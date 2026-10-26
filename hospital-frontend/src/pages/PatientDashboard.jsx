import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useStore from '../store';
import { Activity, MapPin, Stethoscope, MessageSquare, Scan, Clock, ArrowRight, BellRing, Building2 } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const PatientDashboard = () => {
  const navigate = useNavigate();
  const token = useStore((state) => state.token);
  
  const [queueInfo, setQueueInfo] = useState(null);
  const [loadingQueue, setLoadingQueue] = useState(false);

  const fetchQueue = async () => {
    if (!token) return;
    setLoadingQueue(true);
    try {
      const response = await axios.get(`${API_URL}/tokens/queue/${token.doctor_id}`);
      const list = response.data;
      const myTokenIndex = list.findIndex(t => t.id === token.id);
      
      if (myTokenIndex !== -1) {
        const myTokenInQueue = list[myTokenIndex];
        const ahead = list.slice(0, myTokenIndex).filter(t => t.status === 'waiting' || t.status === 'called').length;
        
        setQueueInfo({
          position: ahead + 1,
          patientsAhead: ahead,
          status: myTokenInQueue.status,
          eta: myTokenInQueue.eta_minutes || (ahead * 10),
          tokenNumber: myTokenInQueue.token_number
        });

        if (myTokenInQueue.status !== token.status) {
          useStore.getState().setToken({ ...token, status: myTokenInQueue.status });
        }
      }
    } catch (error) {
      console.error('Error fetching queue status:', error);
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    let interval;
    if (token) {
      interval = setInterval(fetchQueue, 15000); // Poll every 15s
    }
    return () => clearInterval(interval);
  }, [token?.id]);

  const mainActions = [
    {
      title: 'Scan QR Ticket',
      desc: 'Scan hospital or clinic QR codes to instantly join the consultation queue and get a token.',
      icon: Scan,
      path: '/scan',
      color: 'from-amber-50/40 via-amber-50/10 to-transparent',
      borderColor: 'border-slate-100 hover:border-amber-300',
      iconBg: 'bg-amber-50 text-amber-500',
    },
    {
      title: 'Hospital Explorer',
      desc: 'Discover nearby medical centers, view live bed/ICU stats, wait times, and book doctor consultations.',
      icon: Building2,
      path: '/resources',
      color: 'from-sky-50/40 via-sky-50/10 to-transparent',
      borderColor: 'border-slate-100 hover:border-primary-300',
      iconBg: 'bg-sky-50 text-primary-500',
    },
  ];

  return (
    <div className="space-y-8 entrance-fade max-w-5xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Patient <span className="text-primary-500">Portal</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">Select an option below to access hospital resources or scan to join a queue.</p>
        </div>
      </div>

      {/* Active Token Tracker Widget */}
      {token ? (
        <div className="relative overflow-hidden bg-white rounded-3xl p-8 border border-slate-100 shadow-md">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-50 rounded-full blur-3xl -z-10 opacity-30"></div>
          
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                </span>
                <span className="text-xs font-bold tracking-wider text-primary-500 uppercase">Active Ticket Tracking</span>
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-slate-800">You are in queue for consultation</h2>
                <p className="text-slate-500 text-sm mt-1">Patient Name: <span className="text-slate-700 font-bold">{token.patient_name}</span></p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <span className="text-xs text-slate-400 font-semibold block mb-1">Ticket Number</span>
                  <span className="text-2xl font-black text-slate-800">{token.token_number}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center flex flex-col justify-center items-center">
                  <span className="text-xs text-slate-400 font-semibold block mb-1">Status</span>
                  <span className={`text-[11px] font-bold block uppercase py-1 px-3.5 rounded-full inline-block ${
                    token.status === 'called' ? 'bg-primary-50 text-primary-500 border border-primary-200' :
                    token.status === 'present' ? 'bg-green-50 text-green-600 border border-green-200' :
                    'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    {token.status}
                  </span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <span className="text-xs text-slate-400 font-semibold block mb-1">Estimated Wait</span>
                  <span className="text-2xl font-black text-primary-500">
                    {queueInfo ? `${queueInfo.eta} min` : '--'}
                  </span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <span className="text-xs text-slate-400 font-semibold block mb-1">Position in Line</span>
                  <span className="text-2xl font-black text-green-600">
                    {queueInfo ? `#${queueInfo.position}` : '--'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-row sm:flex-col gap-3 w-full lg:w-auto shrink-0">
              <Link 
                to="/token"
                className="w-full text-center py-3.5 px-6 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-primary-500/10 cursor-pointer"
              >
                Open Ticket Details
                <ArrowRight size={16} />
              </Link>
              {token.status === 'called' && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3">
                  <BellRing size={20} className="animate-bounce shrink-0 text-red-600" />
                  <span className="text-xs font-semibold">It's your turn! Proceed to the doctor's cabin immediately.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Grid of Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mainActions.map((action, idx) => {
          const IconComponent = action.icon;
          return (
            <div
              key={idx}
              onClick={() => navigate(action.path)}
              className={`cursor-pointer group hover:-translate-y-1 hover:shadow-md transition-all duration-300 relative overflow-hidden border flex flex-col justify-between h-[260px] p-8 rounded-2xl bg-white ${action.borderColor}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${action.color} -z-10 opacity-30`}></div>
              
              <div className="space-y-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${action.iconBg} shadow-sm`}>
                  <IconComponent size={22} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-xl font-bold tracking-tight text-slate-800">{action.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{action.desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm font-bold text-slate-600 group-hover:text-primary-500 transition-colors pt-4">
                <span>Access Feature</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PatientDashboard;
