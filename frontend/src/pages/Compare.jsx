import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';

export default function Compare() {
  const [history, setHistory] = useState([]);
  const [selectedId1, setSelectedId1] = useState('');
  const [selectedId2, setSelectedId2] = useState('');
  const userId = localStorage.getItem('user_id');

  useEffect(() => {
    fetch(`${API_URL}/history/${userId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      .then(res => res.json())
      .then(data => setHistory(data));
  }, [userId]);

  const item1 = history.find(i => i.id.toString() === selectedId1);
  const item2 = history.find(i => i.id.toString() === selectedId2);

  return (
    <div>
      <h1 className="mb-2">Compare Products</h1>
      <p className="text-muted mb-4">Select two previously scanned products side-by-side to review their health impact.</p>
      
      <div className="grid-cols-2 mb-4">
        <div>
          <label style={{display: 'block', fontWeight: 600, marginBottom: '0.5rem'}}>Product 1</label>
          <select 
            value={selectedId1} 
            onChange={e => setSelectedId1(e.target.value)} 
            style={{width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #D1D5DB'}}
          >
            <option value="">-- Choose Product --</option>
            {history.map(h => <option key={h.id} value={h.id}>{h.product_name} ({new Date(h.id).toLocaleDateString() || h.score + " score"})</option>)}
          </select>
        </div>
        <div>
          <label style={{display: 'block', fontWeight: 600, marginBottom: '0.5rem'}}>Product 2</label>
          <select 
            value={selectedId2} 
            onChange={e => setSelectedId2(e.target.value)} 
            style={{width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #D1D5DB'}}
          >
            <option value="">-- Choose Product --</option>
            {history.map(h => <option key={h.id} value={h.id}>{h.product_name} ({new Date(h.id).toLocaleDateString() || h.score + " score"})</option>)}
          </select>
        </div>
      </div>

      {(item1 || item2) && (
        <div className="compare-grid">
          {/* Header Row */}
          <div className="compare-row header">
            <div className="compare-row-label"></div>
            <div className="compare-val">
              <div className="compare-product-name">{item1?.product_name || "---"}</div>
            </div>
            <div className="compare-val">
              <div className="compare-product-name">{item2?.product_name || "---"}</div>
            </div>
          </div>

          <div className="compare-row">
            <div className="compare-row-label">Health Score</div>
            <div className="compare-val">
               {item1 && (
                 <div className="score-ring" style={{width: '60px', height: '60px', fontSize: '1.5rem', margin: '0', color: item1.score > 70 ? 'var(--success)' : item1.score > 40 ? 'var(--warning)' : 'var(--danger)'}}>
                   {item1.score}
                 </div>
               )}
            </div>
            <div className="compare-val">
               {item2 && (
                 <div className="score-ring" style={{width: '60px', height: '60px', fontSize: '1.5rem', margin: '0', color: item2.score > 70 ? 'var(--success)' : item2.score > 40 ? 'var(--warning)' : 'var(--danger)'}}>
                   {item2.score}
                 </div>
               )}
            </div>
          </div>

          <div className="compare-row">
            <div className="compare-row-label">Allergens Flags</div>
            <div className="compare-val">
               {item1?.data.allergens_found.length === 0 ? <span className="text-muted">None Found</span> : item1?.data.allergens_found.map(a => <div key={a.label} className="pill pill-danger mb-1 text-sm">{a.label}</div>)}
            </div>
            <div className="compare-val">
               {item2?.data.allergens_found.length === 0 ? <span className="text-muted">None Found</span> : item2?.data.allergens_found.map(a => <div key={a.label} className="pill pill-danger mb-1 text-sm">{a.label}</div>)}
            </div>
          </div>

          <div className="compare-row">
            <div className="compare-row-label">Diet Conflicts</div>
            <div className="compare-val">
               {item1?.data.diet_conflicts?.length === 0 ? <span className="text-muted">No Conflicts</span> : item1?.data.diet_conflicts?.map(d => <div key={d.label} className="pill pill-warning mb-1 text-sm">{d.label}</div>)}
            </div>
            <div className="compare-val">
               {item2?.data.diet_conflicts?.length === 0 ? <span className="text-muted">No Conflicts</span> : item2?.data.diet_conflicts?.map(d => <div key={d.label} className="pill pill-warning mb-1 text-sm">{d.label}</div>)}
            </div>
          </div>

          <div className="compare-row">
            <div className="compare-row-label">Health Flags</div>
            <div className="compare-val">
               {item1?.data.health_concerns?.length === 0 ? <span className="text-muted">No Concerns</span> : item1?.data.health_concerns?.map(h => <div key={h.label} className="pill pill-warning mb-1 text-sm">{h.label}</div>)}
            </div>
            <div className="compare-val">
               {item2?.data.health_concerns?.length === 0 ? <span className="text-muted">No Concerns</span> : item2?.data.health_concerns?.map(h => <div key={h.label} className="pill pill-warning mb-1 text-sm">{h.label}</div>)}
            </div>
          </div>

          <div className="compare-row" style={{alignItems: 'flex-start'}}>
            <div className="compare-row-label" style={{marginTop: '0.2rem'}}>Nutrition</div>
            <div className="compare-val">
               {item1?.data.nutrition_facts && Object.keys(item1.data.nutrition_facts).map(k => (
                 <div key={k} className="text-sm mb-1"><strong>{k.replace('_', ' ')}:</strong> {item1.data.nutrition_facts[k]}</div>
               ))}
            </div>
            <div className="compare-val">
               {item2?.data.nutrition_facts && Object.keys(item2.data.nutrition_facts).map(k => (
                 <div key={k} className="text-sm mb-1"><strong>{k.replace('_', ' ')}:</strong> {item2.data.nutrition_facts[k]}</div>
               ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
