"use client";

import { useEffect, useState } from "react";

import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { ProductMark } from "@/lib/product-mark";

import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Building2,
  Clock,
  Database,
  FolderTree,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Menu,
  Palette,
  PlusSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UsersRound
} from "lucide-react";
import { getHighestRole } from "@/lib/auth/roles";
import { fullEditionPages, type FullEditionPageKey } from "./full-edition/FullEditionPage";
import type { UserProfile } from "@/lib/mock-data";

export type SidebarMenuKey =
  | "admin-dashboard"
  | "admin-users"
  | "admin-roles-info"
  | FullEditionPageKey
  | "admin-departments"
  | "file-explorer"
  | "trash"
  | "data-entry"
  | "my-recent"
  | "recent"
  | "expiring"
  | "expired";

const menuItems: Array<{ key: SidebarMenuKey; label: string; icon: typeof PlusSquare }> = [
  { key: "admin-dashboard", label: "Yönetici Paneli", icon: BarChart3 },
  { key: "admin-users", label: "Tüm Kullanıcılar ve Yetkilendirme", icon: UsersRound },
  { key: "admin-roles-info", label: "Roller ve Yetkiler", icon: ShieldCheck },
  { key: "admin-departments", label: "Birimler", icon: Building2 },
  { key: "file-explorer", label: "Dosya ve Klasörler", icon: FolderTree },
  { key: "trash", label: "Geri Dönüşüm Kutusu", icon: Trash2 },
  { key: "data-entry", label: "Veri Girişi", icon: PlusSquare },
  { key: "my-recent", label: "Son Eklediklerim", icon: UploadCloud },
  { key: "recent", label: "Son Eklenenler", icon: Clock },
  { key: "expiring", label: "Tarihi Geçecek Olanlar", icon: Database },
  { key: "expired", label: "Süresi Geçenler", icon: AlertTriangle }
];

export const sidebarMenuLabels = {
  "admin-dashboard": "Yönetici Paneli",
  "admin-users": "Tüm Kullanıcılar ve Yetkilendirme",
  "admin-roles-info": "Roller ve Yetkiler",
  "full-audit": fullEditionPages["full-audit"].title,
  "full-approvals": fullEditionPages["full-approvals"].title,
  "full-search": fullEditionPages["full-search"].title,
  "full-reminders": fullEditionPages["full-reminders"].title,
  "full-institution": fullEditionPages["full-institution"].title,
  "admin-departments": "Birimler",
  "file-explorer": "Dosya ve Klasörler",
  trash: "Geri Dönüşüm Kutusu",
  "data-entry": "Veri Girişi",
  "my-recent": "Son Eklediklerim",
  recent: "Son Eklenenler",
  expiring: "Tarihi Geçecek Olanlar",
  expired: "Süresi Geçenler"
} satisfies Record<SidebarMenuKey, string>;

export const unsupportedSidebarMenuKeys: SidebarMenuKey[] = [];

const fullEditionItems: Array<{ key: FullEditionPageKey; icon: typeof PlusSquare }> = [
  { key: "full-audit", icon: ClipboardList },
  { key: "full-approvals", icon: ClipboardCheck },
  { key: "full-search", icon: Search },
  { key: "full-reminders", icon: Mail },
  { key: "full-institution", icon: Palette }
];

export function isFullEditionPage(key: SidebarMenuKey): key is FullEditionPageKey {
  return key in fullEditionPages;
}

const FULL_EDITION_MENU_KEY = "evrakdar_full_edition_menu";

type SidebarProps = {
  user: UserProfile;
  roles?: string[];
  collapsed: boolean;
  activeMenuKey?: SidebarMenuKey | null;
  onToggle: () => void;
  onLogout: () => void;
  onChangePassword: () => void;
  onSelectMenuItem: (key: SidebarMenuKey) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function Sidebar(props: SidebarProps) {
  const { collapsed, mobileOpen = false, onMobileClose } = props;

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onMobileClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, onMobileClose]);

  function closeThen(action: () => void) {
    return () => {
      onMobileClose?.();
      action();
    };
  }

  return (
    <>
      <aside
        className={`hidden min-h-screen shrink-0 flex-col border-r border-zinc-200 bg-brand2-950 text-white transition-all duration-200 lg:flex ${
          collapsed ? "w-20" : "w-72"
        }`}
      >
        <SidebarContent {...props} toggleLabel="Menüyü aç veya kapat" />
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menü">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Menü dışına tıkla, menü kapansın"
            onClick={onMobileClose}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto bg-brand2-950 text-white">
            <SidebarContent
              {...props}
              collapsed={false}
              toggleLabel="Menüyü kapat"
              onToggle={() => onMobileClose?.()}
              onLogout={closeThen(props.onLogout)}
              onChangePassword={closeThen(props.onChangePassword)}
              onSelectMenuItem={(key) => closeThen(() => props.onSelectMenuItem(key))()}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}

