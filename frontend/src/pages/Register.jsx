import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config';

export function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const navigate = useNavigate();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      if(!res.ok) throw new Error("Registration failed");
      navigate('/login');
    } catch(err) { alert(err.message); }
  };
  
  return (
    <div className="container" style={{maxWidth: '400px', marginTop: '4rem'}}>
      <div className="card">
        <h1 className="mb-4">Create Account</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group mb-2"><input type="text" placeholder="Full Name" required onChange={e=>setForm({...form, name: e.target.value})} /></div>
          <div className="form-group mb-2"><input type="email" placeholder="Email" required onChange={e=>setForm({...form, email: e.target.value})} /></div>
          <div className="form-group mb-2"><input type="password" placeholder="Password" required onChange={e=>setForm({...form, password: e.target.value})} /></div>
          <button type="submit" className="btn-primary" style={{width: '100%', marginTop: '1rem'}}>Register</button>
        </form>
        <div className="mt-4" style={{textAlign: 'center'}}>
           <Link to="/login" style={{color: 'var(--primary)'}}>Already have an account?</Link>
        </div>
      </div>
    </div>
  );
}

export default Register;
