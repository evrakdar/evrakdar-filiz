import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const MAX_TEXT_LENGTH = 200_000;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_DOCX_UNPACKED_BYTES = 200 * 1024 * 1024;

type ExtractableFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

/**
 * Makes "İÇ TETKİK" and "iç tetkik" match. Dotted and dotless i count as the same letter,
 * because people type them interchangeably when searching.
 */
export function foldSearchText(value: string) {
  return value.toLocaleLowerCase("tr-TR").replace(/ı/g, "i");
}

/**
 * Reads the text of digital PDF, Word (.docx) and plain text files.
 * Scanned documents have no text to read; recognising them needs OCR, which is part of the paid editions.
 */
export async function extractSearchableText(file: ExtractableFile) {
  const text = await readText(file);
  const normalized = foldSearchText(text).replace(/\s+/g, " ").trim();

  return normalized ? normalized.slice(0, MAX_TEXT_LENGTH) : null;
}

/** Adds up the unpacked sizes listed in a zip file's table of contents. An unreadable table counts as too big. */
function zipUnpackedSize(buffer: Buffer) {
  const endRecord = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));

  if (endRecord < 0 || endRecord + 22 > buffer.length) {
    return Number.POSITIVE_INFINITY;
  }

  const entryCount = buffer.readUInt16LE(endRecord + 10);
  let offset = buffer.readUInt32LE(endRecord + 16);
  let total = 0;

  for (let entry = 0; entry < entryCount; entry += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      return Number.POSITIVE_INFINITY;
    }

    total += buffer.readUInt32LE(offset + 24);
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }

  return total;
}

/** A simple page made from a Word file: text, tables and images, without the page layout. */
export async function renderWordPreview(buffer: Buffer) {
  if (zipUnpackedSize(buffer) > MAX_DOCX_UNPACKED_BYTES) {
    throw new Error("Dosya önizleme için çok büyük.");
  }

  return (await mammoth.convertToHtml({ buffer })).value;
}

async function readText({ originalname, mimetype, buffer }: ExtractableFile) {
  const extension = originalname.split(".").pop()?.toLowerCase();

  if (mimetype === "application/pdf" || extension === "pdf") {
    const parser = new PDFParse({ data: buffer });

    try {
      return (await parser.getText({ pageJoiner: "" })).text;
    } finally {
      await parser.destroy();
    }
  }

  if (mimetype === DOCX_MIME || extension === "docx") {
    // A small file can unpack to gigabytes. Such a file is stored but not searched.
    if (zipUnpackedSize(buffer) > MAX_DOCX_UNPACKED_BYTES) {
      return "";
    }

    return (await mammoth.extractRawText({ buffer })).value;
  }

  if (mimetype === "text/plain" || extension === "txt") {
    return buffer.toString("utf8");
  }

  return "";
}
