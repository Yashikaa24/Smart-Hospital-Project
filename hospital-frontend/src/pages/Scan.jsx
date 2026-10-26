import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  QrCode, Camera as CameraIcon, VideoOff, Flashlight,
  CheckCircle, XCircle, Loader2, User, Phone, AlertTriangle,
  Stethoscope, Building2, Clock, Users, ChevronRight, X, Zap, Layers
} from 'lucide-react';
import { Camera } from '@capacitor/camera';
import jsQR from 'jsqr';
import useStore from '../store';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ─── Scanner States ───────────────────────────────────────────────────────────
const STATE = {
  SCANNING: 'scanning',       // Camera active, waiting for QR
  VALIDATING: 'validating',   // QR found, fetching backend data
  PREVIEW: 'preview',         // Showing doctor/hospital info, asking patient name
  CREATING: 'creating',       // Creating the token
  SUCCESS: 'success',         // Token created — brief success screen
  ERROR: 'error',             // Something went wrong
  NO_CAMERA: 'no_camera',     // Camera not available
};

const Scan = () => {
  const [scanState, setScanState] = useState(STATE.SCANNING);
  const [cameraError, setCameraError]   = useState(null);
  const [torchOn, setTorchOn]           = useState(false);
  const [scanData, setScanData]         = useState(null);   // validated QR info from backend
  const [rawQr, setRawQr]               = useState('');     // raw JSON string from QR
  const [errorMsg, setErrorMsg]         = useState('');
  const [suggestions, setSuggestions]   = useState([]);     // alternative doctors
  const [patientName, setPatientName]   = useState('');
  const [phone, setPhone]               = useState('');
  const [formError, setFormError]       = useState('');

  const videoRef      = useRef(null);
  const streamRef     = useRef(null);
  const canvasRef     = useRef(null);
  const rafRef        = useRef(null);
  const scanActiveRef = useRef(false);
  const lastScanRef   = useRef('');    // debounce repeated scans

  const navigate  = useNavigate();
  const setToken  = useStore((s) => s.setToken);

  // ── Play beep + haptic on successful scan ──────────────────────────────────────
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1046; // C6
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (_) {}
    // Haptic feedback
    try { navigator.vibrate?.([100, 50, 100]); } catch (_) {}
  };

  // ── Camera management ─────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    scanActiveRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scanActiveRef.current = true;
        rafRef.current = requestAnimationFrame(tick);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Camera access denied. Please grant permission in your browser settings.');
      setScanState(STATE.NO_CAMERA);
    }
  }, []); // eslint-disable-line

  // ── Torch toggle ──────────────────────────────────────────────────────────────
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const newState = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: newState }] });
      setTorchOn(newState);
    } catch (_) {
      // Torch not supported on this device
    }
  }, [torchOn]);

  // ── Scan loop (requestAnimationFrame) ─────────────────────────────────────────
  const tick = useCallback(() => {
    if (!scanActiveRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data && code.data !== lastScanRef.current) {
      lastScanRef.current = code.data;
      handleQRDetected(code.data);
      return; // stop looping until we reset
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []); // eslint-disable-line

  // ── Handle QR Detection ───────────────────────────────────────────────────────
  const handleQRDetected = async (rawData) => {
    scanActiveRef.current = false;
    playBeep();
    setScanState(STATE.VALIDATING);
    setRawQr(rawData);

    // Parse JSON
    let parsed = null;
    try {
      parsed = JSON.parse(rawData);
    } catch (_) {
      showError('Invalid Hospital QR. Please scan a valid SmartH QR code.');
      return;
    }

    if (parsed?.type !== 'hospital_qr' || !parsed?.doctor_id) {
      showError('Invalid Hospital QR. This QR code is not a recognized hospital registration code.');
      return;
    }

    // Validate against backend
    try {
      const res = await axios.post(`${API_URL}/tokens/scan-validate`, {
        qr_data: rawData,
      });
      const data = res.data;

      if (!data.valid) {
        showError('QR validation failed. Please try again.');
        return;
      }

      setScanData(data);

      if (!data.doctor.is_available) {
        setSuggestions(data.alternatives || []);

        // Department closed — no alternative doctors in that department
        if (data.department_closed && data.available_departments?.length > 0) {
          showError(
            `The ${data.doctor.department} department is currently closed. No doctors are available.`,
            [],
            'department_closed',
            data.available_departments
          );
        } else {
          showError(
            `Dr. ${data.doctor.name} is currently unavailable.`,
            data.alternatives,
            'doctor_unavailable'
          );
        }
        return;
      }

      setScanState(STATE.PREVIEW);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail === 'invalid_qr') {
        showError('Invalid Hospital QR. Please scan a valid SmartH QR code.');
      } else if (detail === 'doctor_not_found') {
        showError('Doctor not found. This QR code may be outdated or invalid.');
      } else if (detail === 'doctor_unavailable') {
        showError(`Doctor is currently unavailable. Please scan another doctor's QR code.`);
      } else {
        showError('Could not connect to hospital server. Please check your network and try again.');
      }
    }
  };

  const [availableDepts, setAvailableDepts] = useState([]);

  const showError = (msg, alts = [], _type = '', depts = []) => {
    setErrorMsg(msg);
    setSuggestions(alts || []);
    setAvailableDepts(depts || []);
    setScanState(STATE.ERROR);
  };

  // ── Create token after patient fills form ─────────────────────────────────────
  const handleCreateToken = async () => {
    if (!patientName.trim()) { setFormError('Please enter your full name.'); return; }
    if (!phone.trim())        { setFormError('Please enter your phone number.'); return; }
    setFormError('');
    setScanState(STATE.CREATING);

    try {
      const res = await axios.post(`${API_URL}/tokens/scan-create`, {
        qr_data: rawQr,
        patient_name: patientName.trim(),
        phone: phone.trim(),
      });
      setToken(res.data);
      setScanState(STATE.SUCCESS);
      stopCamera();
      setTimeout(() => navigate('/token'), 1800);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail === 'doctor_unavailable') {
        setErrorMsg('Doctor became unavailable. Please scan another QR code.');
      } else {
        setErrorMsg('Failed to create token. Please try again.');
      }
      setScanState(STATE.ERROR);
    }
  };

  // ── Reset scanner ─────────────────────────────────────────────────────────────
  const resetScan = async () => {
    lastScanRef.current = '';
    setScanData(null);
    setRawQr('');
    setErrorMsg('');
    setSuggestions([]);
    setPatientName('');
    setPhone('');
    setFormError('');
    setScanState(STATE.SCANNING);
    await startCamera();
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const check = await Camera.checkPermissions();
        if (check.camera !== 'granted') {
          await Camera.requestPermissions({ permissions: ['camera'] });
        }
      } catch (_) {}
      await startCamera();
    };
    init();
    return () => stopCamera();
  }, []); // eslint-disable-line

  // ── Scan alternative doctor directly ─────────────────────────────────────────
  const useSuggestion = async (doc) => {
    const syntheticQr = JSON.stringify({
      type: 'hospital_qr',
      doctor_id: doc.id,
      hospital_id: scanData?.hospital?.id || '',
      department: doc.department,
      hospital_name: scanData?.hospital?.name || '',
      doctor_name: doc.name,
    });
    await handleQRDetected(syntheticQr);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const isShowingCamera = [STATE.SCANNING, STATE.VALIDATING].includes(scanState);

  return (
    <div className="max-w-2xl mx-auto px-4 py-2 space-y-4 entrance-fade">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          Scan <span className="text-primary-500">QR Code</span>
        </h1>
        <p className="text-slate-500 text-sm">
          {scanState === STATE.SCANNING   && 'Point your camera at a hospital QR code'}
          {scanState === STATE.VALIDATING && 'Verifying with hospital database…'}
          {scanState === STATE.PREVIEW    && 'Confirm details and enter patient info'}
          {scanState === STATE.CREATING   && 'Generating your queue token…'}
          {scanState === STATE.SUCCESS    && 'Token created successfully!'}
          {scanState === STATE.ERROR      && 'Unable to process QR code'}
          {scanState === STATE.NO_CAMERA  && 'Camera not available'}
        </p>
      </div>

      {/* ── Camera Viewfinder ── */}
      {isShowingCamera && (
        <div className="relative rounded-3xl overflow-hidden bg-black shadow-2xl" style={{ aspectRatio: '4/3' }}>
          {/* Live Video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Dark overlay with cutout */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Subtle dark vignette */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/30" />

            {/* Scanner frame */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-56 h-56 scan-frame-glow rounded-2xl">
                {/* Corner brackets with pulse animation */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg scan-corner-pulse" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg scan-corner-pulse" style={{ animationDelay: '0.5s' }} />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg scan-corner-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg scan-corner-pulse" style={{ animationDelay: '1.5s' }} />

                {/* Laser sweep line */}
                <div
                  className="absolute left-2 right-2 h-0.5 scan-laser"
                  style={{
                    background: 'linear-gradient(90deg, transparent, #22c55e, #86efac, #22c55e, transparent)',
                    boxShadow: '0 0 8px 2px rgba(34,197,94,0.6)',
                  }}
                />

                {/* Validating spinner overlay */}
                {scanState === STATE.VALIDATING && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
                    <div className="text-center space-y-2">
                      <Loader2 className="animate-spin text-green-400 mx-auto" size={32} />
                      <p className="text-white text-xs font-semibold">Verifying…</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom label */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <div className="bg-black/50 backdrop-blur-sm px-4 py-1.5 rounded-full">
                <p className="text-white text-xs font-medium tracking-wide">
                  {scanState === STATE.VALIDATING ? 'QR Detected — Checking database…' : 'Align QR code within frame'}
                </p>
              </div>
            </div>
          </div>

          {/* Torch button */}
          <button
            onClick={toggleTorch}
            className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200
              ${torchOn
                ? 'bg-yellow-400 text-black torch-active'
                : 'bg-black/50 backdrop-blur-sm text-white hover:bg-black/70'
              }`}
            title={torchOn ? 'Turn off torch' : 'Turn on torch'}
          >
            <Zap size={18} />
          </button>
        </div>
      )}

      {/* ── No Camera State ── */}
      {scanState === STATE.NO_CAMERA && (
        <div className="rounded-3xl bg-slate-50 border border-slate-200 p-10 text-center space-y-4">
          <VideoOff size={40} className="text-slate-400 mx-auto" />
          <p className="text-slate-600 text-sm">{cameraError || 'Camera is not available.'}</p>
          <button
            onClick={resetScan}
            className="btn-primary mx-auto"
          >
            <CameraIcon size={16} />
            Try Again
          </button>
        </div>
      )}

      {/* ── Error State ── */}
      {scanState === STATE.ERROR && (
        <div className="rounded-3xl border border-red-100 bg-red-50 p-6 space-y-4 scan-error">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
              <XCircle className="text-red-500" size={22} />
            </div>
            <div>
              <p className="font-bold text-red-700 text-sm">Scan Failed</p>
              <p className="text-red-600 text-xs mt-0.5">{errorMsg}</p>
            </div>
          </div>

          {/* Alternative doctors */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Available Alternatives</p>
              {suggestions.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => useSuggestion(doc)}
                  className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-4 py-3 hover:border-primary-300 hover:shadow-sm transition-all text-left"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-800">{doc.name}</p>
                    <p className="text-xs text-slate-500">{doc.department}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </button>
              ))}
            </div>
          )}

          {/* Available departments (when department is closed) */}
          {availableDepts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                <Layers size={12} />
                Available Departments
              </p>
              <div className="flex flex-wrap gap-2">
                {availableDepts.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => navigate(`/resources`)}
                    className="bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-primary-300 hover:text-primary-600 transition-all"
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={resetScan} className="w-full btn-primary justify-center">
            <QrCode size={16} />
            Scan Again
          </button>
        </div>
      )}

      {/* ── Preview State — Doctor info + patient form ── */}
      {scanState === STATE.PREVIEW && scanData && (
        <div className="space-y-4">
          {/* Doctor & Hospital Card */}
          <div className="rounded-3xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-5 space-y-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle size={18} />
              <span className="text-sm font-bold">QR Verified Successfully</span>
            </div>

            <div className="flex items-start gap-4">
              {/* Doctor photo */}
              <img
                src={scanData.doctor.photo_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(scanData.doctor.name)}`}
                alt={scanData.doctor.name}
                className="w-14 h-14 rounded-2xl border-2 border-white shadow-sm bg-white object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-900 text-base leading-tight">{scanData.doctor.name}</p>
                <p className="text-xs text-primary-600 font-semibold mt-0.5">{scanData.doctor.specialization}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Building2 size={11} className="text-slate-400" />
                  <p className="text-xs text-slate-500 truncate">{scanData.hospital.name}</p>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Stethoscope size={11} className="text-slate-400" />
                  <p className="text-xs text-slate-500">{scanData.doctor.department}</p>
                </div>
              </div>
            </div>

            {/* Queue stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/70 rounded-2xl p-3 text-center border border-white">
                <div className="flex items-center justify-center gap-1 text-primary-600 mb-1">
                  <Users size={14} />
                </div>
                <p className="text-lg font-black text-slate-900">{scanData.queue.patients_ahead}</p>
                <p className="text-[10px] text-slate-500 font-semibold">Ahead</p>
              </div>
              <div className="bg-white/70 rounded-2xl p-3 text-center border border-white">
                <div className="flex items-center justify-center gap-1 text-orange-500 mb-1">
                  <Clock size={14} />
                </div>
                <p className="text-lg font-black text-slate-900">{scanData.queue.eta_minutes}</p>
                <p className="text-[10px] text-slate-500 font-semibold">Min Wait</p>
              </div>
              <div className="bg-white/70 rounded-2xl p-3 text-center border border-white">
                <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                  <QrCode size={14} />
                </div>
                <p className="text-lg font-black text-slate-900">#{scanData.queue.current_token + 1}</p>
                <p className="text-[10px] text-slate-500 font-semibold">Your Token</p>
              </div>
            </div>
          </div>

          {/* Patient Info Form */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
            <p className="text-sm font-bold text-slate-700">Enter Patient Details</p>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Full Name <span className="text-red-400">*</span></label>
              <div className="relative">
                <User className="absolute left-3 top-3 text-slate-400" size={15} />
                <input
                  type="text"
                  className="input-field pl-9 text-sm py-2.5"
                  placeholder="e.g. Rahul Sharma"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateToken()}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Phone Number <span className="text-red-400">*</span></label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 text-slate-400" size={15} />
                <input
                  type="tel"
                  className="input-field pl-9 text-sm py-2.5"
                  placeholder="e.g. 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateToken()}
                />
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-xl px-3 py-2">
                <AlertTriangle size={13} />
                {formError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={resetScan}
                className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
              >
                <X size={15} />
                Cancel
              </button>
              <button
                onClick={handleCreateToken}
                className="flex-[2] btn-primary py-3 rounded-2xl text-sm"
              >
                <QrCode size={16} />
                Get My Token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Creating Token State ── */}
      {scanState === STATE.CREATING && (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 flex flex-col items-center gap-4 shadow-sm">
          <Loader2 className="animate-spin text-primary-500" size={40} />
          <div className="text-center">
            <p className="font-bold text-slate-800">Registering in Queue…</p>
            <p className="text-slate-500 text-sm mt-1">Please wait while we assign your token.</p>
          </div>
        </div>
      )}

      {/* ── Success State ── */}
      {scanState === STATE.SUCCESS && (
        <div className="rounded-3xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-12 flex flex-col items-center gap-4 scan-success">
          <div className="w-20 h-20 rounded-full bg-green-100 border-4 border-green-300 flex items-center justify-center">
            <CheckCircle className="text-green-500" size={40} />
          </div>
          <div className="text-center">
            <p className="font-black text-green-800 text-lg">Token Created!</p>
            <p className="text-green-600 text-sm mt-1">Redirecting to your token details…</p>
          </div>
        </div>
      )}

      {/* ── Quick-access manual entry hint (only during scanning) ── */}
      {scanState === STATE.SCANNING && (
        <div className="text-center">
          <p className="text-xs text-slate-400">
            Can't scan? Try the{' '}
            <a href="/resources" className="text-primary-500 font-semibold underline underline-offset-2">
              Hospital Discovery
            </a>{' '}
            page to find a doctor manually.
          </p>
        </div>
      )}
    </div>
  );
};

export default Scan;
