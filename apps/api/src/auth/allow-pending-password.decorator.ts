import { SetMetadata } from "@nestjs/common";

export const ALLOW_PENDING_PASSWORD_KEY = "allowPendingPassword";

/** Marks a route that stays open while the user still has to change their password. */
export function AllowPendingPassword() {
  return SetMetadata(ALLOW_PENDING_PASSWORD_KEY, true);
}
