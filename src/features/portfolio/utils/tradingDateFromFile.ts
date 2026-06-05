/** Local calendar date as YYYY-MM-DD. */
export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Trading date inferred from the file's last-modified timestamp (export/save day). */
export function tradingDateFromFile(file: File): string {
  const ms = file.lastModified;
  if (Number.isFinite(ms) && ms > 0) {
    return localDateString(new Date(ms));
  }
  return localDateString();
}
