import type { AuthUserDto, LoginResponseDto } from "./auth";

export const AUTH_TOKEN_STORAGE_KEY = "evrakdar_access_token";
export const AUTH_USER_STORAGE_KEY = "evrakdar_user";

export function getStoredToken() {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function getStoredUser() {
  if (!canUseStorage()) {
    return null;
  }

  const storedUser = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    const user = JSON.parse(storedUser);
    return isAuthUser(user) ? user : null;
  } catch {
    return null;
  }
}

export function setStoredAuth(auth: LoginResponseDto) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, auth.accessToken);
  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(auth.user));
}

export function clearStoredAuth() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
}

function canUseStorage() {
  return typeof window !== "undefined";
}

function isAuthUser(value: unknown): value is AuthUserDto {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const user = value as Partial<AuthUserDto>;

  return (
    typeof user.id === "string" &&
    typeof user.username === "string" &&
    typeof user.firstName === "string" &&
    typeof user.lastName === "string" &&
    typeof user.email === "string" &&
    Array.isArray(user.roles)
  );
}