function SidebarContent({
  user,
  roles = [],
  collapsed,
  activeMenuKey,
  onToggle,
  onLogout,
  onChangePassword,
  onSelectMenuItem,
  toggleLabel
}: SidebarProps & { toggleLabel: string }) {
  const visibleMenuItems = menuItems.filter((item) => canShowMenuItem(item.key, roles));
  // Only the person who can decide on the full edition sees it, and it stays out of the way until opened.
  const showFullEdition = getHighestRole(roles) === "ADMIN";
  const [fullEditionOpen, setFullEditionOpen] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFullEditionOpen(window.localStorage.getItem(FULL_EDITION_MENU_KEY) === "open");
    } catch {
      // Without browser storage the menu simply starts closed.
    }
  }, []);

  function toggleFullEdition() {
    const next = !fullEditionOpen;
    setFullEditionOpen(next);

    try {
      window.localStorage.setItem(FULL_EDITION_MENU_KEY, next ? "open" : "closed");
    } catch {
      // Remembering this is a convenience, not a need.
    }
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        {!collapsed ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">{APP_NAME}</p>
            <p className="mt-1 text-sm text-zinc-300">{APP_TAGLINE}</p>
          </div>
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-md bg-brand-800 text-sm font-bold"><ProductMark /></div>
        )}
        <button
          onClick={onToggle}
          className="grid h-10 w-10 place-items-center rounded-md text-zinc-300 transition hover:bg-white/10 hover:text-white"
          aria-label={toggleLabel}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-brand-800 text-sm font-semibold">
            {user.firstName[0]}
            {user.lastName[0]}
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-zinc-400">{user.title}</p>
              <p className="truncate text-xs text-zinc-500">{user.department}</p>
            </div>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {visibleMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === activeMenuKey;

          return (
            <button
              key={item.key}
              onClick={() => onSelectMenuItem(item.key)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm transition hover:bg-white/10 hover:text-white ${
                isActive ? "bg-white/10 text-white" : "text-zinc-300"
              } ${collapsed ? "justify-center" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed ? <span>{item.label}</span> : null}
            </button>
          );
        })}

        {showFullEdition ? (
          <div className="mt-3 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={toggleFullEdition}
              aria-expanded={fullEditionOpen}
              aria-label="Tam Sürüm Sayfaları"
              title={collapsed ? "Tam Sürüm Sayfaları" : undefined}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <Sparkles className="h-5 w-5 shrink-0" />
              {!collapsed ? <span className="flex-1">Tam Sürüm Sayfaları</span> : null}
              {!collapsed ? <ChevronDown className={`h-4 w-4 shrink-0 transition ${fullEditionOpen ? "rotate-180" : ""}`} /> : null}
            </button>
            {fullEditionOpen
              ? fullEditionItems.map((item) => {
                  const Icon = item.icon;
                  const title = fullEditionPages[item.key].title;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onSelectMenuItem(item.key)}
                      title={collapsed ? `${title} (örnek)` : undefined}
                      aria-label={title}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition hover:bg-white/10 hover:text-white ${
                        item.key === activeMenuKey ? "bg-white/10 text-white" : "text-zinc-400"
                      } ${collapsed ? "justify-center" : "pl-5"}`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed ? <span className="flex-1">{title}</span> : null}
                      {!collapsed ? <Lock className="h-3.5 w-3.5 shrink-0 opacity-70" /> : null}
                    </button>
                  );
                })
              : null}
          </div>
        ) : null}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          onClick={onChangePassword}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white ${
            collapsed ? "justify-center" : ""
          }`}
          title={collapsed ? "Şifremi Değiştir" : undefined}
        >
          <KeyRound className="h-5 w-5 shrink-0" />
          {!collapsed ? <span>Şifremi Değiştir</span> : null}
        </button>
        <button
          onClick={onLogout}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white ${
            collapsed ? "justify-center" : ""
          }`}
          title={collapsed ? "Çıkış Yap" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed ? <span>Çıkış Yap</span> : null}
        </button>
      </div>
    </>
  );
}

function canShowMenuItem(key: SidebarMenuKey, roles: string[]) {
  const role = getHighestRole(roles);

  if (role === "ADMIN") {
    return true;
  }

  if (role === "EDITOR") {
    return isEditorMenuItem(key);
  }

  return isViewerMenuItem(key);
}

function isEditorMenuItem(key: SidebarMenuKey) {
  return key === "file-explorer" || key === "trash" || key === "data-entry" || key === "my-recent" || key === "recent" || key === "expiring" || key === "expired";
}

function isViewerMenuItem(key: SidebarMenuKey) {
  return key === "file-explorer" || key === "trash" || key === "recent" || key === "expiring" || key === "expired";
}
