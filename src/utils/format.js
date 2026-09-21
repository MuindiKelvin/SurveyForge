const pad = (n) => String(n).padStart(2, '0');

export function formatDateTime(ms) {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(ms) {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '';
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTimeLong(ms) {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '';
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** "23h 59m left", "12m left" or "Expired" */
export function formatTimeLeft(expiresAtMs, nowMs = Date.now()) {
  const diff = expiresAtMs - nowMs;
  if (diff <= 0) return 'Expired';
  const totalMinutes = Math.ceil(diff / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export function slugify(text, fallback = 'survey') {
  const s = String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || fallback;
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** A readable name for a signed-in Firebase user (display name, else email, else empty). */
export function personName(user) {
  return (user && (user.displayName || user.email)) || '';
}
