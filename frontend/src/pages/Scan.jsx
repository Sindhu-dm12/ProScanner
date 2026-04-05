import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  Type,
  X,
  CheckCircle,
  AlertTriangle,
  Info,
  ArrowRight,
  Image as ImageIcon,
  GitCompare,
} from 'lucide-react';
import { loadHealthProfile } from '../App';
import { compressImageFile } from '../utils/imageCompress';
import { appendScanHistory } from '../utils/scanHistory';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const healthDotClass = (color) => {
  const c = (color || '').toLowerCase();
  if (c === 'orange') return 'bg-orange-400';
  if (c === 'red') return 'bg-red-500';
  if (c === 'yellow') return 'bg-yellow-400';
  if (c === 'green') return 'bg-primary';
  if (c === 'blue') return 'bg-blue-400';
  if (c === 'purple') return 'bg-violet-500';
  if (c === 'brown') return 'bg-amber-800';
  return 'bg-primary';
};

function scoreStroke(score) {
  if (score >= 80) return '#8a9a7e';
  if (score >= 50) return '#c68b77';
  return '#dc2626';
}

const ScoreRing = ({ score }) => {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="score-container">
      <svg className="score-svg" width="160" height="160">
        <circle className="score-circle" cx="80" cy="80" r={radius} />
        <circle
          className="score-progress"
          cx="80"
          cy="80"
          r={radius}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
            stroke: scoreStroke(score),
          }}
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className="text-4xl font-bold text-text">{score}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-muted">Safety</span>
      </div>
    </div>
  );
};

function buildApiProfile() {
  const p = loadHealthProfile() || {};
  return {
    allergens: p.allergens || [],
    diets: p.diets || [],
    avoid_flags: p.avoid_flags || [],
    custom_terms: p.custom_terms || [],
  };
}

