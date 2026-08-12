import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  ShieldCheck, 
  Activity, 
  Users, 
  Clock, 
  FileText, 
  PhoneCall,
  CheckCircle,
  XCircle,
  BarChart2,
  Calendar,
  Layers,
  Map,
  Settings,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  Info,
  X,
  ArrowLeft,
  LogIn,
  LogOut,
  PenTool,
  HeartPulse,
  Clipboard,
  Cloud,
  ShieldAlert,
  Package,
  Wrench,
  Search,
  UserPlus,
  IdCard,
  UserCheck,
  Contact,
  Archive,
  Camera,
  Paperclip,
  FileCheck,
  Home,
  DoorOpen,
  CheckSquare,
  Menu
} from 'lucide-react';

// --- MOCK DATA ---
const mockAlerts = [
  { id: 1, type: 'critical', message: 'Main Stage crowd density > 4 hlö/m²', time: '10:42', location: 'Main Stage' },
  { id: 2, type: 'warning', message: 'Gate 2 throughput dropping, queue 15m', time: '10:35', location: 'Gate 2' },
  { id: 3, type: 'info', message: 'Weather update: rain expected at 14:00', time: '10:15', location: 'All Areas' }
];

const mockChecklist = [
  { id: 1, task: 'Riskienarviointi päivitetty', status: 'done', category: 'Suunnittelu' },
  { id: 2, task: 'Pelastussuunnitelma lähetetty', status: 'done', category: 'Luvat' },
  { id: 3, task: 'JV-mitoitus vahvistettu', status: 'pending', category: 'Resurssit' },
  { id: 4, task: 'Ensiapupisteet pystytetty', status: 'in-progress', category: 'Operatiivinen' }
];

const mockLogs = [
  { id: 101, time: '10:30', user: 'JOKE', action: 'Portit avattu yleisölle' },
  { id: 102, time: '10:35', user: 'Gate 1', action: 'Kapasiteetti 1500/h saavutettu' },
  { id: 103, time: '10:42', user: 'Spotter A', action: 'Ilmoitus ruuhkasta Main Stagen edessä' }
];

const mockEmployees = [
  "Korhonen Elli Marja Orvokki",
  "Virtanen Matti Johannes Antero",
  "Mäkinen Kalle Petteri Aleksi",
  "Nieminen Anna Sofia Maria",
  "Lahtinen Oskari Juhani Tapio"
];

const mockCheckedInEmployees = [
  { id: 1, name: "Korhonen Elli Marja Orvokki", role: "Järjestyksenvalvoja", vest: true, badge: "1234", headset: true, radio: "R-12" },
  { id: 2, name: "Virtanen Matti Johannes Antero", role: "Vartija", vest: false, badge: "5521", headset: false, radio: "" },
  { id: 3, name: "Mäkinen Kalle Petteri Aleksi", role: "Järjestyksenvalvoja", vest: true, badge: "9982", headset: true, radio: "R-05" }
];

const mockReports = [
  { id: '26/FesX/1108/099', type: 'Työntekijän uloskirjaus', author: 'TIKE Päivystäjä', time: '14:10', summary: 'Virtanen ulos, radiopuhelin rikki.' },
  { id: '26/FesX/1108/098', type: 'JV Tapahtumailmoitus', author: 'Korhonen Elli', time: '13:45', summary: 'Kiinniotto portilla 2.' },
  { id: '26/FesX/1108/097', type: 'Ensiaputilanne', author: 'EA-Päivystys', time: '12:15', summary: 'Nyrjähdys, paikattu pisteellä.' }
];

// --- COMPONENTS ---

const DashboardCard = ({ title, icon: Icon, value, subtitle, trend, trendUp }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 rounded-lg bg-slate-50 text-slate-600">
        <Icon size={24} />
      </div>
      {trend && (
        <span className={`text-sm font-medium ${trendUp ? 'text-emerald-500' : 'text-rose-500'} flex items-center`}>
          {trend}
        </span>
      )}
    </div>
    <div>
      <h3 className="text-3xl font-bold text-slate-800 mb-1">{value}</h3>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  </div>
);

