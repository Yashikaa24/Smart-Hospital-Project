import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import axios from 'axios';
import Scan from './pages/Scan';
import TokenView from './pages/TokenView';
import QueueView from './pages/QueueView';
import StaffDashboard from './pages/StaffDashboard';
import ResourceDashboard from './pages/ResourceDashboard';
import PatientResourceView from './pages/PatientResourceView';
import HospitalDiscovery from './pages/HospitalDiscovery';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import ManagementDashboard from './pages/ManagementDashboard';
import RoleSelection from './pages/RoleSelection';
import DemoQRCodes from './pages/DemoQRCodes';
import Navbar from './components/Navbar';
import { App as CapApp } from '@capacitor/app';
import { useLocation, useNavigate } from 'react-router-dom';

// ── Capacitor Back Button Handler ──────────────────────────────────────────────
function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = CapApp.addListener('backButton', (data) => {
      const path = location.pathname;
      if (
        path === '/' ||
        path === '/patient/dashboard' ||
        path === '/doctor/dashboard' ||
        path === '/management/dashboard'
      ) {
        CapApp.exitApp();
      } else {
        if (data.canGoBack) {
          window.history.back();
        } else {
          navigate('/', { replace: true });
        }
      }
    });

    return () => {
      handler.then((h) => h.remove());
    };
  }, [location, navigate]);

  return null;
}

// ── Axios Interceptor — rewrite backend URL if configured ────────────────────
function AxiosSetup() {
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        const apiUrl = import.meta.env.VITE_API_URL;
        if (apiUrl && config.url && config.url.startsWith('http://localhost:8000')) {
          config.url = config.url.replace('http://localhost:8000', apiUrl);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => {
      axios.interceptors.request.eject(interceptor);
    };
  }, []);

  return null;
}

// ── App ────────────────────────────────────────────────────────────────────────
function App() {
  // WebSocket for real-time updates
  useEffect(() => {
    let socket;

    const connectWS = () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws';
      console.log('Connecting to WebSocket:', wsUrl);
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          window.dispatchEvent(new CustomEvent('websocket-update', { detail: data }));
        } catch {
          // ignore non-JSON frames
        }
      };

      socket.onclose = () => {
        console.log('WebSocket closed. Reconnecting in 3s...');
        setTimeout(connectWS, 3000);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connectWS();
    return () => {
      if (socket) socket.close();
    };
  }, []);

  return (
    <Router>
      <AxiosSetup />
      <BackButtonHandler />
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            {/* Public routes */}
            <Route path="/"        element={<RoleSelection />} />
            <Route path="/scan"    element={<Scan />} />
            <Route path="/resources"         element={<HospitalDiscovery />} />
            <Route path="/hospital/:id"      element={<PatientResourceView />} />
            <Route path="/token"             element={<TokenView />} />
            <Route path="/queue"             element={<QueueView />} />
            <Route path="/patient/dashboard" element={<PatientDashboard />} />

            {/* Dashboards (directly accessible without authentication) */}
            <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
            <Route path="/management/dashboard" element={<ManagementDashboard />} />
            <Route path="/staff/dashboard" element={<StaffDashboard />} />
            <Route path="/staff/resources" element={<ResourceDashboard />} />
            <Route path="/demo-qr" element={<DemoQRCodes />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
