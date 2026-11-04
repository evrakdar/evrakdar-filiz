const documentTypeLabels: Record<string, string> = {
  REPORT: "Rapor",
  PRESENTATION: "Sunum",
  GUIDE: "Kılavuz",
  FORM: "Form",
  MINUTES: "Tutanak",
  OTHER: "Diğer"
};

export function getDocumentTypeLabel(documentType: string) {
  return documentTypeLabels[documentType] ?? documentType;
}
