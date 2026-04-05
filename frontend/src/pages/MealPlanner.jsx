import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed, Sparkles, AlertCircle, ExternalLink } from 'lucide-react';
import { loadHealthProfile } from '../App';
import { API_URL } from '../config';

const MealPlanner = () => {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiOk, setAiOk] = useState(null);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const profile = loadHealthProfile() || {};

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/ai/status`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setAiOk(!!d.gemini_configured);
      })
      .catch(() => {
        if (!cancelled) setAiOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const buildProfilePayload = () => ({
    allergens: profile.allergens || [],
    diets: profile.diets || [],
    avoid_flags: profile.avoid_flags || [],
    custom_terms: profile.custom_terms || [],
  });

  const generate = async () => {
    setLoading(true);
    setErr('');
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/api/meal/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: buildProfilePayload(),
          notes: notes.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || `HTTP ${res.status}`);
      }
      setResult(data);
    } catch (e) {
      setErr(e.message || 'Request failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-8">
      <header className="border-b border-glass-border pb-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-sage-dark">Plan</p>
        <h1 className="font-display text-3xl font-bold text-text sm:text-4xl">Meal planner</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Uses your saved profile (allergens, diets, health flags, custom terms) and{' '}
          <strong>Gemini</strong> to draft a 7-day plan. Edit your profile anytime — plans respect
          what you saved under{' '}
          <Link to="/profile" className="font-semibold text-sage-dark underline">
            Profile
          </Link>
          .
        </p>
      </header>

      {aiOk === false && (
        <div className="glass-card flex items-start gap-3 border-amber-200/60 bg-amber-50/50 p-4 text-sm text-amber-950">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Gemini API key not detected on the server</p>
            <p className="mt-1 text-amber-900/90">
              Add <code className="rounded bg-white/60 px-1">GEMINI_API_KEY</code> to{' '}
              <code className="rounded bg-white/60 px-1">backend/.env</code> or project root{' '}
              <code className="rounded bg-white/60 px-1">.env</code>, then restart the API (
              <code className="rounded bg-white/60 px-1">uvicorn</code>).
            </p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 font-semibold text-sage-dark hover:underline"
            >
              Get a key in Google AI Studio <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      <div className="glass-card space-y-4 p-6">
        <h2 className="text-lg font-bold text-text">Preferences this week</h2>
        <p className="text-sm text-muted">
          Current profile: {profile.allergens?.length ? profile.allergens.join(', ') : 'No allergens'}{' '}
          · {profile.diets?.length ? profile.diets.join(', ') : 'No diet filters'}
        </p>
        <textarea
          className="pure-input min-h-[100px] resize-y"
          placeholder="Optional: dislikes, calorie goal, cooking time, cuisine…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button
          type="button"
          onClick={generate}
          disabled={loading || aiOk === false}
          className="pure-btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Generating with Gemini…
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Generate 7-day plan
            </>
          )}
        </button>
      </div>

      {err && (
        <div className="glass-card border-red-200/80 bg-red-50/60 p-4 text-sm font-medium text-red-900">
          {err}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {result.error && !result.ok && (
            <div className="glass-card border-red-200/80 bg-red-50/50 p-4 text-sm text-red-900">
              {result.error}
            </div>
          )}

          {result.shopping_tips && (
            <div className="glass-card p-6">
              <h3 className="mb-2 flex items-center gap-2 font-bold text-text">
                <UtensilsCrossed className="h-5 w-5 text-sage-dark" />
                Shopping tips
              </h3>
              <p className="text-sm leading-relaxed text-muted">{result.shopping_tips}</p>
            </div>
          )}

          {Array.isArray(result.days) && result.days.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.days.map((d, i) => (
                <div key={i} className="glass-card-strong p-5">
                  <div className="mb-3 text-sm font-extrabold uppercase tracking-wider text-sage-dark">
                    {d.day || `Day ${i + 1}`}
                  </div>
                  <ul className="space-y-2 text-sm text-text">
                    {d.breakfast && (
                      <li>
                        <span className="font-semibold text-muted">Breakfast</span>
                        <p>{d.breakfast}</p>
                      </li>
                    )}
                    {d.lunch && (
                      <li>
                        <span className="font-semibold text-muted">Lunch</span>
                        <p>{d.lunch}</p>
                      </li>
                    )}
                    {d.dinner && (
                      <li>
                        <span className="font-semibold text-muted">Dinner</span>
                        <p>{d.dinner}</p>
                      </li>
                    )}
                    {d.snack && (
                      <li>
                        <span className="font-semibold text-muted">Snack</span>
                        <p>{d.snack}</p>
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          ) : result.text ? (
            <div className="glass-card p-6">
              <h3 className="mb-3 font-bold text-text">Plan (text)</h3>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted">
                {result.text}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default MealPlanner;
