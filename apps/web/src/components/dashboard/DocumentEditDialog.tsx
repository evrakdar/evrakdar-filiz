"use client";

import { useEffect, useState } from "react";
import { getDepartments, getDocumentById, getResponsibleOptions, updateDocument, type DepartmentDto } from "@/lib/api";
import { getStoredToken } from "@/lib/api/auth-storage";
import type { DocumentTypeDto, ResponsibleOptionDto } from "@/lib/api/types";

type DocumentEditDialogProps = {
  documentId: string;
  onClose: () => void;
  onSaved: () => void;
};

const documentTypeOptions: Array<{ value: DocumentTypeDto; label: string }> = [
  { value: "REPORT", label: "Rapor" },
  { value: "PRESENTATION", label: "Sunum" },
  { value: "GUIDE", label: "Kılavuz" },
  { value: "FORM", label: "Form" },
  { value: "MINUTES", label: "Tutanak" },
  { value: "OTHER", label: "Diğer" }
];

const fieldClass =
  "mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-brand-950";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-200";

export function DocumentEditDialog({ documentId, onClose, onSaved }: DocumentEditDialogProps) {
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [name, setName] = useState("");
  const [documentType, setDocumentType] = useState<DocumentTypeDto>("REPORT");
  const [departmentId, setDepartmentId] = useState("");
  const [people, setPeople] = useState<ResponsibleOptionDto[]>([]);
  const [personId, setPersonId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [accessLevel, setAccessLevel] = useState<"DEPARTMENT" | "CONFIDENTIAL">("DEPARTMENT");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    Promise.all([getDocumentById(documentId), getDepartments(), getResponsibleOptions()])
      .then(([documentResponse, departmentResponse, peopleResponse]) => {
        if (!isActive) {
          return;
        }

        const document = documentResponse.data;
        const tags = (document.tags ?? {}) as { description?: string | null };

        setDepartments(departmentResponse.data);
        setName(document.name);
        setDocumentType(document.documentType);
        setDepartmentId(document.responsibleDepartment?.id ?? departmentResponse.data[0]?.id ?? "");
        setPeople(peopleResponse.data);
        setPersonId(document.responsibleUser?.id ?? "");
        setValidUntil(document.validUntil ? document.validUntil.slice(0, 10) : "");
        setAccessLevel(document.accessLevel === "CONFIDENTIAL" ? "CONFIDENTIAL" : "DEPARTMENT");
        setDescription(tags.description ?? "");
      })
      .catch((loadError: unknown) => {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : "Belge bilgileri yüklenemedi.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [documentId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const token = getStoredToken();

    if (!token) {
      setError("Oturum bulunamadı. Lütfen yeniden giriş yapın.");
      return;
    }

    setIsSaving(true);

    try {
      await updateDocument(
        documentId,
        {
          name: name.trim(),
          documentType,
          responsibleDepartmentId: departmentId || undefined,
          responsiblePersonId: personId || undefined,
          validUntil: validUntil || null,
          accessLevel,
          description: description.trim() || null
        },
        token
      );
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Belge bilgileri kaydedilemedi.");
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-zinc-950/60 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Belge bilgileri"
        className="w-full max-w-lg space-y-4 rounded-md border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Bilgileri düzenle</h2>

        {isLoading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Bilgiler yükleniyor...</p>
        ) : (
          <>
            <label className={labelClass}>
              Belge adı
              <input required value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Belge türü
                <select
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value as DocumentTypeDto)}
                  className={fieldClass}
                >
                  {documentTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Sorumlu birim
                <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className={fieldClass}>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Sorumlu kişi
                <select value={personId} onChange={(event) => setPersonId(event.target.value)} className={fieldClass}>
                  {personId ? null : <option value="">Seçilmedi</option>}
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.department ? `${person.name} (${person.department})` : person.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Geçerlilik tarihi
                <input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} className={fieldClass} />
              </label>
              <label className={labelClass}>
                Erişim
                <select
                  value={accessLevel}
                  onChange={(event) => setAccessLevel(event.target.value as "DEPARTMENT" | "CONFIDENTIAL")}
                  className={fieldClass}
                >
                  <option value="DEPARTMENT">Kurum içi (tüm kullanıcılar)</option>
                  <option value="CONFIDENTIAL">Gizli (yalnız sorumlu birim ve yöneticiler)</option>
                </select>
              </label>
            </div>
            <label className={labelClass}>
              Açıklama
              <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className={fieldClass} />
            </label>
          </>
        )}

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={isLoading || isSaving}
            className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
