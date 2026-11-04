"use client";

import { CONTACT_EMAIL } from "./full-edition/FullEditionPage";

type RoleRow = {
  label: string;
  admin: boolean;
  editor: boolean;
  viewer: boolean;
};

/**
 * What each role can really do. This list is written from the server's own rules,
 * and an automated test compares every line with real requests.
 */
const groups: Array<{ label: string; rows: RoleRow[] }> = [
  {
    label: "Belgeler",
    rows: [
      { label: "Belgeleri görme", admin: true, editor: true, viewer: true },
      { label: "Belge indirme", admin: true, editor: true, viewer: true },
      { label: "Belge bağlantısı paylaşma", admin: true, editor: true, viewer: true },
      { label: "Favorilere ekleme", admin: true, editor: true, viewer: true },
      { label: "Belge ekleme", admin: true, editor: true, viewer: false },
      { label: "Belge bilgilerini düzenleme, taşıma, kopyalama", admin: true, editor: true, viewer: false },
      { label: "Dosyayı yenisiyle değiştirme", admin: true, editor: true, viewer: false },
      { label: "Belge silme", admin: true, editor: true, viewer: false },
      { label: "Bütün gizli belgeleri görme", admin: true, editor: false, viewer: false }
    ]
  },
  {
    label: "Klasörler",
    rows: [
      { label: "Klasör ekleme", admin: true, editor: true, viewer: false },
      { label: "Klasör düzenleme, taşıma, kopyalama", admin: true, editor: true, viewer: false },
      { label: "Klasör silme", admin: true, editor: true, viewer: false }
    ]
  },
  {
    label: "Geri Dönüşüm Kutusu",
    rows: [
      { label: "Geri alma", admin: true, editor: true, viewer: false },
      { label: "Kalıcı silme", admin: true, editor: true, viewer: false }
    ]
  },
  {
    label: "Yönetim",
    rows: [
      { label: "Birim ekleme, düzenleme, silme", admin: true, editor: false, viewer: false },
      { label: "Kullanıcıları görme, ekleme, düzenleme, rol verme", admin: true, editor: false, viewer: false },
      { label: "Yönetici Paneli", admin: true, editor: false, viewer: false }
    ]
  }
];

const roles = [
  { key: "admin", label: "Yönetici" },
  { key: "editor", label: "Düzenleyici" },
  { key: "viewer", label: "Kullanıcı" }
] as const;

export function AdminRolesInfoPanel() {
  return (
    <section className="space-y-5" aria-label="Roller ve Yetkiler">
      <div>
        <p className="text-sm font-medium text-brand-800 dark:text-brand-300">Yönetim</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Roller ve Yetkiler</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Kişiye rol verirken hangi rolün neler yapabildiğini buradan görebilirsiniz.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-[640px] w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Yetki</th>
              {roles.map((role) => (
                <th key={role.key} className="w-32 px-4 py-3 text-center font-semibold">
                  {role.label}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.label} className="divide-y divide-zinc-100 dark:divide-zinc-800">
              <tr className="bg-zinc-50 dark:bg-zinc-950">
                <th colSpan={4} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {group.label}
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-2.5 text-zinc-800 dark:text-zinc-200">{row.label}</td>
                  {roles.map((role) => (
                    <td key={role.key} className="px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={row[role.key]}
                        disabled
                        readOnly
                        aria-label={`${row.label}: ${role.label}`}
                        className="h-4 w-4 accent-brand-800"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Herkes kendi eklediği, sorumlusu olduğu ya da kendi birimine ait gizli belgeleri görür.
      </p>

      <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100">
        Rol eklemek ve yetkileri değiştirmek tam sürümdedir. Bilgi almak için{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium underline underline-offset-2">{CONTACT_EMAIL}</a>
      </div>
    </section>
  );
}
