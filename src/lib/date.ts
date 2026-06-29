export function localDateInTz(tz: string, date: Date = new Date()): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(date); // YYYY-MM-DD
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function weekStart(localDate: string): string {
  const d = new Date(localDate + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=Sun
  const isoDow = day === 0 ? 7 : day;
  d.setUTCDate(d.getUTCDate() - (isoDow - 1));
  return d.toISOString().slice(0, 10);
}

export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Rest well";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Quiet night";
}
