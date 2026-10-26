import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import useStore from '../store';
import { 
  Activity, MapPin, Phone, Bed, Star, Users, Clock, 
  Sparkles, CheckCircle2, User, Smartphone, ShieldAlert, ArrowLeft 
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const PatientResourceView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const setToken = useStore((state) => state.setToken);

  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState(null);
  const [bookingDoctor, setBookingDoctor] = useState(null);
  
  // Booking Form State
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  const fetchHospitalDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/hospitals/${id}/details`);
      setHospital(response.data);
      if (response.data.departments.length > 0 && !selectedDept) {
        setSelectedDept(response.data.departments[0].name);
      }
    } catch (error) {
      console.error('Error fetching hospital details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitalDetails();

    const handleWSUpdate = (e) => {
      const msg = e.detail;
      if (msg && (msg.hospital_id === id || msg.type === "RESOURCE_UPDATE" || msg.type === "QUEUE_UPDATE" || msg.type === "DOCTOR_UPDATE")) {
        fetchHospitalDetails();
      }
    };

    window.addEventListener('websocket-update', handleWSUpdate);
    return () => {
      window.removeEventListener('websocket-update', handleWSUpdate);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm">Fetching live hospital records...</p>
      </div>
    );
  }

  if (!hospital) {
    return (
      <div className="text-center py-20 text-slate-500 space-y-4 max-w-md mx-auto bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
        <ShieldAlert size={48} className="mx-auto text-red-500" />
        <h2 className="text-2xl font-bold text-slate-800">Hospital Not Found</h2>
        <button onClick={() => navigate('/resources')} className="btn-primary">Back to Explorer</button>
      </div>
    );
  }

  const selectedDepartmentData = hospital.departments.find(d => d.name === selectedDept);

  const handleBookToken = async (e) => {
    e.preventDefault();
    if (!bookingDoctor) return;
    setBookingLoading(true);
    try {
      const response = await axios.post(`${API_URL}/tokens/create`, {
        doctor_id: bookingDoctor.id,
        patient_name: patientName,
        phone: phone,
        is_half: true // Generate a Half Token
      });
      setToken(response.data);
      navigate('/token');
    } catch (error) {
      console.error('Error creating token:', error);
      alert('Failed to register token. Please try again.');
    } finally {
      setBookingLoading(false);
      setBookingDoctor(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Navigation and Back */}
      <button 
        onClick={() => navigate('/resources')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors font-medium"
      >
        <ArrowLeft size={16} /> Back to Explorer
      </button>

      {/* Hospital Banner Info Card */}
      <div className="relative overflow-hidden bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary-50 rounded-full blur-3xl -z-10 opacity-30"></div>
        
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div className="space-y-4 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                hospital.crowd_level === 'Low' ? 'bg-green-50 text-green-600 border border-green-200' :
                hospital.crowd_level === 'Moderate' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                'bg-red-50 text-red-600 border border-red-200'
              }`}>
                {hospital.crowd_level === 'Low' ? '🟢 Low Crowd' : hospital.crowd_level === 'Moderate' ? '🟡 Moderate' : '🔴 Heavy Crowd'}
              </span>
              <span className="text-green-600 font-bold uppercase tracking-wider text-xs flex items-center gap-1">
                ● Open 24/7
              </span>
            </div>
            
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{hospital.name}</h1>
              <p className="text-slate-500 text-sm mt-1 flex items-center gap-1">
                <MapPin size={14} className="text-slate-400" /> {hospital.address}
              </p>
              {hospital.phone && (
                <p className="text-slate-400 text-xs mt-1.5 flex items-center gap-1.5">
                  <Phone size={12} className="text-slate-400" /> {hospital.phone}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {hospital.services.map((serv, idx) => (
                <span key={idx} className="bg-slate-50 text-slate-600 text-[10px] py-1 px-3 rounded-full border border-slate-200 font-bold uppercase tracking-wider">
                  {serv}
                </span>
              ))}
            </div>
          </div>

          {/* Stats Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:flex md:flex-col gap-4 md:w-64">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-center shadow-sm">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-1">General Beds</span>
              <span className="text-2xl font-black text-green-600">{hospital.available_beds} <span className="text-xs text-slate-400 font-medium">/ {hospital.total_beds}</span></span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-center shadow-sm">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-1">ICU Beds</span>
              <span className="text-2xl font-black text-primary-500">{hospital.available_icu} <span className="text-xs text-slate-400 font-medium">/ {hospital.total_icu}</span></span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-center shadow-sm">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-1">Ambulance</span>
              <span className="text-2xl font-black text-amber-500">{hospital.ambulance_available} Ready</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-center shadow-sm">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-1">Avg wait time</span>
              <span className="text-2xl font-black text-primary-500">{hospital.avg_wait_time} min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Flow: Departments & Doctors */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Middle: Departments selector and Doctors */}
        <div className="lg:col-span-8 space-y-6">
          <div className="space-y-3 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-xl font-bold tracking-tight text-slate-800">Select Department</h2>
            <div className="flex flex-wrap gap-2">
              {hospital.departments.map((dept) => (
                <button
                  key={dept.name}
                  onClick={() => {
                    setSelectedDept(dept.name);
                    setBookingDoctor(null);
                  }}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    selectedDept === dept.name 
                      ? 'bg-primary-500 border-primary-500 text-white shadow-sm' 
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  {dept.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800">Available Doctors</h2>
            {selectedDepartmentData?.doctors.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400">
                No doctors currently scheduled in this department.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedDepartmentData?.doctors.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => {
                      if (doc.is_available) {
                        setBookingDoctor(doc);
                        setTimeout(() => {
                          const formEl = document.getElementById('booking-form');
                          if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
                        }, 50);
                      }
                    }}
                    className={`border cursor-pointer transition-all duration-300 p-5 rounded-2xl bg-white flex flex-col justify-between ${
                      !doc.is_available ? 'opacity-40 pointer-events-none' : 
                      bookingDoctor?.id === doc.id ? 'border-primary-500 ring-2 ring-primary-500/10 shadow-md' : 'border-slate-100 hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <div className="flex gap-4 items-start mb-4">
                      <img 
                        src={doc.photo_url} 
                        alt={doc.name} 
                        className="w-16 h-16 rounded-2xl bg-slate-50 object-cover border border-slate-100"
                      />
                      <div className="space-y-1">
                        <h4 className="font-bold text-md leading-tight text-slate-800">{doc.name}</h4>
                        <p className="text-xs text-slate-400 font-semibold">{doc.specialization}</p>
                        <p className="text-[11px] text-primary-500 font-bold flex items-center gap-1">
                          <Star size={12} className="fill-primary-500" /> {doc.experience_years} Years Experience
                        </p>
                      </div>
                    </div>

                    {/* AI Prediction details widget */}
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-2 mb-4">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <span>AI Queue Prediction</span>
                        <span className="text-primary-500 flex items-center gap-1 font-extrabold">
                          <Sparkles size={11} /> {doc.confidence}% Confidence
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white border border-slate-200/60 py-1.5 rounded-lg shadow-sm">
                          <span className="text-[9px] text-slate-400 block font-bold">Wait Time</span>
                          <span className="text-sm font-black text-slate-700">{doc.est_wait_time} min</span>
                        </div>
                        <div className="bg-white border border-slate-200/60 py-1.5 rounded-lg shadow-sm">
                          <span className="text-[9px] text-slate-400 block font-bold">Ahead</span>
                          <span className="text-sm font-black text-green-600">{doc.patients_ahead}</span>
                        </div>
                        <div className="bg-white border border-slate-200/60 py-1.5 rounded-lg shadow-sm">
                          <span className="text-[9px] text-slate-400 block font-bold">Token</span>
                          <span className="text-sm font-black text-slate-700">#{doc.current_token || '--'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs pt-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          doc.status_text === 'Available' ? 'bg-green-500 animate-pulse' :
                          doc.status_text === 'Busy' ? 'bg-red-500' : 'bg-amber-500'
                        }`}></span>
                        <span className="text-slate-600 font-semibold">{doc.status_text}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                        <Users size={12} /> {doc.patients_waiting} Waiting
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Token Booking Confirmation */}
        <div id="booking-form" className="lg:col-span-4">
          {bookingDoctor ? (
            <div className="border border-primary-500/20 bg-white p-6 rounded-3xl space-y-6 shadow-md relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-full blur-2xl -z-10"></div>
              
              <div className="space-y-3 text-center border-b border-slate-100 pb-5">
                <Sparkles size={28} className="mx-auto text-primary-500 animate-pulse" />
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-800">Confirm Token Booking</h3>
                  <p className="text-xs text-slate-400 mt-1">Get your entry code. You are booking a tentative **Half Token**.</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                <img 
                  src={bookingDoctor.photo_url} 
                  alt={bookingDoctor.name} 
                  className="w-12 h-12 rounded-xl bg-white object-cover border border-slate-100"
                />
                <div>
                  <h4 className="font-bold text-sm text-slate-800">{bookingDoctor.name}</h4>
                  <p className="text-[11px] text-slate-400 font-medium">{bookingDoctor.specialization}</p>
                </div>
              </div>

              <form onSubmit={handleBookToken} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <User size={12} className="text-slate-400" /> Patient Full Name
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. John Doe"
                    className="input-field py-2.5 text-sm"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Smartphone size={12} className="text-slate-400" /> Contact Phone Number
                  </label>
                  <input 
                    type="tel" 
                    placeholder="e.g. 9876543210"
                    className="input-field py-2.5 text-sm"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="bg-slate-50 p-3.5 border border-slate-100 rounded-2xl space-y-1.5 text-xs text-slate-500">
                  <p className="flex justify-between"><span>Predicted Queue ETA:</span> <span className="font-bold text-primary-500">{bookingDoctor.est_wait_time} min</span></p>
                  <p className="flex justify-between"><span>Patients Ahead:</span> <span className="font-bold text-slate-800">{bookingDoctor.patients_ahead}</span></p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-1 border-t border-slate-200 pt-1.5">
                    * Generating a Half Token secures your position temporarily. You must arrive within the hospital boundary to claim your active spot.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="w-full btn-primary py-3 rounded-2xl flex items-center justify-center gap-2 font-bold tracking-wide"
                >
                  {bookingLoading ? 'Generating Half Token...' : 'Confirm Half Token'}
                  <CheckCircle2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setBookingDoctor(null)}
                  className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 py-2.5 rounded-2xl text-xs font-bold transition-all border border-slate-200 cursor-pointer"
                >
                  Cancel Selection
                </button>
              </form>
            </div>
          ) : (
            <div className="border border-slate-100 p-8 text-center text-slate-400 bg-white shadow-sm rounded-3xl h-64 flex flex-col justify-center items-center">
              <Activity size={32} className="animate-pulse text-slate-300 mb-2" />
              <p className="text-sm">Please select an available doctor from the list to generate your queue ticket.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientResourceView;
