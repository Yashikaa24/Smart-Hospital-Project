import { Link } from 'react-router-dom';
import { Activity, Menu, X } from 'lucide-react';
import { useState } from 'react';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="glass sticky top-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="bg-primary-500 p-2 rounded-lg group-hover:rotate-12 transition-transform shadow-md shadow-primary-500/10">
            <Activity className="text-white" size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800 font-sans">
            Smart<span className="text-primary-500">H</span>
          </span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/patient/dashboard" className="text-slate-600 hover:text-primary-500 transition-colors text-sm font-bold">Patient Portal</Link>
          <Link to="/doctor/dashboard" className="text-slate-600 hover:text-primary-500 transition-colors text-sm font-bold">Doctor Portal</Link>
          <Link to="/staff/dashboard" className="text-slate-600 hover:text-primary-500 transition-colors text-sm font-bold">Staff Queue</Link>
          <Link to="/management/dashboard" className="text-slate-600 hover:text-primary-500 transition-colors text-sm font-bold">Management Console</Link>
          <Link to="/resources" className="text-slate-600 hover:text-primary-500 transition-colors text-sm font-bold">Find Hospitals</Link>
          <Link to="/demo-qr" className="text-primary-600 hover:text-primary-700 transition-colors text-sm font-bold bg-primary-50 border border-primary-200 px-3 py-1 rounded-lg">Demo QR Codes</Link>
          <Link to="/scan" className="btn-primary text-sm px-4 py-2">Scan QR</Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button className="md:hidden text-slate-700 hover:text-slate-900" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white p-6 flex flex-col gap-4 shadow-lg border-b border-slate-100">
          <Link to="/patient/dashboard" onClick={() => setIsOpen(false)} className="text-sm font-bold text-slate-600 hover:text-primary-500">Patient Portal</Link>
          <Link to="/doctor/dashboard" onClick={() => setIsOpen(false)} className="text-sm font-bold text-slate-600 hover:text-primary-500">Doctor Portal</Link>
          <Link to="/staff/dashboard" onClick={() => setIsOpen(false)} className="text-sm font-bold text-slate-600 hover:text-primary-500">Staff Queue</Link>
          <Link to="/management/dashboard" onClick={() => setIsOpen(false)} className="text-sm font-bold text-slate-600 hover:text-primary-500">Management Console</Link>
          <Link to="/resources" onClick={() => setIsOpen(false)} className="text-sm font-bold text-slate-600 hover:text-primary-500">Find Hospitals</Link>
          <Link to="/demo-qr" onClick={() => setIsOpen(false)} className="text-sm font-bold text-primary-600 hover:text-primary-700">Demo QR Codes</Link>
          <Link to="/scan" onClick={() => setIsOpen(false)} className="btn-primary justify-start text-sm">Scan QR</Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
