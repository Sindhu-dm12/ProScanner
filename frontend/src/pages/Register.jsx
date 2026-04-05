import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, User, Mail, Lock } from 'lucide-react';

const API_URL = 'http://localhost:8000';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/auth/register`, { name, email, password });
      navigate('/login');
    } catch (err) {
      setError('Registration failed. Email may already be in use.');
    }
  };

  return (
    <div className="page-container flex flex-col items-center justify-center min-h-[80vh] animate-fade-in">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
           <div className="w-20 h-20 bg-sage rounded-full flex items-center justify-center mx-auto mb-6 text-white squi-circle shadow-2xl shadow-sage/30">
              <ShieldCheck size={40} />
           </div>
           <h1 className="text-4xl font-bold mb-2">Initialize Account</h1>
           <p className="text-muted text-lg">PureScan Intelligence Registration</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="flex flex-col gap-2 group">
             <div className="relative">
               <User className="absolute left-4 top-5 text-sage/40" size={20} />
               <input 
                 type="text" placeholder="Full Name" 
                 value={name} onChange={e => setName(e.target.value)}
                 className="w-full pl-12 py-5" required
               />
             </div>
          </div>

          <div className="flex flex-col gap-2 group">
             <div className="relative">
               <Mail className="absolute left-4 top-5 text-sage/40" size={20} />
               <input 
                 type="email" placeholder="Email Address" 
                 value={email} onChange={e => setEmail(e.target.value)}
                 className="w-full pl-12 py-5" required
               />
             </div>
          </div>

          <div className="flex flex-col gap-2 group">
             <div className="relative">
               <Lock className="absolute left-4 top-5 text-sage/40" size={20} />
               <input 
                 type="password" placeholder="Secure Password" 
                 value={password} onChange={e => setPassword(e.target.value)}
                 className="w-full pl-12 py-5" required
               />
             </div>
          </div>

          <button type="submit" className="btn-organic w-full py-5 text-xl font-black justify-center shadow-2xl shadow-sage/30 rounded-[1.8rem]">
            Create Account <ArrowRight className="ml-2" size={20} />
          </button>
        </form>

        <p className="mt-8 text-center text-text-muted font-medium">
          Already verified? <Link to="/login" className="text-sage font-bold hover:underline">Log In</Link>
        </p>

        {error && <div className="mt-6 p-4 bg-red-100 text-red-600 rounded-2xl text-center font-bold text-sm tracking-tight">{error}</div>}
      </div>
    </div>
  );
};

export default Register;
