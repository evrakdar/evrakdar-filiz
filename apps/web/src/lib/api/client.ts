import { getStoredToken } from "./auth-storage";
import { API_BASE_URL } from "./endpoints";
import type { ApiErrorPayload } from "./types";

type RequestOptions = Omit<RequestInit, "body"> & {
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  authToken?: string | null;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly payload: ApiErrorPayload | null;

  constructor(status: number, message: string, payload: ApiErrorPayload | null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.payload = payload;
  }
}

export async function apiFetch<TResponse>(path: string, options: RequestOptions = {}) {
  const url = buildUrl(path, options.query);
  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  // Explicit token wins; otherwise use the signed-in user's token (browser only).
  const authToken = options.authToken === undefined ? getStoredToken() : options.authToken;

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const hasBody = options.body !== undefined;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    cache: options.cache ?? "no-store",
    headers,
    body: getRequestBody(options.body, isFormData)
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    throw new ApiClientError(response.status, getErrorMessage(payload, response.status), payload);
  }

  return payload as TResponse;
}

function getRequestBody(body: unknown, isFormData: boolean): BodyInit | undefined {
  if (body === undefined) {
    return undefined;
  }

  return isFormData ? (body as FormData) : JSON.stringify(body);
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(path, API_BASE_URL);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

async function parseJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    if (response.ok) {
      return text;
    }

    return null;
  }
}

function getErrorMessage(payload: unknown, status: number) {
  if (isApiErrorPayload(payload)) {
    if (Array.isArray(payload.message)) {
      return payload.message.join(", ");
    }

    if (payload.message) {
      return payload.message;
    }

    if (payload.error) {
      return payload.error;
    }
  }

  return `API request failed with status ${status}`;
}

function isApiErrorPayload(payload: unknown): payload is ApiErrorPayload {
  return typeof payload === "object" && payload !== null;
}
