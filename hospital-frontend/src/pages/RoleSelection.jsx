import { useNavigate } from 'react-router-dom';
import useStore from '../store';
import { User, Stethoscope, Building2, Activity, ArrowRight } from 'lucide-react';

const RoleSelection = () => {
  const navigate = useNavigate();
  const setRole = useStore((state) => state.setRole);

  const handleSelectRole = (role) => {
    setRole(role);
    if (role === 'patient') {
      navigate('/patient/dashboard');
    } else if (role === 'doctor') {
      navigate('/doctor/dashboard');
    } else if (role === 'management') {
      navigate('/management/dashboard');
    }
  };

  const portalCards = [
    {
      role: 'patient',
      title: 'Patient Portal',
      icon: User,
      gradient: 'from-hospital-teal/10 via-hospital-teal/5 to-transparent',
      borderColor: 'group-hover:border-hospital-teal/30 hover:shadow-lg hover:shadow-hospital-teal/5',
      iconBg: 'bg-hospital-teal/10 text-hospital-teal',
      hoverText: 'group-hover:text-hospital-teal',
    },
    {
      role: 'doctor',
      title: 'Doctor Portal',
      icon: Stethoscope,
      gradient: 'from-hospital-gold/10 via-hospital-gold/5 to-transparent',
      borderColor: 'group-hover:border-hospital-gold/30 hover:shadow-lg hover:shadow-hospital-gold/5',
      iconBg: 'bg-hospital-gold/10 text-hospital-gold',
      hoverText: 'group-hover:text-hospital-gold',
    },
    {
      role: 'management',
      title: 'Hospital Management',
      icon: Building2,
      gradient: 'from-primary-500/10 via-primary-500/5 to-transparent',
      borderColor: 'group-hover:border-primary-500/30 hover:shadow-lg hover:shadow-primary-500/5',
      iconBg: 'bg-primary-500/10 text-primary-600',
      hoverText: 'group-hover:text-primary-600',
    },
  ];

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center space-y-16 entrance-fade max-w-5xl mx-auto px-4">
      {/* Branding Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-4 bg-primary-500/10 rounded-3xl border border-primary-500/20 text-primary-600 shadow-lg shadow-primary-500/5" style={{ animation: 'bluePulse 2s ease-in-out infinite' }}>
          <Activity size={36} />
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">
          Welcome to <span className="gradient-text">SmartH</span>
        </h1>
        <p className="text-slate-500 max-w-lg mx-auto text-sm">
          Please select your access portal to continue. Your workspace, tools, and permissions will be configured automatically.
        </p>
      </div>

      {/* 3-Option Portal Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
        {portalCards.map((portal) => {
          const IconComponent = portal.icon;
          return (
            <div
              key={portal.role}
              onClick={() => handleSelectRole(portal.role)}
              className={`glass-card cursor-pointer group hover:-translate-y-2 transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-[210px] p-7 rounded-3xl ${portal.borderColor}`}
            >
              {/* Radial gradient background accent */}
              <div className={`absolute inset-0 bg-gradient-to-br ${portal.gradient} -z-10 opacity-30 group-hover:opacity-100 transition-opacity duration-300`}></div>
              
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${portal.iconBg} shadow-inner transition-transform duration-300 group-hover:scale-110`}>
                  <IconComponent size={28} />
                </div>
                <h3 className={`text-lg font-black tracking-tight text-slate-800 transition-colors ${portal.hoverText}`}>{portal.title}</h3>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">Enter Workspace</span>
                <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-primary-500/20 text-slate-400 group-hover:text-primary-600 flex items-center justify-center transition-all duration-300">
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform duration-300" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RoleSelection;
