import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, Circle, CheckCircle2 } from 'lucide-react';
import { PROFILE_KEY, loadHealthProfile } from '../App';

const TABS = [
  { id: 'allergens', label: 'Allergens' },
  { id: 'diets', label: 'Diets' },
  { id: 'health', label: 'Health' },
  { id: 'custom', label: 'Custom' },
];

const ALLERGEN_GROUPS = [
  { title: 'Grains', items: ['Gluten / Wheat', 'Oats', 'Corn / Maize', 'Rice'] },
  {
    title: 'Animal products',
    items: ['Dairy / Milk', 'Eggs', 'Beef / Red Meat', 'Pork', 'Fish', 'Shellfish'],
  },
  {
    title: 'Proteins & legumes',
    items: ['Peanuts', 'Tree nuts', 'Soy', 'Sesame', 'Mustard', 'Lupin'],
  },
  { title: 'Other', items: ['Celery', 'Sulfites / SO2'] },
];

const DIET_OPTIONS = ['Vegan', 'Vegetarian', 'Keto', 'Paleo', 'Halal'];

const HEALTH_OPTIONS = [
  { key: 'high_sugar', label: 'High sugar' },
  { key: 'artificial_colors', label: 'Artificial colors' },
  { key: 'artificial_sweeteners', label: 'Artificial sweeteners' },
  { key: 'trans_fats', label: 'Trans fats' },
  { key: 'msg', label: 'MSG' },
  { key: 'nitrates_nitrites', label: 'Nitrates / nitrites' },
];

const ProfileSetup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnboarding = location.pathname === '/setup';

  const [tab, setTab] = useState('allergens');
  const [displayName, setDisplayName] = useState('');
  const [allergens, setAllergens] = useState([]);
  const [diets, setDiets] = useState([]);
  const [avoidFlags, setAvoidFlags] = useState([]);
  const [customText, setCustomText] = useState('');

  useEffect(() => {
    const p = loadHealthProfile();
    if (p) {
      setDisplayName(p.displayName || '');
      setAllergens(p.allergens || []);
      setDiets(p.diets || []);
      setAvoidFlags(p.avoid_flags || []);
      setCustomText((p.custom_terms || []).join(', '));
    }
  }, []);

  const toggle = (list, setList, item) => {
    setList((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  };

  const saveProfile = () => {
    const custom_terms = customText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const profile = {
      displayName: displayName.trim() || 'Friend',
      allergens,
      diets,
      avoid_flags: avoidFlags,
      custom_terms,
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    navigate('/dashboard');
  };

  const shell =
    location.pathname === '/setup'
      ? 'min-h-screen bg-canvas px-4 py-10 sm:py-14'
      : 'py-2';

  return (
    <div className={`${shell} animate-fade-in`}>
      <div className="mx-auto max-w-lg sm:max-w-2xl">
        <header className="mb-8 border-b border-border pb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-primary">You</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Your profile
          </h1>
          <p className="mt-3 text-muted">
            {displayName.trim() || 'Add how we should greet you'}
          </p>
          <input
            type="text"
            className="pure-input mt-4 max-w-md"
            placeholder="Your name (e.g. Sindhu DM)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </header>

        <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface/90 p-1.5 shadow-sm backdrop-blur-sm">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                tab === t.id
                  ? 'bg-primary-soft text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-primary/20'
                  : 'text-muted hover:bg-canvas hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'allergens' && (
          <div className="space-y-8">
            <p className="text-sm leading-relaxed text-muted">
              Select ingredients you are allergic to or sensitive about. We will flag any product
              containing these.
            </p>
            {ALLERGEN_GROUPS.map((group) => (
              <section key={group.title}>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
                  {group.title}
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {group.items.map((item) => {
                    const on = allergens.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggle(allergens, setAllergens, item)}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition-all ${
                          on
                            ? 'border-primary/30 bg-primary-soft text-text shadow-[0_6px_20px_-12px_rgba(196,92,62,0.35)]'
                            : 'border-border bg-surface text-text hover:border-primary/20 hover:shadow-sm'
                        }`}
                      >
                        {on ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                        ) : (
                          <Circle className="h-5 w-5 shrink-0 text-border" />
                        )}
                        {item}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {tab === 'diets' && (
          <div>
            <p className="mb-4 text-sm text-muted">We will flag ingredients that conflict with these diets.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {DIET_OPTIONS.map((item) => {
                const on = diets.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggle(diets, setDiets, item)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition-all ${
                      on
                        ? 'border-primary/30 bg-primary-soft text-text shadow-[0_6px_20px_-12px_rgba(196,92,62,0.35)]'
                        : 'border-border bg-surface text-text hover:border-primary/20 hover:shadow-sm'
                    }`}
                  >
                    {on ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-border" />
                    )}
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'health' && (
          <div>
            <p className="mb-4 text-sm text-muted">
              Flag common additives and nutrients you want highlighted on labels.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {HEALTH_OPTIONS.map(({ key, label }) => {
                const on = avoidFlags.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggle(avoidFlags, setAvoidFlags, key)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition-all ${
                      on
                        ? 'border-primary/30 bg-primary-soft text-text shadow-[0_6px_20px_-12px_rgba(196,92,62,0.35)]'
                        : 'border-border bg-surface text-text hover:border-primary/20 hover:shadow-sm'
                    }`}
                  >
                    {on ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-border" />
                    )}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'custom' && (
          <div>
            <p className="mb-3 text-sm text-muted">
              Comma or line separated words to always flag if they appear in ingredients (e.g.
              carrageenan, annatto).
            </p>
            <textarea
              className="pure-input min-h-[160px] resize-y"
              placeholder="carrageenan, annatto, red 40"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
            />
          </div>
        )}

        <button
          type="button"
          onClick={saveProfile}
          className="pure-btn-primary mt-10 flex w-full items-center justify-center gap-2 py-4 text-base"
        >
          <Save className="h-5 w-5" />
          Save profile
        </button>
      </div>
    </div>
  );
};

export default ProfileSetup;
