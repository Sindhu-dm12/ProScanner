import React, { useState, useRef, useEffect } from 'react';
import { API_URL } from '../config';
import { Camera, Upload, Edit3 } from 'lucide-react';

export default function Scan() {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('upload'); // 'upload', 'text', 'camera'
  const [text, setText] = useState('');
  const [productName, setProductName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert("Camera access denied or unavailable.");
      setMode('upload');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      
      canvasRef.current.toBlob(async (blob) => {
        const capturedFile = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
        setFile(capturedFile);
        stopCamera();
        setMode('upload');
        
        // Auto-upload instantly for immediate UX
        setLoading(true);
        try {
          const formData = new FormData();
          formData.append('file', capturedFile);
          formData.append('product_name', productName || "Scanned Product");
          
          const res = await fetch(`${API_URL}/scan/image`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
          });
          if (!res.ok) throw new Error("Scan failed with status: " + res.status);
          setResult(await res.json());
        } catch (err) {
          alert(err.message);
        }
        setLoading(false);
      }, 'image/jpeg');
    }
  };

  const handleScan = async () => {
    setLoading(true);
    try {
      let res;
      if (mode === 'text') {
        const formData = new FormData();
        formData.append('text', text);
        formData.append('product_name', productName || "Scanned Product");
        res = await fetch(`${API_URL}/scan/text`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: formData
        });
      } else {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('product_name', productName || "Scanned Product");
        res = await fetch(`${API_URL}/scan/image`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: formData
        });
      }
      
      if (!res.ok) throw new Error("Scan failed. Error Code " + res.status);
      setResult(await res.json());
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  };

  if (result) {
    return (
      <div className="card">
        <div className="card-header" style={{display: 'flex', justifyContent: 'space-between'}}>
          <h2>Scan Results</h2>
          <button onClick={() => setResult(null)} className="btn-secondary" style={{width: 'auto'}}>Scan Another</button>
        </div>
        
        <div className="grid-cols-2 mt-4">
          <div>
            <div className="score-ring" style={{color: result.score > 85 ? 'var(--success)' : result.score > 60 ? 'var(--warning)' : 'var(--danger)'}}>
              {result.score}
            </div>
            
            <div className="card" style={{background: '#F9FAFB', marginTop: '1rem'}}>
              <h3>AI Summary</h3>
              <p className="mt-1">{result.summary}</p>
            </div>

            {result.nutrition_facts && Object.keys(result.nutrition_facts).length > 0 && (
              <div className="card mt-2" style={{background: '#fff', border: '1px solid #E5E7EB'}}>
                <h3>Nutrition Facts (Estimates)</h3>
                <ul className="mt-2" style={{listStyle: 'none'}}>
                  {Object.entries(result.nutrition_facts).map(([k, v]) => (
                    <li key={k} style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', padding: '0.25rem 0'}}>
                      <span style={{textTransform: 'capitalize'}}>{k.replace(/_/g, ' ')}</span>
                      <strong>{v}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card mt-2" style={{background: '#EFF6FF', border: '1px solid #DBEAFE'}}>
               <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                 <h3 style={{color: '#1E40AF'}}>Scan Accuracy</h3>
                 <span style={{fontSize: '1.25rem', fontWeight: 800, color: '#1E40AF'}}>{result.accuracy}%</span>
               </div>
               <p className="text-sm mt-1" style={{color: '#1E40AF'}}>This represents the AI's confidence in correctly identifying ingredients from the image.</p>
            </div>
          </div>
          
          <div>
            <h3>Findings</h3>
            
            <div className="mt-2">
              {result.error && (
                <div className="card mb-2" style={{borderLeft: '4px solid var(--danger)', background: '#FEF2F2'}}>
                  <strong style={{color: 'var(--danger)'}}>⚠️ Analysis Issue</strong>
                  <p className="mt-1 text-sm">{result.error}</p>
                </div>
              )}
              {result.allergens_found.length > 0 && <h4 className="mt-2 mb-1" style={{color: 'var(--danger)'}}>🚨 Allergens Detected</h4>}
              {result.allergens_found.map((a, i) => (
                <div key={i} className="card mb-1" style={{borderLeft: '4px solid var(--danger)', padding: '1rem'}}>
                  <strong>{a.label}</strong>
                  <p className="text-muted mt-1" style={{fontSize: '0.875rem'}}>{a.description}</p>
                </div>
              ))}
              
              {result.diet_conflicts?.length > 0 && <h4 className="mt-2 mb-1" style={{color: 'var(--warning)'}}>⚠️ Diet Conflicts</h4>}
              {result.diet_conflicts?.map((d, i) => (
                <div key={i} className="card mb-1" style={{borderLeft: '4px solid var(--warning)', padding: '1rem'}}>
                  <strong>{d.label}</strong>
                </div>
              ))}
              
              {result.health_concerns?.length > 0 && <h4 className="mt-2 mb-1" style={{color: 'var(--warning)'}}>🟡 Health Warning</h4>}
              {result.health_concerns?.map((h, i) => (
                <div key={i} className="card mb-1" style={{borderLeft: '4px solid var(--warning)', padding: '0.75rem'}}>
                  <strong>{h.label}</strong>
                  <p className="text-muted" style={{fontSize: '0.85rem'}}>{h.description} {h.global ? "(Global Warning)" : ""}</p>
                </div>
              ))}

              {result.score === 100 && !result.error && (
                <div className="card mt-2" style={{borderLeft: '4px solid var(--success)', padding: '1rem'}}>
                  <strong style={{color: 'var(--success)'}}>✅ Safe to consume</strong>
                  <p className="text-muted mt-1" style={{fontSize: '0.875rem'}}>No configured allergens or major health flags detected.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2">Scan Product</h1>
      <p className="text-muted mb-4">Upload, capture, or paste ingredients to analyze</p>
      
      <div className="mb-4">
         <label style={{display: 'block', fontWeight: 600, marginBottom: '0.5rem'}}>Product Name (optional)</label>
         <input type="text" placeholder="e.g. Oreo Cookies, Heinz Ketchup..." value={productName} onChange={e=>setProductName(e.target.value)} />
         <p className="text-muted text-sm mt-1">Adding a name makes it easier to find and compare later</p>
      </div>

      <div className="flex-center mb-4" style={{justifyContent: 'flex-start', gap: '1rem'}}>
        <button className={`btn-${mode === 'upload' ? 'primary' : 'secondary'}`} style={{width: 'auto', display:'flex', gap:'0.5rem', alignItems:'center'}} onClick={() => setMode('upload')}><Upload size={18}/> Upload Image</button>
        <button className={`btn-${mode === 'camera' ? 'primary' : 'secondary'}`} style={{width: 'auto', display:'flex', gap:'0.5rem', alignItems:'center'}} onClick={() => setMode('camera')}><Camera size={18}/> Camera</button>
        <button className={`btn-${mode === 'text' ? 'primary' : 'secondary'}`} style={{width: 'auto', display:'flex', gap:'0.5rem', alignItems:'center'}} onClick={() => setMode('text')}><Edit3 size={18}/> Paste Text</button>
      </div>
      
      {mode === 'upload' && (
        <label className="scan-box" style={{display: 'block', cursor:'pointer'}}>
          <input type="file" onChange={e => setFile(e.target.files[0])} style={{display:'none'}} accept="image/*" />
          <Upload size={48} color="var(--text-muted)" style={{margin: '0 auto', marginBottom: '1rem'}}/>
          <h3>{file ? file.name : "Click to upload an image"}</h3>
          <p className="text-muted mt-1">JPG, PNG, or WEBP</p>
        </label>
      )}

      {mode === 'camera' && (
        <div style={{textAlign: 'center'}}>
          <video ref={videoRef} autoPlay playsInline style={{width: '100%', maxWidth: '600px', borderRadius: 'var(--radius-lg)', border: '2px solid #E5E7EB'}} />
          <canvas ref={canvasRef} style={{display: 'none'}} />
          <br />
          <button className="btn-primary mt-2" onClick={capturePhoto} style={{width: 'auto', padding: '0.75rem 2rem'}}>Snap Photo</button>
        </div>
      )}
      
      {mode === 'text' && (
        <textarea 
          style={{width: '100%', height: '200px', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #E5E7EB', outline: 'none', fontFamily: 'inherit'}}
          placeholder="Paste ingredients text here..."
          value={text}
          onChange={e => setText(e.target.value)}
        />
      )}
      
      <button 
        className="btn-primary mt-4" 
        onClick={handleScan}
        disabled={loading || (mode === 'upload' && !file) || (mode === 'text' && !text) || mode === 'camera'}
        style={{opacity: loading ? 0.7 : 1}}
      >
        {loading ? 'Analyzing...' : 'Analyze Ingredients'}
      </button>
    </div>
  );
}
