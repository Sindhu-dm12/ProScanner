import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getScanHistory, formatRelativeTime } from '../utils/scanHistory';

function scoreBadgeClass(score) {
  if (score >= 80) return 'bg-sage text-white shadow-sm';
  if (score >= 50) return 'bg-terracotta text-white shadow-sm';
  return 'bg-red-500 text-white shadow-sm';
}

const HistoryPage = () => {
  const [history] = useState(() => getScanHistory());
  const sorted = useMemo(() => [...history], [history]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <header className="border-b border-glass-border pb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-sage-dark">My scans</p>
        <h1 className="font-display text-3xl font-bold text-text">History</h1>
        <p className="mt-2 text-muted">Everything you have scanned here stays local.</p>
      </header>

      <ul className="glass-card divide-y divide-white/40 overflow-hidden p-0">
        {sorted.length === 0 ? (
          <li className="px-5 py-16 text-center text-muted">
            No scans yet.{' '}
            <Link to="/scan" className="font-semibold text-sage-dark hover:underline">
              Scan a product
            </Link>
          </li>
        ) : (
          sorted.map((row) => (
            <li key={row.id} className="flex items-center gap-4 px-5 py-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold ${scoreBadgeClass(row.score)}`}
              >
                {row.score}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-text">{row.product_name}</div>
                <div className="text-sm text-muted">{formatRelativeTime(row.at)}</div>
                {(row.allergens_found || []).length > 0 && (
                  <div className="mt-1 text-xs text-warn">
                    {(row.allergens_found || []).map((a) => a.label).join(' · ')}
                  </div>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default HistoryPage;
