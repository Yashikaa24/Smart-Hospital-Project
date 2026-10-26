import { useState } from 'react';
import axios from 'axios';
import { Activity, ShieldAlert, Clock, Stethoscope, Send } from 'lucide-react';

const Triage = () => {
  const [symptoms, setSymptoms] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/triage/symptoms', { symptoms });
      setResult(response.data);
    } catch (error) {
      console.error('Error in triage:', error);
      alert('AI Triage is currently unavailable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black mb-4 gradient-text">AI Symptom Triage</h1>
        <p className="text-white/60">Describe your symptoms and our AI will route you to the correct department.</p>
      </div>

      {!result ? (
        <div className="glass-card">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">How are you feeling?</label>
              <textarea 
                className="input-field min-h-[150px] pt-4" 
                placeholder="e.g. I have a sharp pain in my chest and difficulty breathing..."
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2 py-4"
            >
              {loading ? 'Analyzing Symptoms...' : 'Run AI Analysis'}
              <Send size={20} />
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in zoom-in duration-500">
          <div className={`p-8 rounded-2xl border-2 ${
            result.urgency === 'emergency' ? 'bg-red-500/20 border-red-500' :
            result.urgency === 'high' ? 'bg-orange-500/20 border-orange-500' :
            'bg-green-500/20 border-green-500'
          }`}>
            <div className="flex items-center gap-4 mb-6">
              <ShieldAlert size={48} className={result.urgency === 'emergency' ? 'text-red-500' : 'text-primary-400'} />
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-tighter">Urgency: {result.urgency}</h2>
                <p className="text-white/70">{result.reason}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass bg-black/20 p-6 rounded-xl">
                <Stethoscope className="text-primary-400 mb-2" />
                <p className="text-sm text-white/50">Recommended Department</p>
                <p className="text-xl font-bold">{result.department}</p>
              </div>
              <div className="glass bg-black/20 p-6 rounded-xl">
                <Clock className="text-primary-400 mb-2" />
                <p className="text-sm text-white/50">Expected See-Doctor Time</p>
                <p className="text-xl font-bold">{result.see_doctor_in_minutes} mins</p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setResult(null)} 
            className="w-full py-3 text-white/40 hover:text-white transition-colors"
          >
            Run Another Analysis
          </button>
        </div>
      )}

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 rounded-xl border border-white/5 bg-white/5">
          <Activity size={24} className="text-primary-400 mb-2" />
          <h4 className="font-bold mb-1">Instant Routing</h4>
          <p className="text-xs text-white/50">Get matched with the right specialists instantly.</p>
        </div>
        <div className="p-4 rounded-xl border border-white/5 bg-white/5">
          <ShieldAlert size={24} className="text-primary-400 mb-2" />
          <h4 className="font-bold mb-1">Safety First</h4>
          <p className="text-xs text-white/50">Emergency cases are prioritized and flagged.</p>
        </div>
        <div className="p-4 rounded-xl border border-white/5 bg-white/5">
          <Clock size={24} className="text-primary-400 mb-2" />
          <h4 className="font-bold mb-1">Live Tracking</h4>
          <p className="text-xs text-white/50">Know exactly how long you'll have to wait.</p>
        </div>
      </div>
    </div>
  );
};

export default Triage;
