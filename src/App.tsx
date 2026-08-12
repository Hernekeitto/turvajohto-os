import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, ShieldCheck, Activity, Users, Clock, FileText, PhoneCall,
  CheckCircle, XCircle, BarChart2, Calendar, Layers, Map, Settings,
  MessageSquare, ChevronRight, ChevronDown, Info, X, ArrowLeft, LogIn,
  LogOut, PenTool, HeartPulse, Clipboard, Cloud, ShieldAlert, Package,
  Wrench, Search, UserPlus, IdCard, UserCheck, Contact, Archive, Camera,
  Paperclip, FileCheck, Home, DoorOpen, CheckSquare, Menu, Lock
} from 'lucide-react';

// --- MOCK DATA (Koodiin kovatututimmat esimerkit) ---
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
  // 1. KIRJAUTUMISTILA
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  // 2. SOVELLUKSEN YLEISET TILAT
  const [activeTab, setActiveTab] = useState('landing');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [overviewCardTab, setOverviewCardTab] = useState('checklist'); // 'checklist' | 'reports'
  const [runningNumber, setRunningNumber] = useState(100);

  // 3. TYÖNTEKIJÄTIETOKANTA (Reaktiivinen tila)
  const [employees, setEmployees] = useState([
    { id: 1, name: "Korhonen Elli Marja Orvokki", role: "Järjestyksenvalvoja", checkedIn: true, email: "elli@esimerkki.fi" },
    { id: 2, name: "Virtanen Matti Johannes Antero", role: "Vartija", checkedIn: true, email: "matti@esimerkki.fi" },
    { id: 3, name: "Mäkinen Kalle Petteri Aleksi", role: "Järjestyksenvalvoja", checkedIn: true, email: "kalle@esimerkki.fi" },
    { id: 4, name: "Nieminen Anna Sofia Maria", role: "Järjestyksenvalvoja", checkedIn: false, email: "anna@esimerkki.fi" },
    { id: 5, name: "Lahtinen Oskari Juhani Tapio", role: "Vartija", checkedIn: false, email: "oskari@esimerkki.fi" }
  ]);

  const [checkedInEmployees, setCheckedInEmployees] = useState([
    { id: 101, empId: 1, name: "Korhonen Elli Marja Orvokki", role: "Järjestyksenvalvoja", vest: true, badge: "1234", headset: true, radio: "R-12" },
    { id: 102, empId: 2, name: "Virtanen Matti Johannes Antero", role: "Vartija", vest: false, badge: "5521", headset: false, radio: "" },
    { id: 103, empId: 3, name: "Mäkinen Kalle Petteri Aleksi", role: "Järjestyksenvalvoja", vest: true, badge: "9982", headset: true, radio: "R-05" }
  ]);

  const activeJvCount = checkedInEmployees.filter(e => e.role === 'Järjestyksenvalvoja').length;
  const activeVartijaCount = checkedInEmployees.filter(e => e.role === 'Vartija').length;

  // 4. LOMAKKEIDEN TILAT
  // Työntekijän hallinta
  const [editingEmp, setEditingEmp] = useState(null);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('Järjestyksenvalvoja');

  // JV-ilmoitus
  const [eventDate, setEventDate] = useState('');
  const [eventTimeStr, setEventTimeStr] = useState('');
  const timeInputRef = useRef(null);

  // TIKE Sisäänkirjaus
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkInRole, setCheckInRole] = useState('Järjestyksenvalvoja');
  const [checkInVest, setCheckInVest] = useState(false);
  const [checkInBadge, setCheckInBadge] = useState('');
  const [checkInHeadset, setCheckInHeadset] = useState(false);
  const [checkInRadio, setCheckInRadio] = useState('');

  // TIKE Uloskirjaus
  const [outEmpSearch, setOutEmpSearch] = useState('');
  const [selectedOutEmp, setSelectedOutEmp] = useState(null);
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [showOutTimeInput, setShowOutTimeInput] = useState(false);

  // TIKE Avoin kirjaus
  const [openKirjausDate, setOpenKirjausDate] = useState('');
  const [openKirjausTime, setOpenKirjausTime] = useState('');
  const [openKirjausText, setOpenKirjausText] = useState('');
  const [fileName, setFileName] = useState('');

  // TIKE Ensiapu
  const [faDate, setFaDate] = useState('');
  const [faTime, setFaTime] = useState('');
  const [faDesc, setFaDesc] = useState('');
  const [faActions, setFaActions] = useState('');
  const [faResources, setFaResources] = useState('');
  const [faEmployees, setFaEmployees] = useState('');
  const [faFileName, setFaFileName] = useState('');

  // TIKE Kierrosraportti
  const [patrolDate, setPatrolDate] = useState('');
  const [patrolTime, setPatrolTime] = useState('');
  const [patrolPerson, setPatrolPerson] = useState('');
  const [patrolAreas, setPatrolAreas] = useState('');
  const [patrolDeviations, setPatrolDeviations] = useState('');
  const [patrolFile, setPatrolFile] = useState('');

  // TIKE Muut Yleiset Raportit
  const [genRepDate, setGenRepDate] = useState('');
  const [genRepTime, setGenRepTime] = useState('');
  const [genRepDesc, setGenRepDesc] = useState('');
  const [genRepActions, setGenRepActions] = useState('');
  const [genRepEmps, setGenRepEmps] = useState('');
  const [genRepFile, setGenRepFile] = useState('');

  // Avausvalmius
  const [targetOpeningTime, setTargetOpeningTime] = useState('16:00');
  const [readinessChecks, setReadinessChecks] = useState({
    exits: false, guards: false, vehicles: false, production: false, security: false
  });
  const [readinessComments, setReadinessComments] = useState('');

  // --- FUNKTIOT JA LOGIIKAT ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

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

  const setTimeNow = (setDate, setTime) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [d, t] = now.toISOString().slice(0, 16).split('T');
    setDate(d);
    setTime(t);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === 'Kaulin') {
      setIsAuthenticated(true);
      setLoginError(false);
    } else {
      setLoginError(true);
      setPasswordInput('');
    }
  };

  // Työntekijöiden hallinta
  const openEmployeeForm = (emp = null) => {
    setEditingEmp(emp);
    if (emp) {
      setNewEmpName(emp.name);
      setNewEmpRole(emp.role);
    } else {
      setNewEmpName('');
      setNewEmpRole('Järjestyksenvalvoja');
    }
    setActiveTab('planning_employee_new');
  };

  const handleSaveEmployee = () => {
    if (!newEmpName) return;
    if (editingEmp) {
      setEmployees(employees.map(e => e.id === editingEmp.id ? { ...e, name: newEmpName, role: newEmpRole } : e));
      setCheckedInEmployees(checkedInEmployees.map(e => e.empId === editingEmp.id ? { ...e, name: newEmpName, role: newEmpRole } : e));
    } else {
      setEmployees([...employees, { id: Date.now(), name: newEmpName, role: newEmpRole, checkedIn: false }]);
    }
    setActiveTab('planning_employees');
  };

  // Sisään/Uloskirjaus Logiikka
  const filteredEmployeesForCheckIn = empSearch.length >= 3 
    ? employees.filter(e => !e.checkedIn && e.name.toLowerCase().includes(empSearch.toLowerCase())) 
    : [];

  const filteredOutEmployees = outEmpSearch.length >= 3
    ? checkedInEmployees.filter(e => e.name.toLowerCase().includes(outEmpSearch.toLowerCase()))
    : [];

  const handleSelectEmpForCheckIn = (emp) => {
    setSelectedEmp(emp);
    setEmpSearch(emp.name);
    setCheckInRole(emp.role);
    setCheckInVest(false); setCheckInBadge(''); setCheckInHeadset(false); setCheckInRadio('');
  };

  const handleSaveCheckInFinal = () => {
    if (!selectedEmp) return;
    const newCI = {
      id: Date.now(), empId: selectedEmp.id, name: selectedEmp.name, role: checkInRole,
      vest: checkInVest, badge: checkInBadge, headset: checkInHeadset, radio: checkInRadio
    };
    setCheckedInEmployees([...checkedInEmployees, newCI]);
    setEmployees(employees.map(e => e.id === selectedEmp.id ? { ...e, checkedIn: true, role: checkInRole } : e));
    setSelectedEmp(null); setEmpSearch(''); setActiveTab('report_tike');
  };

  const handleSaveCheckOutFinal = () => {
    if (!selectedOutEmp) return;
    setCheckedInEmployees(checkedInEmployees.filter(e => e.empId !== selectedOutEmp.empId));
    setEmployees(employees.map(e => e.id === selectedOutEmp.empId ? { ...e, checkedIn: false } : e));
    setSelectedOutEmp(null); setOutEmpSearch(''); setShowOutTimeInput(false); setActiveTab('report_tike');
  };

  // Avausvalmius Logiikka
  const toggleReadinessCheck = (key) => setReadinessChecks(prev => ({ ...prev, [key]: !prev[key] }));
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

  // --- LOGIN RENDERÖINTI ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl max-w-md w-full text-center animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Lock size={40} />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Turvajohto OS</h1>
          <p className="text-slate-500 mb-8 font-medium">Turvallisuusjohtajan tilannekuva</p>
          
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Pääsykoodi</label>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className={`w-full rounded-xl border p-3 text-lg focus:ring-2 focus:outline-none transition-colors ${loginError ? 'border-rose-300 focus:ring-rose-500 bg-rose-50' : 'border-slate-300 focus:ring-indigo-500'}`}
                placeholder="••••••"
                autoFocus
              />
              {loginError && <p className="text-rose-500 text-xs font-bold mt-2">Väärä salasana, yritä uudelleen.</p>}
            </div>
            <button 
              type="submit" 
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg mt-2"
            >
              Kirjaudu sisään
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- PÄÄSISÄLLÖN RENDERÖINTI ---
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <DashboardCard 
                title="Aktiiviset Järjestyksenvalvojat" 
                icon={ShieldCheck} 
                value={activeJvCount.toString()} 
                subtitle="Dynaaminen luku sisäänkirjatuista"
              />
              <DashboardCard 
                title="Aktiiviset Vartijat" 
                icon={Users} 
                value={activeVartijaCount.toString()} 
                subtitle="Dynaaminen luku sisäänkirjatuista"
              />
              <DashboardCard 
                title="Ensiaputapaukset" 
                icon={HeartPulse} 
                value="12" 
                subtitle="Viimeisen tunnin aikana: 3"
              />
              <DashboardCard 
                title="Poikkeamat" 
                icon={AlertTriangle} 
                value="3" 
                subtitle="Avoinna olevat tilanteet"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

              <div className="space-y-6">
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
              <button onClick={() => setActiveTab('report_jv')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 text-left group">
                <div className="flex justify-between mb-4">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100"><ShieldCheck size={24} /></div>
                  <ChevronRight className="text-slate-400 group-hover:text-indigo-500" size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Järjestyksenvalvojan tapahtumailmoitus</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Lakisääteinen ilmoitus kiinniotto- ja voimankäyttötilanteista.</p>
              </button>

              <button onClick={() => setActiveTab('report_tike')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 text-left group">
                <div className="flex justify-between mb-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100"><Activity size={24} /></div>
                  <ChevronRight className="text-slate-400 group-hover:text-emerald-500" size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">TIKE:n raportointi</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Tilannekeskuksen seuranta, kirjaukset ja poikkeamat.</p>
              </button>

               <button onClick={() => setActiveTab('report_list')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 text-left group">
                <div className="flex justify-between mb-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100"><Archive size={24} /></div>
                  <ChevronRight className="text-slate-400 group-hover:text-blue-500" size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Tallennetut raportit</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Selaa, hae ja tarkastele kaikkia luotuja raportteja.</p>
              </button>
            </div>
          </div>
        );

      case 'report_list':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
             <button onClick={() => setActiveTab('reporting')} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 mb-6">
              <ArrowLeft size={16} /> Takaisin raportointivalikkoon
            </button>
            <div className="mb-6 flex justify-between items-end border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Archive className="text-blue-500" size={24} /> Tallennetut raportit</h2>
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
                      <td className="p-4"><span className="inline-flex px-2 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700">{rep.type}</span></td>
                      <td className="p-4 text-slate-600">{rep.author}</td>
                      <td className="p-4 text-slate-600 line-clamp-1 max-w-[200px]">{rep.summary}</td>
                      <td className="p-4 text-right"><button className="text-blue-600 hover:text-blue-900 font-medium text-xs bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md">Avaa</button></td>
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
            <button onClick={() => setActiveTab('reporting')} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 mb-6">
              <ArrowLeft size={16} /> Takaisin raportointivalikkoon
            </button>
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-indigo-500" size={24} /> Järjestyksenvalvojan tapahtumailmoitus
              </h2>
            </div>
            <form className="space-y-8 text-left">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <h3 className="text-md font-semibold text-slate-700">1. Perustiedot</h3>
                  <button type="button" onClick={() => setShowInfoModal(true)} className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg bg-indigo-50">
                    <Info size={16} /> Lain vaatimukset (LYTP)
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Nimi</label><input type="text" className="w-full rounded-lg border p-2 text-sm focus:ring-2 focus:ring-indigo-500" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Luvannhaltija</label><input type="text" className="w-full rounded-lg border p-2 text-sm focus:ring-2 focus:ring-indigo-500" /></div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Aika</label>
                    <div className="flex gap-2">
                      <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="w-full rounded-lg border p-2 text-sm" />
                      <input type="time" ref={timeInputRef} value={eventTimeStr} onChange={e => setEventTimeStr(e.target.value)} className="w-full rounded-lg border p-2 text-sm" />
                    </div>
                    <button type="button" onClick={() => setTimeNow(setEventDate, setEventTimeStr)} className="mt-2 px-3 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-md">Nyt</button>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Paikka</label><input type="text" className="w-full rounded-lg border p-2 text-sm focus:ring-2 focus:ring-indigo-500" /></div>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t">
                <button type="button" className="px-5 py-2 text-sm font-medium bg-slate-100 rounded-lg">Tyhjennä</button>
                <button type="button" className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg flex items-center gap-2"><CheckCircle size={16} /> Tallenna ilmoitus</button>
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
          { id: 'weather', label: 'Sääraportti', icon: Cloud, color: 'text-sky-600', bg: 'bg-sky-50' }
        ];

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <button onClick={() => setActiveTab('reporting')} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 mb-6">
              <ArrowLeft size={16} /> Takaisin raportointivalikkoon
            </button>
            <div className="mb-8 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Activity className="text-emerald-500" size={24} /> TIKE:n raportointi ja seuranta</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tikeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button key={option.id} onClick={() => setActiveTab(`tike_form_${option.id}`)} className="flex flex-col items-start p-5 rounded-xl border hover:shadow-md transition-all bg-white group">
                    <div className={`p-3 rounded-lg mb-4 ${option.bg} ${option.color} group-hover:scale-110 duration-200`}><Icon size={24} /></div>
                    <span className="font-bold text-slate-800 text-sm">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'tike_form_in':
        return (
          <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8 max-w-4xl">
            <button onClick={() => { setActiveTab('report_tike'); setSelectedEmp(null); setEmpSearch(''); }} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 mb-6">
              <ArrowLeft size={16} /> Takaisin TIKE-valikkoon
            </button>
            <div className="mb-6 border-b pb-4"><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><LogIn className="text-emerald-500" /> Työntekijän sisäänkirjaus</h2></div>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
              <div className="bg-slate-50 p-3 rounded-lg border text-center"><div className="text-2xl font-bold">{activeJvCount}</div><div className="text-xs text-slate-500 uppercase">JV paikalla</div></div>
              <div className="bg-slate-50 p-3 rounded-lg border text-center"><div className="text-2xl font-bold">{activeVartijaCount}</div><div className="text-xs text-slate-500 uppercase">Vartijat</div></div>
            </div>

            <form className="space-y-8">
              <div className="relative">
                <label className="block text-sm font-bold mb-2">Työntekijän haku (Ei sisäänkirjattu)</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input type="text" value={empSearch} onChange={(e) => {setEmpSearch(e.target.value); setSelectedEmp(null);}} className="w-full pl-10 pr-4 py-2.5 rounded-lg border" placeholder="Kirjoita vähintään 3 merkkiä hakeaksesi..." />
                </div>
                {empSearch.length >= 3 && !selectedEmp && (
                  <ul className="absolute z-10 bg-white border rounded-lg shadow-lg w-full mt-1 max-h-60 overflow-y-auto">
                    {filteredEmployeesForCheckIn.map((emp) => (
                      <li key={emp.id} onClick={() => handleSelectEmpForCheckIn(emp)} className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b">
                        {emp.name} <span className="text-xs text-slate-400">({emp.role})</span>
                      </li>
                    ))}
                    {filteredEmployeesForCheckIn.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Ei osumia tai henkilö on jo sisällä.</li>}
                  </ul>
                )}
              </div>
              
              {selectedEmp && (
                <div className="border-t pt-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg border">
                      <label className="block text-sm font-bold mb-3">Rooli</label>
                      <div className="flex gap-4">
                        <label><input type="radio" value="Järjestyksenvalvoja" checked={checkInRole==='Järjestyksenvalvoja'} onChange={e=>setCheckInRole(e.target.value)} /> JV</label>
                        <label><input type="radio" value="Vartija" checked={checkInRole==='Vartija'} onChange={e=>setCheckInRole(e.target.value)} /> Vartija</label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-1">Aika</label>
                      <div className="flex gap-2"><input type="date" value={checkInDate} onChange={e=>setCheckInDate(e.target.value)} className="border rounded-lg p-2 w-full"/><input type="time" value={checkInTime} onChange={e=>setCheckInTime(e.target.value)} className="border rounded-lg p-2 w-full"/></div>
                      <button type="button" onClick={handleCheckInNyt} className="mt-2 px-4 py-1.5 bg-emerald-100 text-emerald-800 rounded text-xs font-bold">NYT</button>
                    </div>
                  </div>
                  <div className="pt-4 flex justify-end gap-3 border-t">
                    <button type="button" onClick={() => { setSelectedEmp(null); setEmpSearch(''); }} className="px-5 py-2 text-sm bg-slate-100 rounded-lg">Peruuta</button>
                    <button type="button" onClick={handleSaveCheckInFinal} className="px-5 py-2 text-sm text-white bg-emerald-600 rounded-lg flex items-center gap-2"><CheckCircle size={16} /> Tallenna kirjaus</button>
                  </div>
                </div>
              )}
            </form>
          </div>
        );

      case 'tike_form_out':
        return (
          <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8 max-w-4xl">
            <button onClick={() => { setActiveTab('report_tike'); setSelectedOutEmp(null); setOutEmpSearch(''); setShowOutTimeInput(false); }} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 mb-6">
              <ArrowLeft size={16} /> Takaisin TIKE-valikkoon
            </button>
            <div className="mb-6 border-b pb-4"><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><LogOut className="text-rose-500" /> Työntekijän uloskirjaus</h2></div>
            <form className="space-y-8">
              <div className="relative">
                <label className="block text-sm font-bold mb-2">Hae sisäänkirjattu työntekijä</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input type="text" value={outEmpSearch} onChange={(e) => {setOutEmpSearch(e.target.value); setSelectedOutEmp(null); setShowOutTimeInput(false);}} className="w-full pl-10 pr-4 py-2.5 rounded-lg border" placeholder="Hae..." />
                </div>
                {outEmpSearch.length >= 3 && !selectedOutEmp && (
                  <ul className="absolute z-10 bg-white border rounded-lg shadow-lg w-full mt-1 max-h-60 overflow-y-auto">
                    {filteredOutEmployees.map((emp) => (
                      <li key={emp.empId} onClick={() => {setSelectedOutEmp(emp); setOutEmpSearch(emp.name);}} className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b">
                        {emp.name} <span className="text-xs text-slate-400">({emp.role})</span>
                      </li>
                    ))}
                    {filteredOutEmployees.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Ei osumia.</li>}
                  </ul>
                )}
              </div>
              {selectedOutEmp && (
                <div className="border-t pt-6 space-y-6">
                  <div className="bg-slate-50 p-5 rounded-xl border">
                    <h3 className="text-sm font-bold mb-4 border-b pb-2">Sisäänkirjauksen tiedot</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div><span className="block text-slate-500 text-xs">Rooli</span><span className="font-semibold">{selectedOutEmp.role}</span></div>
                      <div><span className="block text-slate-500 text-xs">Radiopuhelin</span><span className="font-semibold">{selectedOutEmp.radio || '-'}</span></div>
                    </div>
                  </div>
                  <div className="pt-2 flex gap-3">
                    <button type="button" onClick={handleSaveCheckOutFinal} className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl flex items-center justify-center gap-2"><LogOut size={18}/> KIRJAA ULOS NYT</button>
                  </div>
                </div>
              )}
            </form>
          </div>
        );

      case 'tike_form_open':
      case 'tike_form_firstaid':
      case 'tike_form_patrol':
      case 'tike_form_threat':
      case 'tike_form_damage':
      case 'tike_form_lostfound':
      case 'tike_form_queue':
      case 'tike_form_weather': {
        const formConfigs = {
          tike_form_open: { title: 'Avoin kirjaus', icon: PenTool, color: 'text-indigo-500', btn: 'bg-indigo-600' },
          tike_form_firstaid: { title: 'Ensiaputilanne', icon: HeartPulse, color: 'text-rose-500', btn: 'bg-rose-600' },
          tike_form_patrol: { title: 'Kierrosraportti', icon: Clipboard, color: 'text-blue-500', btn: 'bg-blue-600' },
          tike_form_threat: { title: 'Uhkatilanne', icon: AlertTriangle, color: 'text-amber-500', btn: 'bg-amber-600' },
          tike_form_damage: { title: 'Omaisuusvaurio', icon: Wrench, color: 'text-slate-600', btn: 'bg-slate-600' },
          tike_form_lostfound: { title: 'Löytötavara', icon: Package, color: 'text-indigo-500', btn: 'bg-indigo-600' },
          tike_form_queue: { title: 'Portin jonon odotusaika', icon: Clock, color: 'text-blue-500', btn: 'bg-blue-600' },
          tike_form_weather: { title: 'Sääraportti', icon: Cloud, color: 'text-sky-500', btn: 'bg-sky-600' }
        };
        const config = formConfigs[activeTab];
        const Icon = config.icon;

        return (
          <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8 max-w-4xl">
            <button onClick={() => setActiveTab('report_tike')} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 mb-6"><ArrowLeft size={16} /> Takaisin</button>
            <div className="mb-6 border-b pb-4 flex justify-between items-end">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Icon className={config.color} size={24} /> {config.title}</h2>
              <div className="text-sm font-mono bg-slate-100 px-3 py-1.5 rounded-lg border">{getDynamicId()}</div>
            </div>
            <form className="space-y-6 text-left">
              <div className="bg-slate-50 p-5 rounded-xl border">
                <label className="block text-sm font-bold mb-2">Tapahtuma-aika</label>
                <div className="flex gap-4">
                  <input type="date" value={genRepDate} onChange={e=>setGenRepDate(e.target.value)} className="rounded-lg border p-2 text-sm" />
                  <input type="time" value={genRepTime} onChange={e=>setGenRepTime(e.target.value)} className="rounded-lg border p-2 text-sm" />
                  <button type="button" onClick={() => setTimeNow(setGenRepDate, setGenRepTime)} className="px-4 py-2 text-xs font-bold bg-slate-200 rounded-lg">NYT</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Kuvaus</label>
                <textarea rows="4" className="w-full rounded-lg border p-3 text-sm"></textarea>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t">
                <button type="button" onClick={() => setActiveTab('report_tike')} className="px-5 py-2.5 text-sm bg-slate-100 rounded-lg">Peruuta</button>
                <button type="button" onClick={() => { setRunningNumber(p=>p+1); setActiveTab('report_tike'); }} className={`px-5 py-2.5 text-sm font-bold text-white rounded-lg flex items-center gap-2 ${config.btn}`}>
                  <CheckCircle size={18} /> Tallenna kirjaus
                </button>
              </div>
            </form>
          </div>
        );
      }

      case 'planning':
        return (
          <div className="space-y-6 max-w-5xl">
            <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm ${readinessStatusColor}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 bg-white rounded-lg ${readinessStatusIconColor} shadow-sm`}><DoorOpen size={24} /></div>
                <div><h3 className="font-bold text-lg leading-tight">Avausvalmius</h3><p className="text-sm font-medium">{readinessStatusText}</p></div>
              </div>
              <div className="text-3xl font-black tabular-nums">{completedChecksCount}/5</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              <button onClick={() => setActiveTab('planning_readiness')} className="bg-white p-6 rounded-xl border hover:border-blue-300 text-left">
                <DoorOpen size={24} className="text-blue-600 mb-4" />
                <h3 className="font-bold text-lg mb-1">Avausvalmius</h3>
                <p className="text-sm text-slate-500">Porttien avauksen edellytysten kuittaus.</p>
              </button>
              <button onClick={() => setActiveTab('planning_employees')} className="bg-white p-6 rounded-xl border hover:border-indigo-300 text-left">
                <Users size={24} className="text-indigo-600 mb-4" />
                <h3 className="font-bold text-lg mb-1">Tapahtuman työntekijät</h3>
                <p className="text-sm text-slate-500">Henkilöstörekisteri ja tilat.</p>
              </button>
              <button onClick={() => openEmployeeForm(null)} className="bg-white p-6 rounded-xl border hover:border-emerald-300 text-left">
                <UserPlus size={24} className="text-emerald-600 mb-4" />
                <h3 className="font-bold text-lg mb-1">Kirjaa uusi työntekijä</h3>
              </button>
            </div>
          </div>
        );

      case 'planning_readiness':
        return (
          <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8 max-w-3xl mx-auto">
            <button onClick={() => setActiveTab('planning')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-6"><ArrowLeft size={16} /> Takaisin</button>
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4"><DoorOpen className="text-indigo-500" /> Avausvalmius (Green Light)</h2>
            <form className="space-y-8">
              <div className="bg-slate-50 p-5 rounded-xl border flex items-center justify-between">
                <div><h3 className="font-bold text-sm">Tavoiteltu avausaika</h3></div>
                <input type="time" value={targetOpeningTime} onChange={e=>setTargetOpeningTime(e.target.value)} className="rounded-lg border p-2 text-sm font-bold text-center" />
              </div>
              <div className="bg-white border rounded-xl overflow-hidden divide-y">
                {[
                  { key: 'exits', label: 'Hätäuloskäynnit miehitetty' },
                  { key: 'guards', label: 'Vähintään 80% JV:stä paikalla' },
                  { key: 'vehicles', label: 'Ajoneuvot pois alueelta' },
                  { key: 'production', label: 'Tuotanto valmis avaukseen' },
                  { key: 'security', label: 'Turvajohto valmis avaukseen' }
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={readinessChecks[item.key]} onChange={() => toggleReadinessCheck(item.key)} className="w-6 h-6 text-emerald-600 rounded" />
                    <span className="font-medium text-slate-800">{item.label}</span>
                  </label>
                ))}
              </div>
              <div className="pt-4 flex justify-end border-t"><button type="button" onClick={() => setActiveTab('planning')} className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg flex items-center gap-2"><CheckCircle size={18} /> Tallenna</button></div>
            </form>
          </div>
        );

      case 'planning_employees':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 max-w-5xl">
            <button onClick={() => setActiveTab('planning')} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 mb-6">
              <ArrowLeft size={16} /> Takaisin
            </button>
            <div className="mb-6 flex justify-between items-end border-b pb-4">
              <div><h2 className="text-xl font-bold flex items-center gap-2"><Users className="text-indigo-500" /> Tapahtuman työntekijät</h2></div>
              <button onClick={() => openEmployeeForm(null)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg flex gap-2"><UserPlus size={16}/> Lisää uusi</button>
            </div>
            <div className="bg-slate-50 border rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 border-b">
                  <tr><th className="p-4">Nimi</th><th className="p-4">Rooli</th><th className="p-4">Tila</th><th className="p-4 text-right">Toiminnot</th></tr>
                </thead>
                <tbody className="divide-y">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-white">
                      <td className="p-4 font-medium">{emp.name}</td>
                      <td className="p-4"><span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md text-xs">{emp.role}</span></td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${emp.checkedIn ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${emp.checkedIn ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          {emp.checkedIn ? 'Sisällä' : 'Ei sisällä'}
                        </span>
                      </td>
                      <td className="p-4 text-right"><button onClick={() => openEmployeeForm(emp)} className="text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-md text-xs font-medium">Muokkaa</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'planning_employee_new':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 max-w-4xl">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">
              <UserPlus className="text-emerald-500" /> {editingEmp ? 'Muokkaa työntekijää' : 'Kirjaa uusi työntekijä'}
            </h2>
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Nimi</label><input type="text" value={newEmpName} onChange={e=>setNewEmpName(e.target.value)} className="w-full border rounded-lg p-2.5" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Rooli</label>
                  <select value={newEmpRole} onChange={e=>setNewEmpRole(e.target.value)} className="w-full border rounded-lg p-2.5 bg-white">
                    <option>Järjestyksenvalvoja</option><option>Vartija</option><option>EA-henkilö</option><option>Tuotanto</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3"><button type="button" onClick={() => setActiveTab('planning_employees')} className="px-5 py-2.5 bg-slate-100 rounded-lg text-sm">Peruuta</button><button type="button" onClick={handleSaveEmployee} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold">Tallenna</button></div>
            </form>
          </div>
        );

      case 'postevent':
        return (
          <div className="space-y-6 max-w-5xl">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 border-b pb-4"><Layers className="text-indigo-500" size={28} /> FestivaaliX</h2>
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Map className="text-indigo-500" /> Tapahtuman pohjakartta</h3>
              <div className="w-full bg-slate-50 rounded-lg border min-h-[300px] flex items-center justify-center">
                <img src="image_aa9244.png" alt="Kartta" className="max-w-full h-auto" onError={(e) => { e.target.style.display = 'none'; }} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><PhoneCall className="text-emerald-500" /> Radiopuhelinten kanavalista</h3>
                <ul className="space-y-2 text-sm font-medium text-slate-700">
                  {["JV:t Tapahtuma", "JV:t Välitönläheisyys", "Toimintaryhmät", "Toimintaryhmät (vara)", "Backstage", "Raportointi", "Liikenne", "Turvallisuusjohto"].map((c, i) => (
                    <li key={i} className="flex gap-3 items-center p-2"><span className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">{i+1}</span>{c}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Users className="text-blue-500" /> Esimiehet ja vastuuhenkilöt</h3>
                <ul className="space-y-2 text-sm">
                  {[ {r: "Turva 1", n: "Ismo Näkki"}, {r: "Turva 2", n: "Liisa Ollila"}, {r: "Pääportti 10", n: "Jaakko Mäki"}, {r: "Lava 1 10", n: "Markus Joki"} ].map((s, i) => (
                    <li key={i} className="flex justify-between items-center p-3 border rounded-lg"><span className="font-bold">{s.r}</span><span className="text-slate-500">{s.n}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );

      case 'documents':
      case 'settings':
        return (
          <div className="bg-white p-8 rounded-xl shadow-sm border text-center py-16">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Asetukset / Asiakirjat</h2>
            <p className="text-slate-500">Tätä osiota rakennetaan.</p>
          </div>
        );
        
      default:
        return <div>Näkymää rakennetaan...</div>;
    }
  };

  // PÄÄ-UI
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <nav className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300">
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('landing')}>
            <ShieldCheck className="text-indigo-400" size={28} />
            <h1 className="text-xl font-bold leading-tight hidden sm:block">Turvajohto OS</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button onClick={() => setShowQuickActions(!showQuickActions)} className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-bold text-sm">
              <AlertTriangle size={16} /> <span className="hidden sm:inline">Pikatoiminnot</span>
            </button>
            {showQuickActions && (
              <div className="absolute right-0 mt-3 w-72 bg-slate-800 rounded-xl shadow-xl p-5 z-50">
                <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
                  <h3 className="text-white font-bold">Kriittiset toiminnot</h3>
                  <button onClick={() => setShowQuickActions(false)} className="text-slate-400"><X size={18} /></button>
                </div>
                <div className="space-y-3">
                  <button className="w-full py-3 px-4 bg-rose-600 text-white font-bold rounded-lg">SHOW STOP PROTOKOLLA</button>
                  <button className="w-full py-3 px-4 bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center gap-2"><PhoneCall size={18}/> Soita 112</button>
                </div>
              </div>
            )}
          </div>
          <div className="hidden md:flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg">
            <Clock size={16} className="text-indigo-400" />
            <span className="font-mono text-sm tracking-widest">{formatTime(currentTime)}</span>
          </div>
          <button onClick={() => setIsAuthenticated(false)} className="bg-slate-800 hover:bg-rose-600 p-2 rounded-lg transition-colors text-slate-300 hover:text-white" title="Kirjaudu ulos">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <div className="flex flex-col md:flex-row min-h-[calc(100vh-73px)]">
        {isSidebarOpen && (
          <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
            <div className="p-4 space-y-1">
              <button onClick={() => setActiveTab('landing')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${activeTab === 'landing' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><Home size={18} /> Aloitussivu</button>
              <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${activeTab === 'overview' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><Activity size={18} /> Tilannekuva</button>
              <button onClick={() => setActiveTab('reporting')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${activeTab.includes('report') || activeTab.includes('tike') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><FileText size={18} /> Raportointi</button>
              <button onClick={() => setActiveTab('planning')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${activeTab.includes('planning') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><Calendar size={18} /> Ennen Tapahtumaa</button>
              <button onClick={() => setActiveTab('postevent')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${activeTab === 'postevent' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><Layers size={18} /> FestivaaliX</button>
              <button onClick={() => setActiveTab('documents')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${activeTab === 'documents' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><FileText size={18} /> Lomakekartoitus</button>
              <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${activeTab === 'settings' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><Settings size={18} /> Asetukset</button>
            </div>
          </aside>
        )}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}