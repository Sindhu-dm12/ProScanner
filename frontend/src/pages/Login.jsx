import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    try {
      const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', body: formData });
      if(!res.ok) throw new Error("Invalid credentials");
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user_id', data.user_id);
      navigate('/dashboard');
    } catch(err) { alert(err.message); }
  };
  
  return (
    <div className="container" style={{maxWidth: '400px', marginTop: '4rem'}}>
      <div className="card">
        <h1 className="mb-4">Welcome Back</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group mb-2">
            <input type="email" placeholder="Email" required value={email} onChange={e=>setEmail(e.target.value)} />
          </div>
          <div className="form-group mb-2">
            <input type="password" placeholder="Password" required value={password} onChange={e=>setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" style={{width: '100%', marginTop: '1rem'}}>Sign In</button>
        </form>
        <div className="mt-4" style={{textAlign: 'center'}}>
           <Link to="/register" style={{color: 'var(--primary)'}}>Create an account</Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
