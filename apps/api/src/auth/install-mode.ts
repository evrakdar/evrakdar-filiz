export const DEFAULT_PASSWORD = "1234";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * True only while the system can be reached from this computer alone.
 * Anything unclear counts as open to the network, so the safe behaviour wins.
 */
export function isLocalOnlyInstall() {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  if (process.env.TRUST_PROXY?.trim()) {
    return false;
  }

  const bindHost = (process.env.API_BIND?.trim() ?? "").replace(/:\d+$/, "");
  const origins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return LOCAL_HOSTS.has(bindHost) && origins.length > 0 && origins.every(isLocalOrigin);
}

/**
 * While the default password is possible, the API answers only under its local names.
 * Otherwise a web page could point its own domain at this computer and talk to the API as if it were its own site.
 */
export function isAcceptedHost(hostHeader: string | undefined) {
  if (!isLocalOnlyInstall()) {
    return true;
  }

  const hostname = (hostHeader ?? "").trim().toLowerCase().replace(/:\d+$/, "");

  return LOCAL_HOSTS.has(hostname);
}

function isLocalOrigin(origin: string) {
  try {
    return LOCAL_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}
