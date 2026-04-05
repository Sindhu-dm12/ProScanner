import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, ArrowRight, ShieldCheck, AlertTriangle, Info, Plus } from 'lucide-react';

const API_URL = 'http://localhost:8000';

const Compare = () => {
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState([null, null]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const token = localStorage.getItem('token');
    const user_id = JSON.parse(atob(token.split('.')[1])).sub;
    try {
      const res = await axios.get(`${API_URL}/history/${user_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectProduct = (item, index) => {
    const newSelected = [...selected];
    newSelected[index] = JSON.parse(item.result_json);
    newSelected[index].name = item.product_name || "Scanned Product";
    setSelected(newSelected);
  };

  const ProductCard = ({ product, index }) => (
    <div className="organic-card border-none bg-white/40 h-full flex flex-col">
      {!product ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-16 h-16 bg-sand/50 rounded-full flex items-center justify-center mb-6 text-sage animate-pulse">
            <Plus size={32} />
          </div>
          <p className="font-bold text-text-muted mb-6">Select from history</p>
          <div className="w-full space-y-2 max-h-[300px] overflow-y-auto px-2">
            {history.map(item => (
              <button 
                key={item.id} 
                onClick={() => selectProduct(item, index)}
                className="w-full p-4 bg-white/80 hover:bg-white rounded-2xl text-left border border-white/50 transition-all flex justify-between items-center group shadow-sm"
              >
                <div className="flex flex-col">
                  <span className="font-bold text-sm truncate max-w-[150px]">{item.product_name || "Scan"}</span>
                  <span className="text-[10px] uppercase font-black text-sage tracking-widest">{item.score} Score</span>
                </div>
                <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 animate-fade-in">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-bold text-text-dark">{product.name}</h3>
            <button onClick={() => {
              const ns = [...selected]; ns[index] = null; setSelected(ns);
            }} className="text-text-muted hover:text-red-500 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="mb-8 p-6 bg-white/60 rounded-[2rem] text-center border border-white/80 shadow-sm">
             <div className="text-4xl font-black mb-1" style={{ color: product.score >= 80 ? '#8E9B8E' : '#D48C70' }}>
               {product.score}
             </div>
             <p className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Intelligence Score</p>
          </div>

          <div className="space-y-4">
             <div className="p-4 bg-sand/30 rounded-2xl">
               <h4 className="text-xs font-black uppercase tracking-widest text-text-muted mb-2">Key Risks</h4>
               {product.allergens_found.length > 0 ? (
                 product.allergens_found.slice(0, 2).map((a, i) => (
                   <div key={i} className="text-sm font-bold text-terra-cotta mb-1">• {a.label}</div>
                 ))
               ) : <div className="text-sm font-bold text-sage">No Critical Risks</div>}
             </div>

             <div className="p-4 bg-sage/10 rounded-2xl">
               <h4 className="text-xs font-black uppercase tracking-widest text-text-muted mb-2">Ingredients</h4>
               <p className="text-xs font-medium leading-relaxed opacity-70">
                 {product.ingredients.slice(0, 8).join(', ')}...
               </p>
             </div>
          </div>
        </div>
      )}
    </div>
  );

  const X = ({ size }) => <span className="p-1 rounded-full bg-off-white hover:bg-white transition-colors" style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✕</span>;

  return (
    <div className="page-container animate-fade-in">
      <div className="mb-12 text-center md:text-left">
        <h1 className="text-4xl font-bold mb-2">Comparative Intelligence</h1>
        <p className="text-muted text-lg">Detailed side-by-side nutritional metrics analysis.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <ProductCard product={selected[0]} index={0} />
        <ProductCard product={selected[1]} index={1} />
      </div>

      {selected[0] && selected[1] && (
        <div className="organic-card animate-slide-up">
           <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
             <ShieldCheck className="text-sage" /> Verification Matrix
           </h2>
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead>
                 <tr className="text-xs font-black uppercase tracking-[0.3em] text-text-muted opacity-60">
                   <th className="pb-6 w-1/3">Feature Set</th>
                   <th className="pb-6">{selected[0].name}</th>
                   <th className="pb-6">{selected[1].name}</th>
                 </tr>
               </thead>
               <tbody className="text-base font-medium">
                 <tr className="border-t border-sand/50">
                    <td className="py-6 text-text-muted flex items-center gap-2"><Info size={16} /> Total Ingredients</td>
                    <td className="py-6">{selected[0].ingredients.length} units</td>
                    <td className="py-6">{selected[1].ingredients.length} units</td>
                 </tr>
                 <tr className="border-t border-sand/50">
                    <td className="py-6 text-text-muted flex items-center gap-2"><AlertTriangle size={16} /> Risks Detected</td>
                    <td className="py-6 font-bold" style={{ color: selected[0].allergens_found.length > 0 ? '#D48C70' : '#8E9B8E' }}>
                      {selected[0].allergens_found.length} items
                    </td>
                    <td className="py-6 font-bold" style={{ color: selected[1].allergens_found.length > 0 ? '#D48C70' : '#8E9B8E' }}>
                      {selected[1].allergens_found.length} items
                    </td>
                 </tr>
                 <tr className="border-t border-sand/50">
                    <td className="py-6 text-text-muted font-bold">Recommended Choice</td>
                    <td colSpan={2} className="py-6">
                      <div className="p-4 bg-sage/10 rounded-2xl text-sage font-black text-center text-sm uppercase tracking-widest border border-sage/20 shadow-sm shadow-sage/5">
                        Superior Health Index: {selected[0].score >= selected[1].score ? selected[0].name : selected[1].name}
                      </div>
                    </td>
                 </tr>
               </tbody>
             </table>
           </div>
        </div>
      )}
    </div>
  );
};

export default Compare;
