import { config } from "dotenv";
import { resolve } from "node:path";

config({ quiet: true });
config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

const LOCAL_DEVELOPMENT_JWT_SECRET = "local-development-only-jwt-secret";
const PLACEHOLDER_SECRETS = new Set(["", "change-me", "changeme", LOCAL_DEVELOPMENT_JWT_SECRET]);
let warnedAboutDevSecret = false;

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim() ?? "";

  if (!PLACEHOLDER_SECRETS.has(secret) && secret.length >= 32) {
    return secret;
  }

  if (isProduction()) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters in production.");
  }

  if (!warnedAboutDevSecret) {
    warnedAboutDevSecret = true;
    console.warn("[auth] JWT_SECRET is missing or weak; using a development-only secret. Never do this in production.");
  }

  return secret && !PLACEHOLDER_SECRETS.has(secret) ? secret : LOCAL_DEVELOPMENT_JWT_SECRET;
}

export function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN?.trim() || "8h";
}