const AlertBanner = ({ alert }) => {
  const colors = {
    critical: 'bg-rose-50 border-rose-200 text-rose-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };
  
  const iconColors = {
    critical: 'text-rose-600',
    warning: 'text-amber-600',
    info: 'text-blue-600'
  };

  return (
    <div className={`p-4 rounded-lg border flex items-start gap-4 mb-3 ${colors[alert.type]}`}>
      <AlertTriangle className={`mt-0.5 ${iconColors[alert.type]}`} size={20} />
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="font-semibold text-sm">{alert.location}</span>
          <span className="text-xs font-medium opacity-80">{alert.time}</span>
        </div>
        <p className="text-sm">{alert.message}</p>
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

export default function App() {
  const [activeTab, setActiveTab] = useState('landing');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Overview Tab State
  const [overviewCardTab, setOverviewCardTab] = useState('checklist'); // 'checklist' | 'reports'

  // JV Form State
  const [eventDate, setEventDate] = useState('');
  const [eventTimeStr, setEventTimeStr] = useState('');
  const timeInputRef = useRef(null);

  // Check-in Form State
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');

  // Check-out Form State
  const [outEmpSearch, setOutEmpSearch] = useState('');
  const [selectedOutEmp, setSelectedOutEmp] = useState(null);
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [showOutTimeInput, setShowOutTimeInput] = useState(false);

  // Open Log Form State
  const [openKirjausDate, setOpenKirjausDate] = useState('');
  const [openKirjausTime, setOpenKirjausTime] = useState('');
  const [openKirjausText, setOpenKirjausText] = useState('');
  const [fileName, setFileName] = useState('');
  const [runningNumber, setRunningNumber] = useState(100);

  // First Aid Form State
  const [faDate, setFaDate] = useState('');
  const [faTime, setFaTime] = useState('');
  const [faDesc, setFaDesc] = useState('');
  const [faActions, setFaActions] = useState('');
  const [faResources, setFaResources] = useState('');
  const [faEmployees, setFaEmployees] = useState('');
  const [faFileName, setFaFileName] = useState('');

  // Generic TIKE Reports State
  const [genRepDate, setGenRepDate] = useState('');
  const [genRepTime, setGenRepTime] = useState('');
  const [genRepDesc, setGenRepDesc] = useState('');
  const [genRepActions, setGenRepActions] = useState('');
  const [genRepEmps, setGenRepEmps] = useState('');
  const [genRepFile, setGenRepFile] = useState('');

  // Edit Employee Form State
  const [editingEmp, setEditingEmp] = useState(null);

  // Readiness Form State
  const [targetOpeningTime, setTargetOpeningTime] = useState('16:00');
  const [readinessChecks, setReadinessChecks] = useState({
    exits: false,
    guards: false,
    vehicles: false,
    production: false,
    security: false
  });
  const [readinessComments, setReadinessComments] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getGreeting = (date) => {
    const hour = date.getHours();
    if (hour >= 5 && hour < 10) return 'Hyvää huomenta';
    if (hour >= 10 && hour < 17) return 'Hyvää päivää';
    if (hour >= 17 && hour < 22) return 'Hyvää iltaa';
    return 'Hyvää yötä';
  };

  const getDynamicId = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${yy}/FesX/${dd}${mm}/${runningNumber}`;
  };

  const handleTamaPvm = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setEventDate(now.toISOString().split('T')[0]);
    if (timeInputRef.current) {
      timeInputRef.current.focus();
    }
  };

  const handleNyt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [d, t] = now.toISOString().slice(0, 16).split('T');
    setEventDate(d);
    setEventTimeStr(t);
  };

  const handleCheckInNyt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [d, t] = now.toISOString().slice(0, 16).split('T');
    setCheckInDate(d);
    setCheckInTime(t);
  };

  const handleOpenKirjausNyt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [d, t] = now.toISOString().slice(0, 16).split('T');
    setOpenKirjausDate(d);
    setOpenKirjausTime(t);
  };

  const handleFaNyt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [d, t] = now.toISOString().slice(0, 16).split('T');
    setFaDate(d);
    setFaTime(t);
  };

  const handleGenRepNyt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [d, t] = now.toISOString().slice(0, 16).split('T');
    setGenRepDate(d);
    setGenRepTime(t);
  };

  const toggleReadinessCheck = (key) => {
    setReadinessChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredEmployees = empSearch.length >= 3 
    ? mockEmployees.filter(e => e.toLowerCase().includes(empSearch.toLowerCase())) 
    : [];

  const filteredOutEmployees = outEmpSearch.length >= 3
    ? mockCheckedInEmployees.filter(e => e.name.toLowerCase().includes(outEmpSearch.toLowerCase()))
    : [];

  // Readiness logic computations
  const completedChecksCount = Object.values(readinessChecks).filter(Boolean).length;
  const missingChecksCount = 5 - completedChecksCount;
  const isReadyForOpening = missingChecksCount === 0;

  const checkIsLate = () => {
    if (!targetOpeningTime) return false;
    const [hours, minutes] = targetOpeningTime.split(':').map(Number);
    const targetDate = new Date(currentTime);
    targetDate.setHours(hours, minutes, 0, 0);
    return currentTime > targetDate;
  };
  const isLate = checkIsLate();

  let readinessStatusColor = 'bg-blue-50 border-blue-200 text-blue-800';
  let readinessStatusIconColor = 'text-blue-500';
  let readinessStatusText = `Avausvalmius kesken. ${missingChecksCount} kohtaa puuttuu.`;

  if (isReadyForOpening) {
    readinessStatusColor = 'bg-emerald-50 border-emerald-200 text-emerald-800';
    readinessStatusIconColor = 'text-emerald-500';
    readinessStatusText = 'Tapahtuma voidaan aloittaa (Portit avata).';
  } else if (isLate) {
    readinessStatusColor = 'bg-rose-50 border-rose-200 text-rose-800';
    readinessStatusIconColor = 'text-rose-500';
    readinessStatusText = `Avaus on myöhässä! ${missingChecksCount} kohtaa puuttuu.`;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'landing':
        return (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-white p-10 md:p-14 rounded-3xl shadow-xl border border-slate-100 text-center max-w-2xl w-full">
              <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-indigo-50/50">
                <ShieldCheck size={48} />
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-3 tracking-tight">Turvajohto OS</h1>
              
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mt-6 mb-10">
                <h2 className="text-xl md:text-2xl font-semibold text-slate-700">
                  {getGreeting(currentTime)}, <span className="text-indigo-600">oletuskäyttäjä</span>
                </h2>
                <p className="text-slate-500 font-medium mt-1">Turvajohto</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={() => setActiveTab('overview')}
                  className="flex items-center justify-center gap-3 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-sm hover:shadow group"
                >
                  <Activity size={20} className="group-hover:scale-110 transition-transform" />
                  Siirry tilannekuvaan
                </button>
                <button 
                  onClick={() => setActiveTab('reporting')}
                  className="flex items-center justify-center gap-3 p-4 bg-white border-2 border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all"
                >
                  <FileText size={20} className="text-indigo-500" />
                  Avaa raportointi
                </button>
              </div>
            </div>
            
            <div className="mt-12 text-slate-400 text-sm font-medium flex items-center gap-2">
              <Clock size={16} />
              Kirjautumisaika: {formatTime(currentTime)}
            </div>
          </div>
        );
      case 'overview':
        return (
          <div className="space-y-6">
            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <DashboardCard 
                title="Aktiiviset Järjestyksenvalvojat" 
                icon={ShieldCheck} 
                value="142" 
                subtitle="Mitoitus: 1:100 (vaatimus 142)"
              />
              <DashboardCard 
                title="Ensiaputapaukset" 
                icon={HeartPulse} 
                value="12" 
                subtitle="Viimeisen tunnin aikana: 3"
              />
              <DashboardCard 
                title="Poistot" 
                icon={LogOut} 
                value="8" 
                subtitle="Koko tapahtuman ajalta"
              />
              <DashboardCard 
                title="Poikkeamat" 
                icon={AlertTriangle} 
                value="3" 
                subtitle="Avoinna olevat tilanteet"
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Alerts & Status */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Activity className="text-rose-500" size={20} />
                      Aktiiviset Hälytykset ja Poikkeamat
                    </h2>
                    <button className="text-sm text-indigo-600 font-medium hover:text-indigo-700">Näytä Kaikki</button>
                  </div>
                  <div className="space-y-1">
                    {mockAlerts.map(alert => (
                      <AlertBanner key={alert.id} alert={alert} />
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                   <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <MessageSquare className="text-indigo-500" size={20} />
                      JOKE Loki (Viimeisimmät)
                    </h2>
                    <button className="px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100 transition-colors">
                      + Uusi Kirjaus
                    </button>
                  </div>
                  <div className="space-y-4">
                    {mockLogs.map(log => (
                      <div key={log.id} className="flex gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors border-b border-slate-50 last:border-0">
                        <div className="text-sm font-mono text-slate-400 w-16 pt-0.5">{log.time}</div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{log.action}</p>
                          <p className="text-xs text-slate-500 mt-1">Kirjaaja: {log.user}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column - Checklist & Actions */}
              <div className="space-y-6">
                {/* Swaippattava / Välilehdellinen kortti */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="flex border-b border-slate-100">
                    <button 
                      onClick={() => setOverviewCardTab('checklist')}
                      className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${overviewCardTab === 'checklist' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      <CheckCircle size={16} />
                      Valmiustarkastus
                    </button>
                    <button 
                      onClick={() => setOverviewCardTab('reports')}
                      className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${overviewCardTab === 'reports' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      <Archive size={16} />
                      Uusimmat raportit
                    </button>
                  </div>
                  
                  <div className="p-6">
                    {overviewCardTab === 'checklist' ? (
                      <div className="space-y-3 animate-in fade-in duration-300">
                        {mockChecklist.map(item => (
                          <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50">
                            <div className="mt-0.5">
                              {item.status === 'done' ? (
                                <CheckCircle className="text-emerald-500" size={18} />
                              ) : item.status === 'in-progress' ? (
                                <Clock className="text-amber-500" size={18} />
                              ) : (
                                <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-300"></div>
                              )}
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${item.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                {item.task}
                              </p>
                              <p className="text-xs text-slate-400">{item.category}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3 animate-in fade-in duration-300">
                        {mockReports.map((rep, idx) => (
                          <div key={idx} className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{rep.type}</span>
                              <span className="text-xs font-mono text-slate-400">{rep.time}</span>
                            </div>
                            <p className="text-sm font-medium text-slate-800 line-clamp-1">{rep.summary}</p>
                            <p className="text-xs text-slate-500">Kirjaaja: {rep.author} | ID: {rep.id.split('/').pop()}</p>
                          </div>
                        ))}
                        <button 
                          onClick={() => setActiveTab('report_list')}
                          className="w-full mt-2 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        >
                          Näytä kaikki raportit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'reporting':
        return (
          <div className="space-y-6 max-w-5xl">
            <div className="mb-6 pb-4 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-indigo-500" size={28} />
                Raportointi ja lomakkeet
              </h2>
              <p className="text-sm text-slate-500 mt-1">Valitse täytettävä raportti tai tarkastele tallennettuja asiakirjoja.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* JV Card */}
              <button 
                onClick={() => setActiveTab('report_jv')}
                className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all text-left group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 transition-colors">
                    <ShieldCheck size={24} />
                  </div>
                  <ChevronRight className="text-slate-400 group-hover:text-indigo-500 transition-colors" size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Järjestyksenvalvojan tapahtumailmoitus</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Lakisääteinen ilmoitus kiinniotto- ja voimankäyttötilanteista (LYTP 33 §).</p>
              </button>

              {/* TIKE Card */}
              <button 
                onClick={() => setActiveTab('report_tike')}
                className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition-colors">
                    <Activity size={24} />
                  </div>
                  <ChevronRight className="text-slate-400 group-hover:text-emerald-500 transition-colors" size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">TIKE:n raportointi</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Tilannekeskuksen seuranta, kirjaukset ja laajemmat poikkeamaraportit.</p>
              </button>

               {/* Raportit Arkisto Card */}
               <button 
                onClick={() => setActiveTab('report_list')}
                className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <Archive size={24} />
                  </div>
                  <ChevronRight className="text-slate-400 group-hover:text-blue-500 transition-colors" size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Tallennetut raportit</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Selaa, hae ja tarkastele kaikkia järjestelmään luotuja raportteja.</p>
              </button>
            </div>
          </div>
        );
      case 'report_list':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
             <button 
              onClick={() => setActiveTab('reporting')}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin raportointivalikkoon
            </button>

            <div className="mb-6 flex justify-between items-end border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Archive className="text-blue-500" size={24} />
                  Tallennetut raportit
                </h2>
                <p className="text-sm text-slate-500 mt-1">Selaa ja tarkastele kaikkia tehtyjä kirjauksia ja ilmoituksia.</p>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input type="text" placeholder="Hae raporteista..." className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Tunniste</th>
                    <th className="p-4">Aika</th>
                    <th className="p-4">Tyyppi</th>
                    <th className="p-4">Kirjaaja</th>
                    <th className="p-4">Tiivistelmä</th>
                    <th className="p-4 text-right">Toiminnot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {mockReports.map((rep, idx) => (
                    <tr key={idx} className="hover:bg-white transition-colors cursor-pointer">
                      <td className="p-4 font-mono text-xs text-slate-500">{rep.id}</td>
                      <td className="p-4 font-medium text-slate-800">{rep.time}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700">
                          {rep.type}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600">{rep.author}</td>
                      <td className="p-4 text-slate-600 line-clamp-1 max-w-[200px]">{rep.summary}</td>
                      <td className="p-4 text-right">
                        <button className="text-blue-600 hover:text-blue-900 font-medium text-xs bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors">
                          Avaa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'report_jv':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <button 
              onClick={() => setActiveTab('reporting')}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin raportointivalikkoon
            </button>
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-indigo-500" size={24} />
                Järjestyksenvalvojan tapahtumailmoitus
              </h2>
              <p className="text-sm text-slate-500 mt-1">LYTP:n mukainen lakisääteinen ilmoitus kiinniotto- ja voimankäyttötilanteista sekä ensihoidon käytöstä.</p>
            </div>
            
            <form className="space-y-8 text-left">
              {/* Osa 1: Perustiedot */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <h3 className="text-md font-semibold text-slate-700">1. Perustiedot</h3>
                  <button 
                    type="button" 
                    onClick={() => setShowInfoModal(true)}
                    className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg"
                  >
                    <Info size={16} />
                    Lain vaatimukset (LYTP)
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Järjestyksenvalvojan nimi</label>
                    <input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Etunimi Sukunimi" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Turvallisuusalan elinkeinoluvan haltija</label>
                    <input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Turva Oy" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tapahtuma-aika</label>
                    <div className="flex gap-2">
                      <input 
                        type="date" 
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                      />
                      <input 
                        type="time" 
                        ref={timeInputRef}
                        value={eventTimeStr}
                        onChange={(e) => setEventTimeStr(e.target.value)}
                        className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button 
                        type="button" 
                        onClick={handleTamaPvm}
                        className="px-3 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                      >
                        Tämä pvm
                      </button>
                      <button 
                        type="button" 
                        onClick={handleNyt}
                        className="px-3 py-1 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-colors"
                      >
                        Nyt
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tapahtumapaikka</label>
                    <input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Main Stage, portti 2..." />
                  </div>
                </div>
              </div>

              {/* Osa 2: Toimenpiteet */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">2. Toimenpiteet</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                    <span className="text-sm font-medium text-slate-700">Otettu kiinni tai käytetty voimakeinoja</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                    <span className="text-sm font-medium text-slate-700">Käytetty voimankäyttövälineitä (esim. käsiraudat, patukka, kaasu)</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500" />
                    <span className="text-sm font-medium text-slate-700">Otettu esille tai käytetty ampuma-asetta</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="w-5 h-5 text-amber-500 rounded border-slate-300 focus:ring-amber-500" />
                    <span className="text-sm font-medium text-slate-700">Kohdehenkilö on viety ensiapuun tai ensihoitoa on käytetty tilanteessa</span>
                  </label>
                </div>
              </div>

              {/* Osa 3: Kohdehenkilö ja havainnot */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">3. Kohdehenkilö ja havainnot (Havaintotiedot)</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kohdehenkilön tuntomerkit (tunnistamista varten)</label>
                    <textarea rows="2" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Pituus, vartalonrakenne, vaatetus, erityistuntomerkit..."></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Havainnot käyttäytymisestä ja tilasta</label>
                    <textarea rows="2" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. aggressiivinen, sekava, vahvasti päihtynyt, yhteistyökykyinen..."></textarea>
                  </div>
                </div>
              </div>

              {/* Osa 4: Lisätiedot */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">4. Vapaa kuvaus ja lisätiedot</h3>
                <div>
                  <textarea rows="4" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Tarkempi kuvaus tilanteen kulusta, toimenpiteistä, ensihoidon antamista tiedoista yms..."></textarea>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" className="px-5 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                  Tyhjennä
                </button>
                <button type="button" className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2">
                  <CheckCircle size={16} />
                  Tallenna ilmoitus
                </button>
              </div>

              {/* TIKE-osio */}
              <div className="mt-10 bg-slate-50 border border-slate-200 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3 border-b border-slate-200 pb-2">
                  TIKE:n muistilista (päivystäjälle)
                </h3>
                <ul className="space-y-1.5 mb-5 text-sm text-slate-600 list-disc list-inside">
                  <li>Onko TR käynyt paikalla?</li>
                  <li>Onko työntekijälle tullut vammoja?</li>
                  <li>Onko Turva 1 ja Turva 2 infottu asiasta?</li>
                  <li>Tarvitseeko tapahtumatuotannolle ilmoittaa?</li>
                </ul>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">TIKE:n kommentti:</label>
                  <textarea 
                    rows="3" 
                    className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" 
                    placeholder="Kirjaa tilannekeskuksen toimenpiteet ja lisähuomiot..."
                  ></textarea>
                </div>
              </div>
            </form>
          </div>
        );
      case 'report_tike':
        const tikeOptions = [
          { id: 'in', label: 'Työntekijän sisäänkirjaus', icon: LogIn, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { id: 'out', label: 'Työntekijän uloskirjaus', icon: LogOut, color: 'text-rose-600', bg: 'bg-rose-50' },
          { id: 'open', label: 'Avoin kirjaus', icon: PenTool, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { id: 'firstaid', label: 'Ensiaputilanne', icon: HeartPulse, color: 'text-rose-600', bg: 'bg-rose-50' },
          { id: 'threat', label: 'Uhkatilanne', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
          { id: 'fence', label: 'Aitojen ylitys / luvaton sisäänpääsy', icon: ShieldAlert, color: 'text-orange-600', bg: 'bg-orange-50' },
          { id: 'damage', label: 'Omaisuusvaurio', icon: Wrench, color: 'text-slate-600', bg: 'bg-slate-100' },
          { id: 'lostfound', label: 'Löytötavara', icon: Package, color: 'text-slate-600', bg: 'bg-slate-100' },
          { id: 'patrol', label: 'Kierrosraportti', icon: Clipboard, color: 'text-blue-600', bg: 'bg-blue-50' },
          { id: 'queue', label: 'Portin jonon odotusaika', icon: Clock, color: 'text-slate-600', bg: 'bg-slate-100' },
          { id: 'weather', label: 'Sääraportti', icon: Cloud, color: 'text-sky-600', bg: 'bg-sky-50' },
          { id: 'briefing', label: 'Briefing', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { id: 'management', label: 'Johdon tilannekatsaus', icon: BarChart2, color: 'text-purple-600', bg: 'bg-purple-50' },
        ];

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <button 
              onClick={() => setActiveTab('reporting')}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin raportointivalikkoon
            </button>
            
            <div className="mb-8 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Activity className="text-emerald-500" size={24} />
                TIKE:n raportointi ja seuranta
              </h2>
              <p className="text-sm text-slate-500 mt-1">Valitse uuden kirjauksen tai toimenpiteen tyyppi aloittaaksesi.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tikeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => setActiveTab(`tike_form_${option.id}`)}
                    className="flex flex-col items-start p-5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all text-left group bg-white"
                  >
                    <div className={`p-3 rounded-lg mb-4 transition-colors ${option.bg} ${option.color} group-hover:scale-110 transform duration-200`}>
                      <Icon size={24} />
                    </div>
                    <span className="font-bold text-slate-800 text-sm">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 'tike_form_in':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <button 
              onClick={() => { setActiveTab('report_tike'); setSelectedEmp(''); setEmpSearch(''); }}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin TIKE-valikkoon
            </button>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <LogIn className="text-emerald-500" size={24} />
                  Työntekijän sisäänkirjaus
                </h2>
                <p className="text-sm text-slate-500 mt-1">Kirjaa työntekijä sisään ja merkitse luovutetut välineet.</p>
              </div>
            </div>

            {/* Info Boxes / Työntekijätilanne */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">142</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">JV paikalla</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">25</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">Vartijat</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">12</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">EA henkilöt</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">8</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">Muu avoin</div>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-amber-700">3</div>
                <div className="text-xs text-amber-600 font-medium uppercase tracking-wide mt-1">Poikkeamat</div>
              </div>
            </div>

            <form className="space-y-8 text-left">
              {/* Haku */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Työntekijän haku (Sukunimi Etunimi...)</label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      value={empSearch}
                      onChange={(e) => {
                        setEmpSearch(e.target.value);
                        setSelectedEmp('');
                      }}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm font-medium" 
                      placeholder="Kirjoita vähintään 3 merkkiä hakeaksesi..."
                    />
                  </div>
                  
                  {empSearch.length >= 3 && !selectedEmp && (
                    <ul className="absolute z-10 bg-white border border-slate-200 rounded-lg shadow-lg w-full mt-1 max-h-60 overflow-y-auto">
                      {filteredEmployees.length > 0 ? (
                        filteredEmployees.map((emp, idx) => (
                          <li 
                            key={idx} 
                            onClick={() => {
                              setSelectedEmp(emp);
                              setEmpSearch(emp);
                            }}
                            className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-medium text-slate-700 border-b border-slate-100 last:border-0"
                          >
                            {emp}
                          </li>
                        ))
                      ) : (
                        <li className="px-4 py-3 text-sm text-slate-500">Ei osumia työntekijärekisteristä.</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              {/* Kirjauslomake (näytetään vain kun työntekijä on valittu) */}
              {selectedEmp && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-8 border-t border-slate-200 pt-6">
                  
                  {/* Rooli ja Aika */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col justify-center">
                      <label className="block text-sm font-bold text-slate-700 mb-3">Työntekijän rooli</label>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="role" className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" defaultChecked />
                          <span className="text-sm font-medium text-slate-700">Järjestyksenvalvoja</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="role" className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" />
                          <span className="text-sm font-medium text-slate-700">Vartija</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Sisäänkirjausaika</label>
                      <div className="flex gap-2">
                        <input 
                          type="date" 
                          value={checkInDate}
                          onChange={(e) => setCheckInDate(e.target.value)}
                          className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-emerald-500" 
                        />
                        <input 
                          type="time" 
                          value={checkInTime}
                          onChange={(e) => setCheckInTime(e.target.value)}
                          className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-emerald-500" 
                        />
                      </div>
                      <div className="mt-2">
                        <button 
                          type="button" 
                          onClick={handleCheckInNyt}
                          className="px-4 py-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md transition-colors"
                        >
                          Nyt
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Välineet */}
                  <div className="space-y-4">
                    <h3 className="text-md font-semibold text-slate-700 border-b pb-2">Luovutetut välineet</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      
                      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="text-sm font-medium text-slate-700">JV / Vartijan liivi</span>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="vest" className="text-emerald-600 focus:ring-emerald-500" />
                            <span className="text-sm">Kyllä</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="vest" className="text-slate-600 focus:ring-slate-500" defaultChecked />
                            <span className="text-sm">Ei</span>
                          </label>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <label className="block text-sm font-medium text-slate-700 mb-1">JV yksilötunnus</label>
                        <input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-emerald-500" placeholder="Esim. 1234" />
                      </div>

                      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="text-sm font-medium text-slate-700">Headset</span>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="headset" className="text-emerald-600 focus:ring-emerald-500" />
                            <span className="text-sm">Kyllä</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="headset" className="text-slate-600 focus:ring-slate-500" defaultChecked />
                            <span className="text-sm">Ei</span>
                          </label>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Radiopuhelimen nro</label>
                        <input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-emerald-500" placeholder="Esim. R-12" />
                      </div>
                      
                    </div>
                  </div>

                  {/* Poikkeamakommentit */}
                  <div className="space-y-4">
                    <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex justify-between items-end">
                      <span>Avoin poikkeamakommentti</span>
                      <span className="text-xs font-normal text-slate-500">Nämä kirjaukset näkyvät etusivun tilastoissa</span>
                    </h3>
                    <div>
                      <textarea 
                        rows="3" 
                        className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-emerald-500" 
                        placeholder="Esim. työntekijä joutuu lähtemään ennen työvuoron loppua, varustepuutteet tai muu huomionarvoinen asia..."
                      ></textarea>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => { setSelectedEmp(''); setEmpSearch(''); }}
                      className="px-5 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Peruuta
                    </button>
                    <button type="button" className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2">
                      <CheckCircle size={16} />
                      Tallenna kirjaus
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        );
      case 'tike_form_out':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <button 
              onClick={() => { setActiveTab('report_tike'); setSelectedOutEmp(null); setOutEmpSearch(''); setShowOutTimeInput(false); }}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin TIKE-valikkoon
            </button>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <LogOut className="text-rose-500" size={24} />
                  Työntekijän uloskirjaus
                </h2>
                <p className="text-sm text-slate-500 mt-1">Päätä työvuoro, palauta välineet ja kirjaa mahdolliset puutteet.</p>
              </div>
            </div>

            {/* Info Boxes / Työntekijätilanne */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">142</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">JV paikalla</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">25</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">Vartijat</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">12</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">EA henkilöt</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">8</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">Muu avoin</div>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-amber-700">3</div>
                <div className="text-xs text-amber-600 font-medium uppercase tracking-wide mt-1">Poikkeamat</div>
              </div>
            </div>

            <form className="space-y-8 text-left">
              {/* Haku */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Hae sisäänkirjattu työntekijä</label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      value={outEmpSearch}
                      onChange={(e) => {
                        setOutEmpSearch(e.target.value);
                        setSelectedOutEmp(null);
                        setShowOutTimeInput(false);
                      }}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500 text-sm font-medium" 
                      placeholder="Kirjoita vähintään 3 merkkiä hakeaksesi (esim. Kor tai Vir)..."
                    />
                  </div>
                  
                  {outEmpSearch.length >= 3 && !selectedOutEmp && (
                    <ul className="absolute z-10 bg-white border border-slate-200 rounded-lg shadow-lg w-full mt-1 max-h-60 overflow-y-auto">
                      {filteredOutEmployees.length > 0 ? (
                        filteredOutEmployees.map((emp) => (
                          <li 
                            key={emp.id} 
                            onClick={() => {
                              setSelectedOutEmp(emp);
                              setOutEmpSearch(emp.name);
                            }}
                            className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-medium text-slate-700 border-b border-slate-100 last:border-0 flex justify-between items-center"
                          >
                            <span>{emp.name}</span>
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">{emp.role}</span>
                          </li>
                        ))
                      ) : (
                        <li className="px-4 py-3 text-sm text-slate-500">Ei osumia sisäänkirjatuista työntekijöistä.</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              {/* Uloskirjauslomake (näytetään vain kun työntekijä on valittu) */}
              {selectedOutEmp && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-6 border-t border-slate-200 pt-6">
                  
                  {/* Yhteenveto sisäänkirjauksesta */}
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b border-slate-200 pb-2">
                      Sisäänkirjauksen tiedot
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="block text-slate-500 text-xs mb-1">Rooli</span>
                        <span className="font-semibold text-slate-800">{selectedOutEmp.role}</span>
                      </div>
                      <div>
                        <span className="block text-slate-500 text-xs mb-1">JV Yksilötunnus</span>
                        <span className="font-semibold text-slate-800">{selectedOutEmp.badge || '-'}</span>
                      </div>
                      <div>
                        <span className="block text-slate-500 text-xs mb-1">Liivi luovutettu</span>
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          {selectedOutEmp.vest ? <CheckCircle size={14} className="text-emerald-500"/> : <XCircle size={14} className="text-rose-500"/>}
                          {selectedOutEmp.vest ? 'Kyllä' : 'Ei'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-slate-500 text-xs mb-1">Radiopuhelin</span>
                        <span className="font-semibold text-slate-800">{selectedOutEmp.radio || '-'}</span>
                      </div>
                      <div>
                        <span className="block text-slate-500 text-xs mb-1">Headset</span>
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          {selectedOutEmp.headset ? <CheckCircle size={14} className="text-emerald-500"/> : <XCircle size={14} className="text-rose-500"/>}
                          {selectedOutEmp.headset ? 'Kyllä' : 'Ei'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Uloskirjauksen kommentti */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Uloskirjauksen kommentit ja huomiot</label>
                    <textarea 
                      rows="3" 
                      className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-rose-500" 
                      placeholder="Kirjaa ylös jos välineitä on hajonnut, kadonnut, tai jos työntekijällä on jotain raportoitavaa vuoron päätteeksi..."
                    ></textarea>
                  </div>

                  {/* Toiminnot */}
                  <div className="pt-2">
                    {!showOutTimeInput ? (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button 
                          type="button" 
                          onClick={() => {
                            // Tässä tallennetaan data nykyajalla. UI:n tyhjennys demo-tarkoituksessa:
                            setSelectedOutEmp(null);
                            setOutEmpSearch('');
                          }}
                          className="flex-1 py-3 px-4 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors flex justify-center items-center gap-2 shadow-sm"
                        >
                          <LogOut size={18} />
                          KIRJAA ULOS NYT
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setShowOutTimeInput(true)}
                          className="flex-1 py-3 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex justify-center items-center gap-2"
                        >
                          <Clock size={18} />
                          Kirjaa ulos muu aika
                        </button>
                      </div>
                    ) : (
                      <div className="bg-rose-50/50 p-5 rounded-xl border border-rose-100 animate-in fade-in slide-in-from-bottom-2">
                        <label className="block text-sm font-bold text-slate-800 mb-3">Valitse poikkeava uloskirjausaika</label>
                        <div className="flex gap-3 mb-5">
                          <input 
                            type="date" 
                            value={checkOutDate}
                            onChange={(e) => setCheckOutDate(e.target.value)}
                            className="flex-1 rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-rose-500 bg-white" 
                          />
                          <input 
                            type="time" 
                            value={checkOutTime}
                            onChange={(e) => setCheckOutTime(e.target.value)}
                            className="flex-1 rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-rose-500 bg-white" 
                          />
                        </div>
                        <div className="flex gap-3">
                          <button 
                            type="button" 
                            onClick={() => {
                              setSelectedOutEmp(null);
                              setOutEmpSearch('');
                              setShowOutTimeInput(false);
                            }}
                            className="px-5 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm flex-1"
                          >
                            Tallenna uloskirjaus
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setShowOutTimeInput(false)}
                            className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                          >
                            Peruuta ajan valinta
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </form>
          </div>
        );
      case 'tike_form_open':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <button 
              onClick={() => setActiveTab('report_tike')}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin TIKE-valikkoon
            </button>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <PenTool className="text-indigo-500" size={24} />
                  Avoin kirjaus
                </h2>
                <p className="text-sm text-slate-500 mt-1">Vapaamuotoinen lokikirjaus poikkeamista tai toimenpiteistä.</p>
              </div>
              
              {/* Dynaaminen tunniste */}
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Tunniste</span>
                <div className="text-sm font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
                  {getDynamicId()}
                </div>
              </div>
            </div>

            <form className="space-y-6 text-left">
              
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <label className="block text-sm font-bold text-slate-700 mb-2">Tapahtuma-aika</label>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input 
                      type="date" 
                      value={openKirjausDate}
                      onChange={(e) => setOpenKirjausDate(e.target.value)}
                      className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                    />
                    <input 
                      type="time" 
                      value={openKirjausTime}
                      onChange={(e) => setOpenKirjausTime(e.target.value)}
                      className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={handleOpenKirjausNyt}
                    className="px-4 py-2 text-xs font-bold bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg transition-colors shadow-sm"
                  >
                    NYT
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Kuvaus tapahtuneesta</label>
                <textarea 
                  rows="6" 
                  value={openKirjausText}
                  onChange={(e) => setOpenKirjausText(e.target.value)}
                  className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-indigo-500" 
                  placeholder="Kirjoita tarkka ja ytimekäs kuvaus tilanteesta ja tehdyistä toimenpiteistä..."
                ></textarea>
              </div>

              <div className="border border-dashed border-slate-300 rounded-xl p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-3">
                <div className="flex gap-4">
                  {/* Mobiilikamera-painike (capture="environment") */}
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-indigo-300 rounded-lg transition-all text-sm font-medium text-slate-700">
                    <Camera size={18} className="text-indigo-500" />
                    Ota kuva
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      onChange={(e) => setFileName(e.target.files[0]?.name || '')}
                    />
                  </label>

                  {/* Tiedoston valinta */}
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-indigo-300 rounded-lg transition-all text-sm font-medium text-slate-700">
                    <Paperclip size={18} className="text-indigo-500" />
                    Liitä tiedosto
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => setFileName(e.target.files[0]?.name || '')}
                    />
                  </label>
                </div>
                {fileName && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 mt-2">
                    <FileCheck size={16} />
                    Liitetty: {fileName}
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => { 
                    setActiveTab('report_tike'); 
                    setOpenKirjausText(''); 
                    setFileName(''); 
                  }}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Peruuta
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    // Tallennuksen yhteydessä juokseva numero kasvaa
                    setRunningNumber(prev => prev + 1);
                    setActiveTab('report_tike');
                    setOpenKirjausText('');
                    setFileName('');
                  }}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  <CheckCircle size={18} />
                  Tallenna kirjaus
                </button>
              </div>
            </form>
          </div>
        );
      case 'tike_form_firstaid':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <button 
              onClick={() => setActiveTab('report_tike')}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin TIKE-valikkoon
            </button>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <HeartPulse className="text-rose-500" size={24} />
                  Ensiaputilanne
                </h2>
                <p className="text-sm text-slate-500 mt-1">Kirjaa ensiapua vaatineet tapahtumat ja resurssien käyttö.</p>
              </div>
              
              {/* Dynaaminen tunniste */}
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Tunniste</span>
                <div className="text-sm font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
                  {getDynamicId()}
                </div>
              </div>
            </div>

            <form className="space-y-6 text-left">
              
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <label className="block text-sm font-bold text-slate-700 mb-2">Tapahtuma-aika</label>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input 
                      type="date" 
                      value={faDate}
                      onChange={(e) => setFaDate(e.target.value)}
                      className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-rose-500" 
                    />
                    <input 
                      type="time" 
                      value={faTime}
                      onChange={(e) => setFaTime(e.target.value)}
                      className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-rose-500" 
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={handleFaNyt}
                    className="px-4 py-2 text-xs font-bold bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg transition-colors shadow-sm"
                  >
                    NYT
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tapahtuman kuvaus</label>
                  <textarea 
                    rows="3" 
                    value={faDesc}
                    onChange={(e) => setFaDesc(e.target.value)}
                    className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-rose-500" 
                    placeholder="Mitä tapahtui? Potilaan tila ja oireet..."
                  ></textarea>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tehdyt toimenpiteet</label>
                  <textarea 
                    rows="3" 
                    value={faActions}
                    onChange={(e) => setFaActions(e.target.value)}
                    className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-rose-500" 
                    placeholder="Mitä toimenpiteitä tehtiin? (esim. haavan puhdistus, sidonta, ohjaus jatkohoitoon)"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Mitä resursseja kului</label>
                    <textarea 
                      rows="2" 
                      value={faResources}
                      onChange={(e) => setFaResources(e.target.value)}
                      className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-rose-500" 
                      placeholder="Esim. ensihoitotarvikkeet, lanssin tilaus..."
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Mitkä työntekijät paikalla olivat</label>
                    <textarea 
                      rows="2" 
                      value={faEmployees}
                      onChange={(e) => setFaEmployees(e.target.value)}
                      className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-rose-500" 
                      placeholder="Nimet / kutsumanimet"
                    ></textarea>
                  </div>
                </div>
              </div>

              <div className="border border-dashed border-slate-300 rounded-xl p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-3">
                <div className="flex gap-4">
                  {/* Mobiilikamera-painike */}
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-rose-300 rounded-lg transition-all text-sm font-medium text-slate-700">
                    <Camera size={18} className="text-rose-500" />
                    Ota kuva
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      onChange={(e) => setFaFileName(e.target.files[0]?.name || '')}
                    />
                  </label>

                  {/* Tiedoston valinta */}
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-rose-300 rounded-lg transition-all text-sm font-medium text-slate-700">
                    <Paperclip size={18} className="text-rose-500" />
                    Liitä tiedosto
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => setFaFileName(e.target.files[0]?.name || '')}
                    />
                  </label>
                </div>
                {faFileName && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 mt-2">
                    <FileCheck size={16} />
                    Liitetty: {faFileName}
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => { 
                    setActiveTab('report_tike'); 
                    setFaDesc(''); setFaActions(''); setFaResources(''); setFaEmployees(''); setFaFileName(''); 
                  }}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Peruuta
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setRunningNumber(prev => prev + 1);
                    setActiveTab('report_tike');
                    setFaDesc(''); setFaActions(''); setFaResources(''); setFaEmployees(''); setFaFileName('');
                  }}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  <CheckCircle size={18} />
                  Tallenna EA-kirjaus
                </button>
              </div>
            </form>
          </div>
        );
      case 'tike_form_threat':
      case 'tike_form_damage':
      case 'tike_form_lostfound':
      case 'tike_form_queue':
      case 'tike_form_weather': {
        const genericForms = {
          tike_form_threat: { title: 'Uhkatilanne', icon: AlertTriangle, iconColor: 'text-amber-500', btnBg: 'bg-amber-600 hover:bg-amber-700', nytBg: 'bg-amber-100 hover:bg-amber-200 text-amber-800', focusRing: 'focus:ring-amber-500', desc: 'Kirjaa havaitut uhkatilanteet ja niihin liittyvät toimenpiteet.' },
          tike_form_damage: { title: 'Omaisuusvaurio', icon: Wrench, iconColor: 'text-slate-600', btnBg: 'bg-slate-600 hover:bg-slate-700', nytBg: 'bg-slate-200 hover:bg-slate-300 text-slate-800', focusRing: 'focus:ring-slate-500', desc: 'Kirjaa alueella tapahtuneet omaisuusvauriot ja rikkoutumiset.' },
          tike_form_lostfound: { title: 'Löytötavara', icon: Package, iconColor: 'text-indigo-500', btnBg: 'bg-indigo-600 hover:bg-indigo-700', nytBg: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800', focusRing: 'focus:ring-indigo-500', desc: 'Kirjaa vastaanotetut tai toimitetut löytötavarat.' },
          tike_form_queue: { title: 'Portin jonon odotusaika', icon: Clock, iconColor: 'text-blue-500', btnBg: 'bg-blue-600 hover:bg-blue-700', nytBg: 'bg-blue-100 hover:bg-blue-200 text-blue-800', focusRing: 'focus:ring-blue-500', desc: 'Kirjaa porttien jonotilanne ja odotusajat.' },
          tike_form_weather: { title: 'Sääraportti', icon: Cloud, iconColor: 'text-sky-500', btnBg: 'bg-sky-600 hover:bg-sky-700', nytBg: 'bg-sky-100 hover:bg-sky-200 text-sky-800', focusRing: 'focus:ring-sky-500', desc: 'Kirjaa sääolosuhteiden muutokset ja varautumistoimenpiteet.' },
        };
        
        const config = genericForms[activeTab];
        const Icon = config.icon;

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <button 
              onClick={() => {
                setActiveTab('report_tike');
                setGenRepDate(''); setGenRepTime(''); setGenRepDesc(''); setGenRepActions(''); setGenRepEmps(''); setGenRepFile('');
              }}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin TIKE-valikkoon
            </button>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Icon className={config.iconColor} size={24} />
                  {config.title}
                </h2>
                <p className="text-sm text-slate-500 mt-1">{config.desc}</p>
              </div>
              
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Tunniste</span>
                <div className="text-sm font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
                  {getDynamicId()}
                </div>
              </div>
            </div>

            <form className="space-y-6 text-left">
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <label className="block text-sm font-bold text-slate-700 mb-2">Tapahtuma-aika</label>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input 
                      type="date" 
                      value={genRepDate}
                      onChange={(e) => setGenRepDate(e.target.value)}
                      className={`w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm ${config.focusRing}`}
                    />
                    <input 
                      type="time" 
                      value={genRepTime}
                      onChange={(e) => setGenRepTime(e.target.value)}
                      className={`w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm ${config.focusRing}`}
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={handleGenRepNyt}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm ${config.nytBg}`}
                  >
                    NYT
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tapahtuman kuvaus</label>
                  <textarea 
                    rows="3" 
                    value={genRepDesc}
                    onChange={(e) => setGenRepDesc(e.target.value)}
                    className={`w-full rounded-lg border-slate-300 border p-3 text-sm ${config.focusRing}`}
                    placeholder="Mitä havaittiin tai tapahtui..."
                  ></textarea>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tehdyt toimenpiteet</label>
                  <textarea 
                    rows="3" 
                    value={genRepActions}
                    onChange={(e) => setGenRepActions(e.target.value)}
                    className={`w-full rounded-lg border-slate-300 border p-3 text-sm ${config.focusRing}`}
                    placeholder="Miten tilanteeseen reagoitiin, kenelle ilmoitettu..."
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Mitkä työntekijät paikalla olivat</label>
                  <textarea 
                    rows="2" 
                    value={genRepEmps}
                    onChange={(e) => setGenRepEmps(e.target.value)}
                    className={`w-full rounded-lg border-slate-300 border p-3 text-sm ${config.focusRing}`}
                    placeholder="Paikalla olleiden työntekijöiden nimet tai kutsutunnukset..."
                  ></textarea>
                </div>
              </div>

              <div className="border border-dashed border-slate-300 rounded-xl p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-3">
                <div className="flex gap-4">
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 rounded-lg transition-all text-sm font-medium text-slate-700">
                    <Camera size={18} className={config.iconColor} />
                    Ota kuva
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      onChange={(e) => setGenRepFile(e.target.files[0]?.name || '')}
                    />
                  </label>

                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 rounded-lg transition-all text-sm font-medium text-slate-700">
                    <Paperclip size={18} className={config.iconColor} />
                    Liitä tiedosto
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => setGenRepFile(e.target.files[0]?.name || '')}
                    />
                  </label>
                </div>
                {genRepFile && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 mt-2">
                    <FileCheck size={16} />
                    Liitetty: {genRepFile}
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => { 
                    setActiveTab('report_tike'); 
                    setGenRepDate(''); setGenRepTime(''); setGenRepDesc(''); setGenRepActions(''); setGenRepEmps(''); setGenRepFile(''); 
                  }}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Peruuta
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setRunningNumber(prev => prev + 1);
                    setActiveTab('report_tike');
                    setGenRepDate(''); setGenRepTime(''); setGenRepDesc(''); setGenRepActions(''); setGenRepEmps(''); setGenRepFile('');
                  }}
                  className={`px-5 py-2.5 text-sm font-bold text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm ${config.btnBg}`}
                >
                  <CheckCircle size={18} />
                  Tallenna kirjaus
                </button>
              </div>
            </form>
          </div>
        );
      }
      case 'planning':
        return (
          <div className="space-y-6 max-w-5xl">
            {/* Status Banner */}
            <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm ${readinessStatusColor}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 bg-white rounded-lg ${readinessStatusIconColor} shadow-sm`}>
                  <DoorOpen size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">Avausvalmius</h3>
                  <p className="text-sm font-medium">{readinessStatusText}</p>
                </div>
              </div>
              <div className="text-3xl font-black tabular-nums tracking-tighter">
                {completedChecksCount}/5
              </div>
            </div>

            <div className="mb-6 pb-4 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="text-indigo-500" size={28} />
                Ennen tapahtumaa
              </h2>
              <p className="text-sm text-slate-500 mt-1">Suunnittelu, varautuminen ja henkilöstöhallinto.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Avausvalmius Card */}
              <button 
                onClick={() => setActiveTab('planning_readiness')}
                className={`bg-white p-6 rounded-xl border shadow-sm transition-all text-left group hover:shadow-md ${isReadyForOpening ? 'border-emerald-200 hover:border-emerald-300' : isLate ? 'border-rose-200 hover:border-rose-300' : 'border-slate-200 hover:border-blue-300'}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg transition-colors ${isReadyForOpening ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100' : isLate ? 'bg-rose-50 text-rose-600 group-hover:bg-rose-100' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'}`}>
                    <DoorOpen size={24} />
                  </div>
                  <ChevronRight className="text-slate-400 group-hover:text-slate-600 transition-colors" size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Avausvalmius</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Porttien avauksen edellytysten kuittaus ja tavoiteaika.</p>
              </button>

              {/* Työntekijärekisteri Card */}
              <button 
                onClick={() => setActiveTab('planning_employees')}
                className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all text-left group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 transition-colors">
                    <Users size={24} />
                  </div>
                  <ChevronRight className="text-slate-400 group-hover:text-indigo-500 transition-colors" size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Tapahtuman työntekijät</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Henkilöstörekisteri, pätevyydet ja osallistuvat työntekijät.</p>
              </button>

              {/* Uusi työntekijä Card */}
              <button 
                onClick={() => { setEditingEmp(null); setActiveTab('planning_employee_new'); }}
                className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition-colors">
                    <UserPlus size={24} />
                  </div>
                  <ChevronRight className="text-slate-400 group-hover:text-emerald-500 transition-colors" size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Kirjaa uusi työntekijä</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Lisää työntekijä rekisteriin ja tarkista luvat sekä koulutukset.</p>
              </button>
            </div>
          </div>
        );
      case 'planning_readiness':
        const checklistItems = [
          { key: 'exits', label: 'Hätäuloskäynnit miehitetty' },
          { key: 'guards', label: 'Vähintään 80% järjestyksenvalvojista paikalla' },
          { key: 'vehicles', label: 'Ajoneuvot pois alueelta' },
          { key: 'production', label: 'Tuotanto valmis avaukseen' },
          { key: 'security', label: 'Turvajohto valmis avaukseen' }
        ];

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-3xl mx-auto">
            <button 
              onClick={() => setActiveTab('planning')}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin suunnitteluvalikkoon
            </button>
            
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <DoorOpen className="text-indigo-500" size={28} />
                Avausvalmius (Green Light)
              </h2>
              <p className="text-sm text-slate-500 mt-1">Kuittaa tapahtuman avauksen edellytykset ennen porttien avaamista yleisölle.</p>
            </div>

            <form className="space-y-8 text-left">
              {/* Tavoiteaika */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">Tavoiteltu avausaika</h3>
                  <p className="text-xs text-slate-500">Aseta kellonaika, jolloin portit on tarkoitus avata. Jos valmiutta ei ole kuitattu tähän mennessä, järjestelmä hälyttää myöhästymisestä.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="text-slate-400" size={18} />
                  <input 
                    type="time" 
                    value={targetOpeningTime}
                    onChange={(e) => setTargetOpeningTime(e.target.value)}
                    className="w-28 rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 text-center font-bold" 
                  />
                </div>
              </div>

              {/* Tarkistuslista */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <CheckSquare className="text-slate-400" size={20} />
                  Edellytysten kuittaus
                </h3>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {checklistItems.map(item => (
                    <label key={item.key} className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          checked={readinessChecks[item.key]}
                          onChange={() => toggleReadinessCheck(item.key)}
                          className="w-6 h-6 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 transition-all cursor-pointer" 
                        />
                      </div>
                      <span className={`text-base font-medium transition-colors ${readinessChecks[item.key] ? 'text-slate-800' : 'text-slate-600'}`}>
                        {item.label}
                      </span>
                      {readinessChecks[item.key] && (
                        <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Kyllä</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Poikkeamat */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Avauksen poikkeamat ja lisätiedot</label>
                <textarea 
                  rows="4" 
                  value={readinessComments}
                  onChange={(e) => setReadinessComments(e.target.value)}
                  className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-indigo-500" 
                  placeholder="Kirjaa ylös syyt mahdolliseen myöhästymiseen tai muut huomionarvoiset poikkeamat (esim. 'Turvatarkastuslinja 2 ei käytössä kortinlukijan vian vuoksi')..."
                ></textarea>
              </div>

              {/* Toiminnot */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setActiveTab('planning')}
                  className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  <CheckCircle size={18} />
                  Tallenna ja sulje
                </button>
              </div>
            </form>
          </div>
        );
      case 'postevent':
        const radioChannels = [
          "JV:t Tapahtuma",
          "JV:t Välitönläheisyys",
          "Toimintaryhmät",
          "Toimintaryhmät (vara)",
          "Backstage",
          "Raportointi",
          "Liikenne",
          "Turvallisuusjohto ja tike (tarvittaessa viranomaiset)"
        ];

        const supervisors = [
          { role: "Turva 1", name: "Ismo Näkki" },
          { role: "Turva 2", name: "Liisa Ollila" },
          { role: "Pääportti 10", name: "Jaakko Mäki" },
          { role: "Lava 1 10", name: "Markus Joki" },
          { role: "Lava 2 10", name: "Maria Lohi" },
          { role: "VIP 10", name: "Sulo Oja" },
          { role: "Toimintaryhmä 10", name: "Kalevi Mauno" },
          { role: "Kenttä 10", name: "Jouko Neno" },
          { role: "Ulko 10", name: "Anna Lahti" }
        ];

        return (
          <div className="space-y-6 max-w-5xl">
            <div className="mb-6 pb-4 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Layers className="text-indigo-500" size={28} />
                FestivaaliX
              </h2>
              <p className="text-sm text-slate-500 mt-1">Tapahtuman operatiivinen kartta, viestintäkanavat ja johto.</p>
            </div>

            {/* Kartta */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Map className="text-indigo-500" size={20} />
                Tapahtuman pohjakartta
              </h3>
              <div className="w-full bg-slate-50 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center min-h-[300px] md:min-h-[500px]">
                <img 
                  src="image_aa9244.png" 
                  alt="Tapahtuman pohjakartta" 
                  className="max-w-full h-auto object-contain" 
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/800x400/e2e8f0/64748b?text=Kuva+ei+latautunut' }} 
                />
              </div>
            </div>

            {/* Grid for Radios and Supervisors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Radiokanavat */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <PhoneCall className="text-emerald-500" size={20} />
                  Radiopuhelinten kanavalista
                </h3>
                <ul className="space-y-2">
                  {radioChannels.map((channel, idx) => (
                    <li key={idx} className="flex gap-3 items-center p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-colors">
                      <span className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {idx + 1}
                      </span> 
                      <span className="text-sm font-medium text-slate-700">{channel}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Esimiehet */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Users className="text-blue-500" size={20} />
                  Esimiehet ja vastuuhenkilöt
                </h3>
                <ul className="space-y-2">
                  {supervisors.map((sup, idx) => (
                    <li key={idx} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg border border-slate-100 transition-colors">
                      <span className="text-sm font-bold text-slate-700">{sup.role}</span>
                      <span className="text-sm font-medium text-slate-500 bg-white px-2 py-1 rounded shadow-sm border border-slate-200">{sup.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      case 'planning_employees':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <button 
              onClick={() => setActiveTab('planning')}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin suunnitteluvalikkoon
            </button>
            
            <div className="mb-6 flex justify-between items-end border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Users className="text-indigo-500" size={24} />
                  Tapahtuman työntekijät
                </h2>
                <p className="text-sm text-slate-500 mt-1">Tapahtumaan rekisteröity henkilöstö ({mockEmployees.length} henkilöä).</p>
              </div>
              <button 
                onClick={() => { setEditingEmp(null); setActiveTab('planning_employee_new'); }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                <UserPlus size={16} />
                Lisää uusi
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Nimi</th>
                    <th className="p-4">Roolit</th>
                    <th className="p-4">Kortit tarkistettu</th>
                    <th className="p-4 text-right">Toiminnot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {mockCheckedInEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-white transition-colors">
                      <td className="p-4 font-medium text-slate-800">{emp.name}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                          {emp.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                          <CheckCircle size={14} /> OK
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => { setEditingEmp(emp); setActiveTab('planning_employee_new'); }}
                          className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                        >
                          Muokkaa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'planning_employee_new':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <button 
              onClick={() => { setEditingEmp(null); setActiveTab('planning_employees'); }}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin työntekijälistaan
            </button>
            
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                {editingEmp ? <UserCheck className="text-indigo-500" size={24} /> : <UserPlus className="text-emerald-500" size={24} />}
                {editingEmp ? 'Muokkaa työntekijää' : 'Kirjaa uusi työntekijä'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {editingEmp ? 'Päivitä työntekijän perustiedot, luvat ja suoritetut koulutukset.' : 'Lisää työntekijän perustiedot, pätevyydet ja suoritetut koulutukset rekisteriin.'}
              </p>
            </div>

            <form className="space-y-8 text-left">
              {/* Osa 1: Yhteys- ja henkilötiedot */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
                  <Contact size={18} className="text-slate-400"/>
                  1. Henkilö- ja yhteystiedot
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Koko nimi (Sukunimi Etunimi Toiset nimet)</label>
                    <input type="text" defaultValue={editingEmp ? editingEmp.name : ''} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Korhonen Elli Marja Orvokki" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Henkilötunnus</label>
                    <input type="text" defaultValue={editingEmp ? '121280-123X' : ''} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="PPKKVV-XXXX" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sähköposti</label>
                    <input type="email" className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="etunimi.sukunimi@esimerkki.fi" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Matkapuhelin</label>
                    <input type="tel" className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="040 123 4567" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Katuosoite</label>
                      <input type="text" className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esimerkkikatu 1 A 2" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Postinumero</label>
                      <input type="text" className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="00100" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Osa 2: Luvat ja kortit */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
                  <IdCard size={18} className="text-slate-400"/>
                  2. Pätevyydet ja kortit
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <label className="block text-sm font-bold text-slate-800 mb-2">Järjestyksenvalvojakortti</label>
                    <input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Kortin numero" />
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <label className="block text-sm font-bold text-slate-800 mb-2">Vartijakortti</label>
                    <input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Kortin numero" />
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <label className="block text-sm font-bold text-slate-800 mb-2">Kaasusumuttimen hallussapito</label>
                    <input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Lupanumero" />
                  </div>
                </div>
              </div>

              {/* Osa 3: Erityiskoulutukset */}
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b pb-2">
                  <h3 className="text-md font-semibold text-slate-700 flex items-center gap-2">
                    <UserCheck size={18} className="text-slate-400"/>
                    3. Erityiskoulutukset
                  </h3>
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">Ruksaa vain jos suoritettu ja todistus mukana</span>
                </div>
                
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                    <div>
                      <span className="block text-sm font-bold text-slate-800">Järjestyksenvalvojan voimankäytön lisäkoulutus</span>
                      <span className="block text-xs text-slate-500 mt-0.5">Oikeuttaa kantaa voimankäyttövälineitä (jos muut luvat kunnossa).</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                    <span className="text-sm font-bold text-slate-800">Kaasusumutinkoulutus</span>
                  </label>
                  <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                    <span className="text-sm font-bold text-slate-800">Teleskooppipatukkakoulutus</span>
                  </label>
                  
                  <div className="p-4 bg-slate-50 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                    <div>
                      <span className="block text-sm font-bold text-slate-800">Voimankäyttövälineiden kertauskoulutus</span>
                      <span className="block text-xs text-slate-500 mt-0.5">Vuosittainen kertaus. Kirjaa mihin asti todistus on voimassa.</span>
                    </div>
                    <div className="min-w-[200px]">
                      <input type="date" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => { setEditingEmp(null); setActiveTab('planning_employees'); }}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Peruuta
                </button>
                <button 
                  type="button" 
                  onClick={() => { setEditingEmp(null); setActiveTab('planning_employees'); }}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  <CheckCircle size={18} />
                  {editingEmp ? 'Tallenna muutokset' : 'Tallenna työntekijä'}
                </button>
              </div>
            </form>
          </div>
        );
      case 'documents':
        return (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[400px] text-center">
            <FileText className="text-slate-300 mb-4" size={48} />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Lomakkeet & Asiakirjat</h2>
            <p className="text-slate-500 max-w-md">Viranomaislomakkeet, JOKE-loki, ja poikkeamaraportit (Osa 4).</p>
          </div>
        );
      case 'settings':
        return (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[400px] text-center">
            <Settings className="text-slate-300 mb-4" size={48} />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Asetukset</h2>
            <p className="text-slate-500 max-w-md">Järjestelmän asetukset, käyttäjänhallinta ja integraatiot.</p>
          </div>
        );
      default:
        if (activeTab.startsWith('tike_form_')) {
          return (
             <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl text-center py-16">
               <button 
                onClick={() => setActiveTab('report_tike')}
                className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6 mx-auto"
              >
                <ArrowLeft size={16} />
                Takaisin TIKE-valikkoon
              </button>
              <Wrench className="text-slate-300 mx-auto mb-4" size={48} />
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Osio rakenteilla</h2>
              <p className="text-slate-500 max-w-md mx-auto">Tämä lomakepohja ({activeTab.replace('tike_form_', '')}) toteutetaan seuraavassa vaiheessa.</p>
            </div>
          );
        }
        return <div>Osio rakenteilla.</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Top Navigation Bar */}
      <nav className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
            aria-label="Kutista tai laajenna sivuvalikko"
          >
            <Menu size={24} />
          </button>
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setActiveTab('landing')}
          >
            <ShieldCheck className="text-indigo-400" size={28} />
            <div>
              <h1 className="text-xl font-bold leading-tight tracking-tight">Turvajohto OS</h1>
              <p className="hidden md:block text-xs text-slate-400 font-medium">Tapahtumaturvallisuuden tilannekuva</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          
          {/* Pikatoiminnot -ponnahdusvalikko */}
          <div className="relative">
            <button 
              onClick={() => setShowQuickActions(!showQuickActions)}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm"
            >
              <AlertTriangle size={16} />
              <span className="hidden sm:inline">Pikatoiminnot</span>
            </button>
            
            {showQuickActions && (
              <div className="absolute right-0 mt-3 w-72 bg-slate-800 rounded-xl shadow-xl border border-slate-700 p-5 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <AlertTriangle className="text-rose-400" size={18} />
                    Kriittiset toiminnot
                  </h3>
                  <button onClick={() => setShowQuickActions(false)} className="text-slate-400 hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-3">
                  <button className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors flex justify-center items-center gap-2 shadow-sm">
                    SHOW STOP PROTOKOLLA
                  </button>
                  <button className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex justify-center items-center gap-2">
                    <PhoneCall size={18} /> Yhteys Viranomaisiin
                  </button>
                  <button className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex justify-center items-center gap-2">
                    <Layers size={18} /> Eskaloi Tilanne
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="hidden md:flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg">
            <Clock size={16} className="text-indigo-400" />
            <span className="font-mono text-sm tracking-widest">{formatTime(currentTime)}</span>
          </div>
          <div className="flex items-center gap-3 border-l border-slate-700 pl-4 sm:pl-6">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">
              TJ
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-col md:flex-row min-h-[calc(100vh-73px)]">
        {/* Sidebar Navigation */}
        {isSidebarOpen && (
          <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col">
            <div className="p-4 space-y-1">
              <button 
                onClick={() => setActiveTab('landing')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'landing' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Home size={18} />
                Aloitussivu
              </button>
              <button 
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Activity size={18} />
                Tilannekuva
              </button>
              <button 
                onClick={() => setActiveTab('reporting')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${(activeTab.startsWith('report') || activeTab.startsWith('tike_')) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <FileText size={18} />
                Raportointi
              </button>
              <button 
                onClick={() => setActiveTab('planning')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab.startsWith('planning') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Calendar size={18} />
                Ennen Tapahtumaa
              </button>
               <button 
                onClick={() => setActiveTab('postevent')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'postevent' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Layers size={18} />
                FestivaaliX
              </button>
              <button 
                onClick={() => setActiveTab('documents')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'documents' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <FileText size={18} />
                Lomakekartoitus
              </button>
              <button 
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Settings size={18} />
                Asetukset
              </button>
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>

      {/* LYTP Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Info className="text-indigo-500" size={24} />
                Lakisääteiset vaatimukset
              </h2>
              <button 
                onClick={() => setShowInfoModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 leading-relaxed text-left">
              <div>
                <h3 className="font-bold text-slate-900 mb-2 text-base">Laki yksityisistä turvallisuuspalveluista (1085/2015) 33 §</h3>
                <p className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  "Järjestyksenvalvojan tulee heti laatia järjestyksenvalvojatehtävissä havaituista kiinniottamiseen 
                  tai voimakeinojen käyttöön johtaneista tapahtumista kirjallinen selvitys (tapahtumailmoitus). 
                  Järjestyksenvalvoja voi laatia tapahtumailmoituksen myös muista toimenpiteisiin johtaneista tapahtumista. 
                  Tapahtumailmoituksesta tulee käydä ilmi järjestyksenvalvojan kyseiseen tapahtumaan liittyvät havainnot ja 
                  toimenpiteet. Toimenpiteiden kohteena olleiden sukunimi, etunimet, henkilötunnus ja osoitetiedot saadaan 
                  kirjata tapahtumailmoitukseen."
                </p>
              </div>
              
              <div>
                <h3 className="font-bold text-slate-900 mb-2 text-base">Valtioneuvoston asetus yksityisistä turvallisuuspalveluista (874/2016) 18 §</h3>
                <p className="mb-2">Sen lisäksi, mitä yksityisistä turvallisuuspalveluista annetun lain 8 ja 33 §:ssä säädetään, tapahtumailmoituksessa on mainittava:</p>
                <ol className="list-decimal list-inside space-y-1 mb-4 ml-2">
                  <li>vartijan tai järjestyksenvalvojan nimi ja turvallisuusalan elinkeinoluvan haltija, jonka palveluksessa vartija tai järjestyksenvalvoja on;</li>
                  <li>tapahtuma-aika ja -paikka;</li>
                  <li>tieto siitä, onko vartija tai järjestyksenvalvoja ottanut jonkun kiinni tai käyttänyt voimakeinoja;</li>
                  <li>tieto siitä, onko vartija tai järjestyksenvalvoja käyttänyt voimankäyttövälineitä; sekä</li>
                  <li>tieto siitä, onko vartija ottanut esille ampuma-aseen tai käyttänyt sitä.</li>
                </ol>
                <p className="mb-2">Tapahtumailmoituksessa saadaan tarvittaessa mainita havaintotietoina:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>toimenpiteen kohteena olleen henkilön tuntomerkit henkilön tunnistamiseksi; sekä</li>
                  <li>havaintoja kohdehenkilön käyttäytymisestä ja tilasta.</li>
                </ol>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowInfoModal(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
              >
                Sulje
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}