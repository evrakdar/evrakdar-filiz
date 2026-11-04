const DAY_MS = 24 * 60 * 60 * 1000;

/** Validity dates are stored as dates, so a document stays valid through its last day. */
export function startOfToday() {
  const now = new Date();

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function daysFromToday(days: number) {
  return new Date(startOfToday().getTime() + days * DAY_MS);
}
