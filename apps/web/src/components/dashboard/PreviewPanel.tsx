"use client";

import { getDocumentTypeLabel } from "@/lib/document-labels";
import { getPreviewKind, readTextFile, type PreviewKind } from "@/lib/document-preview";

import { useEffect, useMemo, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import {
  downloadDocumentFileBlob,
  downloadDocumentVersionFileBlob,
  getDocumentFileBlob,
  getDocumentPreviewHtml,
  getDocumentVersions,
  uploadDocumentVersion
} from "@/lib/api";
import { getStoredToken, getStoredUser } from "@/lib/api/auth-storage";
import type { DocumentVersionDto } from "@/lib/api/types";
import type { DocumentItem } from "@/lib/mock-data";
import { DocumentEditDialog } from "./DocumentEditDialog";

type PreviewPanelProps = {
  document: DocumentItem;
  onClose: () => void;
  onDocumentChanged?: (documentId: string) => void | Promise<void>;
};

export function PreviewPanel({ document, onClose, onDocumentChanged }: PreviewPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [versions, setVersions] = useState<DocumentVersionDto[]>([]);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);
  const canEditDocument = Boolean(
    typeof window !== "undefined" && getStoredUser()?.roles.some((role) => role === "ADMIN" || role === "EDITOR")
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasStoredFile = Boolean(document.storageKey && document.storageBucket && document.storageBucket !== "metadata-only");
  const fileName = document.originalFileName || document.name;
  const previewKind = useMemo(
    () => getPreviewKind(document.mimeType, document.originalFileName ?? document.name),
    [document]
  );

  useEffect(() => {
    let isActive = true;
    let objectUrl: string | null = null;

    setPreviewUrl(null);
    setPreviewText(null);
    setPreviewHtml(null);
    setPreviewError(null);
    setActionMessage(null);
    setActionError(null);

    if (!hasStoredFile || previewKind === "none") {
      return () => {
        isActive = false;
      };
    }

    const token = getStoredToken();

    if (!token) {
      setPreviewError("Dosya önizlemesi için oturum bilgisi bulunamadı.");
      return () => {
        isActive = false;
      };
    }

    setIsPreviewLoading(true);

    if (previewKind === "office") {
      getDocumentPreviewHtml(document.id, token)
        .then((response) => {
          if (isActive) {
            setPreviewHtml(response.data.html);
          }
        })
        .catch((error: unknown) => {
          if (isActive) {
            setPreviewError(error instanceof Error ? error.message : "Dosya önizlemesi yüklenemedi.");
          }
        })
        .finally(() => {
          if (isActive) {
            setIsPreviewLoading(false);
          }
        });

      return () => {
        isActive = false;
      };
    }

    getDocumentFileBlob(document.id, token)
      .then(async (blob) => {
        if (previewKind === "text") {
          const text = await readTextFile(blob);

          if (isActive) {
            setPreviewText(text);
          }

          return;
        }

        objectUrl = URL.createObjectURL(blob);

        if (isActive) {
          setPreviewUrl(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setPreviewError(error instanceof Error ? error.message : "Dosya önizlemesi yüklenemedi.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsPreviewLoading(false);
        }
      });

    return () => {
      isActive = false;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [document.id, document.storageKey, hasStoredFile, previewKind]);

  useEffect(() => {
    let isActive = true;
    const token = getStoredToken();

    setVersions([]);
    setNewVersionFile(null);

    if (!token) {
      return () => {
        isActive = false;
      };
    }

    getDocumentVersions(document.id, token)
      .then((response) => {
        if (isActive) {
          setVersions(response.data);
        }
      })
      .catch(() => {
        if (isActive) {
          setVersions([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, [document.id, document.storageKey]);

  async function handleDownload() {
    setActionMessage(null);
    setActionError(null);

    if (!hasStoredFile) {
      setActionError("Bu kayıt için dosya yok.");
      return;
    }

    const token = getStoredToken();

    if (!token) {
      setActionError("Dosya indirmek için oturum bilgisi bulunamadı.");
      return;
    }

    try {
      const blob = await downloadDocumentFileBlob(document.id, token);
      downloadBlob(blob, fileName);
      setActionMessage("İndirme başlatıldı.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Dosya indirilemedi.");
    }
  }

  async function handleVersionDownload(version: DocumentVersionDto) {
    setActionMessage(null);
    setActionError(null);

    const token = getStoredToken();

    if (!token) {
      setActionError("Dosya indirmek için oturum bilgisi bulunamadı.");
      return;
    }

    try {
      const blob = await downloadDocumentVersionFileBlob(document.id, version.id, token);
      downloadBlob(blob, version.originalFileName ?? fileName);
      setActionMessage(`${version.versionNo}. sürüm indiriliyor.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Sürüm indirilemedi.");
    }
  }

  async function handleNewVersionUpload() {
    setActionMessage(null);
    setActionError(null);

    const token = getStoredToken();

    if (!token || !newVersionFile) {
      setActionError("Önce bir dosya seçin.");
      return;
    }

    const formData = new FormData();
    formData.set("file", newVersionFile);
    setIsUploadingVersion(true);

    try {
      await uploadDocumentVersion(document.id, formData, token);
      setNewVersionFile(null);
      setActionMessage("Yeni dosya yüklendi. Eski sürüm saklandı.");
      await onDocumentChanged?.(document.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Dosya yüklenemedi.");
    } finally {
      setIsUploadingVersion(false);
    }
  }

  async function handleShare() {
    setActionMessage(null);
    setActionError(null);

    if (!navigator.clipboard) {
      setActionError("Tarayıcı pano erişimini desteklemiyor.");
      return;
    }

    try {
      const url = new URL(window.location.href);
      url.pathname = "/dashboard";
      url.searchParams.set("documentId", document.id);
      await navigator.clipboard.writeText(url.toString());
      setActionMessage("Bağlantı panoya kopyalandı.");
    } catch {
      setActionError("Bağlantı panoya kopyalanamadı.");
    }
  }

  return (
    <aside className="fixed inset-x-0 bottom-0 z-30 flex max-h-[85vh] w-full flex-col rounded-t-lg border-t border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 xl:sticky xl:top-0 xl:h-screen xl:max-h-screen xl:w-[380px] xl:shrink-0 xl:rounded-none xl:border-l xl:border-t-0 xl:shadow-none">
      <div className="flex items-start justify-between border-b border-zinc-200 p-5 dark:border-zinc-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-300">Önizleme</p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">Dosya bilgileri</h2>
        </div>
        <button
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          aria-label="Önizleme panelini kapat"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Dosya adı</p>
          <h3 className="mt-1 text-base font-semibold leading-6 text-zinc-950 dark:text-zinc-50">{document.name}</h3>
          {hasStoredFile && document.originalFileName ? (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Orijinal dosya: {document.originalFileName}</p>
          ) : null}
        </div>

        <div className="mt-5 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950">
          {renderPreviewContent({ hasStoredFile, previewKind, isPreviewLoading, previewError, previewUrl, previewText, previewHtml })}
        </div>

        <dl className="mt-5 grid gap-4 text-sm">
          <PreviewMeta label="Doküman türü" value={getDocumentTypeLabel(document.documentType)} />
          <PreviewMeta label="Sorumlu birim" value={document.department} />
          <PreviewMeta label="Sorumlu kişi" value={document.responsiblePerson} />
          <PreviewMeta label="Güncelleme / geçerlilik tarihi" value={document.validityDate} />
        </dl>


        <section aria-label="Sürümler" className="mt-6 rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Sürümler</h3>
          <div className="mt-3 grid gap-2">
            {versions.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Bu kayıtta henüz dosya yok.</p>
            ) : (
              versions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {version.versionNo}. sürüm{version.isActive ? " (güncel)" : ""}
                    </p>
                    <p className="mt-1 truncate text-zinc-500 dark:text-zinc-400">
                      {new Intl.DateTimeFormat("tr-TR").format(new Date(version.createdAt))}
                      {version.createdBy ? ` · ${version.createdBy.firstName} ${version.createdBy.lastName}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleVersionDownload(version)}
                    aria-label={`${version.versionNo}. sürümü indir`}
                    className="shrink-0 rounded-md border border-zinc-200 px-2 py-1 font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    İndir
                  </button>
                </div>
              ))
            )}
          </div>

          {canEditDocument ? (
            <div className="mt-4 rounded-md border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                {hasStoredFile ? "Dosyayı yenisiyle değiştir (eskisi saklanır)" : "Bu kayda dosya ekle"}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
                  onChange={(event) => setNewVersionFile(event.target.files?.[0] ?? null)}
                  className="mt-2 block w-full text-xs text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white dark:text-zinc-300"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleNewVersionUpload()}
                disabled={!newVersionFile || isUploadingVersion}
                className="mt-3 w-full rounded-md bg-brand-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploadingVersion ? "Yükleniyor..." : "Dosyayı yükle"}
              </button>
            </div>
          ) : null}
        </section>
      </div>

      <div className="grid gap-2 border-t border-zinc-200 p-5 dark:border-zinc-800">
        {actionMessage ? <SuccessLine>{actionMessage}</SuccessLine> : null}
        {actionError ? <ErrorLine>{actionError}</ErrorLine> : null}
        {canEditDocument ? (
          <button
            onClick={() => setIsEditing(true)}
            className="rounded-md border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Bilgileri Düzenle
          </button>
        ) : null}
        <button
          onClick={handleDownload}
          disabled={!hasStoredFile}
          className="flex items-center justify-center gap-2 rounded-md bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          İndir
        </button>
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Share2 className="h-4 w-4" />
          Paylaş
        </button>
      </div>
      {isEditing ? (
        <DocumentEditDialog
          documentId={document.id}
          onClose={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            setActionMessage("Belge bilgileri güncellendi.");
            void onDocumentChanged?.(document.id);
          }}
        />
      ) : null}
    </aside>
  );
}

function PreviewMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}

function ErrorLine({ children }: { children: string }) {
  return (
    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {children}
    </p>
  );
}

function SuccessLine({ children }: { children: string }) {
  return (
    <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
      {children}
    </p>
  );
}

function renderPreviewContent({
  hasStoredFile,
  previewKind,
  isPreviewLoading,
  previewError,
  previewUrl,
  previewText,
  previewHtml
}: {
  hasStoredFile: boolean;
  previewKind: PreviewKind;
  isPreviewLoading: boolean;
  previewError: string | null;
  previewUrl: string | null;
  previewText: string | null;
  previewHtml: string | null;
}) {
  if (!hasStoredFile) {
    return <PreviewMessage title="Bu belgenin dosyası yok" description="Bu bir kağıt belge kaydı. Dosyası eklenince burada görünür." />;
  }

  if (previewKind === "none") {
    return <PreviewMessage title="Bu dosya burada açılmıyor" description="Dosyayı indirip bilgisayarınızda açabilirsiniz." />;
  }

  if (isPreviewLoading) {
    return <PreviewMessage title="Dosya hazırlanıyor" description="Birkaç saniye sürebilir." />;
  }

  if (previewError) {
    return <PreviewMessage title="Önizleme açılamadı" description={previewError} />;
  }

  if (previewText !== null) {
    return (
      <pre className="h-[420px] w-full overflow-auto whitespace-pre-wrap break-words rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
        {previewText}
      </pre>
    );
  }

  if (previewHtml !== null) {
    // The sandbox stops anything inside a document from running or reaching this page.
    return (
      <iframe
        sandbox=""
        srcDoc={`<!doctype html><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#18181b;margin:16px}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #d4d4d8;padding:4px}</style>${previewHtml}`}
        title="Belge önizleme"
        className="h-[420px] w-full rounded-md border border-zinc-200 bg-white dark:border-zinc-800"
      />
    );
  }

  if (!previewUrl) {
    return <PreviewMessage title="Dosya hazırlanıyor" description="Birkaç saniye sürebilir." />;
  }

  if (previewKind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={previewUrl} alt="Belge görseli" className="max-h-[420px] w-full rounded-md border border-zinc-200 bg-white object-contain dark:border-zinc-800" />
    );
  }

  return (
    <iframe
      src={previewUrl}
      title="Belge önizleme"
      className="h-[420px] w-full rounded-md border border-zinc-200 bg-white dark:border-zinc-800"
    />
  );
}

function PreviewMessage({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid aspect-[4/3] place-items-center rounded-md bg-white p-4 text-center text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
      <div>
        <p className="font-medium text-zinc-700 dark:text-zinc-200">{title}</p>
        <p className="mt-2 text-xs">{description}</p>
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = window.document.createElement("a");

  link.href = objectUrl;
  link.download = fileName;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
