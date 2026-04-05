import React, { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Bell, ScanLine, Trash2 } from 'lucide-react';
import { loadHealthProfile } from '../App';
import {
  getScanHistory,
  aggregateFlaggedAllergens,
  formatRelativeTime,
  clearScanHistory,
} from '../utils/scanHistory';

function healthLabel(score) {
  if (score >= 80) return 'HEALTHY';
  if (score >= 60) return 'GOOD';
  if (score >= 40) return 'CAUTION';
  return 'REVIEW';
}

function insightCards(last) {
  const hc = last?.health_concerns || [];
  const fromRules = hc.map((h) => ({
    title: h.label || 'Insight',
    body: h.description || '',
  }));
  const summary = (last?.summary || '').trim();
  const sentences = summary.split(/(?<=[.!?])\s+/).filter(Boolean);
  const pad = [
    { title: 'Good for routine', body: 'Whole foods and clear labels usually score higher on this app.' },
    { title: 'Watch additives', body: 'Short lists with recognizable names are easier to trust.' },
    { title: 'Balanced view', body: 'Use the score as a guide alongside your doctor or dietitian.' },
  ];
  const out = [...fromRules];
  for (const s of sentences) {
    if (out.length >= 3) break;
    if (s.length > 12) out.push({ title: 'AI summary', body: s });
  }
  while (out.length < 3 && pad.length) {
    out.push(pad.shift());
  }
  return out.slice(0, 3);
}

function scansByWeekday(history) {
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const h of history) {
    if (!h.at) continue;
    const d = new Date(h.at).getDay();
    counts[d] += 1;
  }
  const max = Math.max(1, ...counts);
  return days.map((label, i) => ({ label, n: counts[i], h: Math.round((counts[i] / max) * 100) }));
}

function scoreBadgeClass(score) {
  if (score >= 80) return 'bg-sage text-white';
  if (score >= 50) return 'bg-terracotta text-white';
  return 'bg-red-500 text-white';
}

