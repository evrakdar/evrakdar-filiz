import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Marks a route as reachable without a bearer token. Everything else requires login. */
export function Public() {
  return SetMetadata(IS_PUBLIC_KEY, true);
}
