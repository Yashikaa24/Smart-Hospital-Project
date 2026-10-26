import { useState, useEffect } from 'react';
import { Printer, QrCode, Building2, Stethoscope, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const DemoQRCodes = () => {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [filter, setFilter]       = useState('all'); // hospital id or 'all'

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/hospitals/qr-data`);
      setHospitals(res.data);
    } catch (err) {
      setError('Could not load QR data. Make sure the backend is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handlePrint = () => window.print();

  const filteredHospitals = filter === 'all'
    ? hospitals
    : hospitals.filter((h) => h.id === filter);

  const totalDoctors = hospitals.reduce((acc, h) => acc + h.doctors.length, 0);

  // ── Loading ──
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 flex flex-col items-center gap-4 entrance-fade">
        <Loader2 className="animate-spin text-primary-500" size={40} />
        <p className="text-slate-500 text-sm">Loading QR codes from database…</p>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4 entrance-fade">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto">
          <AlertCircle className="text-red-400" size={28} />
        </div>
        <p className="text-slate-700 font-bold">{error}</p>
        <button onClick={fetchData} className="btn-primary mx-auto">
          <RefreshCw size={16} />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ── Print-only styles ── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #qr-print-area, #qr-print-area * { visibility: visible; }
          #qr-print-area { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .qr-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 py-4 entrance-fade">
        {/* Header */}
        <div className="no-print mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Demo <span className="text-primary-500">QR Codes</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {totalDoctors} QR codes across {hospitals.length} hospitals — generated from live database.
              Print and scan these during demos.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Hospital filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input-field py-2 text-sm max-w-xs"
            >
              <option value="all">All Hospitals</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>

            <button
              onClick={handlePrint}
              className="btn-primary whitespace-nowrap"
            >
              <Printer size={16} />
              Print All
            </button>
          </div>
        </div>

        {/* QR Grid */}
        <div id="qr-print-area">
          {filteredHospitals.map((hospital) => (
            <div key={hospital.id} className="mb-10">
              {/* Hospital heading */}
              <div className="no-print flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
                  <Building2 className="text-primary-600" size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">{hospital.name}</h2>
                  <p className="text-xs text-slate-500">{hospital.address} · {hospital.doctors.length} doctors</p>
                </div>
              </div>

              {/* Print hospital heading */}
              <div className="hidden print:block mb-3 border-b border-slate-300 pb-2">
                <h2 className="text-lg font-bold">{hospital.name}</h2>
                <p className="text-xs text-slate-500">{hospital.address}</p>
              </div>

              {/* Doctor QR cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                {hospital.doctors.map((doc) => (
                  <QRCard
                    key={doc.id}
                    doctor={doc}
                    hospitalName={hospital.name}
                    apiUrl={API_URL}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {filteredHospitals.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <QrCode size={36} className="mx-auto mb-3" />
            <p className="text-sm">No QR codes found.</p>
          </div>
        )}
      </div>
    </>
  );
};

// ── Individual QR Card ────────────────────────────────────────────────────────
const QRCard = ({ doctor, hospitalName, apiUrl }) => {
  const [imgError, setImgError] = useState(false);

  // Use the backend QR image endpoint (returns PNG)
  const qrSrc = `${apiUrl}/tokens/qr/${encodeURIComponent(doctor.id)}`;

  return (
    <div className="qr-card bg-white border border-slate-200 rounded-2xl p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-center gap-2">
      {/* QR Image */}
      <div className="w-full aspect-square rounded-xl overflow-hidden bg-white border border-slate-100 flex items-center justify-center">
        {!imgError ? (
          <img
            src={qrSrc}
            alt={`QR for ${doctor.name}`}
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-400">
            <QrCode size={24} />
            <p className="text-[10px]">Failed to load</p>
          </div>
        )}
      </div>

      {/* Doctor info */}
      <div className="w-full text-center space-y-0.5">
        <p className="text-[11px] font-black text-slate-800 leading-tight truncate" title={doctor.name}>
          {doctor.name}
        </p>
        <div className="flex items-center justify-center gap-1">
          <Stethoscope size={9} className="text-primary-500 shrink-0" />
          <p className="text-[10px] text-primary-600 font-semibold truncate">{doctor.department}</p>
        </div>
        <div className="flex items-center justify-center gap-1">
          <Building2 size={9} className="text-slate-400 shrink-0" />
          <p className="text-[10px] text-slate-400 truncate" title={hospitalName}>{hospitalName}</p>
        </div>
        {/* Doctor ID badge */}
        <div className="mt-1 inline-flex items-center gap-1 bg-slate-100 rounded-full px-2 py-0.5">
          <span className="text-[9px] font-mono font-bold text-slate-500">{doctor.id}</span>
        </div>
        {/* Availability badge */}
        <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ml-1
          ${doctor.is_available ? 'bg-green-100' : 'bg-red-100'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${doctor.is_available ? 'bg-green-500' : 'bg-red-400'}`} />
          <span className={`text-[9px] font-bold ${doctor.is_available ? 'text-green-700' : 'text-red-600'}`}>
            {doctor.is_available ? 'Available' : 'Unavailable'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DemoQRCodes;
