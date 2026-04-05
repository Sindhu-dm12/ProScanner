import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const userId = localStorage.getItem('user_id');

  useEffect(() => {
    fetch(`${API_URL}/stats/${userId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      .then(res => res.json())
      .then(data => setStats(data));
      
    fetch(`${API_URL}/history/${userId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      .then(res => res.json())
      .then(data => setHistory(data.slice(0, 5)));
  }, [userId]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this scan from history?")) return;
    try {
      const res = await fetch(`${API_URL}/history/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setHistory(history.filter(item => item.id !== id));
        // Refresh stats too
        fetch(`${API_URL}/stats/${userId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
          .then(res => res.json())
          .then(data => setStats(data));
      }
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  if (!stats) return <div className="container">Loading Dashboard...</div>;

  return (
    <div>
      <div className="flex-center mb-4" style={{justifyContent: 'space-between'}}>
        <div>
          <h1 className="mb-1">Dashboard</h1>
          <p className="text-muted">Welcome back! Here is your scan activity.</p>
        </div>
      </div>
      
      <div className="grid-cols-2 mb-4">
        <div className="card" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '180px'}}>
           <div className="score-ring" style={{color: 'var(--primary)', width: '80px', height: '80px', fontSize: '1.5rem'}}>{stats.avg_score}</div>
           <h3 className="mt-2 text-muted">Average Safety Score</h3>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
          <div className="card" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1}}>
             <h3>Total Scans</h3>
             <span style={{fontSize: '2rem', fontWeight: 700}}>{stats.total_scans}</span>
          </div>
          <div className="card" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1}}>
             <h3>Safe Products</h3>
             <span style={{fontSize: '2rem', fontWeight: 700, color: 'var(--success)'}}>{stats.safe_scans}</span>
          </div>
        </div>
      </div>
      
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
        <h2>Recent Scans</h2>
      </div>

      <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
        {history.length === 0 ? <p className="text-muted">No scans yet. Go to the Scan tab to analyze a product!</p> : history.map((item) => (
          <div key={item.id} className="card history-card" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative'}}>
            <div style={{flex: 1}}>
              <h3 style={{fontSize: '1.1rem'}}>{item.product_name || "Scanned Product"}</h3>
              <div style={{display:'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem'}}>
                 {item.data.allergens_found?.map((a, i) => <span key={i} className="pill pill-danger text-sm">{a.label}</span>)}
                 {item.data.health_concerns?.map((a, i) => <span key={i} className="pill pill-warning text-sm">{a.label}</span>)}
                 {item.data.diet_conflicts?.map((a, i) => <span key={i} className="pill pill-info text-sm">{a.label}</span>)}
              </div>
            </div>
            
            <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
              <div className="score-ring" style={{width: '45px', height: '45px', fontSize: '0.9rem', margin: 0, color: item.score > 80 ? 'var(--success)' : item.score > 50 ? 'var(--warning)' : 'var(--danger)'}}>
                {item.score}
              </div>
              <button 
                onClick={() => handleDelete(item.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  padding: '5px',
                  lineHeight: 1
                }}
                className="delete-btn"
                title="Delete Scan"
              >
                &times;
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
