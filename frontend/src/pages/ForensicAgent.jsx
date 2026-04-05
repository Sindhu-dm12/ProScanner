import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../config';

export default function ForensicAgent() {
  const [query, setQuery] = useState('');
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat]);

  const handleQuery = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMsg = { role: 'user', text: query };
    setChat([...chat, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/forensic/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: query })
      });

      const data = await res.json();
      const aiMsg = { 
        role: 'ai', 
        text: data.answer, 
        confidence: data.confidence, 
        sources: data.sources,
        context: data.raw_context
      };
      setChat(prev => [...prev, aiMsg]);
    } catch (err) {
      setChat(prev => [...prev, { role: 'ai', text: "System Error: Forensic link lost.", error: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forensic-dashboard">
      <div className="dashboard-header mb-4">
        <h1>🕵️ Forensic Intelligence Agent</h1>
        <p className="text-muted">Grounded Investigation Interface | Hallucination-Free RAG System</p>
      </div>

      <div className="grid-cols-2" style={{ gridTemplateColumns: '1.5fr 1fr', gap: '2rem', height: 'calc(100vh - 250px)' }}>
        
        {/* Chat Terminal Section */}
        <div className="card forensic-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0, overflow: 'hidden' }}>
          <div className="card-header p-3" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)' }}>
            <span className="badge badge-primary">LIVE INVESTIGATION TERMINAL</span>
          </div>
          
          <div className="chat-window p-3" ref={scrollRef} style={{ flex: 1, overflowY: 'auto', background: '#0a0a0c', color: '#e0e0e0', fontFamily: 'monospace' }}>
            {chat.length === 0 && (
              <div className="text-center mt-5 text-muted">
                <p>Establishing secure connection...</p>
                <p>System Ready. Waiting for query.</p>
              </div>
            )}
            {chat.map((msg, i) => (
              <div key={i} className={`msg mb-4 ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div style={{ display: 'inline-block', maxWidth: '85%', textAlign: 'left' }}>
                  <div className={`p-3 rounded ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-dark-soft border-glow'}`}>
                    {msg.text}
                  </div>
                  {msg.role === 'ai' && !msg.error && (
                    <div className="mt-2 text-xs text-muted flex" style={{ gap: '1rem' }}>
                      <span className="text-success">CONFIDENCE: {msg.confidence}</span>
                      <span>SOURCES: {msg.sources}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && <div className="text-muted">AI is analyzing forensic data...</div>}
          </div>

          <form onSubmit={handleQuery} className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Ask about persons, locations, or risk scores..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ background: '#1a1a1c', color: 'white', border: '1px solid #333' }}
              />
              <button className="btn-primary" disabled={loading}>QUERY</button>
            </div>
          </form>
        </div>

        {/* Evidence & Details Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
          <div className="card">
            <h3>🔍 Active Evidence Data</h3>
            <p className="text-muted text-sm mb-3">Retrieved context for most recent query</p>
            <div className="context-box p-2 rounded" style={{ background: '#111', fontSize: '0.85rem', color: '#aaa', minHeight: '100px' }}>
              {chat.length > 0 && chat[chat.length - 1].role === 'ai' ? (
                <pre style={{ whiteSpace: 'pre-wrap' }}>{chat[chat.length - 1].context}</pre>
              ) : (
                "No context retrieved yet."
              )}
            </div>
          </div>

          <div className="card">
            <h3>📊 Investigation Rules</h3>
            <ul className="text-sm text-muted">
              <li>Evidence-Based: Answers are strictly tied to the forensic dataset.</li>
              <li>Minimal Hallucination: system avoids predicting data not in the source.</li>
              <li>Vulnerability Scoring: Linked to provided risk metrics.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