const Scan = () => {
  const [inputMethod, setInputMethod] = useState('upload');
  const [productName, setProductName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState(null);
  const [comparePair, setComparePair] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const galleryInputRef = useRef(null);
  const nativeCameraInputRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!cameraOpen) return;
    const id = requestAnimationFrame(() => {
      const el = videoRef.current;
      const stream = streamRef.current;
      if (el && stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    });
    return () => cancelAnimationFrame(id);
  }, [cameraOpen]);

  const openLiveCamera = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      nativeCameraInputRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setError('Camera unavailable. Use Upload or allow camera access.');
      nativeCameraInputRef.current?.click();
    }
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      async (blob) => {
        if (blob) {
          const raw = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
          setFile(await compressImageFile(raw));
          stopCamera();
        }
      },
      'image/jpeg',
      0.88
    );
  };

  const onGalleryChange = async (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(await compressImageFile(f));
    e.target.value = '';
  };

  const finalizeScanResult = (data) => {
    appendScanHistory({
      product_name: data.product_name,
      score: data.score,
      allergens_found: data.allergens_found,
      summary: data.summary,
      health_concerns: data.health_concerns,
      diet_conflicts: data.diet_conflicts,
      ingredients: data.ingredients,
    });

    if (compareMode) {
      if (!compareA) {
        setCompareA(data);
        setResult(null);
        setInfo('First product saved. Scan your second product, then run analysis again.');
        setProductName('');
        setIngredients('');
        setFile(null);
        return;
      }
      setComparePair({ a: compareA, b: data });
      setCompareA(null);
      setInfo('');
      setResult(null);
      return;
    }
    setResult(data);
    setInfo('');
  };

  const handleScan = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    const profile = buildApiProfile();

    try {
      let res;
      if (inputMethod === 'text') {
        res = await fetch(`${API_URL}/api/scan/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: ingredients,
            product_name: productName || 'Scanned product',
            profile,
          }),
        });
      } else {
        if (!file) {
          setError('Add an image first (upload or camera).');
          setLoading(false);
          return;
        }
        const toSend = await compressImageFile(file);
        const formData = new FormData();
        formData.append('file', toSend);
        formData.append('product_name', productName || 'Scanned product');
        formData.append('profile_json', JSON.stringify(profile));
        res = await fetch(`${API_URL}/api/scan/image`, {
          method: 'POST',
          body: formData,
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const d = data.detail;
        const detailMsg =
          typeof d === 'string'
            ? d
            : Array.isArray(d)
              ? d.map((x) => x.msg || JSON.stringify(x)).join('; ')
              : data.message;
        throw new Error(detailMsg || `Request failed (${res.status})`);
      }
      finalizeScanResult(data);
    } catch (err) {
      setError(err.message || 'Scan failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const resetCompare = () => {
    setComparePair(null);
    setCompareA(null);
    setInfo('');
  };

  if (comparePair) {
    const { a, b } = comparePair;
    return (
      <div className="animate-fade-in space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">Compare products</h1>
            <p className="text-sm text-muted">Side-by-side safety scores</p>
          </div>
          <button
            type="button"
            onClick={resetCompare}
            className="pure-btn-primary w-fit bg-text px-5 py-2.5 text-sm hover:opacity-90"
          >
            Done
          </button>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[a, b].map((r, i) => (
            <div key={i} className="glass-card flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-text">{r.product_name || `Product ${i + 1}`}</h2>
                  <p className="text-sm text-muted">Score {r.score}</p>
                </div>
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-md ${
                    r.score >= 80 ? 'bg-accent' : r.score >= 50 ? 'bg-sidebar-accent' : 'bg-red-500'
                  }`}
                >
                  {r.score}
                </div>
              </div>
              <p className="text-sm leading-relaxed text-text">{r.summary}</p>
              {(r.allergens_found || []).length > 0 && (
                <div className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                  {(r.allergens_found || []).map((x) => x.label).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="animate-fade-in space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              {result.product_name || 'Analyzed product'}
            </h1>
            <p className="mt-1 text-sm text-muted">Ingredient scan · {new Date().toLocaleDateString()}</p>
          </div>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text hover:bg-canvas"
          >
            <X className="mr-2 inline h-4 w-4" />
            New scan
          </button>
        </div>

        <div className="glass-card flex flex-col items-center gap-8 md:flex-row md:items-center">
          <ScoreRing score={result.score} />
          <div className="flex-1 text-center md:text-left">
            <h3 className="mb-2 flex items-center justify-center gap-2 text-lg font-semibold text-text md:justify-start">
              <CheckCircle className="h-5 w-5 text-primary" />
              AI summary
            </h3>
            <p className="text-base leading-relaxed text-text">{result.summary}</p>
          </div>
        </div>

        <div className="glass-card">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text">
            <Type className="h-5 w-5 text-primary" />
            Parsed ingredients
          </h3>
          <div className="flex flex-wrap gap-2">
            {(result.ingredients || []).map((ing, i) => (
              <span
                key={i}
                className="rounded-full border border-border bg-canvas px-3 py-1.5 text-sm font-medium text-text"
              >
                {ing}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {(result.allergens_found || []).length > 0 && (
            <div className="glass-card border-warn/30 bg-warn-soft/40">
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-warn">
                <AlertTriangle className="h-5 w-5" />
                Allergen alerts
              </h3>
              <ul className="space-y-3">
                {(result.allergens_found || []).map((all, i) => (
                  <li key={i} className="rounded-xl bg-surface p-4 text-sm">
                    <div className="text-xs font-bold uppercase tracking-wide text-warn">
                      {all.severity || 'alert'}
                    </div>
                    <div className="mt-1 font-semibold text-text">{all.label}</div>
                    <p className="mt-1 text-muted">{all.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="glass-card">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-text">
              <Info className="h-5 w-5 text-primary" />
              Diet & health flags
            </h3>
            {(result.diet_conflicts || []).length > 0 ? (
              <ul className="mb-4 space-y-2 text-sm">
                {(result.diet_conflicts || []).map((d, i) => (
                  <li key={i} className="rounded-lg bg-canvas px-3 py-2">
                    <span className="font-medium text-text">{d.label}</span>
                    {d.matched_keyword && (
                      <span className="text-muted"> — {d.matched_keyword}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            {(result.health_concerns || []).length > 0 ? (
              <ul className="space-y-3 text-sm">
                {(result.health_concerns || []).map((con, i) => (
                  <li key={i}>
                    <div className="flex items-center justify-between gap-2 font-medium text-text">
                      {con.label}
                      <span className={`h-3 w-3 shrink-0 rounded-full ${healthDotClass(con.color)}`} />
                    </div>
                    <p className="mt-1 text-muted">{con.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No extra health flags from the ruleset.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8 pb-12">
      <header className="border-b border-border pb-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-primary">Analyze</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">Scan product</h1>
        <p className="mt-3 max-w-md text-muted">Upload, capture, or paste ingredients—we decode the label.</p>
      </header>

      <form onSubmit={handleScan} className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-text">Product name (optional)</label>
          <input
            type="text"
            className="pure-input"
            placeholder="e.g. Oreo Cookies, Heinz Ketchup…"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'upload', label: 'Upload', icon: Upload },
            { id: 'camera', label: 'Camera', icon: Camera },
            { id: 'text', label: 'Paste text', icon: Type },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setInputMethod(id);
                setError('');
              }}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border py-4 text-sm font-semibold transition-all ${
                inputMethod === id
                  ? 'border-primary/35 bg-primary-soft text-primary shadow-[0_8px_24px_-12px_rgba(196,92,62,0.35)]'
                  : 'border-border bg-surface text-muted hover:border-primary/25 hover:text-text hover:shadow-sm'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          className="hidden"
          onChange={onGalleryChange}
        />
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          capture="environment"
          className="hidden"
          onChange={onGalleryChange}
        />

        {inputMethod === 'text' && (
          <div>
            <label className="mb-2 block text-sm font-medium text-text">Ingredients</label>
            <textarea
              className="pure-input min-h-[200px] resize-y"
              placeholder="Ingredients: water, sugar, palm oil…"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              required
            />
          </div>
        )}

        {inputMethod === 'upload' && (
          <div className="space-y-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => galleryInputRef.current?.click()}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') galleryInputRef.current?.click();
              }}
              className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-surface py-14 transition-colors hover:border-primary/40 hover:bg-primary-soft/30"
            >
              <ImageIcon className="h-12 w-12 text-muted" />
              <span className="font-semibold text-text">Upload an image</span>
              <span className="text-sm text-muted">JPG, PNG, or WEBP</span>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="mt-4 max-h-48 rounded-xl border border-border object-contain shadow-sm"
                />
              )}
            </div>
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-sm font-semibold text-danger hover:underline"
              >
                Remove image
              </button>
            )}
          </div>
        )}

        {inputMethod === 'camera' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={openLiveCamera}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface py-4 font-semibold text-text hover:bg-canvas"
              >
                <Camera className="h-5 w-5 text-primary" />
                Open camera
              </button>
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface py-4 font-semibold text-text hover:bg-canvas sm:hidden"
              >
                Native camera
              </button>
            </div>
            <div className="rounded-2xl border border-dashed border-border bg-surface py-12 text-center">
              {previewUrl ? (
                <>
                  <img
                    src={previewUrl}
                    alt="Captured"
                    className="mx-auto max-h-56 rounded-xl object-contain shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="mt-4 text-sm font-semibold text-danger hover:underline"
                  >
                    Retake
                  </button>
                </>
              ) : (
                <p className="text-sm text-muted">Capture a clear photo of the ingredient list.</p>
              )}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="pure-btn-primary flex w-full items-center justify-center gap-2 py-4 text-base font-semibold disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Analyzing…
            </>
          ) : (
            <>
              Run analysis
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setCompareMode((c) => !c);
            setCompareA(null);
            setInfo('');
            setComparePair(null);
          }}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl border py-3.5 text-sm font-semibold transition-all ${
            compareMode
              ? 'border-primary/40 bg-primary-soft text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'
              : 'border-dashed border-border bg-surface/80 text-muted hover:border-primary/30 hover:text-text'
          }`}
        >
          <GitCompare className="h-4 w-4" />
          {compareMode ? 'Compare mode on — scan two products' : 'Enable compare mode'}
        </button>
      </form>

      {info && (
        <div className="rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm font-medium text-primary">
          {info}
        </div>
      )}

      {error && (
        <div className="flex animate-shake items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {cameraOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Camera"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-text shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 text-white">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Camera className="h-5 w-5" />
                Ingredient label
              </span>
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-lg p-2 hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <video ref={videoRef} playsInline muted autoPlay className="aspect-[4/3] w-full bg-black object-cover" />
            <div className="flex gap-2 p-3">
              <button
                type="button"
                onClick={stopCamera}
                className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-semibold text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={captureFromVideo}
                className="pure-btn-primary flex-1 py-3 text-sm"
              >
                Capture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scan;
