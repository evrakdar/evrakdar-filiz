"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";

export const CONTACT_EMAIL = "bilgi@evrakdar.com";

export type FullEditionPageKey = "full-audit" | "full-approvals" | "full-search" | "full-reminders" | "full-institution";

/**
 * Sample screens of the full edition. They are drawn here for looking only: everything in them is made up,
 * every control is switched off, and nothing is sent to the server or saved.
 */
export const fullEditionPages: Record<FullEditionPageKey, { title: string; summary: string; body: () => ReactNode }> = {
  "full-audit": {
    title: "İşlem Kayıtları",
    summary: "Kim, ne zaman, neyi değiştirdi. Rol ve bilgi değişikliklerinde önceki ve yeni değer de yazılır.",
    body: AuditSample
  },
  "full-approvals": {
    title: "Onay Bekleyenler",
    summary: "Belgeler yayına çıkmadan önce yetkili kişinin onayından geçer. Reddedilen belgede sebep de yazılır.",
    body: ApprovalsSample
  },
  "full-search": {
    title: "Arama Yönetimi",
    summary: "Taranmış belgeler ve Word, Excel, PowerPoint dosyaları dahil, her belgenin içinde yazıyla arama yapılır.",
    body: SearchSample
  },
  "full-reminders": {
    title: "E-posta Hatırlatma",
    summary: "Geçerlilik tarihi yaklaşan belgelerin sorumlusuna kendiliğinden e-posta gider.",
    body: RemindersSample
  },
  "full-institution": {
    title: "Kurum Ayarları",
    summary: "Kurumun adı, logosu ve renkleri bütün ekranlarda görünür. Yeni kişiye kurum e-postası önerilir.",
    body: InstitutionSample
  }
};

