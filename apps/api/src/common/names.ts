const CONNECTORS = new Set(["ve", "ile", "veya"]);

/**
 * "müdür YARDIMCISI" becomes "Müdür Yardımcısı", with Turkish i and ı handled correctly.
 * For job titles, short capitalised abbreviations such as BT stay as typed and small connecting words stay small.
 */
export function formatTitleCase(value: string, options: { jobTitle?: boolean } = {}) {
  let isFirstWord = true;

  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(/([\s\-./]+)/)
    .map((part) => {
      if (!part || /^[\s\-./]+$/.test(part)) {
        return part;
      }

      const lower = part.toLocaleLowerCase("tr-TR");
      const isFirst = isFirstWord;
      isFirstWord = false;

      if (options.jobTitle) {
        if (!isFirst && CONNECTORS.has(lower)) {
          return lower;
        }

        if (part.length <= 3 && part === part.toLocaleUpperCase("tr-TR") && /\p{L}/u.test(part)) {
          return part;
        }
      }

      return lower.charAt(0).toLocaleUpperCase("tr-TR") + lower.slice(1);
    })
    .join("");
}

/** "Ayşe Nur" gives ["ayse", "nur"]: Turkish letters simplified, anything else dropped. */
export function nameParts(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
