import { useEffect, useState } from 'react';
import useStore from '../store';
import { 
  Clock, Users, MapPin, Bell, AlertCircle, Navigation, 
  Sparkles, CheckCircle2, ShieldAlert, ArrowRight 
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const TokenView = () => {
  const token = useStore((state) => state.token);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
  
  // Half Token States
  const [travelTime, setTravelTime] = useState(15); // Default 15m travel time
  const [simulating, setSimulating] = useState(false);
  const [simulatedArrival, setSimulatedArrival] = useState(false);

  // Pre-call Alarm notification states
  const [hasNotifiedApproach, setHasNotifiedApproach] = useState(false);
  const [showApproachNotification, setShowApproachNotification] = useState(false);

  const fetchQueue = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/tokens/queue/${token.doctor_id}`);
      setQueue(response.data);
      
      // Update our token status/fields from the queue/details API
      const responseDetails = await axios.get(`${API_URL}/tokens/${token.id}`);
      const freshToken = responseDetails.data;
      if (freshToken) {
        useStore.getState().setToken(freshToken);
      }
    } catch (error) {
      console.error('Error fetching queue details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [token?.id]);

  // GPS Update every 30s
  useEffect(() => {
    const sendLocation = () => {
      if (!token || simulatedArrival) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          axios.patch(`${API_URL}/tokens/location/${token.id}`, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => {
          console.log("GPS access denied, fallback to manual simulator", err);
        }
      );
    };

    const locInterval = setInterval(sendLocation, 30000);
    sendLocation();
    return () => clearInterval(locInterval);
  }, [token?.id, simulatedArrival]);

  // 5-min timer for "called" status
  useEffect(() => {
    let timer;
    if (token?.status === 'called') {
      timer = setInterval(() => {
        setCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [token?.status]);

  // Ring the device synthesizer
  const triggerApproachRinger = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const playRing = () => {
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, audioCtx.currentTime); // Standard mixed tone
        osc2.frequency.setValueAtTime(480, audioCtx.currentTime);
        
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime + 0.9);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.0);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc1.start();
        osc2.start();
        osc1.stop(audioCtx.currentTime + 1.0);
        osc2.stop(audioCtx.currentTime + 1.0);
      };

      playRing();
      setTimeout(playRing, 1500);
      setTimeout(playRing, 3000);

      if (navigator.vibrate) {
        navigator.vibrate([400, 200, 400, 200, 400]);
      }
    } catch (e) {
      console.log('Audio Context or Vibe API not supported:', e);
    }
  };

  // Pre-call checking logic: 1-5 users ahead or ETA <= 5 mins
  useEffect(() => {
    if (token && token.status === 'waiting' && queue.length > 0) {
      const myPos = queue.findIndex(t => t.id === token.id);
      const isClose = (myPos !== -1 && myPos <= 4) || (token.eta_minutes !== null && token.eta_minutes <= 5);
      
      if (isClose && !hasNotifiedApproach) {
        setHasNotifiedApproach(true);
        setShowApproachNotification(true);
        triggerApproachRinger();
      }
    }
  }, [queue, token?.id, token?.status, hasNotifiedApproach]);

  if (!token) {
    return (
      <div className="max-w-md mx-auto text-center py-20 bg-white border border-slate-100 rounded-2xl p-8 shadow-sm">
        <AlertCircle size={48} className="text-primary-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800">No Active Ticket</h2>
        <p className="text-slate-500 text-sm mt-2">Please explore hospitals or scan a QR code first to join a consultation queue.</p>
        <button 
          onClick={() => navigate('/resources')}
          className="btn-primary mt-6 mx-auto text-sm"
        >
          Browse Hospitals
        </button>
      </div>
    );
  }

  const myPosition = queue.findIndex(t => t.id === token.id);
  const myData = token;

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getSuggestedDeparture = (etaMins) => {
    if (!etaMins) return '--';
    const departureDelta = etaMins - travelTime;
    if (departureDelta <= 0) {
      return "Depart immediately!";
    }
    const now = new Date();
    const depTime = new Date(now.getTime() + departureDelta * 60 * 1000);
    return depTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSimulateArrival = async () => {
    if (!token.hospital_lat || !token.hospital_lng) {
      alert("Coordinates are syncing, please wait a moment.");
      return;
    }
    setSimulating(true);
    try {
      const res = await axios.patch(`${API_URL}/tokens/location/${token.id}`, {
        lat: token.hospital_lat,
        lng: token.hospital_lng
      });
      if (res.data.geofence_triggered) {
        setSimulatedArrival(true);
        await fetchQueue();
      } else {
        alert("Arrival simulated, but boundary check failed. Try again.");
      }
    } catch (err) {
      console.error("Geofence simulation failed:", err);
      alert("Error sending location updates.");
    } finally {
      setSimulating(false);
    }
  };

  // Queue progress calculation
  const totalInQueue = queue.length || 1;
  const currentProgress = myPosition >= 0 ? ((totalInQueue - myPosition) / totalInQueue) * 100 : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Called Banner */}
      {token.status === 'called' && (
        <div className="bg-primary-500 text-white p-6 rounded-2xl shadow-lg shadow-primary-500/20 flex items-center gap-4 border border-primary-400">
          <div className="p-3 bg-white/20 rounded-full animate-bounce">
            <Bell size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">You're Next in Line!</h2>
            <p className="text-sm opacity-90">Please report to the doctor's room immediately. Cabin appointment ticket session expires in: <span className="font-mono font-bold">{formatTime(countdown)}</span></p>
          </div>
        </div>
      )}

      {/* Cancelled Banner */}
      {token.status === 'cancelled' && (
        <div className="bg-red-50 text-red-700 border border-red-200 p-6 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-full">
            <AlertCircle size={24} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Token Cancelled</h2>
            <p className="text-sm text-red-600/80">Your ticket session has expired. You did not report or reach within the geofence boundary in time. Please book a new token.</p>
          </div>
        </div>
      )}

      {/* Turn Approaching Alert Banner */}
      {showApproachNotification && token.status === 'waiting' && (
        <div className="bg-amber-500 text-white p-6 rounded-2xl shadow-lg flex items-center gap-4 border border-amber-400">
          <div className="p-3 bg-white/20 rounded-full animate-bounce">
            <Bell size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Turn Approaching Soon!</h2>
            <p className="text-sm opacity-90">You are in the next 5 queue positions or your wait time is under 5 mins. Please prepare to visit the physician.</p>
          </div>
        </div>
      )}

      {/* Half Token Warning Banner */}
      {token.is_half && token.status !== 'cancelled' && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex items-start gap-4 text-amber-800">
          <div className="p-3 bg-amber-100 rounded-full mt-0.5">
            <ShieldAlert size={20} className="text-amber-600" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-amber-900">Tentative Half Token (Inactive)</h3>
            <p className="text-xs text-amber-800/80 leading-relaxed">
              This token is inactive. You must cross the **200-meter hospital geofence** boundary to convert it to a **Full Active Token**. Unclaimed tokens are automatically cancelled after 15 minutes.
            </p>
          </div>
        </div>
      )}

      {/* Token Details Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Token Number Card */}
        <div className="glass-card text-center flex flex-col justify-center items-center py-10 relative overflow-hidden bg-white border border-slate-100 shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-full blur-2xl -z-10"></div>
          <span className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-2">Your Token</span>
          <h2 className="text-7xl font-black text-primary-500 font-sans tracking-tight">{token.token_number}</h2>
          <p className="mt-4 font-bold text-lg text-slate-800">{token.patient_name}</p>
          <span className={`text-[10px] uppercase font-bold py-1.5 px-4 rounded-full mt-3 ${
            token.is_half ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-green-50 text-green-600 border border-green-200'
          }`}>
            {token.is_half ? 'Half Token' : 'Full Token'}
          </span>
        </div>

        {/* Stats Column */}
        <div className="space-y-4">
          <div className="glass-card flex items-center gap-4 p-5 bg-white border border-slate-100 shadow-sm">
            <div className="p-3.5 bg-sky-50 rounded-xl text-primary-500"><Users size={20} /></div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Patients Ahead</p>
              <p className="text-xl font-bold text-slate-800">{myData.patients_ahead !== null ? `${myData.patients_ahead} Patients` : 'Checking...'}</p>
            </div>
          </div>

          <div className="glass-card flex items-center gap-4 p-5 bg-white border border-slate-100 shadow-sm">
            <div className="p-3.5 bg-teal-50 rounded-xl text-hospital-teal"><Clock size={20} /></div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Est. Waiting Time</p>
              <p className="text-xl font-bold text-slate-800">{myData.eta_minutes !== null ? `${myData.eta_minutes} mins` : 'Checking...'}</p>
            </div>
          </div>

          <div className="glass-card flex items-center gap-4 p-5 bg-white border border-slate-100 shadow-sm">
            <div className="p-3.5 bg-amber-50 rounded-xl text-amber-500"><Sparkles size={20} /></div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Prediction Confidence</p>
              <p className="text-xl font-bold text-slate-800">{myData.confidence !== null ? `${myData.confidence}% Confidence` : 'Checking...'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar (Visualizer) */}
      <div className="glass-card bg-white border border-slate-100 p-6 shadow-sm space-y-3">
        <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
          <span>Queue Progress</span>
          <span>{myPosition >= 0 ? `${myPosition} ahead` : 'Completed'}</span>
        </div>
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
          <div 
            className="bg-primary-500 h-full rounded-full transition-all duration-500" 
            style={{ width: `${currentProgress}%` }}
          />
        </div>
      </div>

      {/* Suggested Departure Helper Card */}
      {token.is_half && token.status !== 'cancelled' && (
        <div className="glass-card p-6 border border-slate-100 bg-white shadow-sm space-y-4">
          <h3 className="text-md font-bold flex items-center gap-1.5 text-slate-800">
            <Clock size={18} className="text-primary-500" />
            Suggested Departure Assistant
          </h3>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-semibold block">Select your travel time to hospital:</label>
              <select 
                value={travelTime} 
                onChange={(e) => setTravelTime(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 outline-none cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <option value={5}>5 Minutes</option>
                <option value={10}>10 Minutes</option>
                <option value={15}>15 Minutes</option>
                <option value={20}>20 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
              </select>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-right sm:text-left shrink-0">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-0.5">Suggested Departure</span>
              <span className="text-lg font-black text-primary-500">{getSuggestedDeparture(myData.eta_minutes)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Geofence Location Verification Simulator */}
      {token.is_half && token.status !== 'cancelled' && (
        <div className="glass-card border border-primary-500/20 bg-white p-6 space-y-4 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-full blur-2xl -z-10"></div>
          <div className="flex items-center justify-between">
            <h3 className="text-md font-bold flex items-center gap-2 text-slate-800">
              <Navigation size={18} className="text-primary-500" />
              Location Verification Simulator
            </h3>
            <span className="text-[9px] bg-slate-100 border border-slate-200 py-1 px-2.5 rounded-full text-slate-500 font-bold uppercase tracking-widest">
              Dev Mode
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Since browser geofencing requires physical coordinates movement, use this simulator tool to verify automatic conversion logic.
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 block">Simulated Distance:</span>
              <span className="text-sm text-slate-600 flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                Outside Bounds (~5.4 km away)
              </span>
            </div>
            <button
              onClick={handleSimulateArrival}
              disabled={simulating}
              className="btn-primary py-2.5 px-5 rounded-xl font-bold flex items-center gap-1 text-xs whitespace-nowrap w-full sm:w-auto justify-center"
            >
              {simulating ? 'Syncing Coordinates...' : 'Simulate Crossing Geofence'}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Live Queue / Nearby Patients */}
      <div className="glass-card bg-white border border-slate-100 shadow-sm">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
          <Users size={20} className="text-primary-500" />
          Live Queue Listing
        </h3>
        {loading ? (
          <p className="text-slate-400 text-sm">Loading queue...</p>
        ) : (
          <div className="space-y-3">
            {queue.map((t) => (
              <div 
                key={t.id} 
                className={`flex justify-between items-center p-3.5 rounded-2xl border transition-all duration-300 ${
                  t.id === token.id 
                    ? 'bg-primary-50 border-primary-200 text-white font-bold shadow-md shadow-primary-500/10' 
                    : 'bg-slate-50 border-slate-100 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 flex items-center justify-center rounded-xl text-sm font-bold shrink-0 ${
                    t.id === token.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {t.token_number}
                  </span>
                  <span>
                    {t.patient_name} {t.id === token.id && <span className="text-sky-200 text-xs ml-1">(You)</span>}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {t.is_half && (
                    <span className={`text-[9px] border px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                      t.id === token.id ? 'bg-white/20 border-white/30 text-white' : 'bg-amber-50 border-amber-200 text-amber-600'
                    }`}>
                      Half
                    </span>
                  )}
                  <span className={`text-[10px] font-black uppercase py-1 px-3.5 rounded-lg text-center inline-block ${
                    t.status === 'called' ? (t.id === token.id ? 'bg-white text-primary-500' : 'bg-primary-500 text-white') : 
                    t.status === 'present' ? (t.id === token.id ? 'bg-white text-green-600' : 'bg-green-500 text-white') : 
                    (t.id === token.id ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-500')
                  }`}>
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenView;
