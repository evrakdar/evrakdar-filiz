"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createDocumentMetadata,
  getResponsibleOptions,
  ApiClientError,
  getDepartments,
  getFolderChildren,
  getRootFolders,
  uploadDocument,
  type DepartmentDto,
  type DocumentDto,
  type DocumentTypeDto,
  type FolderDto
} from "@/lib/api";
import type { DashboardData, DocumentItem } from "@/lib/data-source";
import { FolderTreeView, type FolderTreeSelection } from "./FolderTreeView";
import type { ResponsibleOptionDto } from "@/lib/api/types";

type Option = {
  id: string;
  label: string;
};

type FolderOption = Option & {
  name: string;
};

type FolderTreeState = {
  rootFolders: FolderOption[];
  childrenByFolderId: Record<string, FolderOption[]>;
  expandedFolderIds: Set<string>;
  loadingFolderIds: Set<string>;
  loadedFolderIds: Set<string>;
  folderPaths: Record<string, string>;
};

type EntryMode = "upload" | "metadata";

const PAPER_DOCUMENT_SIZE = "Kağıt belge";

type DocumentEntryPanelProps = {
  data: DashboardData;
  token: string | null;
  initialFolder?: FolderDto | null;
  onCancel: () => void;
  onCreated: (document: DocumentItem) => void | Promise<void>;
};

const documentTypeOptions: Array<{ value: DocumentTypeDto; label: string }> = [
  { value: "REPORT", label: "Rapor" },
  { value: "PRESENTATION", label: "Sunum" },
  { value: "GUIDE", label: "Kılavuz" },
  { value: "FORM", label: "Form" },
  { value: "MINUTES", label: "Tutanak" },
  { value: "OTHER", label: "Diğer" }
];
const maxUploadSizeBytes = 20 * 1024 * 1024;
const acceptedFileExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "png", "jpg", "jpeg"];
const acceptedFileInput = acceptedFileExtensions.map((extension) => `.${extension}`).join(",");

