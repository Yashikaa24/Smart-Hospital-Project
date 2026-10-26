import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Database, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import axios from 'axios';
import useStore from '../store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ResourceDashboard = () => {
  const storeHospitalId = useStore((state) => state.hospitalId);
  const hospitalId = storeHospitalId || 'h1';

  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchResources = async () => {
    try {
      const response = await axios.get(`${API_URL}/resources/${hospitalId}`);
      if (response.data) {
        setResources(response.data);
      } else {
        setResources([]);
      }
    } catch (error) {
      console.error("Error fetching resources:", error);
      setResources([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();

    const handleWSUpdate = (e) => {
      const msg = e.detail;
      if (msg && (msg.hospital_id === hospitalId || msg.type === "RESOURCE_UPDATE")) {
        fetchResources();
      }
    };
    window.addEventListener('websocket-update', handleWSUpdate);
    return () => {
      window.removeEventListener('websocket-update', handleWSUpdate);
    };
  }, [hospitalId]);

  const COLORS = ['#0284c7', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6'];

  const handleUpdate = async (id, newAvailable) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, available: newAvailable } : r));
    try {
      await axios.patch(`${API_URL}/resources/${id}`, { available: newAvailable });
    } catch (error) {
      console.error("Failed to update resource on backend:", error);
      alert("Failed to update resource on server. Reverting...");
      fetchResources();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3 text-slate-900">
          <Database className="text-primary-500" />
          Hospital Resources
        </h1>
        <div className="text-xs font-bold text-slate-400 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
          Last Updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {resources.map((res, idx) => (
          <div key={res.id} className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className={`absolute top-0 left-0 w-1.5 h-full`} style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
            
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold uppercase text-slate-400 text-xs tracking-wider">{res.resource_type}</h3>
              {res.available < res.total * 0.2 ? (
                <AlertTriangle size={16} className="text-red-500 animate-pulse" />
              ) : (
                <CheckCircle size={16} className="text-green-500" />
              )}
            </div>
            
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-800">{res.available}</span>
              <span className="text-slate-400 text-sm">/ {res.total}</span>
            </div>
            
            <div className="mt-4 flex gap-2">
              <button 
                onClick={() => handleUpdate(res.id, Math.max(0, res.available - 1))}
                className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 py-1.5 rounded-lg text-sm font-bold transition-colors cursor-pointer"
              >
                -
              </button>
              <button 
                onClick={() => handleUpdate(res.id, Math.min(res.total, res.available + 1))}
                className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 py-1.5 rounded-lg text-sm font-bold transition-colors cursor-pointer"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm h-[400px]">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800">
          <TrendingUp size={20} className="text-primary-500" />
          Resource Availability Overview
        </h3>
        <ResponsiveContainer width="100%" height="80%">
          <BarChart data={resources}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
            <XAxis 
              dataKey="resource_type" 
              stroke="rgba(0,0,0,0.4)" 
              fontSize={11} 
              tickFormatter={(val) => val.toUpperCase()} 
            />
            <YAxis stroke="rgba(0,0,0,0.4)" fontSize={11} />
            <Tooltip 
              cursor={{ fill: 'rgba(0,0,0,0.02)' }}
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
            />
            <Bar dataKey="available" radius={[4, 4, 0, 0]}>
              {resources.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ResourceDashboard;
