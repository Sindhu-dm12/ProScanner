const HISTORY_KEY = 'pureScanHistory';
const MAX_ITEMS = 80;

export function getScanHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function appendScanHistory(entry) {
  const list = getScanHistory();
  const row = {
    id: entry.id || `${Date.now()}`,
    product_name: entry.product_name || 'Product',
    score: typeof entry.score === 'number' ? entry.score : 0,
    at: entry.at || new Date().toISOString(),
    allergens_found: entry.allergens_found || [],
    summary: entry.summary || '',
    health_concerns: entry.health_concerns || [],
    diet_conflicts: entry.diet_conflicts || [],
    ingredients: entry.ingredients || [],
  };
  list.unshift(row);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)));
  return row;
}

export function aggregateFlaggedAllergens(history) {
  const counts = {};
  for (const h of history) {
    for (const a of h.allergens_found || []) {
      const label = a.label || 'Unknown';
      counts[label] = (counts[label] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export function formatRelativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.floor((now - then) / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 14) return `${day} day${day === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}
