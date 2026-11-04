import { BadRequestException } from "@nestjs/common";

type Signature = "pdf" | "zip" | "ole" | "png" | "jpeg" | "text";

/** Every accepted file type: its extension, the type browsers report for it, and what its bytes must look like. */
const uploadTypes: Record<string, { mimeType: string; signature: Signature }> = {
  pdf: { mimeType: "application/pdf", signature: "pdf" },
  doc: { mimeType: "application/msword", signature: "ole" },
  docx: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", signature: "zip" },
  xls: { mimeType: "application/vnd.ms-excel", signature: "ole" },
  xlsx: { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", signature: "zip" },
  ppt: { mimeType: "application/vnd.ms-powerpoint", signature: "ole" },
  pptx: { mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", signature: "zip" },
  txt: { mimeType: "text/plain", signature: "text" },
  png: { mimeType: "image/png", signature: "png" },
  jpg: { mimeType: "image/jpeg", signature: "jpeg" },
  jpeg: { mimeType: "image/jpeg", signature: "jpeg" }
};

function extensionOf(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

/** Extension and reported type must both be accepted and must agree with each other. */
export function isAllowedUploadFile(fileName: string, mimeType: string) {
  return uploadTypes[extensionOf(fileName)]?.mimeType === mimeType;
}

function startsWith(buffer: Buffer, bytes: number[]) {
  return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
}

function matchesSignature(buffer: Buffer, signature: Signature) {
  switch (signature) {
    case "pdf":
      // The PDF format allows some bytes before the header, readers look at the first kilobyte.
      return buffer.subarray(0, 1024).includes("%PDF-");
    case "zip":
      return startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]);
    case "ole":
      return startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case "png":
      return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpeg":
      return startsWith(buffer, [0xff, 0xd8, 0xff]);
    case "text":
      // UTF-16 text legitimately contains zero bytes and starts with a byte order mark.
      return startsWith(buffer, [0xff, 0xfe]) || startsWith(buffer, [0xfe, 0xff]) || !buffer.subarray(0, 8192).includes(0);
  }
}

/** A renamed program is refused here: the name says PDF, the bytes do not. */
export function assertUploadContentMatches(file: { originalname: string; buffer: Buffer }) {
  const type = uploadTypes[extensionOf(file.originalname)];

  if (!type || !matchesSignature(file.buffer, type.signature)) {
    throw new BadRequestException("Dosyanın içeriği türüyle uyuşmuyor. Dosya bozuk ya da adı değiştirilmiş olabilir.");
  }
}