export function FullEditionPage({ page }: { page: FullEditionPageKey }) {
  const { title, summary, body: Body } = fullEditionPages[page];

  return (
    <section className="space-y-5" aria-label={title}>
      <div>
        <p className="text-sm font-medium text-brand-800 dark:text-brand-300">Tam Sürüm Sayfaları</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{title}</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{summary}</p>
      </div>

      <div
        role="note"
        className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Bu bir örnek görünümdür. Tam sürümde çalışır. Buradaki bilgiler uydurmadır, düğmeler kapalıdır.</span>
      </div>

      {/* "inert" keeps the sample out of reach of the mouse and the keyboard alike. */}
      <div inert className="space-y-4 select-none">
        <Body />
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Tam sürüm hakkında bilgi almak için{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-brand-800 underline underline-offset-2 dark:text-brand-300">{CONTACT_EMAIL}</a>
      </p>
    </section>
  );
}

const card = "rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
const cell = "px-4 py-3 text-zinc-700 dark:text-zinc-300";
const head = "bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400";
const field = "mt-2 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300";
const label = "text-sm font-medium text-zinc-700 dark:text-zinc-200";

function SampleButton({ children, primary = false }: { children: ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      disabled
      className={`rounded-md px-3 py-2 text-sm font-medium opacity-70 ${
        primary ? "bg-brand-800 text-white" : "border border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className={`${card} p-4`}>
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{value}</p>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{note}</p>
    </div>
  );
}

function AuditSample() {
  const rows = [
    ["12.03.2026 14:22", "Ayşe Yılmaz", "Rol güncelleme", "Kişi"],
    ["12.03.2026 11:05", "Mehmet Demir", "Doküman yükleme", "Yıllık Faaliyet Raporu"],
    ["11.03.2026 16:40", "Ayşe Yılmaz", "Dokümanı geri dönüşüme taşıma", "Eski Form"],
    ["11.03.2026 09:12", "Zeynep Kaya", "Doküman indirme", "Kalite El Kitabı"]
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[560px] text-sm">
          <thead className={head}>
            <tr>
              <th className="px-4 py-3 font-semibold">Tarih</th>
              <th className="px-4 py-3 font-semibold">Yapan kişi</th>
              <th className="px-4 py-3 font-semibold">İşlem</th>
              <th className="px-4 py-3 font-semibold">İlgili kayıt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map((row) => (
              <tr key={row[0]}>
                {row.map((value) => (
                  <td key={value} className={cell}>
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`${card} p-4`}>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">İşlem detayı</h2>
        <dl className="mt-4 grid gap-3 text-sm">
          {[
            ["İşlem", "Rol güncelleme"],
            ["İlgili kayıt", "Can Öztürk"],
            ["Önceki rol", "Kullanıcı"],
            ["Yeni rol", "Düzenleyici"],
            ["Yapan kişi", "Ayşe Yılmaz"]
          ].map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{key}</dt>
              <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function ApprovalsSample() {
  const rows = [
    ["İç Tetkik Prosedürü", "Kalite Birimi", "Mehmet Demir"],
    ["Staj Başvuru Formu", "Öğrenci İşleri", "Zeynep Kaya"],
    ["Bütçe Raporu 2026", "Mali İşler", "Can Öztürk"]
  ];

  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full min-w-[640px] text-sm">
        <thead className={head}>
          <tr>
            <th className="px-4 py-3 font-semibold">Belge</th>
            <th className="px-4 py-3 font-semibold">Birim</th>
            <th className="px-4 py-3 font-semibold">Gönderen</th>
            <th className="px-4 py-3 font-semibold">Karar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((value) => (
                <td key={value} className={cell}>
                  {value}
                </td>
              ))}
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <SampleButton primary>Onayla</SampleButton>
                  <SampleButton>Reddet</SampleButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SearchSample() {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Aramada olan belge" value="1.248" note="Yazısıyla birlikte aranabilir" />
        <Stat title="Taranmış belge" value="312" note="Yazısı okundu" />
        <Stat title="Okunmayı bekleyen" value="4" note="Sırada" />
        <Stat title="Okunamayan" value="1" note="Yeniden denenebilir" />
      </div>
      <div className={`${card} p-4`}>
        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Toplu işlemler</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">İşlemler arka planda sırayla yapılır, kimseyi bekletmez.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <SampleButton primary>Tüm belgeleri yeniden hazırla</SampleButton>
          <SampleButton primary>Okunamayan belgeleri yeniden dene</SampleButton>
        </div>
      </div>
    </>
  );
}

function RemindersSample() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className={`${card} space-y-3 p-4`}>
        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Hatırlatma durumu</h2>
        <dl className="grid gap-3 text-sm">
          {[
            ["Durum", "Açık"],
            ["Hatırlatma günleri", "Bitişten 30, 7 ve 1 gün önce"],
            ["Son gönderim", "12.03.2026 08:00"],
            ["Gönderilen e-posta", "14"]
          ].map(([key, value]) => (
            <div key={key} className="flex justify-between gap-4 border-b border-zinc-100 pb-2 dark:border-zinc-800">
              <dt className="text-zinc-500 dark:text-zinc-400">{key}</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">{value}</dd>
            </div>
          ))}
        </dl>
        <SampleButton primary>Deneme e-postası gönder</SampleButton>
      </div>
      <div className={`${card} p-4`}>
        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Giden e-posta</h2>
        <div className="mt-3 rounded-md border border-zinc-200 p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
          <p className="font-semibold">Konu: Süresi yaklaşan belgeler</p>
          <p className="mt-3">Merhaba Can Öztürk,</p>
          <p className="mt-2">Sorumlu olduğunuz şu belgenin geçerlilik tarihi yaklaşıyor:</p>
          <p className="mt-2 font-medium">Kalite El Kitabı, 30.03.2026</p>
        </div>
      </div>
    </div>
  );
}

function InstitutionSample() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className={`${card} grid gap-3 p-4`}>
        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Kurum bilgileri</h2>
        <label className={label}>
          Kurum adı
          <input disabled value="Örnek Üniversitesi" readOnly className={field} />
        </label>
        <label className={label}>
          E-posta alan adı
          <input disabled value="ogrenci.ornek.edu.tr" readOnly className={field} />
        </label>
        <label className={label}>
          Adres biçimi
          <input disabled value="ayse.nur.yilmaz@" readOnly className={field} />
        </label>
        <div className="flex flex-wrap gap-2">
          <SampleButton primary>Logo yükle</SampleButton>
          <SampleButton>Kaydet</SampleButton>
        </div>
      </div>
      <div className={`${card} p-4`}>
        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Logo ve renkler</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Logo yüklenince renkler ondan önerilir. Açık ve koyu temada önizlenir.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ThemeSample title="Açık tema" page="#ffffff" text="#18181b" />
          <ThemeSample title="Koyu tema" page="#18181b" text="#fafafa" />
        </div>
      </div>
    </div>
  );
}

// The sample shows another institution's colours on purpose, so these two are written out instead of following the theme.
function ThemeSample({ title, page, text }: { title: string; page: string; text: string }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">{title}</p>
      <div className="flex overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
        <div className="w-14 space-y-2 p-2" style={{ backgroundColor: "#0f172a" }}>
          <div className="h-2 rounded bg-white/70" />
          <div className="h-2 rounded bg-white/40" />
          <div className="h-2 rounded bg-white/40" />
        </div>
        <div className="flex-1 p-3 text-xs" style={{ backgroundColor: page, color: text }}>
          <p className="font-semibold" style={{ color: "#3b82f6" }}>
            Örnek başlık
          </p>
          <p className="mt-2">Belge listesi burada görünür.</p>
          <span className="mt-3 inline-block rounded px-3 py-1 font-semibold text-white" style={{ backgroundColor: "#1d4ed8" }}>
            Düğme
          </span>
        </div>
      </div>
    </div>
  );
}
