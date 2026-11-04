"use client";

import { APP_INITIALS, APP_NAME } from "./brand";
import evrakdarMark from "./evrakdar-e.png";

/** Evrakdar's own E. An installation that renames the product keeps its own initials instead. */
export function ProductMark({ className }: { className?: string }) {
  if (APP_NAME !== "Evrakdar") {
    return <span className={className}>{APP_INITIALS}</span>;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={evrakdarMark.src} alt={APP_NAME} className="h-[68%] w-[68%] object-contain" />;
}
