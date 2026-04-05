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
        <div style={{display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 2fr 2fr', gap: '1rem', background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #E5E7EB'}}>
          
          <div style={{fontWeight: 600, color: 'var(--text-muted)', paddingTop: '1rem'}}>
             <div>Score</div>
             <div style={{marginTop: '3.5rem'}}>Allergens</div>
             <div style={{marginTop: '3.5rem'}}>Diet Conflicts</div>
             <div style={{marginTop: '3.5rem'}}>Health Flags</div>
             <div style={{marginTop: '3.5rem'}}>Key Nutrition</div>
          </div>
          
          {/* Column 1 */}
          <div className="card" style={{background: '#F9FAFB', border: 'none', boxShadow: 'none'}}>
            {item1 ? (
              <>
                <h3 className="mb-2">{item1.product_name}</h3>
                <div className="score-ring" style={{width: '60px', height: '60px', fontSize: '1.5rem', color: item1.score > 70 ? 'var(--success)' : item1.score > 40 ? 'var(--warning)' : 'var(--danger)'}}>
                  {item1.score}
                </div>
                
                <div style={{marginTop: '1.5rem', minHeight: '60px'}}>
                  {item1.data.allergens_found.length === 0 ? <span className="text-muted text-sm">None</span> : item1.data.allergens_found.map(a => <div key={a.label} className="pill pill-danger mb-1 text-sm">{a.label}</div>)}
                </div>

                <div style={{marginTop: '1.5rem', minHeight: '60px'}}>
                  {item1.data.diet_conflicts?.length === 0 ? <span className="text-muted text-sm">None</span> : item1.data.diet_conflicts?.map(d => <div key={d.label} className="pill pill-warning mb-1 text-sm">{d.label}</div>)}
                </div>

                <div style={{marginTop: '1.5rem', minHeight: '60px'}}>
                  {item1.data.health_concerns?.length === 0 ? <span className="text-muted text-sm">None</span> : item1.data.health_concerns?.map(h => <div key={h.label} className="pill pill-warning mb-1 text-sm">{h.label}</div>)}
                </div>

                <div style={{marginTop: '1.5rem', fontSize: '0.875rem', lineHeight: '1.6'}}>
                   {item1.data.nutrition_facts && Object.keys(item1.data.nutrition_facts).map(k => (
                     <div key={k}><strong>{k.replace('_', ' ')}:</strong> {item1.data.nutrition_facts[k]}</div>
                   ))}
                </div>
              </>
            ) : <div className="text-muted" style={{textAlign:'center', marginTop:'2rem'}}>No product selected</div>}
          </div>
          
          {/* Column 2 */}
          <div className="card" style={{background: '#F9FAFB', border: 'none', boxShadow: 'none'}}>
            {item2 ? (
              <>
                <h3 className="mb-2">{item2.product_name}</h3>
                <div className="score-ring" style={{width: '60px', height: '60px', fontSize: '1.5rem', color: item2.score > 70 ? 'var(--success)' : item2.score > 40 ? 'var(--warning)' : 'var(--danger)'}}>
                  {item2.score}
                </div>
                
                <div style={{marginTop: '1.5rem', minHeight: '60px'}}>
                  {item2.data.allergens_found.length === 0 ? <span className="text-muted text-sm">None</span> : item2.data.allergens_found.map(a => <div key={a.label} className="pill pill-danger mb-1 text-sm">{a.label}</div>)}
                </div>

                <div style={{marginTop: '1.5rem', minHeight: '60px'}}>
                  {item2.data.diet_conflicts?.length === 0 ? <span className="text-muted text-sm">None</span> : item2.data.diet_conflicts?.map(d => <div key={d.label} className="pill pill-warning mb-1 text-sm">{d.label}</div>)}
                </div>

                <div style={{marginTop: '1.5rem', minHeight: '60px'}}>
                  {item2.data.health_concerns?.length === 0 ? <span className="text-muted text-sm">None</span> : item2.data.health_concerns?.map(h => <div key={h.label} className="pill pill-warning mb-1 text-sm">{h.label}</div>)}
                </div>

                <div style={{marginTop: '1.5rem', fontSize: '0.875rem', lineHeight: '1.6'}}>
                   {item2.data.nutrition_facts && Object.keys(item2.data.nutrition_facts).map(k => (
                     <div key={k}><strong>{k.replace('_', ' ')}:</strong> {item2.data.nutrition_facts[k]}</div>
                   ))}
                </div>
              </>
            ) : <div className="text-muted" style={{textAlign:'center', marginTop:'2rem'}}>No product selected</div>}
          </div>

        </div>
      )}
    </div>
  );
}
