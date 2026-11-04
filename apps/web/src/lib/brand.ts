/**
 * Product and institution names shown in the UI.
 * Override per installation with NEXT_PUBLIC_APP_NAME / NEXT_PUBLIC_ORG_NAME.
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Evrakdar";
export const APP_TAGLINE = "Doküman Yönetimi";
export const ORG_NAME = process.env.NEXT_PUBLIC_ORG_NAME?.trim() || "Örnek Kolej";
export const APP_INITIALS = getInitials(APP_NAME);

function getInitials(value: string) {
  const letters = value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("");

  return (letters.length > 1 ? letters : value.slice(0, 2)).toLocaleUpperCase("tr-TR");
}