const Dashboard = () => {
  const profile = loadHealthProfile() || {};
  const name = profile.displayName?.trim() || 'there';
  const [historyTick, setHistoryTick] = useState(0);
  const refreshHistory = useCallback(() => setHistoryTick((t) => t + 1), []);

  const history = useMemo(() => getScanHistory(), [historyTick]);
  const last = history[0];
  const flagged = useMemo(() => aggregateFlaggedAllergens(history), [history]);
  const recent = history.slice(0, 4);
  const weekday = scansByWeekday(history);
  const totalWeek = weekday.reduce((a, b) => a + b.n, 0);
  const avgScore =
    history.length > 0
      ? Math.round(history.reduce((s, h) => s + (h.score || 0), 0) / history.length)
      : 0;

  const ingList = last?.ingredients || [];
  const allergenCount = (last?.allergens_found || []).length;
  const dietCount = (last?.diet_conflicts || []).length;
  const healthCount = (last?.health_concerns || []).length;

  const handleClearHistory = () => {
    if (
      !window.confirm(
        'Clear all scan history on this device? This cannot be undone.'
      )
    ) {
      return;
    }
    clearScanHistory();
    refreshHistory();
  };

  const today = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Welcome back, {name}!
          </h1>
          <p className="mt-2 text-muted">Your ingredient safety overview</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted">{today}</span>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-glass-border bg-white/50 text-muted backdrop-blur-md transition-colors hover:bg-white/70"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex justify-center">
        <Link
          to="/scan"
          className="glass-card-strong inline-flex items-center gap-3 rounded-2xl px-8 py-4 font-bold text-sage-dark shadow-lg transition-transform hover:scale-[1.02]"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sage/30">
            <ScanLine className="h-6 w-6 text-sage-dark" />
          </span>
          <span>Tap to scan</span>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
        <section className="glass-card p-5 lg:col-span-4">
          <h2 className="text-lg font-bold text-text">
            {last?.product_name || 'Your last scan'}
          </h2>
          {last && (
            <p className="mt-1 text-sm text-muted">{formatRelativeTime(last.at)}</p>
          )}
          {!last && (
            <p className="mt-3 text-sm text-muted">Scan a label to see a snapshot here.</p>
          )}
          {last && (
            <div className="mt-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-glass-border bg-white/45 px-3 py-3 text-center backdrop-blur-sm">
                  <div className="text-2xl font-extrabold text-text">{ingList.length}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Ingredients
                  </div>
                </div>
                <div className="rounded-2xl border border-glass-border bg-white/45 px-3 py-3 text-center backdrop-blur-sm">
                  <div
                    className={`text-2xl font-extrabold ${allergenCount ? 'text-red-600' : 'text-sage-dark'}`}
                  >
                    {allergenCount}
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Alerts
                  </div>
                </div>
                <div className="rounded-2xl border border-glass-border bg-white/45 px-3 py-3 text-center backdrop-blur-sm">
                  <div
                    className={`text-2xl font-extrabold ${dietCount ? 'text-terracotta' : 'text-sage-dark'}`}
                  >
                    {dietCount}
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Diet flags
                  </div>
                </div>
                <div className="rounded-2xl border border-glass-border bg-white/45 px-3 py-3 text-center backdrop-blur-sm">
                  <div
                    className={`text-2xl font-extrabold ${healthCount ? 'text-amber-700' : 'text-sage-dark'}`}
                  >
                    {healthCount}
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Health flags
                  </div>
                </div>
              </div>

              {allergenCount > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-red-700/90">
                    Allergen matches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(last.allergens_found || []).map((a, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-red-100/90 px-3 py-1 text-xs font-semibold text-red-800"
                      >
                        {a.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {ingList.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                    Parsed tokens
                  </p>
                  <div className="max-h-36 overflow-y-auto rounded-2xl border border-glass-border bg-white/35 p-3 backdrop-blur-sm">
                    <div className="flex flex-wrap gap-2">
                      {ingList.slice(0, 24).map((ing, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-text"
                        >
                          {ing}
                        </span>
                      ))}
                      {ingList.length > 24 && (
                        <span className="self-center text-xs text-muted">
                          +{ingList.length - 24} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="glass-card-strong relative flex flex-col items-center justify-center overflow-hidden p-8 lg:col-span-4">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.15]"
            style={{
              background:
                'radial-gradient(circle at 30% 70%, #a8b79a 0%, transparent 45%), radial-gradient(circle at 70% 30%, #c68b77 0%, transparent 40%)',
            }}
          />
          {last ? (
            <>
              <div className="score-container relative z-[1]">
                <svg className="score-svg" width="180" height="180" viewBox="0 0 180 180">
                  <circle
                    className="score-circle"
                    cx="90"
                    cy="90"
                    r="72"
                    fill="none"
                    stroke="rgba(255,255,255,0.65)"
                    strokeWidth="12"
                  />
                  <circle
                    cx="90"
                    cy="90"
                    r="72"
                    fill="none"
                    strokeWidth="12"
                    strokeLinecap="round"
                    transform="rotate(-90 90 90)"
                    stroke={
                      (last.score || 0) >= 80
                        ? '#8a9a7e'
                        : (last.score || 0) >= 50
                          ? '#c68b77'
                          : '#dc2626'
                    }
                    style={{
                      strokeDasharray: 2 * Math.PI * 72,
                      strokeDashoffset: 2 * Math.PI * 72 * (1 - (last.score || 0) / 100),
                    }}
                  />
                </svg>
                <div className="relative z-[1] flex flex-col items-center">
                  <span className="text-5xl font-extrabold text-text">{last.score ?? '—'}</span>
                  <span className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-sage-dark">
                    {healthLabel(last.score ?? 0)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="relative z-[1] text-center text-muted">No score yet</p>
          )}
        </section>

        <section className="glass-card flex flex-col gap-4 p-5 lg:col-span-4">
          <h2 className="text-lg font-bold text-text">Health insights</h2>
          <p className="text-xs text-muted">From your latest scan &amp; rules</p>
          <div className="flex flex-1 flex-col gap-3">
            {insightCards(last).map((c, i) => (
              <div
                key={i}
                className="rounded-2xl border border-glass-border bg-white/40 px-4 py-3 backdrop-blur-sm"
              >
                <div className="text-sm font-bold text-sage-dark">{c.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-muted">{c.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-card p-5">
          <h2 className="text-lg font-bold text-text">Most flagged allergens</h2>
          <ul className="mt-4 space-y-3">
            {flagged.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted">No allergen flags in history yet.</li>
            ) : (
              flagged.slice(0, 6).map(({ label, count }) => (
                <li
                  key={label}
                  className="flex items-center justify-between rounded-xl bg-white/35 px-4 py-3 backdrop-blur-sm"
                >
                  <span className="font-medium text-text">{label}</span>
                  <span className="rounded-full bg-red-100 px-3 py-0.5 text-xs font-bold text-red-700">
                    {count}×
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="glass-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-text">Recent scans</h2>
            <div className="flex items-center gap-3">
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200/80 bg-red-50/70 px-3 py-1.5 text-xs font-bold text-red-800 transition-colors hover:bg-red-100/90"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear history
                </button>
              )}
              <Link to="/history" className="text-sm font-bold text-sage-dark hover:underline">
                View all
              </Link>
            </div>
          </div>
          <ul className="space-y-2">
            {recent.length === 0 ? (
              <li className="py-8 text-center text-sm text-muted">
                <Link to="/scan" className="font-bold text-sage-dark hover:underline">
                  Start scanning
                </Link>
              </li>
            ) : (
              recent.map((row) => (
                <li key={row.id}>
                  <Link
                    to="/history"
                    className="flex items-center gap-3 rounded-xl bg-white/35 px-3 py-3 backdrop-blur-sm transition-colors hover:bg-white/55"
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${scoreBadgeClass(row.score)}`}
                    >
                      {row.score}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-text">{row.product_name}</div>
                      <div className="text-xs text-muted">{formatRelativeTime(row.at)}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="glass-card p-5">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-text">Scanner activity</h2>
            <p className="text-sm text-muted">Daily scans this week (local)</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold text-text">{totalWeek}</div>
            <div className="text-xs text-muted">scans · avg {avgScore || '—'}</div>
          </div>
        </div>
        <div className="flex h-36 items-end justify-between gap-2 border-t border-glass-border pt-4">
          {weekday.map((d) => (
            <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full max-w-[2.5rem] rounded-t-lg bg-gradient-to-t from-sage/90 to-sage-dark/70 transition-all"
                style={{ height: `${Math.max(8, d.h)}%` }}
                title={`${d.n} scans`}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{d.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
