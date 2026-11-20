// Browser-safe & Node-safe Leaderboard validation and sorting utilities (zero node:* imports)

const NAME_REGEX = /^[A-Za-z0-9_\u00C0-\u024F\u1E00-\u1EFF]{3,12}$/;

export function validatePlayerName(rawName) {
  if (typeof rawName !== 'string') return { valid: false, error: 'Tên phải là chuỗi ký tự.' };
  const trimmed = rawName.trim();
  if (trimmed.length < 3 || trimmed.length > 12) {
    return { valid: false, error: 'Tên phải từ 3 đến 12 ký tự.' };
  }
  if (!NAME_REGEX.test(trimmed)) {
    return { valid: false, error: 'Tên chỉ chứa chữ cái, chữ số hoặc dấu gạch dưới (_).' };
  }
  return { valid: true, name: trimmed };
}

export function formatIsoWithTimezone(date = new Date()) {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const hh = String(Math.floor(absMin / 60)).padStart(2, '0');
  const mm = String(absMin % 60).padStart(2, '0');
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hh}:${mm}`;
}

export function sortLeaderboard(entries) {
  if (!Array.isArray(entries)) return [];
  return [...entries]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = Date.parse(a.achieved_at) || 0;
      const tb = Date.parse(b.achieved_at) || 0;
      return ta - tb;
    })
    .slice(0, 10);
}

export function addLeaderboardEntry(existingEntries, rawEntry) {
  const check = validatePlayerName(rawEntry?.name);
  if (!check.valid) {
    return { ok: false, error: check.error, entries: sortLeaderboard(existingEntries) };
  }
  const entry = {
    name: check.name,
    score: Math.max(0, Math.floor(Number(rawEntry.score) || 0)),
    nights_won: Math.max(0, Math.min(3, Math.floor(Number(rawEntry.nights_won) || 0))),
    achieved_at: typeof rawEntry.achieved_at === 'string' && rawEntry.achieved_at.length > 0
      ? rawEntry.achieved_at
      : formatIsoWithTimezone(new Date()),
    seed: Number.isFinite(Number(rawEntry.seed)) ? Math.floor(Number(rawEntry.seed)) : 0
  };
  const updated = sortLeaderboard([...(existingEntries || []), entry]);
  return { ok: true, entry, entries: updated };
}
