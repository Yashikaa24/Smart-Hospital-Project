import { useEffect, useState } from 'react';
import axios from 'axios';
import { User, Phone, MapPin, CheckCircle, XCircle, Play, SkipForward, Clock } from 'lucide-react';
import useStore from '../store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const StaffDashboard = () => {
  const storeDoctorId = useStore((state) => state.doctorId);
  const storeHospitalId = useStore((state) => state.hospitalId);

  const [hospitalsList, setHospitalsList] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState(storeHospitalId || '');
  const [doctorsList, setDoctorsList] = useState([]);
  const [doctorId, setDoctorId] = useState(storeDoctorId || '');
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch hospitals on mount
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const response = await axios.get(`${API_URL}/hospitals`);
        setHospitalsList(response.data);
        if (response.data.length > 0) {
          const defaultHospitalId = selectedHospitalId || response.data[0].id;
          setSelectedHospitalId(defaultHospitalId);
          useStore.getState().setHospitalId(defaultHospitalId);
        }
      } catch (err) {
        console.error('Error fetching hospitals:', err);
      }
    };
    fetchHospitals();
  }, []);

  // 2. Fetch doctors for selected hospital
  useEffect(() => {
    const fetchDoctors = async () => {
      if (!selectedHospitalId) return;
      try {
        const res = await axios.get(`${API_URL}/hospitals/${selectedHospitalId}/doctors`);
        setDoctorsList(res.data);
        if (res.data.length > 0) {
          const defaultDocId = doctorId && res.data.some(d => d.id === doctorId)
            ? doctorId
            : res.data[0].id;
          setDoctorId(defaultDocId);
          useStore.getState().setDoctorId(defaultDocId);
        } else {
          setDoctorId('');
        }
      } catch (err) {
        console.error('Error fetching doctors:', err);
      }
    };
    fetchDoctors();
  }, [selectedHospitalId]);

  const fetchQueue = async () => {
    if (!doctorId) return;
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
    setLoading(true);
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, [doctorId]);

  const handleCall = async (tokenId) => {
    try {
      await axios.post(`${API_URL}/tokens/call/${tokenId}`);
      fetchQueue();
    } catch {
      alert('Failed to call patient');
    }
  };

  const handleStatusUpdate = async (tokenId, status) => {
    try {
      await axios.patch(`${API_URL}/tokens/${tokenId}`, { status });
      fetchQueue();
    } catch {
      alert('Update failed');
    }
  };

  const activeDoc = doctorsList.find(d => d.id === doctorId);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Doctor's Queue Line</h1>
          <div className="mt-2 flex flex-wrap gap-4">
            {/* Hospital Selection */}
            <div>
              <label className="text-xs text-slate-400 font-bold mr-2">Hospital:</label>
              <select
                value={selectedHospitalId}
                onChange={(e) => {
                  setSelectedHospitalId(e.target.value);
                  useStore.getState().setHospitalId(e.target.value);
                  setDoctorId('');
                }}
                className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none cursor-pointer"
              >
                {hospitalsList.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Doctor Selection */}
            {doctorsList.length > 0 && (
              <div>
                <label className="text-xs text-slate-400 font-bold mr-2">Viewing Doctor:</label>
                <select
                  value={doctorId}
                  onChange={(e) => {
                    setDoctorId(e.target.value);
                    useStore.getState().setDoctorId(e.target.value);
                  }}
                  className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none cursor-pointer"
                >
                  {doctorsList.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.department})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-center shadow-sm">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Waiting</p>
            <p className="text-xl font-black text-slate-800">{queue.filter(t => t.status === 'waiting').length}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-center shadow-sm">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Called</p>
            <p className="text-xl font-black text-primary-500">{queue.filter(t => t.status === 'called').length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
            <Clock size={20} className="text-primary-500" />
            Live Patient List
          </h3>

          {!doctorId ? (
            <div className="bg-white border border-slate-100 text-center py-10 text-slate-400 rounded-2xl shadow-sm">Select a doctor to view the patient queue.</div>
          ) : loading ? (
            <div className="bg-white border border-slate-100 text-center py-10 text-slate-400 rounded-2xl shadow-sm">Loading queue...</div>
          ) : queue.length === 0 ? (
            <div className="bg-white border border-slate-100 text-center py-10 text-slate-400 rounded-2xl shadow-sm">No patients in queue</div>
          ) : (
            queue.map((t) => (
              <div key={t.id} className={`bg-white border p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm transition-all hover:border-slate-300 ${t.status === 'called' ? 'border-primary-500 ring-2 ring-primary-500/10' : 'border-slate-100'}`}>
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center text-xl font-black">
                    {t.token_number}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      {t.patient_name}
                    </h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1 font-semibold">
                      <Phone size={12} className="text-slate-400" /> {t.phone || 'No phone'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto justify-end">
                  {t.status === 'waiting' && (
                    <button
                      onClick={() => handleCall(t.id)}
                      className="bg-primary-500 hover:bg-primary-600 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold text-white transition-colors cursor-pointer"
                    >
                      <Play size={16} /> Call Patient
                    </button>
                  )}
                  {t.status === 'called' && (
                    <>
                      <button
                        onClick={() => handleStatusUpdate(t.id, 'present')}
                        className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold text-white cursor-pointer"
                      >
                        <CheckCircle size={16} /> Arrived
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(t.id, 'cancelled')}
                        className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold text-slate-600 border border-slate-200 cursor-pointer"
                      >
                        <SkipForward size={16} /> Skip
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleStatusUpdate(t.id, 'cancelled')}
                    className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-red-200"
                    title="Cancel token"
                  >
                    <XCircle size={20} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <MapPin size={20} className="text-primary-500" />
              Patient Proximity
            </h3>
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-semibold">Nearby (Room & Hall)</span>
                <span className="text-green-600 font-bold">
                  {queue.filter(t => t.location_lat && t.location_lng).length}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-semibold">Location Unknown</span>
                <span className="text-amber-500 font-bold">
                  {queue.filter(t => !t.location_lat).length}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-green-500 h-full rounded-full transition-all duration-300"
                  style={{ width: queue.length > 0 ? `${(queue.filter(t => t.location_lat).length / queue.length) * 100}%` : '0%' }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Doctor Availability</h3>
            {activeDoc ? (
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <img
                  src={activeDoc.photo_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${activeDoc.name}`}
                  alt={activeDoc.name}
                  className="w-10 h-10 rounded-lg object-cover"
                />
                <div>
                  <p className="font-bold text-slate-800 text-sm">{activeDoc.name}</p>
                  <p className={`text-xs font-bold ${activeDoc.is_available ? 'text-green-600' : 'text-red-500'}`}>
                    {activeDoc.is_available ? 'Available' : 'Absent'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">Select a doctor above</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
