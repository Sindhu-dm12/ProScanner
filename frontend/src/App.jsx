import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProfileSetup from './pages/ProfileSetup';
import Scan from './pages/Scan';
import Compare from './pages/Compare';

function ProtectedLayout({ children }) {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    navigate('/login');
  };
  
  return (
    <div className="layout">
      <nav className="navbar">
        <div className="nav-brand" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
          <div style={{color: 'var(--primary)'}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287Z"/></svg>
          </div>
          <h1>PureScan</h1>
        </div>
        <div className="nav-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/scan">Scan</Link>
          <Link to="/compare">Compare</Link>
          <Link to="/profile">Profile</Link>
          <button onClick={handleLogout} className="btn-secondary" style={{padding: '0.5rem 1rem'}}>Logout</button>
        </div>
      </nav>
      <main className="container">{children}</main>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <ProtectedLayout>{children}</ProtectedLayout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
        <Route path="/scan" element={<ProtectedRoute><Scan /></ProtectedRoute>} />
        <Route path="/compare" element={<ProtectedRoute><Compare /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
