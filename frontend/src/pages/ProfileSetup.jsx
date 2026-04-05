import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';

export default function ProfileSetup() {
  const [profile, setProfile] = useState({ allergens: [], diets: [], avoid_flags: [] });
  const [db, setDb] = useState(null);
  const [customInput, setCustomInput] = useState('');
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [activeTab, setActiveTab] = useState('allergens');
  
  const userId = localStorage.getItem('user_id');

  useEffect(() => {
    fetch(`${API_URL}/allergens`)
      .then(res => res.json())
      .then(data => setDb(data));

    if (userId) {
      fetch(`${API_URL}/profile/${userId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => res.json())
      .then(data => setProfile(data));
    }
  }, [userId]);

  const toggleItem = (category, itemKey) => {
    setProfile(prev => {
      const list = [...prev[category]];
      if (list.includes(itemKey)) {
        return { ...prev, [category]: list.filter(k => k !== itemKey) };
      } else {
        return { ...prev, [category]: [...list, itemKey] };
      }
    });
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`${API_URL}/profile/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(profile)
      });
      if(res.ok) alert("Profile saved successfully");
    } catch(err) {
      alert("Error saving profile");
    }
  };

  const handleAddCustom = async (e) => {
    e.preventDefault();
    if(!customInput) return;
    setLoadingCustom(true);
    try {
      const res = await fetch(`${API_URL}/profile/add-allergen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ description: customInput })
      });
      const data = await res.json();
      if (data.allergen_name === "Unknown") {
        alert("We couldn't identify the allergen clearly. Try being more specific!");
      } else {
        alert(`Added ${data.allergen_name} to your custom allergens!`);
        setProfile(prev => {
          if (prev.allergens.includes(data.allergen_name)) return prev;
          return {
            ...prev,
            allergens: [...prev.allergens, data.allergen_name]
          };
        });
      }
      setCustomInput('');
    } catch(err) {
      alert("Error adding custom allergen");
    }
    setLoadingCustom(false);
  };

  const handleDeleteCustom = async (name) => {
    if (!window.confirm(`Remove "${name}" from your profile?`)) return;
    try {
      const res = await fetch(`${API_URL}/profile/allergen/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setProfile(prev => ({
          ...prev,
          allergens: prev.allergens.filter(a => a !== name)
        }));
      }
    } catch (err) {
      alert("Error deleting custom allergen");
    }
  };


  if(!db) return <div>Loading...</div>;

  const tabs = [
    { id: 'allergens', label: ' Allergens' },
    { id: 'diets', label: ' Diets' },
    { id: 'health', label: ' Health' },
    { id: 'custom', label: ' Custom' }
  ];

  return (
    <div>
      <div className="flex-center mb-4" style={{justifyContent: 'space-between'}}>
        <div>
          <h1>Your Profile</h1>
          <p className="text-muted mt-1">Configure your constraints manually or use AI.</p>
        </div>
      </div>

      <div style={{display: 'flex', gap: '1rem', borderBottom: '1px solid #E5E7EB', paddingBottom: '0.5rem', marginBottom: '2rem', overflowX: 'auto'}}>
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.5rem 1rem', background: activeTab === tab.id ? 'var(--surface)' : 'transparent',
              border: activeTab === tab.id ? '1px solid #E5E7EB' : '1px solid transparent',
              borderRadius: '999px', fontWeight: 600, color: activeTab === tab.id ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'allergens' && (
          <div>
            <h3 className="mb-2">Your Allergens</h3>
            <p className="text-muted mb-4">Select ingredients you are allergic to or sensitive about. We will flag any product containing these.</p>
            <div className="grid-cols-2">
              {Object.entries(db.allergens).map(([key, data]) => (
                <label key={key} className={`checkbox-label ${profile.allergens.includes(key) ? 'selected' : ''}`}>
                  <input 
                    type="checkbox" 
                    checked={profile.allergens.includes(key)}
                    onChange={() => toggleItem('allergens', key)}
                  />
                  <div>
                    <strong>{data.label}</strong>
                    <div className="text-muted" style={{fontSize: '0.85rem'}}>{data.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'diets' && (
          <div>
            <h3 className="mb-2">Dietary Restrictions</h3>
            <p className="text-muted mb-4">Select diets you are following.</p>
            <div className="grid-cols-2">
              {Object.entries(db.diet_conflicts).map(([key, data]) => (
                <label key={key} className={`checkbox-label ${profile.diets.includes(key) ? 'selected' : ''}`}>
                  <input 
                    type="checkbox" 
                    checked={profile.diets.includes(key)}
                    onChange={() => toggleItem('diets', key)}
                  />
                  <strong>{data.label}</strong>
                </label>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'health' && (
          <div>
            <h3 className="mb-2">Health Concerns</h3>
            <p className="text-muted mb-4">Flag ingredients you wish to avoid for general health. NB: High impact issues like high sugar or trans fats are automatically warned globally.</p>
            <div className="grid-cols-2">
              {Object.entries(db.health_flags).map(([key, data]) => (
                <label key={key} className={`checkbox-label ${profile.avoid_flags.includes(key) ? 'selected' : ''}`}>
                  <input 
                    type="checkbox" 
                    checked={profile.avoid_flags.includes(key)}
                    onChange={() => toggleItem('avoid_flags', key)}
                  />
                  <div>
                    <strong>{data.label}</strong>
                    <div className="text-muted" style={{fontSize: '0.85rem'}}>{data.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'custom' && (
          <div>
            <h3 className="mb-2">Custom Allergens</h3>
            <p className="text-muted mb-4">Not finding what you need? Describe it naturally, AI will construct the keywords for validation.</p>
            
            <form onSubmit={handleAddCustom}>
              <div className="form-group mb-2">
                <input 
                  type="text" 
                  placeholder="e.g., I am allergic to strawberries and get hives."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                />
              </div>
              <button disabled={loadingCustom || !customInput} type="submit" className="btn-secondary">
                {loadingCustom ? 'Analyzing...' : 'Add Custom Allergen'}
              </button>
            </form>
            
            {profile.allergens.filter(a => !db.allergens[a]).length > 0 && (
              <div className="mt-4">
                <h4>Your Custom Allergens:</h4>
                <div className="mt-2" style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
                  {profile.allergens.filter(a => !db.allergens[a]).map(a => (
                    <div key={a} className="pill pill-danger" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                      <span>{a}</span>
                      <button 
                        onClick={() => handleDeleteCustom(a)}
                        style={{
                          background: 'none', border: 'none', color: 'white', cursor: 'pointer', 
                          padding: 0, display: 'flex', alignItems: 'center', opacity: 0.8
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        <div className="mt-4" style={{borderTop: '1px solid #E5E7EB', paddingTop: '1rem'}}>
           <button onClick={handleSave} className="btn-primary">Save Profile</button>
        </div>
      </div>
    </div>
  );
}
