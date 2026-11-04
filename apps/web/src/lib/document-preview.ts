export type PreviewKind = "pdf" | "image" | "text" | "office" | "none";

const OFFICE_EXTENSIONS = new Set(["docx"]);

export function getPreviewKind(mimeType: string | null | undefined, fileName: string): PreviewKind {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (mimeType === "application/pdf" || extension === "pdf") {
    return "pdf";
  }

  if (mimeType === "image/png" || mimeType === "image/jpeg" || ["png", "jpg", "jpeg"].includes(extension)) {
    return "image";
  }

  if (mimeType === "text/plain" || extension === "txt") {
    return "text";
  }

  return OFFICE_EXTENSIONS.has(extension) ? "office" : "none";
}

/** Old Windows text files are not UTF-8: they are read as Turkish Windows text instead of showing broken letters. */
export async function readTextFile(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes);
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1254").decode(bytes);
  }
}
