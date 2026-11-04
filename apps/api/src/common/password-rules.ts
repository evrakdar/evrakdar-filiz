import { BadRequestException } from "@nestjs/common";

export const PASSWORD_RULE_MESSAGE =
  "Şifre en az 9 karakter olmalı; en az bir büyük harf, bir küçük harf, bir rakam ve bir sembol içermeli.";

/** Bcrypt ignores whatever comes after 72 bytes, so a longer password would not protect more. */
const MAX_PASSWORD_BYTES = 72;

export function isStrongPassword(password: string) {
  return (
    Array.from(password).length >= 9 &&
    /\p{Lu}/u.test(password) &&
    /\p{Ll}/u.test(password) &&
    /\p{Nd}/u.test(password) &&
    /[^\p{L}\p{N}\s]/u.test(password)
  );
}

export function assertStrongPassword(password: string) {
  if (!isStrongPassword(password)) {
    throw new BadRequestException(PASSWORD_RULE_MESSAGE);
  }

  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    throw new BadRequestException("Şifre çok uzun.");
  }
}
