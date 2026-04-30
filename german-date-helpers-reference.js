export const APP_TIME_ZONE = 'Europe/Berlin';

export function todayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

export function parseIsoDateParts(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

export function addDays(date, days) {
  const parts = parseIsoDateParts(date);
  if (!parts) return null;

  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + Number(days || 0)));
  return d.toISOString().slice(0, 10);
}

export function diffDays(from, to) {
  const aParts = parseIsoDateParts(from);
  const bParts = parseIsoDateParts(to);
  if (!aParts || !bParts) return null;

  const a = Date.UTC(aParts.year, aParts.month - 1, aParts.day);
  const b = Date.UTC(bParts.year, bParts.month - 1, bParts.day);
  const diff = Math.round((b - a) / 86400000);

  return Number.isNaN(diff) ? null : diff;
}

export function formatIsoDateInGermany(date, fallback = 'Not scheduled yet', lang = 'de') {
  const parts = parseIsoDateParts(date);
  if (!parts) return fallback;

  const locale = lang === 'de' ? 'de-DE' : 'en-GB';
  const displayDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));

  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(displayDate);
}
