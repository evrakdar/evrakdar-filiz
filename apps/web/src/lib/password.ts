export const PASSWORD_RULE_TEXT = "En az 9 karakter; en az bir büyük harf, bir küçük harf, bir rakam ve bir sembol.";

// Letters that look alike are left out, because these passwords get read out and typed by hand.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*?+-=";

export function isStrongPassword(password: string) {
  return (
    Array.from(password).length >= 9 &&
    /\p{Lu}/u.test(password) &&
    /\p{Ll}/u.test(password) &&
    /\p{Nd}/u.test(password) &&
    /[^\p{L}\p{N}\s]/u.test(password)
  );
}

function randomBelow(limit: number) {
  const ceiling = Math.floor(0x100000000 / limit) * limit;
  const value = new Uint32Array(1);

  do {
    crypto.getRandomValues(value);
  } while (value[0] >= ceiling);

  return value[0] % limit;
}

function pick(characters: string) {
  return characters[randomBelow(characters.length)];
}

export function generatePassword(length = 13) {
  const everything = UPPER + LOWER + DIGITS + SYMBOLS;
  const characters = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];

  while (characters.length < length) {
    characters.push(pick(everything));
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const other = randomBelow(index + 1);
    [characters[index], characters[other]] = [characters[other], characters[index]];
  }

  return characters.join("");
}
