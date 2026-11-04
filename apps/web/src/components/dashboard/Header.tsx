"use client";

import { ProductMark } from "@/lib/product-mark";

import { useEffect, useState } from "react";
import { LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import type { DepartmentDto } from "@/lib/api";
import { FiltersBar, type SearchFilters } from "./FiltersBar";

type HeaderProps = {
  searchQuery: string;
  filters: SearchFilters;
  /** Filters only mean something on screens that list documents. */
  showFilters?: boolean;
  departments?: DepartmentDto[];
  onSearchQueryChange: (value: string) => void;
  onFiltersChange: (filters: SearchFilters) => void;
  onShowHome: () => void;
  onLogout: () => void;
  onOpenMenu: () => void;
};

export function Header({
  searchQuery,
  filters,
  showFilters = true,
  departments,
  onSearchQueryChange,
  onFiltersChange,
  onShowHome,
  onLogout,
  onOpenMenu
}: HeaderProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("evrakdar_theme") === "dark" ? "dark" : "light";
    setTheme(storedTheme);
    document.documentElement.classList.toggle("dark", storedTheme === "dark");
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("evrakdar_theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3 px-4 py-4 lg:gap-4 lg:px-6">
        <button
          type="button"
          onClick={onOpenMenu}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-zinc-200 text-zinc-700 transition hover:bg-zinc-50 lg:hidden dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          aria-label="Menüyü aç"
          title="Menü"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          onClick={onShowHome}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-brand-800 text-sm font-bold tracking-tight text-white transition hover:bg-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          aria-label="Ana sayfaya dön"
          title="Ana sayfaya dön"
        >
          <ProductMark />
        </button>
        <div className="min-w-0 flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              type="search"
              placeholder="Doküman, klasör, birim veya sorumlu kişi ara"
              className="h-11 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-11 pr-4 text-sm outline-none transition focus:border-brand-700 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-950"
            />
          </div>
        </div>
        <button
          onClick={toggleTheme}
          className="grid h-10 w-10 place-items-center rounded-md border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label={theme === "dark" ? "Açık temayı aç" : "Koyu temayı aç"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          onClick={onLogout}
          className="hidden items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 md:flex dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <LogOut className="h-4 w-4" />
          Çıkış
        </button>
      </div>
      {showFilters ? <FiltersBar filters={filters} departments={departments} onFiltersChange={onFiltersChange} /> : null}
    </header>
  );
}
