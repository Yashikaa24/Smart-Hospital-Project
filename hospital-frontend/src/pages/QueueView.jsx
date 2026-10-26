import { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, Clock, Search } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const QueueView = () => {
  const [hospitals, setHospitals] = useState([]);
  const [doctorsList, setDoctorsList] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch hospitals on mount
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const res = await axios.get(`${API_URL}/hospitals`);
        setHospitals(res.data);
        if (res.data.length > 0) {
          setSelectedHospitalId(res.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load hospitals:', err);
      }
    };
    fetchHospitals();
  }, []);

  // Fetch doctors when hospital changes
  useEffect(() => {
    if (!selectedHospitalId) return;
    const fetchDoctors = async () => {
      try {
        const res = await axios.get(`${API_URL}/hospitals/${selectedHospitalId}/doctors`);
        setDoctorsList(res.data);
        setDoctorId(res.data.length > 0 ? res.data[0].id : '');
        setQueue([]);
      } catch (err) {
        console.error('Failed to load doctors:', err);
      }
    };
    fetchDoctors();
  }, [selectedHospitalId]);

  const fetchQueue = async () => {
    if (!doctorId) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/tokens/queue/${doctorId}`);
      setQueue(response.data);
    } catch (error) {
      console.error('Error fetching queue:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, [doctorId]);

  // Compute avg wait from queue data
  const waitingQueue = queue.filter(t => t.status === 'waiting');
  const avgWait = waitingQueue.length > 0
    ? Math.round(waitingQueue.reduce((sum, t) => sum + (t.eta_minutes || 0), 0) / waitingQueue.length)
    : 0;

  const filteredQueue = queue.filter(t =>
    !searchTerm || t.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(t.token_number).includes(searchTerm)
  );

  const activeDoctor = doctorsList.find(d => d.id === doctorId);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Live Hospital Queue</h1>
        <p className="text-slate-500 text-sm mt-1">Real-time waiting list {activeDoctor ? ` for ${activeDoctor.name}` : ''}</p>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <label className="text-xs text-slate-400 font-bold mb-1.5 block">Hospital</label>
          <select
            value={selectedHospitalId}
            onChange={(e) => setSelectedHospitalId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer"
          >
            {hospitals.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 font-bold mb-1.5 block">Doctor</label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer"
          >
            {doctorsList.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.department})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-sky-50 rounded-xl text-primary-500"><Users size={20} /></div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Total Waiting</p>
            <p className="text-2xl font-black text-slate-800">{waitingQueue.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-teal-50 rounded-xl text-hospital-teal"><Clock size={20} /></div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Avg. Wait Time</p>
            <p className="text-2xl font-black text-slate-800">{avgWait > 0 ? `${avgWait} mins` : '—'}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-500"><Search size={20} /></div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name/token..."
              className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none text-slate-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">Token</th>
              <th className="px-6 py-4">Patient Name</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Est. Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="4" className="px-6 py-16 text-center text-slate-400 italic">Loading queue...</td></tr>
            ) : filteredQueue.length === 0 ? (
              <tr><td colSpan="4" className="px-6 py-16 text-center text-slate-400 italic">No active tokens in the queue.</td></tr>
            ) : (
              filteredQueue.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="w-10 h-10 flex items-center justify-center bg-slate-100 text-slate-700 rounded-xl font-extrabold group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors">
                      {t.token_number}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-800">{t.patient_name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${
                      t.status === 'called' ? 'bg-primary-500 text-white animate-pulse' :
                      t.status === 'present' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {t.status === 'waiting' ? `${t.eta_minutes} mins` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QueueView;
