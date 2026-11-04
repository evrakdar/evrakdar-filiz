import { X } from "lucide-react";
import type { DepartmentDto, DocumentTypeDto } from "@/lib/api";

export type SearchFilters = {
  size: "" | "lt-1mb" | "1mb-3mb" | "gt-5mb";
  validUntilFrom: string;
  validUntilTo: string;
  documentType: "" | DocumentTypeDto;
  fileType: string;
  departmentId: string;
};

export const emptySearchFilters: SearchFilters = {
  size: "",
  validUntilFrom: "",
  validUntilTo: "",
  documentType: "",
  fileType: "",
  departmentId: ""
};

type FiltersBarProps = {
  filters: SearchFilters;
  departments?: DepartmentDto[];
  onFiltersChange: (filters: SearchFilters) => void;
};

const documentTypes: Array<{ value: SearchFilters["documentType"]; label: string }> = [
  { value: "", label: "Tümü" },
  { value: "REPORT", label: "Rapor" },
  { value: "PRESENTATION", label: "Sunum" },
  { value: "GUIDE", label: "Kılavuz" },
  { value: "FORM", label: "Form" },
  { value: "MINUTES", label: "Tutanak" },
  { value: "OTHER", label: "Diğer" }
];

const fileTypes: Array<{ value: string; label: string }> = [
  { value: "", label: "Tümü" },
  { value: "PDF", label: "PDF" },
  { value: "WORD", label: "Word" },
  { value: "EXCEL", label: "Excel" },
  { value: "POWERPOINT", label: "PowerPoint" },
  { value: "TEXT", label: "Metin" },
  { value: "IMAGE", label: "Resim" }
];

const sizeFilters: Array<{ value: SearchFilters["size"]; label: string }> = [
  { value: "", label: "Tümü" },
  { value: "lt-1mb", label: "Boyut < 1 MB" },
  { value: "1mb-3mb", label: "1 MB < Boyut < 3 MB" },
  { value: "gt-5mb", label: "5 MB < Boyut" }
];

export function FiltersBar({ filters, departments = [], onFiltersChange }: FiltersBarProps) {
  function updateFilter(nextFilters: Partial<SearchFilters>) {
    onFiltersChange({ ...filters, ...nextFilters });
  }

  const chosen: Array<{ label: string; value: string; clear: Partial<SearchFilters> }> = [];

  if (filters.size) {
    chosen.push({ label: "Boyut", value: sizeFilters.find((item) => item.value === filters.size)?.label ?? filters.size, clear: { size: "" } });
  }

  if (filters.validUntilFrom) {
    chosen.push({ label: "Başlangıç", value: formatDay(filters.validUntilFrom), clear: { validUntilFrom: "" } });
  }

  if (filters.validUntilTo) {
    chosen.push({ label: "Bitiş", value: formatDay(filters.validUntilTo), clear: { validUntilTo: "" } });
  }

  if (filters.documentType) {
    chosen.push({ label: "Doküman türü", value: documentTypes.find((item) => item.value === filters.documentType)?.label ?? "", clear: { documentType: "" } });
  }

  if (filters.fileType) {
    chosen.push({ label: "Dosya türü", value: fileTypes.find((item) => item.value === filters.fileType)?.label ?? "", clear: { fileType: "" } });
  }

  if (filters.departmentId) {
    chosen.push({ label: "Birim", value: departments.find((item) => item.id === filters.departmentId)?.name ?? "Seçili birim", clear: { departmentId: "" } });
  }

  return (
    <div className="border-t border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Boyut
        <select
          value={filters.size}
          onChange={(event) => updateFilter({ size: event.target.value as SearchFilters["size"] })}
          className="h-9 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 outline-none transition focus:border-brand-700 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          {sizeFilters.map((filter) => (
            <option key={filter.value || "all"} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Başlangıç tarihi
        <input
          value={filters.validUntilFrom}
          onChange={(event) => updateFilter({ validUntilFrom: event.target.value })}
          type="date"
          className="h-9 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 outline-none transition focus:border-brand-700 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Bitiş tarihi
        <input
          value={filters.validUntilTo}
          onChange={(event) => updateFilter({ validUntilTo: event.target.value })}
          type="date"
          className="h-9 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 outline-none transition focus:border-brand-700 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Doküman türü
        <select
          aria-label="Filtre dokuman turu"
          value={filters.documentType}
          onChange={(event) => updateFilter({ documentType: event.target.value as SearchFilters["documentType"] })}
          className="h-9 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 outline-none transition focus:border-brand-700 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          {documentTypes.map((type) => (
            <option key={type.value || "all"} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Dosya türü
        <select
          aria-label="Filtre dosya turu"
          value={filters.fileType}
          onChange={(event) => updateFilter({ fileType: event.target.value })}
          className="h-9 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 outline-none transition focus:border-brand-700 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:ring-brand-950"
        >
          {fileTypes.map((type) => (
            <option key={type.value || "all"} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Birim
        <select
          value={filters.departmentId}
          onChange={(event) => updateFilter({ departmentId: event.target.value })}
          className="h-9 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 outline-none transition focus:border-brand-700 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="">Tümü</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </label>

    </div>
    {chosen.length > 0 ? (
      <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Seçili filtreler">
        {chosen.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => updateFilter(item.clear)}
            aria-label={`${item.label} filtresini kaldır`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-900 transition hover:bg-brand-100 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-100 dark:hover:bg-brand-900"
          >
            <span className="truncate">
              {item.label}: {item.value}
            </span>
            <X className="h-3.5 w-3.5 shrink-0" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => onFiltersChange(emptySearchFilters)}
          className="rounded-full px-3 py-1 text-xs font-medium text-zinc-600 underline underline-offset-2 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          Filtreleri temizle
        </button>
      </div>
    ) : null}
    </div>
  );
}

function formatDay(value: string) {
  const [year, month, day] = value.split("-");

  return year && month && day ? `${day}.${month}.${year}` : value;
}