export function DocumentEntryPanel({ data, token, initialFolder, onCancel, onCreated }: DocumentEntryPanelProps) {
  const [folderTree, setFolderTree] = useState<FolderTreeState>({
    rootFolders: [],
    childrenByFolderId: {},
    expandedFolderIds: new Set(),
    loadingFolderIds: new Set(),
    loadedFolderIds: new Set(),
    folderPaths: {}
  });
  const [selectedFolderLabel, setSelectedFolderLabel] = useState("");
  const [departmentOptions, setDepartmentOptions] = useState<Option[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<EntryMode>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [folderId, setFolderId] = useState("");
  const [documentType, setDocumentType] = useState<DocumentTypeDto>("REPORT");
  const [responsibleDepartmentId, setResponsibleDepartmentId] = useState("");
  const [people, setPeople] = useState<ResponsibleOptionDto[]>([]);
  const [responsiblePersonId, setResponsiblePersonId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [description, setDescription] = useState("");
  const [accessLevel, setAccessLevel] = useState<"DEPARTMENT" | "CONFIDENTIAL">("DEPARTMENT");

  useEffect(() => {
    let isActive = true;

    async function loadOptions() {
      setIsLoadingOptions(true);
      setError(null);

      try {
        const nextFolderOptions =
          data.source === "api" ? await loadApiRootFolderOptions() : getMockRootFolderOptions(data);
        const nextDepartmentOptions =
          data.source === "api" ? await loadApiDepartmentOptions() : getMockDepartmentOptions(data);

        if (!isActive) {
          return;
        }

        setFolderTree({
          rootFolders: nextFolderOptions,
          childrenByFolderId: {},
          expandedFolderIds: new Set(),
          loadingFolderIds: new Set(),
          loadedFolderIds: new Set(),
          folderPaths: Object.fromEntries(nextFolderOptions.map((folder) => [folder.id, folder.name]))
        });
        setDepartmentOptions(nextDepartmentOptions);
        setPeople(data.source === "api" ? (await getResponsibleOptions()).data : []);
        setSelectedFolderLabel((current) => initialFolder?.path ?? (current || nextFolderOptions[0]?.label || ""));
        setResponsibleDepartmentId((current) => current || nextDepartmentOptions[0]?.id || "");
      } catch {
        if (isActive) {
          setError("Klasör veya birim seçenekleri yüklenemedi.");
        }
      } finally {
        if (isActive) {
          setIsLoadingOptions(false);
        }
      }
    }

    loadOptions();

    return () => {
      isActive = false;
    };
  }, [data, initialFolder]);

  const canSubmit = useMemo(
    () =>
      Boolean(name.trim()) &&
      Boolean(folderId) &&
      Boolean(responsibleDepartmentId) &&
      (entryMode !== "upload" || selectedFile !== null) &&
      !isLoadingOptions &&
      !isSubmitting,
    [entryMode, folderId, isLoadingOptions, isSubmitting, name, responsibleDepartmentId, selectedFile]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim() || !folderId || !responsibleDepartmentId) {
      setError("Zorunlu alanları kontrol edin.");
      return;
    }

    if (entryMode === "upload" && !selectedFile) {
      setError("Dosya ile yükleme için dosya seçimi zorunludur.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (data.source === "api") {
        if (!token) {
          throw new Error("Oturum bilgisi bulunamadı.");
        }

        const response =
          entryMode === "upload" && selectedFile
            ? await uploadDocument(buildUploadFormData(selectedFile), token)
            : await createDocumentMetadata(
                {
                  name: name.trim(),
                  folderId,
                  documentType,
                  sizeBytes: 0,
                  responsibleDepartmentId,
                  responsiblePersonId: responsiblePersonId || undefined,
                  validUntil: validUntil || undefined,
                  description: description.trim() || undefined,
                  accessLevel
                },
                token
              );

        setSuccess(entryMode === "upload" ? "Doküman dosya ile yüklendi." : "Kağıt belge kaydedildi.");
        await onCreated(mapApiDocumentToItem(response.data));
        return;
      }

      const departmentLabel =
        departmentOptions.find((department) => department.id === responsibleDepartmentId)?.label ?? "-";

      setSuccess(entryMode === "upload" ? "Örnek dosya kaydı oluşturuldu." : "Örnek kağıt belge kaydı oluşturuldu.");
      await onCreated({
        id: `mock-created-${Date.now()}`,
        itemType: "document",
        name: name.trim(),
        size: entryMode === "upload" && selectedFile ? formatSize(String(selectedFile.size)) : PAPER_DOCUMENT_SIZE,
        date: new Intl.DateTimeFormat("tr-TR").format(new Date()),
        documentType,
        department: departmentLabel,
        responsiblePerson: "Örnek kullanıcı",
        validityDate: validUntil ? formatDate(validUntil) : "-",
        isFavorite: false
      });
    } catch (submitError) {
      if (submitError instanceof ApiClientError && submitError.status === 403) {
        setError("Bu işlem için yetkiniz yok.");
      } else {
        setError(submitError instanceof Error ? submitError.message : "Doküman kaydı oluşturulamadı.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function buildUploadFormData(file: File) {
    const formData = new FormData();

    formData.set("file", file);
    formData.set("name", name.trim());

    if (responsiblePersonId) {
      formData.set("responsiblePersonId", responsiblePersonId);
    }

    formData.set("folderId", folderId);
    formData.set("documentType", documentType);
    formData.set("responsibleDepartmentId", responsibleDepartmentId);
    formData.set("accessLevel", accessLevel);

    if (validUntil) {
      formData.set("validUntil", validUntil);
    }

    if (description.trim()) {
      formData.set("description", description.trim());
    }

    return formData;
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSuccess(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

    if (!acceptedFileExtensions.includes(extension)) {
      setSelectedFile(null);
      setError("Bu dosya türü desteklenmiyor.");
      event.target.value = "";
      return;
    }

    if (file.size > maxUploadSizeBytes) {
      setSelectedFile(null);
      setError("Dosya boyutu 20 MB sınırını aşamaz.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    setError(null);
  }

  async function handleSelectFolder(folder: FolderOption) {
    const folderPath = folderTree.folderPaths[folder.id] ?? folder.name;

    setFolderId(folder.id);
    setSelectedFolderLabel(folderPath);
    setError(null);

    if (folderTree.loadedFolderIds.has(folder.id)) {
      setFolderTree((current) => ({
        ...current,
        expandedFolderIds: toggleSet(current.expandedFolderIds, folder.id)
      }));
      return;
    }

    setFolderTree((current) => ({
      ...current,
      expandedFolderIds: new Set(current.expandedFolderIds).add(folder.id),
      loadingFolderIds: new Set(current.loadingFolderIds).add(folder.id)
    }));

    try {
      const nextFolderOptions =
        data.source === "api"
          ? await loadApiChildFolderOptions(folder.id)
          : getMockChildFolderOptions(data, folder.id);

      setFolderTree((current) => ({
        ...current,
        childrenByFolderId: {
          ...current.childrenByFolderId,
          [folder.id]: nextFolderOptions
        },
        expandedFolderIds: new Set(current.expandedFolderIds).add(folder.id),
        loadingFolderIds: removeFromSet(current.loadingFolderIds, folder.id),
        loadedFolderIds: new Set(current.loadedFolderIds).add(folder.id),
        folderPaths: {
          ...current.folderPaths,
          ...Object.fromEntries(nextFolderOptions.map((child) => [child.id, `${folderPath} / ${child.name}`]))
        }
      }));
    } catch {
      setError("Alt klasörler yüklenemedi.");
      setFolderTree((current) => ({
        ...current,
        loadingFolderIds: removeFromSet(current.loadingFolderIds, folder.id)
      }));
    }
  }

  function handleSelectApiTreeFolder(folder: FolderTreeSelection | null) {
    if (!folder) {
      setFolderId("");
      setSelectedFolderLabel("Ana dizin");
      return;
    }

    setFolderId(folder.id);
    setSelectedFolderLabel(folder.path || folder.name);
    setError(null);
  }

  function handleOpenRootFolders() {
    setError(null);
    setFolderTree((current) => ({
      ...current,
      expandedFolderIds: new Set()
    }));

    const firstRoot = folderTree.rootFolders[0];
    if (firstRoot) {
      setFolderId(firstRoot.id);
      setSelectedFolderLabel(firstRoot.name);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-800 dark:text-brand-300">Sol menü</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Veri Girişi
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Dosyayı yükleyin. Dosyası olmayan, dolapta duran bir belgeyse kağıt belge olarak kaydedin.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="w-fit rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Ana Sayfa
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-5 rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        {success ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            {success}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Kayıt türü</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <input
                checked={entryMode === "upload"}
                onChange={() => setEntryMode("upload")}
                type="radio"
                name="document-entry-mode"
                className="mt-1 h-4 w-4 text-brand-800 dark:text-brand-300"
              />
              <span>
                <span className="block font-medium text-zinc-900 dark:text-zinc-50">Dosya ile doküman yükle</span>
                <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                  Dosya depoya kaydedilir, bilgileri sisteme yazılır.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <input
                checked={entryMode === "metadata"}
                onChange={() => setEntryMode("metadata")}
                type="radio"
                name="document-entry-mode"
                className="mt-1 h-4 w-4 text-brand-800 dark:text-brand-300"
              />
              <span>
                <span className="block font-medium text-zinc-900 dark:text-zinc-50">Kağıt belge (dosya yok)</span>
                <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                  Dolaptaki belgeyi sisteme yazar. Aramada ve tarih takibinde görünür, dosyası sonra eklenebilir.
                </span>
              </span>
            </label>
          </div>
        </div>

        {entryMode === "upload" ? (
          <Field label="Dosya seçimi" htmlFor="document-entry-file">
            <input
              id="document-entry-file"
              onChange={handleFileChange}
              accept={acceptedFileInput}
              required
              type="file"
              className="rounded-md border border-dashed border-zinc-300 bg-white px-3 py-3 text-sm outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-brand-800 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:border-brand-800 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              PDF, Word, Excel, PowerPoint, PNG veya JPG. Maksimum 20 MB.
            </span>
            {selectedFile ? (
              <span className="rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                Seçilen dosya: {selectedFile.name} · {formatSize(String(selectedFile.size))}
              </span>
            ) : null}
          </Field>
        ) : null}

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Field label="Doküman adı" htmlFor="document-entry-name">
            <input
              id="document-entry-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-brand-800 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </Field>

          <Field label="Klasör seçimi" htmlFor="document-entry-folder">
            <input
              id="document-entry-folder"
              value={selectedFolderLabel || "Klasör seçilmedi"}
              readOnly
              required
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-brand-800 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-zinc-500 dark:text-zinc-400">Konum:</span>
                <button
                  type="button"
                  onClick={handleOpenRootFolders}
                  className="font-semibold text-brand-800 dark:text-brand-300 hover:underline"
                >
                  Ana dizin
                </button>
                <span className="text-zinc-600 dark:text-zinc-300">{selectedFolderLabel || "Klasör seçilmedi"}</span>
              </div>
              {data.source === "api" ? (
                <FolderTreeView
                  selectedFolderId={folderId || null}
                  onSelectFolder={handleSelectApiTreeFolder}
                  showRoot={false}
                  className="border-0 bg-transparent p-0 dark:bg-transparent"
                />
              ) : isLoadingOptions ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Klasörler yükleniyor...</p>
              ) : folderTree.rootFolders.length > 0 ? (
                <FolderTree
                  folders={folderTree.rootFolders}
                  tree={folderTree}
                  selectedFolderId={folderId}
                  onSelectFolder={handleSelectFolder}
                />
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Klasör bulunamadı.
                </p>
              )}
              {folderId && folderTree.loadedFolderIds.has(folderId) && (folderTree.childrenByFolderId[folderId]?.length ?? 0) === 0 ? (
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Seçili klasörün altında alt klasör yok. Hedef olarak bu klasör kullanılacak.
                </p>
              ) : null}
            </div>
          </Field>

          <Field label="Doküman türü" htmlFor="document-entry-type">
            <select
              id="document-entry-type"
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as DocumentTypeDto)}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-brand-800 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {documentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Sorumlu birim" htmlFor="document-entry-department">
            <select
              id="document-entry-department"
              value={responsibleDepartmentId}
              onChange={(event) => setResponsibleDepartmentId(event.target.value)}
              required
              disabled={isLoadingOptions}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-brand-800 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {departmentOptions.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Sorumlu kişi" htmlFor="document-entry-person">
            <select
              id="document-entry-person"
              value={responsiblePersonId}
              onChange={(event) => setResponsiblePersonId(event.target.value)}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-brand-800 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">Ben</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.department ? `${person.name} (${person.department})` : person.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Geçerlilik tarihi" htmlFor="document-entry-valid-until">
            <input
              id="document-entry-valid-until"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              type="date"
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-brand-800 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </Field>

          <Field label="Erişim" htmlFor="document-entry-access-level">
            <select
              id="document-entry-access-level"
              value={accessLevel}
              onChange={(event) => setAccessLevel(event.target.value as "DEPARTMENT" | "CONFIDENTIAL")}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-brand-800 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="DEPARTMENT">Kurum içi (tüm kullanıcılar)</option>
              <option value="CONFIDENTIAL">Gizli (yalnız sorumlu birim ve yöneticiler)</option>
            </select>
          </Field>
        </div>

        <Field label="Açıklama" htmlFor="document-entry-description">
          <textarea
            id="document-entry-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-800 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </Field>

        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {entryMode === "upload"
              ? "Dosya depoya yüklenecek ve belge kaydı oluşturulacak."
              : "Dosya istenmez. Belgenin bilgileri kaydedilir."}
          </p>
          <button
            disabled={!canSubmit}
            type="submit"
            className="rounded-md bg-brand-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Kaydediliyor..."
              : entryMode === "upload"
                ? "Dosya ile doküman yükle"
                : "Kağıt belgeyi kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FolderTree({
  folders,
  onSelectFolder,
  selectedFolderId,
  tree,
  depth = 0
}: {
  folders: FolderOption[];
  onSelectFolder: (folder: FolderOption) => void;
  selectedFolderId: string;
  tree: FolderTreeState;
  depth?: number;
}) {
  return (
    <div className="grid gap-1">
      {folders.map((folder) => {
        const isSelected = selectedFolderId === folder.id;
        const isExpanded = tree.expandedFolderIds.has(folder.id);
        const isLoading = tree.loadingFolderIds.has(folder.id);
        const isLoaded = tree.loadedFolderIds.has(folder.id);
        const childFolders = tree.childrenByFolderId[folder.id] ?? [];

        return (
          <div key={folder.id} className="grid gap-1">
            <button
              type="button"
              aria-label={folder.name}
              onClick={() => onSelectFolder(folder)}
              className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                isSelected
                  ? "border-brand-800 bg-brand-50 text-brand-900 dark:bg-brand-950/30 dark:text-brand-100"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-brand-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
              style={{ marginLeft: depth * 16 }}
            >
              <span aria-hidden="true" className="mr-2 inline-block w-4 text-center text-xs text-zinc-500">
                {isLoading ? "..." : isExpanded ? "−" : "+"}
              </span>
              {folder.name}
            </button>
            {isExpanded && childFolders.length > 0 ? (
              <FolderTree
                folders={childFolders}
                tree={tree}
                selectedFolderId={selectedFolderId}
                onSelectFolder={onSelectFolder}
                depth={depth + 1}
              />
            ) : null}
            {isExpanded && isLoaded && childFolders.length === 0 ? (
              <p
                className="rounded-md border border-dashed border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
                style={{ marginLeft: (depth + 1) * 16 }}
              >
                Alt klasör yok.
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Field({
  children,
  htmlFor,
  label
}: {
  children: React.ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="grid gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

function toggleSet(values: Set<string>, value: string) {
  const next = new Set(values);

  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }

  return next;
}

function removeFromSet(values: Set<string>, value: string) {
  const next = new Set(values);
  next.delete(value);

  return next;
}

async function loadApiRootFolderOptions() {
  const roots = (await getRootFolders()).data;

  return roots.map(mapFolderToOption);
}

async function loadApiChildFolderOptions(folderId: string) {
  const children = (await getFolderChildren(folderId)).data.folders;

  return children.map(mapFolderToOption);
}

function mapFolderToOption(folder: FolderDto): FolderOption {
  return {
    id: folder.id,
    name: folder.name,
    label: folder.name
  };
}

async function loadApiDepartmentOptions() {
  const departments = (await getDepartments()).data;

  return departments.map((department: DepartmentDto) => ({
    id: department.id,
    label: `${department.code} - ${department.name}`
  }));
}

function getMockRootFolderOptions(data: DashboardData): FolderOption[] {
  return data.mainCategories.map((category) => ({
    id: category.id,
    name: category.title,
    label: category.title
  }));
}

function getMockChildFolderOptions(data: DashboardData, folderId: string): FolderOption[] {
  const category = data.mainCategories.find((item) => item.id === folderId);

  if (!category) {
    return [];
  }

  return category.subCategories.map((subCategory) => ({
    id: subCategory.id,
    name: subCategory.title,
    label: subCategory.title
  }));
}

function getMockDepartmentOptions(data: DashboardData) {
  const departments = Array.from(new Set(data.documents.map((document) => document.department))).filter(Boolean);

  return departments.length > 0
    ? departments.map((department, index) => ({
        id: `mock-department-${index}`,
        label: department
      }))
    : [{ id: "mock-department", label: data.currentUser.department }];
}

function mapApiDocumentToItem(document: DocumentDto): DocumentItem {
  return {
    id: document.id,
    itemType: "document",
    name: document.name,
    size: document.storageBucket === "metadata-only" ? PAPER_DOCUMENT_SIZE : formatSize(document.sizeBytes),
    date: formatDate(document.createdAt),
    documentType: document.documentType,
    department: document.responsibleDepartment?.name ?? "-",
    responsiblePerson: document.responsibleUser
      ? `${document.responsibleUser.firstName} ${document.responsibleUser.lastName}`
      : "-",
    validityDate: document.validUntil ? formatDate(document.validUntil) : "-",
    isFavorite: false,
    originalFileName: document.originalFileName,
    mimeType: document.mimeType,
    storageBucket: document.storageBucket,
    storageKey: document.storageKey,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR").format(new Date(value));
}

function formatSize(value: string) {
  const size = Number(value);

  if (!Number.isFinite(size)) {
    return value;
  }

  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${size} B`;
}
