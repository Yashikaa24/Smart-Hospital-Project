import { useEffect, useState } from 'react';
import axios from 'axios';
import { User, Phone, MapPin, CheckCircle, XCircle, Play, SkipForward, Clock, ToggleLeft, ToggleRight, CheckSquare, Award } from 'lucide-react';
import useStore from '../store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const DoctorDashboard = () => {
  const storeDoctorId = useStore((state) => state.doctorId);
  const storeHospitalId = useStore((state) => state.hospitalId);

  const [hospitalsList, setHospitalsList] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState(storeHospitalId || '');
  const [doctorsList, setDoctorsList] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(storeDoctorId || '');
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [completedCount, setCompletedCount] = useState(0);

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

  // 2. Fetch doctors whenever selectedHospitalId changes
  useEffect(() => {
    const fetchDoctors = async () => {
      if (!selectedHospitalId) return;
      try {
        const response = await axios.get(`${API_URL}/hospitals/${selectedHospitalId}/doctors`);
        setDoctorsList(response.data);
        if (response.data.length > 0) {
          const defaultDocId = selectedDocId && response.data.some(d => d.id === selectedDocId) 
            ? selectedDocId 
            : response.data[0].id;
          setSelectedDocId(defaultDocId);
          useStore.getState().setDoctorId(defaultDocId);
        } else {
          setSelectedDocId('');
        }
      } catch (err) {
        console.error('Error fetching doctors:', err);
      }
    };
    fetchDoctors();
  }, [selectedHospitalId]);

  // Find active doctor & hospital object to retrieve details and coords
  const activeHospitalObj = hospitalsList.find(h => h.id === selectedHospitalId);
  const activeHospitalCoords = activeHospitalObj 
    ? [activeHospitalObj.latitude || 22.7213, activeHospitalObj.longitude || 75.8897] 
    : [22.7213, 75.8897];

  const activeDoc = doctorsList.find(d => d.id === selectedDocId) || {
    id: selectedDocId,
    name: 'No Doctor Selected',
    department: 'N/A',
    avg_consult_minutes: 10,
  };

  const fetchQueue = async () => {
    if (!selectedDocId) return;
    try {
      const response = await axios.get(`${API_URL}/tokens/queue/${selectedDocId}`);
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

    // Live WebSockets sync
    const handleWSUpdate = (e) => {
      const msg = e.detail;
      if (msg && msg.type === "QUEUE_UPDATE" && msg.doctor_id === selectedDocId) {
        fetchQueue();
      }
    };

    window.addEventListener('websocket-update', handleWSUpdate);
    return () => {
      window.removeEventListener('websocket-update', handleWSUpdate);
    };
  }, [selectedDocId]);

  const handleCall = async (tokenId) => {
    try {
      await axios.post(`${API_URL}/tokens/call/${tokenId}`);
      fetchQueue();
    } catch (error) {
      console.error(error);
      alert('Failed to call patient');
    }
  };

  const handleStatusUpdate = async (tokenId, status) => {
    try {
      await axios.patch(`${API_URL}/tokens/${tokenId}`, { status });
      if (status === 'completed') {
        setCompletedCount(prev => prev + 1);
      }
      fetchQueue();
    } catch (error) {
      console.error(error);
      alert('Failed to update status');
    }
  };

  // Proximity Calculation (Haversine formula)
  const getProximityLabel = (lat, lng) => {
    if (!lat || !lng) return { text: 'Unknown', color: 'text-slate-400 bg-slate-50 border border-slate-100', dotColor: 'bg-slate-300' };
    
    const [hLat, hLng] = activeHospitalCoords;
    const R = 6371; // km
    const dLat = (hLat - lat) * Math.PI / 180;
    const dLng = (hLng - lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat * Math.PI / 180) * Math.cos(hLat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = R * c;
    const distanceMeters = distanceKm * 1000;

    if (distanceMeters < 50) {
      return { text: 'Nearby (In Hall)', color: 'text-green-600 bg-green-50 border border-green-200', dotColor: 'bg-green-500' };
    } else if (distanceMeters < 300) {
      return { text: 'On Campus', color: 'text-amber-600 bg-amber-50 border border-amber-200', dotColor: 'bg-amber-500' };
    } else {
      return { text: 'Away', color: 'text-red-600 bg-red-50 border border-red-200', dotColor: 'bg-red-500' };
    }
  };

  const currentPatient = queue.find(t => t.status === 'called' || t.status === 'present');
  const waitingPatients = queue.filter(t => t.status === 'waiting');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header with Selectors and Toggle */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isAvailable ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-xs uppercase font-bold tracking-widest text-slate-400">Clinician Workspace</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1 text-slate-900">Doctor's Queue Console</h1>
          <p className="text-slate-500 text-sm mt-1">Currently managing queue updates for {activeDoc.department}.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          {/* Hospital Selector */}
          <div className="flex flex-col">
            <label className="text-xs text-slate-400 font-bold mb-1 block">Select Hospital</label>
            <select
              value={selectedHospitalId}
              onChange={(e) => {
                setSelectedHospitalId(e.target.value);
                useStore.getState().setHospitalId(e.target.value);
                setSelectedDocId(''); // Reset doctor selection
              }}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 outline-none font-semibold text-sm cursor-pointer hover:bg-slate-100 transition-colors"
            >
              {hospitalsList.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          {/* Doctor Profile Selection */}
          <div className="flex flex-col">
            <label className="text-xs text-slate-400 font-bold mb-1 block">Select Active Doctor</label>
            <select
              value={selectedDocId}
              onChange={(e) => {
                setSelectedDocId(e.target.value);
                useStore.getState().setDoctorId(e.target.value);
              }}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 outline-none font-semibold text-sm cursor-pointer hover:bg-slate-100 transition-colors"
            >
              {doctorsList.length === 0 ? (
                <option value="">No Doctors Registered</option>
              ) : (
                doctorsList.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.department})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Availability Toggle */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
            <span className="text-sm font-semibold text-slate-600">{isAvailable ? 'Online' : 'Offline'}</span>
            <button 
              onClick={() => setIsAvailable(!isAvailable)}
              className="text-primary-500 hover:text-primary-600 transition-colors cursor-pointer"
            >
              {isAvailable ? <ToggleRight size={36} /> : <ToggleLeft size={36} className="text-slate-300" />}
            </button>
          </div>
        </div>
      </div>

      {/* Analytics widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 text-center shadow-sm">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Patients Waiting</p>
          <p className="text-3xl font-black text-slate-800 mt-1">{waitingPatients.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 text-center shadow-sm">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Currently In Call</p>
          <p className="text-3xl font-black text-primary-500 mt-1">{queue.filter(t => t.status === 'called').length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 text-center shadow-sm">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Treated Today</p>
          <p className="text-3xl font-black text-green-600 mt-1">{completedCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 text-center shadow-sm">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Avg. Consult Time</p>
          <p className="text-3xl font-black text-amber-500 mt-1">{activeDoc.avg_consult_minutes || 10} mins</p>
        </div>
      </div>

      {/* Main Grid: Queue and Active Consultation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Live Queue list */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
            <Clock size={20} className="text-primary-500" />
            Live Queue Line
          </h3>

          {!selectedDocId ? (
            <div className="bg-white border border-slate-100 text-center py-10 text-slate-400 rounded-2xl shadow-sm">Select a doctor to view the patient queue.</div>
          ) : loading ? (
            <div className="bg-white border border-slate-100 text-center py-10 text-slate-400 rounded-2xl shadow-sm">Loading patient queue...</div>
          ) : queue.length === 0 ? (
            <div className="bg-white border border-slate-100 text-center py-10 text-slate-400 rounded-2xl shadow-sm">No patients registered in the queue today.</div>
          ) : (
            <div className="space-y-3">
              {queue.map((patient) => {
                const prox = getProximityLabel(patient.location_lat, patient.location_lng);
                return (
                  <div 
                    key={patient.id} 
                    className={`bg-white border p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 transition-all hover:border-slate-300 shadow-sm ${
                      patient.status === 'called' ? 'border-primary-500 ring-2 ring-primary-500/10' : 
                      patient.status === 'present' ? 'border-green-500 ring-2 ring-green-500/10' : 'border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black ${
                        patient.status === 'called' ? 'bg-primary-500 text-white' :
                        patient.status === 'present' ? 'bg-green-500 text-white' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {patient.token_number}
                      </div>
                      <div>
                        <h4 className="font-bold text-md text-slate-800 flex items-center gap-2">
                          {patient.patient_name}
                          <span className={`w-2 h-2 rounded-full ${prox.dotColor}`} title={prox.text}></span>
                        </h4>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-semibold">
                          <Phone size={12} /> {patient.phone || 'No phone'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
                      {/* Proximity badge */}
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${prox.color}`}>
                        {prox.text}
                      </span>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        {patient.status === 'waiting' && (
                          <button 
                            onClick={() => handleCall(patient.id)}
                            className="bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Play size={14} /> Call
                          </button>
                        )}
                        {patient.status === 'called' && (
                          <>
                            <button 
                              onClick={() => handleStatusUpdate(patient.id, 'present')}
                              className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <CheckCircle size={14} /> Present
                            </button>
                            <button 
                              onClick={() => handleStatusUpdate(patient.id, 'cancelled')}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <SkipForward size={14} /> Skip
                            </button>
                          </>
                        )}
                        {patient.status === 'present' && (
                          <button 
                            onClick={() => handleStatusUpdate(patient.id, 'completed')}
                            className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <CheckSquare size={14} /> Complete
                          </button>
                        )}
                        {patient.status !== 'waiting' && patient.status !== 'called' && patient.status !== 'present' && (
                          <span className="text-xs text-slate-400 italic px-2">{patient.status}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Active Consultation Summary */}
        <div className="space-y-6">
          <div className="bg-white border border-primary-500/20 p-6 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-full blur-2xl -z-10"></div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
              <Award size={20} className="text-primary-500" />
              Active Consultation
            </h3>

            {currentPatient ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-4 rounded-xl">
                  <div className="w-12 h-12 rounded-full bg-primary-500 text-white flex items-center justify-center text-xl font-bold">
                    {currentPatient.token_number}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{currentPatient.patient_name}</h4>
                    <p className="text-xs text-slate-500 uppercase font-semibold mt-0.5">Status: <span className="text-primary-500 font-bold">{currentPatient.status}</span></p>
                  </div>
                </div>

                <div className="space-y-2.5 text-sm pt-2">
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-400">Patient ID</span>
                    <span className="font-mono text-xs text-slate-600">{currentPatient.id.substring(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-400">Registered Phone</span>
                    <span className="text-slate-700 font-semibold">{currentPatient.phone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between pb-2">
                    <span className="text-slate-400">Wait Duration</span>
                    <span className="text-green-600 font-bold">Ready for consult</span>
                  </div>
                </div>

                <div className="pt-4 flex gap-2">
                  {currentPatient.status === 'called' && (
                    <button
                      onClick={() => handleStatusUpdate(currentPatient.id, 'present')}
                      className="w-full btn-primary py-3 rounded-2xl flex items-center justify-center gap-2 font-bold tracking-wide cursor-pointer"
                    >
                      <CheckCircle size={18} /> Mark Present
                    </button>
                  )}
                  {currentPatient.status === 'present' && (
                    <button
                      onClick={() => handleStatusUpdate(currentPatient.id, 'completed')}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-2xl flex items-center justify-center gap-2 font-bold tracking-wide cursor-pointer shadow-md shadow-primary-600/10"
                    >
                      <CheckSquare size={18} /> Finish Consultation
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">
                No patient is currently active. Call the next patient in the queue to begin.
              </div>
            )}
          </div>

          {/* Map Pin reference / Hospital Coordinates */}
          <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-3">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
              <MapPin size={20} className="text-primary-500" />
              Facility Anchor
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Hospital Name</span>
                <span className="font-bold text-slate-800">{activeHospitalObj?.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Coordinates</span>
                <span className="font-mono text-xs text-slate-600">[{activeHospitalCoords.join(', ')}]</span>
              </div>
              <div className="w-full bg-slate-100 h-px my-2"></div>
              <div className="text-xs text-slate-400 italic">
                *Proximity triggers are dynamically computed based on the patient's real-time GPS location compared to this anchor.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
