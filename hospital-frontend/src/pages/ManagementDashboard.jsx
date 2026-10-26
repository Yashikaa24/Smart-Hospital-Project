import { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line } from 'recharts';
import { 
  Database, TrendingUp, AlertTriangle, CheckCircle, ShieldAlert, 
  BarChart3, PieChart as PieIcon, LineChart as LineIcon, Activity, 
  Plus, Minus, Edit3, Trash2, Check, X, Stethoscope 
} from 'lucide-react';
import useStore from '../store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ManagementDashboard = () => {
  const storeHospitalId = useStore((state) => state.hospitalId);

  // Hospitals fetched dynamically from the backend
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState(storeHospitalId || '');
  const [resources, setResources] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch hospital list on mount
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const res = await axios.get(`${API_URL}/hospitals`);
        setHospitals(res.data);
        if (res.data.length > 0) {
          const defaultId = storeHospitalId && res.data.find(h => h.id === storeHospitalId)
            ? storeHospitalId
            : res.data[0].id;
          setSelectedHospitalId(defaultId);
          useStore.getState().setHospitalId(defaultId);
        }
      } catch (err) {
        console.error('Failed to fetch hospitals:', err);
      }
    };
    fetchHospitals();
  }, []);

  // Resources CRUD States
  const [editingResId, setEditingResId] = useState(null);
  const [editTotal, setEditTotal] = useState(0);
  const [editAvailable, setEditAvailable] = useState(0);
  const [showAddResource, setShowAddResource] = useState(false);
  const [newResType, setNewResType] = useState('bed');
  const [newResTotal, setNewResTotal] = useState(10);
  const [newResAvailable, setNewResAvailable] = useState(10);

  // Doctors CRUD States
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [docName, setDocName] = useState('');
  const [docDept, setDocDept] = useState('General OPD');
  const [docSpecialization, setDocSpecialization] = useState('');
  const [docExperience, setDocExperience] = useState(5);
  const [docConsultMinutes, setDocConsultMinutes] = useState(10);
  const [docPhoto, setDocPhoto] = useState('');

  // Selected Hospital object
  const activeHospital = hospitals.find(h => h.id === selectedHospitalId) || hospitals[0] || { name: '', address: '' };

  // Analytics states
  const [triageDistribution, setTriageDistribution] = useState([]);
  const [hourlyWaitTimes, setHourlyWaitTimes] = useState([]);

  // Fetch Resources from Backend DB
  const fetchResources = async () => {
    try {
      const response = await axios.get(`${API_URL}/resources/${selectedHospitalId}`);
      setResources(response.data);
    } catch (error) {
      console.error("Error fetching resources:", error);
      setResources([]);
    }
  };

  // Fetch Doctors from Backend DB
  const fetchDoctors = async () => {
    try {
      const response = await axios.get(`${API_URL}/hospitals/${selectedHospitalId}/doctors`);
      setDoctors(response.data);
    } catch (error) {
      console.error("Error fetching doctors:", error);
      setDoctors([]);
    }
  };

  // Fetch Analytics from Backend DB
  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API_URL}/hospitals/${selectedHospitalId}/analytics`);
      setTriageDistribution(response.data.triage_distribution);
      setHourlyWaitTimes(response.data.hourly_wait_times);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      setTriageDistribution([]);
      setHourlyWaitTimes([]);
    }
  };

  useEffect(() => {
    if (!selectedHospitalId) return;
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchResources(), fetchDoctors(), fetchAnalytics()]);
      setLoading(false);
    };
    loadData();

    // Live WebSockets sync listener
    const handleWSUpdate = (e) => {
      const msg = e.detail;
      if (msg && (msg.hospital_id === selectedHospitalId || msg.type === "RESOURCE_UPDATE" || msg.type === "DOCTOR_UPDATE" || msg.type === "QUEUE_UPDATE")) {
        fetchResources();
        fetchDoctors();
        fetchAnalytics();
      }
    };
    window.addEventListener('websocket-update', handleWSUpdate);
    return () => window.removeEventListener('websocket-update', handleWSUpdate);
  }, [selectedHospitalId]);

  // Update resource counts
  const handleSaveResourceCap = async (resId) => {
    try {
      await axios.patch(`${API_URL}/resources/${resId}`, {
        total: editTotal,
        available: editAvailable
      });
      setEditingResId(null);
      fetchResources();
    } catch (error) {
      console.error("Failed to update capacity limits:", error);
      alert("Error: available beds cannot exceed total beds.");
    }
  };

  // Add a new resource row
  const handleAddResourceSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/resources/${selectedHospitalId}`, {
        resource_type: newResType,
        total: newResTotal,
        available: newResAvailable
      });
      setShowAddResource(false);
      fetchResources();
    } catch (error) {
      console.error("Failed to add resource row:", error);
      alert("Failed to add resource. Verify input details.");
    }
  };

  // Delete a resource row
  const handleDeleteResource = async (resId) => {
    if (!window.confirm("Are you sure you want to delete this resource category?")) return;
    try {
      await axios.delete(`${API_URL}/resources/${resId}`);
      fetchResources();
    } catch (error) {
      console.error("Failed to delete resource category:", error);
    }
  };

  // Toggle doctor active availability status
  const handleToggleDoctorAvailability = async (doc) => {
    try {
      await axios.patch(`${API_URL}/hospitals/doctors/${doc.id}`, {
        is_available: !doc.is_available
      });
      fetchDoctors();
    } catch (error) {
      console.error("Failed to toggle availability:", error);
    }
  };

  // Add/Edit Doctor submit handler
  const handleDoctorSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: docName,
      department: docDept,
      experience_years: docExperience,
      avg_consult_minutes: docConsultMinutes,
      specialization: docSpecialization || docDept,
      photo_url: docPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${docName.replace(' ', '')}`
    };

    try {
      if (showAddDoctor) {
        await axios.post(`${API_URL}/hospitals/${selectedHospitalId}/doctors`, payload);
        setShowAddDoctor(false);
      } else if (selectedDoctor) {
        await axios.patch(`${API_URL}/hospitals/doctors/${selectedDoctor.id}`, payload);
        setSelectedDoctor(null);
      }
      setDocName('');
      setDocSpecialization('');
      setDocPhoto('');
      fetchDoctors();
    } catch (error) {
      console.error("Failed to save doctor metadata:", error);
      alert("Failed to save doctor details. Check inputs.");
    }
  };

  // Delete Doctor profile
  const handleDeleteDoctor = async (docId) => {
    if (!window.confirm("Are you sure you want to remove this doctor from the hospital registry?")) return;
    try {
      await axios.delete(`${API_URL}/hospitals/doctors/${docId}`);
      fetchDoctors();
    } catch (error) {
      console.error("Failed to delete doctor profile:", error);
    }
  };

  const COLORS = ['#0284c7', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6'];

  // Calculations for KPIs
  const totalBeds = resources.find(r => r.resource_type === 'bed')?.total || 0;
  const availableBeds = resources.find(r => r.resource_type === 'bed')?.available || 0;
  const totalIcu = resources.find(r => r.resource_type === 'icu')?.total || 0;
  const availableIcu = resources.find(r => r.resource_type === 'icu')?.available || 0;

  const resourceUtilization = totalBeds > 0 
    ? Math.round(((totalBeds - availableBeds) / totalBeds) * 100) 
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header section with Facility Selector */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-primary-500" />
            <span className="text-xs uppercase font-bold tracking-widest text-slate-400">Hospital Operations Suite</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1 text-slate-900">Facility Operations Command</h1>
          <p className="text-slate-500 text-sm mt-1">{activeHospital.name} · {activeHospital.address}</p>
        </div>

        <div className="flex flex-col w-full lg:w-auto">
          <label className="text-xs text-slate-400 font-semibold mb-1">Select Facility Command</label>
          <select
            value={selectedHospitalId}
            onChange={(e) => {
              setSelectedHospitalId(e.target.value);
              useStore.getState().setHospitalId(e.target.value);
            }}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 outline-none font-semibold text-sm cursor-pointer hover:bg-slate-100 transition-colors"
          >
            {hospitals.map(h => (
              <option key={h.id} value={h.id} className="text-slate-800">
                {h.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary-500"></div>
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Resource Occupancy</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-slate-800">{resourceUtilization}%</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4">
            <div className="bg-primary-500 h-full rounded-full" style={{ width: `${resourceUtilization}%` }}></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500"></div>
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Beds Available</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-slate-800">{availableBeds}</span>
            <span className="text-slate-400 text-sm">/ {totalBeds}</span>
          </div>
          <span className="text-[10px] text-green-600 block mt-2 font-bold">Accepting admissions</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">ICU Bed Vacancies</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-3xl font-black text-slate-800 ${availableIcu < 2 ? 'text-red-500' : ''}`}>{availableIcu}</span>
            <span className="text-slate-400 text-sm">/ {totalIcu}</span>
          </div>
          {availableIcu < 2 ? (
            <span className="text-[10px] text-red-500 flex items-center gap-1 mt-2 font-bold animate-pulse">
              <AlertTriangle size={12} /> Critical shortage alert
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 block mt-2 font-semibold">Status stable</span>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Active On-duty Staff</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-slate-800">{doctors.length}</span>
            <span className="text-slate-400 text-sm">Physicians</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-2 font-semibold">All shifts normal</span>
        </div>
      </div>

      {/* Main Resource Controller Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Live Resource Controls */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <Database size={18} className="text-primary-500" />
              Resource Allocator
            </h3>
            <button 
              onClick={() => setShowAddResource(!showAddResource)}
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 font-bold transition-all cursor-pointer"
            >
              {showAddResource ? <X size={12} /> : <Plus size={12} />}
              {showAddResource ? 'Cancel' : 'New'}
            </button>
          </div>

          <div className="space-y-4">
            {/* Inline Add Resource Form */}
            {showAddResource && (
              <form onSubmit={handleAddResourceSubmit} className="bg-white border border-slate-200 p-4 rounded-2xl space-y-3 animate-in fade-in duration-300">
                <h4 className="font-bold text-xs uppercase text-primary-500">Add Resource Row</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">Resource Type</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none"
                      value={newResType}
                      onChange={(e) => setNewResType(e.target.value)}
                    >
                      <option value="bed">Bed</option>
                      <option value="icu">ICU Bed</option>
                      <option value="ventilator">Ventilator</option>
                      <option value="ot">Operation Theater</option>
                      <option value="equipment">Ambulance / Equip</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">Total Limit</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none"
                      value={newResTotal}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || 0;
                        setNewResTotal(v);
                        setNewResAvailable(v);
                      }}
                      min="1"
                    />
                  </div>
                </div>
                <button type="submit" className="w-full btn-primary py-2 text-xs font-bold">
                  Save Resource
                </button>
              </form>
            )}

            {loading ? (
              <div className="bg-white border border-slate-100 text-center py-10 text-slate-400 rounded-2xl shadow-sm">Loading resources...</div>
            ) : (
              resources.map((res) => (
                <div key={res.id} className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex justify-between items-center hover:border-slate-300 transition-colors">
                  <div className="space-y-1 flex-1">
                    <h4 className="font-bold text-xs uppercase tracking-wide text-slate-500">{res.resource_type}</h4>
                    
                    {editingResId === res.id ? (
                      <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-200">
                        <input 
                          type="number" 
                          className="w-16 bg-slate-50 border border-slate-200 text-slate-700 rounded px-2 py-0.5 text-xs outline-none"
                          value={editAvailable}
                          onChange={(e) => setEditAvailable(parseInt(e.target.value) || 0)}
                          placeholder="Avail"
                          title="Available capacity"
                        />
                        <span className="text-slate-400 text-xs">/</span>
                        <input 
                          type="number" 
                          className="w-16 bg-slate-50 border border-slate-200 text-slate-700 rounded px-2 py-0.5 text-xs outline-none"
                          value={editTotal}
                          onChange={(e) => setEditTotal(parseInt(e.target.value) || 0)}
                          placeholder="Total"
                          title="Total capacity"
                        />
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-black text-slate-800">{res.available}</span>
                        <span className="text-xs text-slate-400">/ {res.total} allocated</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {editingResId === res.id ? (
                      <>
                        <button 
                          onClick={() => handleSaveResourceCap(res.id)}
                          className="w-7 h-7 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 flex items-center justify-center cursor-pointer border border-green-200"
                          title="Save Changes"
                        >
                          <Check size={12} />
                        </button>
                        <button 
                          onClick={() => setEditingResId(null)}
                          className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center cursor-pointer border border-red-200"
                          title="Cancel"
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => {
                            setEditingResId(res.id);
                            setEditTotal(res.total);
                            setEditAvailable(res.available);
                          }}
                          className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all flex items-center justify-center cursor-pointer text-slate-500"
                          title="Modify Capacity"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button 
                          onClick={() => handleDeleteResource(res.id)}
                          className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 hover:bg-red-100 transition-all flex items-center justify-center cursor-pointer text-red-500"
                          title="Delete Resource category"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Capacity breakdown visual Chart */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm h-[340px] flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-primary-500" />
              <h3 className="font-bold text-md text-slate-800">Capacity & Availability Breakdown</h3>
            </div>
            
            <div className="h-[240px] w-full">
              {resources.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs">No resource records to analyze.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resources} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Triage Urgency Distribution */}
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm h-[300px] flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2">
                <PieIcon size={18} className="text-primary-500" />
                <h3 className="font-bold text-sm text-slate-800">Patient Triage Log Breakdown</h3>
              </div>
              
              <div className="h-[180px] w-full relative flex items-center justify-center">
                {triageDistribution.length === 0 ? (
                  <div className="text-slate-400 text-xs">No triage records to analyze.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={triageDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {triageDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pb-1">
                {triageDistribution.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span className="text-slate-500">{item.name} ({item.value}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Waiting Time Trend */}
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm h-[300px] flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-4">
                <LineIcon size={18} className="text-primary-500" />
                <h3 className="font-bold text-sm text-slate-800">Average Wait-Time Trend (Hourly)</h3>
              </div>

              <div className="h-[180px] w-full">
                {hourlyWaitTimes.length === 0 ? (
                  <div className="text-slate-400 text-xs">No wait time logs.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={hourlyWaitTimes} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                      <XAxis dataKey="hour" stroke="rgba(0,0,0,0.4)" fontSize={10} />
                      <YAxis stroke="rgba(0,0,0,0.4)" fontSize={10} tickFormatter={(val) => `${val}m`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="waitMinutes" 
                        stroke="#0284c7" 
                        strokeWidth={3} 
                        dot={{ r: 4, stroke: '#0284c7', strokeWidth: 1, fill: '#ffffff' }}
                        activeDot={{ r: 6 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Doctor Directory Administration Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 border-t border-slate-100">
        
        {/* Doctor List Directory */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <Stethoscope size={18} className="text-primary-500" />
              Doctor Registry ({doctors.length})
            </h3>
            <button 
              onClick={() => {
                setShowAddDoctor(true);
                setSelectedDoctor(null);
                setDocName('');
                setDocDept('General OPD');
                setDocSpecialization('');
                setDocExperience(5);
                setDocConsultMinutes(10);
                setDocPhoto('');
              }}
              className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1"
            >
              <Plus size={14} /> Register Doctor
            </button>
          </div>

          <div className="space-y-3">
            {doctors.length === 0 ? (
              <div className="bg-white border border-slate-100 text-center py-10 text-slate-400 text-xs rounded-2xl shadow-sm">No doctors currently registered at this facility.</div>
            ) : (
              doctors.map((doc) => (
                <div key={doc.id} className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex justify-between items-center hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <img 
                      src={doc.photo_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${doc.name.replace(' ', '')}`} 
                      alt={doc.name} 
                      className="w-10 h-10 rounded-full border border-slate-200 object-cover" 
                    />
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">{doc.name}</h4>
                      <p className="text-xs text-slate-400 font-semibold">{doc.department} · {doc.experience_years} Years Exp</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleToggleDoctorAvailability(doc)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all cursor-pointer ${doc.is_available ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}
                    >
                      {doc.is_available ? 'AVAILABLE' : 'ABSENT'}
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedDoctor(doc);
                        setShowAddDoctor(false);
                        setDocName(doc.name);
                        setDocDept(doc.department);
                        setDocSpecialization(doc.specialization || '');
                        setDocExperience(doc.experience_years);
                        setDocConsultMinutes(doc.avg_consult_minutes);
                        setDocPhoto(doc.photo_url || '');
                      }}
                      className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteDoctor(doc.id)}
                      className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1 rounded-lg border border-red-200 transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Doctor Action Panel (Add/Edit Form) */}
        <div className="lg:col-span-4">
          <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="font-bold text-md text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Stethoscope size={16} className="text-primary-500" />
              {showAddDoctor ? 'Register Physician' : selectedDoctor ? 'Edit Doctor Registry' : 'Physician Command'}
            </h3>

            {(showAddDoctor || selectedDoctor) ? (
              <form onSubmit={handleDoctorSubmit} className="space-y-4 animate-in fade-in duration-300">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Doctor Name</label>
                  <input 
                    type="text" 
                    className="input-field text-sm py-2 bg-transparent" 
                    placeholder="e.g. Dr. Sarah Smith"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Department</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2 py-2 text-xs outline-none"
                      value={docDept}
                      onChange={(e) => setDocDept(e.target.value)}
                    >
                      <option value="General OPD">General OPD</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="Orthopedics">Orthopedics</option>
                      <option value="Neurology">Neurology</option>
                      <option value="Radiology">Radiology</option>
                      <option value="Emergency">Emergency</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Exp (Years)</label>
                    <input 
                      type="number" 
                      className="input-field text-sm py-2 bg-transparent"
                      value={docExperience}
                      onChange={(e) => setDocExperience(parseInt(e.target.value) || 0)}
                      min="1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Consult Time (Mins)</label>
                    <input 
                      type="number" 
                      className="input-field text-sm py-2 bg-transparent"
                      value={docConsultMinutes}
                      onChange={(e) => setDocConsultMinutes(parseInt(e.target.value) || 10)}
                      min="5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Specialization</label>
                    <input 
                      type="text" 
                      className="input-field text-sm py-2 bg-transparent"
                      placeholder="e.g. General Practice"
                      value={docSpecialization}
                      onChange={(e) => setDocSpecialization(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Photo/Avatar URL</label>
                  <input 
                    type="url" 
                    className="input-field text-xs py-2 bg-transparent"
                    placeholder="https://example.com/avatar.jpg"
                    value={docPhoto}
                    onChange={(e) => setDocPhoto(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="submit" 
                    className="flex-1 btn-primary py-2.5 font-bold text-xs"
                  >
                    Save
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowAddDoctor(false);
                      setSelectedDoctor(null);
                    }}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-2.5 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-10 text-slate-400 text-xs space-y-2">
                <p>Select a physician profile to edit attributes, or click 'Register Doctor' to append a new record.</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default ManagementDashboard;
