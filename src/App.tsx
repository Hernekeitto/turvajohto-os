import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, ShieldCheck, Activity, Users, Clock, FileText, PhoneCall,
  CheckCircle, XCircle, BarChart2, Calendar, Layers, Map, Settings,
  MessageSquare, ChevronRight, ChevronDown, Info, X, ArrowLeft, LogIn,
  LogOut, PenTool, HeartPulse, Clipboard, Cloud, ShieldAlert, Package,
  Wrench, Search, UserPlus, IdCard, UserCheck, Contact, Archive, Camera,
  Paperclip, FileCheck, Home, DoorOpen, CheckSquare, Menu
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
      <div className="p-3 rounded-lg bg-slate-50 text-slate-600"><Icon size={24} /></div>
      {trend && <span className={`text-sm font-medium ${trendUp ? 'text-emerald-500' : 'text-rose-500'} flex items-center`}>{trend}</span>}
    </div>
    <div>
      <h3 className="text-3xl font-bold text-slate-800 mb-1">{value}</h3>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  </div>
);

const AlertBanner = ({ alert }) => {
  const colors = { critical: 'bg-rose-50 border-rose-200 text-rose-800', warning: 'bg-amber-50 border-amber-200 text-amber-800', info: 'bg-blue-50 border-blue-200 text-blue-800' };
  const iconColors = { critical: 'text-rose-600', warning: 'text-amber-600', info: 'text-blue-600' };
  return (
    <div className={`p-4 rounded-lg border flex items-start gap-4 mb-3 ${colors[alert.type]}`}>
      <AlertTriangle className={`mt-0.5 ${iconColors[alert.type]}`} size={20} />
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="font-semibold text-sm">{alert.location}</span><span className="text-xs font-medium opacity-80">{alert.time}</span>
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
  const [overviewCardTab, setOverviewCardTab] = useState('checklist'); 

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

  // Generic & Specific Form States
  const [faDate, setFaDate] = useState('');
  const [faTime, setFaTime] = useState('');
  const [faDesc, setFaDesc] = useState('');
  const [faActions, setFaActions] = useState('');
  const [faResources, setFaResources] = useState('');
  const [faEmployees, setFaEmployees] = useState('');
  const [faFileName, setFaFileName] = useState('');

  const [patrolDate, setPatrolDate] = useState('');
  const [patrolTime, setPatrolTime] = useState('');
  const [patrolPerson, setPatrolPerson] = useState('');
  const [patrolAreas, setPatrolAreas] = useState('');
  const [patrolDeviations, setPatrolDeviations] = useState('');
  const [patrolFile, setPatrolFile] = useState('');

  const [genRepDate, setGenRepDate] = useState('');
  const [genRepTime, setGenRepTime] = useState('');
  const [genRepDesc, setGenRepDesc] = useState('');
  const [genRepActions, setGenRepActions] = useState('');
  const [genRepEmps, setGenRepEmps] = useState('');
  const [genRepFile, setGenRepFile] = useState('');

  const [editingEmp, setEditingEmp] = useState(null);

  const openEmployeeForm = (emp = null) => {
    setEditingEmp(emp);
    setActiveTab('planning_employee_new');
  };

  // Readiness Form State
  const [targetOpeningTime, setTargetOpeningTime] = useState('16:00');
  const [readinessChecks, setReadinessChecks] = useState({ exits: false, guards: false, vehicles: false, production: false, security: false });
  const [readinessComments, setReadinessComments] = useState('');

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
    setDate(d); setTime(t);
  };

  const filteredEmployees = empSearch.length >= 3 ? mockEmployees.filter(e => e.toLowerCase().includes(empSearch.toLowerCase())) : [];
  const filteredOutEmployees = outEmpSearch.length >= 3 ? mockCheckedInEmployees.filter(e => e.name.toLowerCase().includes(outEmpSearch.toLowerCase())) : [];

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

  // Uudelleenkäytettävä TIKE Stats
  const renderTikeStats = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">
      {[ {v:142, l:'JV paikalla'}, {v:25, l:'Vartijat'}, {v:12, l:'EA henkilöt'}, {v:8, l:'Muu avoin'}, {v:3, l:'Poikkeamat', c:'text-amber-700', bg:'bg-amber-50 border-amber-200'}
      ].map((s, i) => (
        <div key={i} className={`p-3 rounded-lg border text-center flex flex-col justify-center ${s.bg || 'bg-slate-50 border-slate-200'}`}>
          <div className={`text-2xl font-bold ${s.c || 'text-slate-800'}`}>{s.v}</div>
          <div className={`text-xs font-medium uppercase tracking-wide mt-1 ${s.c ? 'text-amber-600' : 'text-slate-500'}`}>{s.l}</div>
        </div>
      ))}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'landing':
        return (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-white p-10 md:p-14 rounded-3xl shadow-xl border border-slate-100 text-center max-w-2xl w-full">
              <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-indigo-50/50"><ShieldCheck size={48} /></div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-3 tracking-tight">Turvajohto OS</h1>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mt-6 mb-10">
                <h2 className="text-xl md:text-2xl font-semibold text-slate-700">{getGreeting(currentTime)}, <span className="text-indigo-600">oletuskäyttäjä</span></h2>
                <p className="text-slate-500 font-medium mt-1">Turvajohto</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={() => setActiveTab('overview')} className="flex items-center justify-center gap-3 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-sm group">
                  <Activity size={20} className="group-hover:scale-110 transition-transform" /> Siirry tilannekuvaan
                </button>
                <button onClick={() => setActiveTab('reporting')} className="flex items-center justify-center gap-3 p-4 bg-white border-2 border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all">
                  <FileText size={20} className="text-indigo-500" /> Avaa raportointi
                </button>
              </div>
            </div>
            <div className="mt-12 text-slate-400 text-sm font-medium flex items-center gap-2"><Clock size={16} /> Kirjautumisaika: {formatTime(currentTime)}</div>
          </div>
        );
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <DashboardCard title="Aktiiviset Järjestyksenvalvojat" icon={ShieldCheck} value="142" subtitle="Mitoitus: 1:100 (vaatimus 142)" />
              <DashboardCard title="Ensiaputapaukset" icon={HeartPulse} value="12" subtitle="Viimeisen tunnin aikana: 3" />
              <DashboardCard title="Poistot" icon={LogOut} value="8" subtitle="Koko tapahtuman ajalta" />
              <DashboardCard title="Poikkeamat" icon={AlertTriangle} value="3" subtitle="Avoinna olevat tilanteet" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Activity className="text-rose-500" size={20} /> Aktiiviset Hälytykset ja Poikkeamat</h2>
                    <button className="text-sm text-indigo-600 font-medium hover:text-indigo-700">Näytä Kaikki</button>
                  </div>
                  <div className="space-y-1">{mockAlerts.map(alert => <AlertBanner key={alert.id} alert={alert} />)}</div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                   <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><MessageSquare className="text-indigo-500" size={20} /> JOKE Loki (Viimeisimmät)</h2>
                    <button className="px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100"> + Uusi Kirjaus</button>
                  </div>
                  <div className="space-y-4">
                    {mockLogs.map(log => (
                      <div key={log.id} className="flex gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors border-b border-slate-50 last:border-0">
                        <div className="text-sm font-mono text-slate-400 w-16 pt-0.5">{log.time}</div>
                        <div className="flex-1"><p className="text-sm font-medium text-slate-800">{log.action}</p><p className="text-xs text-slate-500 mt-1">Kirjaaja: {log.user}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="flex border-b border-slate-100">
                    <button onClick={() => setOverviewCardTab('checklist')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${overviewCardTab === 'checklist' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:bg-slate-50'}`}><CheckCircle size={16} /> Valmiustarkastus</button>
                    <button onClick={() => setOverviewCardTab('reports')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${overviewCardTab === 'reports' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:bg-slate-50'}`}><Archive size={16} /> Uusimmat raportit</button>
                  </div>
                  
                  <div className="p-6">
                    {overviewCardTab === 'checklist' ? (
                      <div className="space-y-3 animate-in fade-in duration-300">
                        {mockChecklist.map(item => (
                          <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50">
                            <div className="mt-0.5">{item.status === 'done' ? <CheckCircle className="text-emerald-500" size={18} /> : item.status === 'in-progress' ? <Clock className="text-amber-500" size={18} /> : <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-300"></div>}</div>
                            <div><p className={`text-sm font-medium ${item.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{item.task}</p><p className="text-xs text-slate-400">{item.category}</p></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3 animate-in fade-in duration-300">
                        {mockReports.map((rep, idx) => (
                          <div key={idx} className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer">
                            <div className="flex justify-between items-center"><span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{rep.type}</span><span className="text-xs font-mono text-slate-400">{rep.time}</span></div>
                            <p className="text-sm font-medium text-slate-800 line-clamp-1">{rep.summary}</p>
                            <p className="text-xs text-slate-500">Kirjaaja: {rep.author} | ID: {rep.id.split('/').pop()}</p>
                          </div>
                        ))}
                        <button onClick={() => setActiveTab('report_list')} className="w-full mt-2 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">Näytä kaikki raportit</button>
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
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileText className="text-indigo-500" size={28} /> Raportointi ja lomakkeet</h2>
              <p className="text-sm text-slate-500 mt-1">Valitse täytettävä raportti tai tarkastele tallennettuja asiakirjoja.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <button onClick={() => setActiveTab('report_jv')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all text-left group">
                <div className="flex items-center justify-between mb-4"><div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100"><ShieldCheck size={24} /></div><ChevronRight className="text-slate-400 group-hover:text-indigo-500" size={20} /></div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Järjestyksenvalvojan tapahtumailmoitus</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Lakisääteinen ilmoitus kiinniotto- ja voimankäyttötilanteista.</p>
              </button>
              <button onClick={() => setActiveTab('report_tike')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left group">
                <div className="flex items-center justify-between mb-4"><div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100"><Activity size={24} /></div><ChevronRight className="text-slate-400 group-hover:text-emerald-500" size={20} /></div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">TIKE:n raportointi</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Tilannekeskuksen seuranta, kirjaukset ja poikkeamaraportit.</p>
              </button>
               <button onClick={() => setActiveTab('report_list')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group">
                <div className="flex items-center justify-between mb-4"><div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100"><Archive size={24} /></div><ChevronRight className="text-slate-400 group-hover:text-blue-500" size={20} /></div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Tallennetut raportit</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Selaa, hae ja tarkastele kaikkia luotuja raportteja.</p>
              </button>
            </div>
          </div>
        );
      case 'report_list':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
             <button onClick={() => setActiveTab('reporting')} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"><ArrowLeft size={16} /> Takaisin raportointivalikkoon</button>
            <div className="mb-6 flex justify-between items-end border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Archive className="text-blue-500" size={24} /> Tallennetut raportit</h2>
                <p className="text-sm text-slate-500 mt-1">Selaa ja tarkastele kaikkia tehtyjä kirjauksia ja ilmoituksia.</p>
              </div>
              <div className="relative w-64"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><input type="text" placeholder="Hae raporteista..." className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr><th className="p-4">Tunniste</th><th className="p-4">Aika</th><th className="p-4">Tyyppi</th><th className="p-4">Kirjaaja</th><th className="p-4">Tiivistelmä</th><th className="p-4 text-right">Toiminnot</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {mockReports.map((rep, idx) => (
                    <tr key={idx} className="hover:bg-white transition-colors cursor-pointer">
                      <td className="p-4 font-mono text-xs text-slate-500">{rep.id}</td><td className="p-4 font-medium text-slate-800">{rep.time}</td>
                      <td className="p-4"><span className="inline-flex px-2 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700">{rep.type}</span></td>
                      <td className="p-4 text-slate-600">{rep.author}</td><td className="p-4 text-slate-600 line-clamp-1 max-w-[200px]">{rep.summary}</td>
                      <td className="p-4 text-right"><button className="text-blue-600 hover:text-blue-900 font-medium text-xs bg-blue-50 px-3 py-1.5 rounded-md">Avaa</button></td>
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
            <button onClick={() => setActiveTab('reporting')} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"><ArrowLeft size={16} /> Takaisin raportointivalikkoon</button>
            <div className="mb-6 border-b border-slate-100 pb-4"><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileText className="text-indigo-500" size={24} /> Järjestyksenvalvojan tapahtumailmoitus</h2></div>
            <form className="space-y-8 text-left">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <h3 className="text-md font-semibold text-slate-700">1. Perustiedot</h3>
                  <button type="button" onClick={() => setShowInfoModal(true)} className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg"><Info size={16} /> Lain vaatimukset (LYTP)</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Järjestyksenvalvojan nimi</label><input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Etunimi Sukunimi" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Turvallisuusalan elinkeinoluvan haltija</label><input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Turva Oy" /></div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tapahtuma-aika</label>
                    <div className="flex gap-2">
                      <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                      <input type="time" ref={timeInputRef} value={eventTimeStr} onChange={(e) => setEventTimeStr(e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <button type="button" onClick={() => setTimeNow(setEventDate, setEventTimeStr)} className="mt-2 px-3 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors">Tämä pvm / Nyt</button>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Tapahtumapaikka</label><input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Main Stage, portti 2..." /></div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">2. Toimenpiteet</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3"><input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-slate-300" /><span className="text-sm font-medium text-slate-700">Otettu kiinni tai käytetty voimakeinoja</span></label>
                  <label className="flex items-center gap-3"><input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-slate-300" /><span className="text-sm font-medium text-slate-700">Käytetty voimankäyttövälineitä (esim. käsiraudat, patukka, kaasu)</span></label>
                  <label className="flex items-center gap-3"><input type="checkbox" className="w-5 h-5 text-rose-600 rounded border-slate-300" /><span className="text-sm font-medium text-slate-700">Otettu esille tai käytetty ampuma-asetta</span></label>
                  <label className="flex items-center gap-3"><input type="checkbox" className="w-5 h-5 text-amber-500 rounded border-slate-300" /><span className="text-sm font-medium text-slate-700">Kohdehenkilö on viety ensiapuun tai ensihoitoa on käytetty tilanteessa</span></label>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">3. Kohdehenkilö ja havainnot</h3>
                <div><label className="block text-sm font-medium mb-1">Tuntomerkit</label><textarea rows="2" className="w-full rounded-lg border-slate-300 border p-2 text-sm"></textarea></div>
                <div><label className="block text-sm font-medium mb-1">Käyttäytyminen</label><textarea rows="2" className="w-full rounded-lg border-slate-300 border p-2 text-sm"></textarea></div>
              </div>
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">4. Vapaa kuvaus ja lisätiedot</h3>
                <textarea rows="4" className="w-full rounded-lg border-slate-300 border p-2 text-sm"></textarea>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" className="px-5 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Tyhjennä</button>
                <button type="button" className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2"><CheckCircle size={16} /> Tallenna ilmoitus</button>
              </div>
              <div className="mt-10 bg-slate-50 border border-slate-200 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3 border-b pb-2">TIKE:n muistilista</h3>
                <ul className="space-y-1.5 mb-5 text-sm text-slate-600 list-disc list-inside"><li>Onko TR käynyt paikalla?</li><li>Onko työntekijälle tullut vammoja?</li><li>Onko Turva 1 ja 2 infottu?</li></ul>
                <div><label className="block text-sm font-bold mb-2">TIKE:n kommentti:</label><textarea rows="2" className="w-full rounded-lg border-slate-300 border p-3 text-sm"></textarea></div>
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
          { id: 'management', label: 'Johdon tilannekatsaus', icon: BarChart2, color: 'text-purple-600', bg: 'bg-purple-50' }
        ];
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <button onClick={() => setActiveTab('reporting')} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"><ArrowLeft size={16} /> Takaisin raportointivalikkoon</button>
            <div className="mb-8 border-b border-slate-100 pb-4"><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Activity className="text-emerald-500" size={24} /> TIKE:n raportointi ja seuranta</h2></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tikeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button key={option.id} onClick={() => setActiveTab(`tike_form_${option.id}`)} className="flex flex-col items-start p-5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all text-left group bg-white">
                    <div className={`p-3 rounded-lg mb-4 transition-colors ${option.bg} ${option.color} group-hover:scale-110`}><Icon size={24} /></div>
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
            <button onClick={() => { setActiveTab('report_tike'); setSelectedEmp(''); setEmpSearch(''); }} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"><ArrowLeft size={16} /> Takaisin TIKE-valikkoon</button>
            <div className="mb-6 border-b border-slate-100 pb-4"><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><LogIn className="text-emerald-500" size={24} /> Työntekijän sisäänkirjaus</h2></div>
            {renderTikeStats()}
            <form className="space-y-8 text-left">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Työntekijän haku</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input type="text" value={empSearch} onChange={(e) => { setEmpSearch(e.target.value); setSelectedEmp(''); }} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-emerald-500 text-sm" placeholder="Hae nimellä..." />
                  {empSearch.length >= 3 && !selectedEmp && (
                    <ul className="absolute z-10 bg-white border border-slate-200 rounded-lg shadow-lg w-full mt-1 max-h-60 overflow-y-auto">
                      {filteredEmployees.map((emp, idx) => (
                        <li key={idx} onClick={() => { setSelectedEmp(emp); setEmpSearch(emp); }} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm border-b">{emp}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {selectedEmp && (
                <div className="animate-in fade-in space-y-8 border-t border-slate-200 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <label className="block text-sm font-bold text-slate-700 mb-3">Rooli</label>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2"><input type="radio" name="role" defaultChecked className="text-emerald-600" /><span className="text-sm">Järjestyksenvalvoja</span></label>
                        <label className="flex items-center gap-2"><input type="radio" name="role" className="text-emerald-600" /><span className="text-sm">Vartija</span></label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Aika</label>
                      <div className="flex gap-2">
                        <input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} className="w-full rounded-lg border p-2 text-sm" />
                        <input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} className="w-full rounded-lg border p-2 text-sm" />
                      </div>
                      <button type="button" onClick={() => setTimeNow(setCheckInDate, setCheckInTime)} className="mt-2 px-4 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 rounded-md">Nyt</button>
                    </div>
                  </div>
                  <div className="pt-4 flex justify-end gap-3 border-t">
                    <button type="button" onClick={() => { setSelectedEmp(''); setEmpSearch(''); }} className="px-5 py-2 text-sm bg-slate-100 rounded-lg">Peruuta</button>
                    <button type="button" className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg flex items-center gap-2"><CheckCircle size={16} /> Tallenna</button>
                  </div>
                </div>
              )}
            </form>
          </div>
        );
      case 'tike_form_out':
        return (
          <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8 max-w-4xl">
            <button onClick={() => { setActiveTab('report_tike'); setSelectedOutEmp(null); setOutEmpSearch(''); setShowOutTimeInput(false); }} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-6"><ArrowLeft size={16} /> Takaisin</button>
            <div className="mb-6 border-b pb-4"><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><LogOut className="text-rose-500" size={24} /> Työntekijän uloskirjaus</h2></div>
            {renderTikeStats()}
            <form className="space-y-8 text-left">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Hae sisäänkirjattu työntekijä</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input type="text" value={outEmpSearch} onChange={(e) => { setOutEmpSearch(e.target.value); setSelectedOutEmp(null); setShowOutTimeInput(false); }} className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm" placeholder="Hae..." />
                  {outEmpSearch.length >= 3 && !selectedOutEmp && (
                    <ul className="absolute z-10 bg-white border rounded-lg shadow-lg w-full mt-1 max-h-60 overflow-y-auto">
                      {filteredOutEmployees.map((emp) => (
                        <li key={emp.id} onClick={() => { setSelectedOutEmp(emp); setOutEmpSearch(emp.name); }} className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b flex justify-between">
                          <span>{emp.name}</span><span className="text-xs bg-slate-100 px-2 py-1 rounded">{emp.role}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {selectedOutEmp && (
                <div className="animate-in fade-in space-y-6 border-t pt-6">
                  <div className="bg-slate-50 p-5 rounded-xl border">
                    <h3 className="text-sm font-bold mb-4 border-b pb-2">Tiedot</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div><span className="block text-slate-500 text-xs">Rooli</span><span className="font-semibold">{selectedOutEmp.role}</span></div>
                      <div><span className="block text-slate-500 text-xs">Yksilötunnus</span><span className="font-semibold">{selectedOutEmp.badge || '-'}</span></div>
                      <div><span className="block text-slate-500 text-xs">Radio</span><span className="font-semibold">{selectedOutEmp.radio || '-'}</span></div>
                    </div>
                  </div>
                  <div><label className="block text-sm font-bold mb-2">Kommentit</label><textarea rows="3" className="w-full rounded-lg border p-3 text-sm"></textarea></div>
                  <div className="pt-2">
                    {!showOutTimeInput ? (
                      <div className="flex gap-3">
                        <button type="button" onClick={() => { setSelectedOutEmp(null); setOutEmpSearch(''); }} className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl flex justify-center items-center gap-2"><LogOut size={18} /> KIRJAA ULOS NYT</button>
                        <button type="button" onClick={() => setShowOutTimeInput(true)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl flex justify-center items-center gap-2"><Clock size={18} /> Kirjaa ulos muu aika</button>
                      </div>
                    ) : (
                      <div className="bg-rose-50 p-5 rounded-xl border border-rose-100">
                        <div className="flex gap-3 mb-5"><input type="date" value={checkOutDate} onChange={e=>setCheckOutDate(e.target.value)} className="flex-1 rounded-lg border p-2.5 text-sm" /><input type="time" value={checkOutTime} onChange={e=>setCheckOutTime(e.target.value)} className="flex-1 rounded-lg border p-2.5 text-sm" /></div>
                        <div className="flex gap-3"><button type="button" onClick={() => { setSelectedOutEmp(null); setOutEmpSearch(''); setShowOutTimeInput(false); }} className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-lg">Tallenna</button><button type="button" onClick={() => setShowOutTimeInput(false)} className="flex-1 py-2.5 bg-white border font-medium rounded-lg">Peruuta</button></div>
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
          <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8 max-w-4xl">
            <button onClick={() => setActiveTab('report_tike')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-6"><ArrowLeft size={16} /> Takaisin</button>
            <div className="mb-6 border-b pb-4 flex justify-between items-end gap-4 flex-wrap">
              <div><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><PenTool className="text-indigo-500" size={24} /> Avoin kirjaus</h2></div>
              <div className="text-sm font-mono bg-slate-100 px-3 py-1.5 rounded-lg border">{getDynamicId()}</div>
            </div>
            <form className="space-y-6 text-left">
              <div className="bg-slate-50 p-5 rounded-xl border">
                <label className="block text-sm font-bold mb-2">Aika</label>
                <div className="flex gap-4">
                  <input type="date" value={openKirjausDate} onChange={e=>setOpenKirjausDate(e.target.value)} className="rounded-lg border p-2 text-sm" />
                  <input type="time" value={openKirjausTime} onChange={e=>setOpenKirjausTime(e.target.value)} className="rounded-lg border p-2 text-sm" />
                  <button type="button" onClick={() => setTimeNow(setOpenKirjausDate, setOpenKirjausTime)} className="px-4 py-2 text-xs font-bold bg-indigo-100 text-indigo-700 rounded-lg">NYT</button>
                </div>
              </div>
              <div><label className="block text-sm font-bold mb-2">Kuvaus</label><textarea rows="6" value={openKirjausText} onChange={e=>setOpenKirjausText(e.target.value)} className="w-full rounded-lg border p-3 text-sm"></textarea></div>
              <div className="border border-dashed p-6 bg-slate-50 flex items-center justify-center gap-3">
                <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border rounded-lg text-sm font-medium"><Camera size={18} className="text-indigo-500" /> Ota kuva<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>setFileName(e.target.files[0]?.name||'')} /></label>
                <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border rounded-lg text-sm font-medium"><Paperclip size={18} className="text-indigo-500" /> Liitä tiedosto<input type="file" className="hidden" onChange={e=>setFileName(e.target.files[0]?.name||'')} /></label>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t">
                <button type="button" onClick={() => setActiveTab('report_tike')} className="px-5 py-2.5 text-sm bg-slate-100 rounded-lg">Peruuta</button>
                <button type="button" onClick={() => { setRunningNumber(p=>p+1); setActiveTab('report_tike'); }} className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-lg flex items-center gap-2"><CheckCircle size={18} /> Tallenna kirjaus</button>
              </div>
            </form>
          </div>
        );
      case 'tike_form_firstaid':
        return (
          <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8 max-w-4xl">
            <button onClick={() => setActiveTab('report_tike')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-6"><ArrowLeft size={16} /> Takaisin</button>
            <div className="mb-6 border-b pb-4 flex justify-between items-end gap-4 flex-wrap">
              <div><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><HeartPulse className="text-rose-500" size={24} /> Ensiaputilanne</h2></div>
              <div className="text-sm font-mono bg-slate-100 px-3 py-1.5 rounded-lg border">{getDynamicId()}</div>
            </div>
            <form className="space-y-6 text-left">
              <div className="bg-slate-50 p-5 rounded-xl border">
                <label className="block text-sm font-bold mb-2">Aika</label>
                <div className="flex gap-4">
                  <input type="date" value={faDate} onChange={e=>setFaDate(e.target.value)} className="rounded-lg border p-2 text-sm" />
                  <input type="time" value={faTime} onChange={e=>setFaTime(e.target.value)} className="rounded-lg border p-2 text-sm" />
                  <button type="button" onClick={() => setTimeNow(setFaDate, setFaTime)} className="px-4 py-2 text-xs font-bold bg-rose-100 text-rose-700 rounded-lg">NYT</button>
                </div>
              </div>
              <div className="space-y-4">
                <div><label className="block text-sm font-bold mb-1">Tapahtuman kuvaus</label><textarea rows="3" value={faDesc} onChange={e=>setFaDesc(e.target.value)} className="w-full rounded-lg border p-3 text-sm"></textarea></div>
                <div><label className="block text-sm font-bold mb-1">Toimenpiteet</label><textarea rows="3" value={faActions} onChange={e=>setFaActions(e.target.value)} className="w-full rounded-lg border p-3 text-sm"></textarea></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold mb-1">Resurssit</label><textarea rows="2" value={faResources} onChange={e=>setFaResources(e.target.value)} className="w-full rounded-lg border p-3 text-sm"></textarea></div>
                  <div><label className="block text-sm font-bold mb-1">Työntekijät paikalla</label><textarea rows="2" value={faEmployees} onChange={e=>setFaEmployees(e.target.value)} className="w-full rounded-lg border p-3 text-sm"></textarea></div>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t">
                <button type="button" onClick={() => setActiveTab('report_tike')} className="px-5 py-2.5 text-sm bg-slate-100 rounded-lg">Peruuta</button>
                <button type="button" onClick={() => { setRunningNumber(p=>p+1); setActiveTab('report_tike'); }} className="px-5 py-2.5 text-sm font-bold text-white bg-rose-600 rounded-lg flex items-center gap-2"><CheckCircle size={18} /> Tallenna</button>
              </div>
            </form>
          </div>
        );
      case 'tike_form_patrol':
        return (
          <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8 max-w-4xl">
            <button onClick={() => setActiveTab('report_tike')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-6"><ArrowLeft size={16} /> Takaisin</button>
            <div className="mb-6 border-b pb-4 flex justify-between items-end gap-4 flex-wrap">
              <div><h2 className="text-xl font-bold flex items-center gap-2"><Clipboard className="text-blue-600" size={24} /> Kierrosraportti</h2></div>
              <div className="text-sm font-mono bg-slate-100 px-3 py-1.5 rounded-lg border">{getDynamicId()}</div>
            </div>
            <form className="space-y-6 text-left">
              <div className="bg-slate-50 p-5 rounded-xl border">
                <label className="block text-sm font-bold mb-2">Aika</label>
                <div className="flex gap-4">
                  <input type="date" value={patrolDate} onChange={e=>setPatrolDate(e.target.value)} className="rounded-lg border p-2 text-sm" />
                  <input type="time" value={patrolTime} onChange={e=>setPatrolTime(e.target.value)} className="rounded-lg border p-2 text-sm" />
                  <button type="button" onClick={() => setTimeNow(setPatrolDate, setPatrolTime)} className="px-4 py-2 text-xs font-bold bg-blue-100 text-blue-800 rounded-lg">NYT</button>
                </div>
              </div>
              <div className="space-y-4">
                <div><label className="block text-sm font-bold mb-1">Suorittaja</label><input type="text" value={patrolPerson} onChange={e=>setPatrolPerson(e.target.value)} className="w-full rounded-lg border p-3 text-sm" /></div>
                <div><label className="block text-sm font-bold mb-1">Tarkastetut alueet</label><textarea rows="3" value={patrolAreas} onChange={e=>setPatrolAreas(e.target.value)} className="w-full rounded-lg border p-3 text-sm"></textarea></div>
                <div><label className="block text-sm font-bold mb-1">Poikkeamat</label><textarea rows="3" value={patrolDeviations} onChange={e=>setPatrolDeviations(e.target.value)} className="w-full rounded-lg border p-3 text-sm"></textarea></div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t">
                <button type="button" onClick={() => setActiveTab('report_tike')} className="px-5 py-2.5 text-sm bg-slate-100 rounded-lg">Peruuta</button>
                <button type="button" onClick={() => { setRunningNumber(p=>p+1); setActiveTab('report_tike'); }} className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg flex items-center gap-2"><CheckCircle size={18} /> Tallenna</button>
              </div>
            </form>
          </div>
        );
      case 'tike_form_threat':
      case 'tike_form_damage':
      case 'tike_form_lostfound':
      case 'tike_form_queue':
      case 'tike_form_weather': {
        const confs = {
          tike_form_threat: { title: 'Uhkatilanne', icon: AlertTriangle, c: 'text-amber-500', btn: 'bg-amber-600', nyt: 'bg-amber-100 text-amber-800' },
          tike_form_damage: { title: 'Omaisuusvaurio', icon: Wrench, c: 'text-slate-600', btn: 'bg-slate-600', nyt: 'bg-slate-200 text-slate-800' },
          tike_form_lostfound: { title: 'Löytötavara', icon: Package, c: 'text-indigo-500', btn: 'bg-indigo-600', nyt: 'bg-indigo-100 text-indigo-800' },
          tike_form_queue: { title: 'Portin jonon odotusaika', icon: Clock, c: 'text-blue-500', btn: 'bg-blue-600', nyt: 'bg-blue-100 text-blue-800' },
          tike_form_weather: { title: 'Sääraportti', icon: Cloud, c: 'text-sky-500', btn: 'bg-sky-600', nyt: 'bg-sky-100 text-sky-800' },
        };
        const cfg = confs[activeTab];
        const Icon = cfg.icon;

        return (
          <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8 max-w-4xl">
            <button onClick={() => setActiveTab('report_tike')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-6"><ArrowLeft size={16} /> Takaisin</button>
            <div className="mb-6 border-b pb-4 flex justify-between items-end flex-wrap gap-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><Icon className={cfg.c} size={24} /> {cfg.title}</h2>
              <div className="text-sm font-mono bg-slate-100 px-3 py-1.5 rounded-lg border">{getDynamicId()}</div>
            </div>
            <form className="space-y-6 text-left">
              <div className="bg-slate-50 p-5 rounded-xl border">
                <label className="block text-sm font-bold mb-2">Aika</label>
                <div className="flex gap-4">
                  <input type="date" value={genRepDate} onChange={e=>setGenRepDate(e.target.value)} className="rounded-lg border p-2 text-sm" />
                  <input type="time" value={genRepTime} onChange={e=>setGenRepTime(e.target.value)} className="rounded-lg border p-2 text-sm" />
                  <button type="button" onClick={() => setTimeNow(setGenRepDate, setGenRepTime)} className={`px-4 py-2 text-xs font-bold rounded-lg ${cfg.nyt}`}>NYT</button>
                </div>
              </div>
              <div className="space-y-4">
                <div><label className="block text-sm font-bold mb-1">Kuvaus</label><textarea rows="3" value={genRepDesc} onChange={e=>setGenRepDesc(e.target.value)} className="w-full rounded-lg border p-3 text-sm"></textarea></div>
                <div><label className="block text-sm font-bold mb-1">Toimenpiteet</label><textarea rows="3" value={genRepActions} onChange={e=>setGenRepActions(e.target.value)} className="w-full rounded-lg border p-3 text-sm"></textarea></div>
                <div><label className="block text-sm font-bold mb-1">Paikalla olijat</label><textarea rows="2" value={genRepEmps} onChange={e=>setGenRepEmps(e.target.value)} className="w-full rounded-lg border p-3 text-sm"></textarea></div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t">
                <button type="button" onClick={() => setActiveTab('report_tike')} className="px-5 py-2.5 text-sm bg-slate-100 rounded-lg">Peruuta</button>
                <button type="button" onClick={() => { setRunningNumber(p=>p+1); setActiveTab('report_tike'); }} className={`px-5 py-2.5 text-sm font-bold text-white rounded-lg flex items-center gap-2 ${cfg.btn}`}><CheckCircle size={18} /> Tallenna</button>
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
              <div className="text-3xl font-black tabular-nums tracking-tighter">{completedChecksCount}/5</div>
            </div>
            <div className="mb-6 pb-4 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Calendar className="text-indigo-500" size={28} /> Ennen tapahtumaa</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <button onClick={() => setActiveTab('planning_readiness')} className={`bg-white p-6 rounded-xl border shadow-sm transition-all text-left group hover:shadow-md ${isReadyForOpening ? 'border-emerald-200 hover:border-emerald-300' : isLate ? 'border-rose-200 hover:border-rose-300' : 'border-slate-200 hover:border-blue-300'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg transition-colors ${isReadyForOpening ? 'bg-emerald-50 text-emerald-600' : isLate ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}><DoorOpen size={24} /></div>
                  <ChevronRight className="text-slate-400 group-hover:text-slate-600 transition-colors" size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Avausvalmius</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Porttien avauksen edellytysten kuittaus ja tavoiteaika.</p>
              </button>
              <button onClick={() => setActiveTab('planning_employees')} className="bg-white p-6 rounded-xl border shadow-sm transition-all text-left group hover:shadow-md">
                <div className="flex items-center justify-between mb-4"><div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><Users size={24} /></div><ChevronRight className="text-slate-400" size={20} /></div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Tapahtuman työntekijät</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Henkilöstörekisteri, pätevyydet ja osallistuvat työntekijät.</p>
              </button>
              <button onClick={() => openEmployeeForm(null)} className="bg-white p-6 rounded-xl border shadow-sm transition-all text-left group hover:shadow-md">
                <div className="flex items-center justify-between mb-4"><div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><UserPlus size={24} /></div><ChevronRight className="text-slate-400" size={20} /></div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Kirjaa uusi työntekijä</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Lisää työntekijä rekisteriin ja tarkista luvat.</p>
              </button>
            </div>
          </div>
        );
      case 'planning_readiness':
        const checklistItems = [
          { key: 'exits', label: 'Hätäuloskäynnit miehitetty' }, { key: 'guards', label: 'Vähintään 80% järjestyksenvalvojista paikalla' },
          { key: 'vehicles', label: 'Ajoneuvot pois alueelta' }, { key: 'production', label: 'Tuotanto valmis avaukseen' },
          { key: 'security', label: 'Turvajohto valmis avaukseen' }
        ];
        return (
          <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8 max-w-3xl mx-auto">
            <button onClick={() => setActiveTab('planning')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-6"><ArrowLeft size={16} /> Takaisin</button>
            <div className="mb-6 border-b pb-4"><h2 className="text-2xl font-bold flex items-center gap-2"><DoorOpen className="text-indigo-500" size={28} /> Avausvalmius (Green Light)</h2></div>
            <form className="space-y-8 text-left">
              <div className="bg-slate-50 p-5 rounded-xl border flex items-center justify-between flex-wrap gap-4">
                <div><h3 className="text-sm font-bold mb-1">Tavoiteltu avausaika</h3></div>
                <div className="flex items-center gap-2"><Clock className="text-slate-400" size={18} /><input type="time" value={targetOpeningTime} onChange={e=>setTargetOpeningTime(e.target.value)} className="w-28 rounded-lg border p-2 text-sm font-bold text-center" /></div>
              </div>
              <div>
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><CheckSquare className="text-slate-400" size={20} /> Edellytysten kuittaus</h3>
                <div className="bg-white border rounded-xl overflow-hidden divide-y">
                  {checklistItems.map(item => (
                    <label key={item.key} className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50">
                      <input type="checkbox" checked={readinessChecks[item.key]} onChange={() => toggleReadinessCheck(item.key)} className="w-6 h-6 text-emerald-600 rounded" />
                      <span className={`text-base font-medium ${readinessChecks[item.key] ? 'text-slate-800' : 'text-slate-600'}`}>{item.label}</span>
                      {readinessChecks[item.key] && <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Kyllä</span>}
                    </label>
                  ))}
                </div>
              </div>
              <div><label className="block text-sm font-bold mb-2">Avauksen poikkeamat ja lisätiedot</label><textarea rows="4" value={readinessComments} onChange={e=>setReadinessComments(e.target.value)} className="w-full rounded-lg border p-3 text-sm"></textarea></div>
              <div className="pt-4 flex justify-end gap-3 border-t"><button type="button" onClick={() => setActiveTab('planning')} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-lg flex items-center gap-2"><CheckCircle size={18} /> Tallenna ja sulje</button></div>
            </form>
          </div>
        );
      case 'planning_employees':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <button onClick={() => setActiveTab('planning')} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"><ArrowLeft size={16} /> Takaisin</button>
            <div className="mb-6 flex justify-between items-end border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Users className="text-indigo-500" size={24} /> Tapahtuman työntekijät</h2>
                <p className="text-sm text-slate-500 mt-1">Rekisteröity henkilöstö ({mockEmployees.length} henkilöä).</p>
              </div>
              <button onClick={() => openEmployeeForm(null)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg flex items-center gap-2"><UserPlus size={16} /> Lisää uusi</button>
            </div>
            <div className="bg-slate-50 border rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 border-b"><tr><th className="p-4">Nimi</th><th className="p-4">Roolit</th><th className="p-4">Kortit</th><th className="p-4 text-right">Toiminnot</th></tr></thead>
                <tbody className="divide-y">
                  {mockCheckedInEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-white">
                      <td className="p-4 font-medium text-slate-800">{emp.name}</td>
                      <td className="p-4"><span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700">{emp.role}</span></td>
                      <td className="p-4"><span className="flex items-center gap-1 text-emerald-600 text-xs font-bold"><CheckCircle size={14} /> OK</span></td>
                      <td className="p-4 text-right"><button onClick={() => openEmployeeForm(emp)} className="text-indigo-600 font-medium text-xs bg-indigo-50 px-3 py-1.5 rounded-md">Muokkaa</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'planning_employee_new':
        return (
          <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8 max-w-4xl">
            <button onClick={() => setActiveTab('planning_employees')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-6"><ArrowLeft size={16} /> Takaisin</button>
            <div className="mb-6 border-b pb-4"><h2 className="text-xl font-bold flex items-center gap-2">{editingEmp ? <UserCheck className="text-indigo-500" size={24} /> : <UserPlus className="text-emerald-500" size={24} />} {editingEmp ? 'Muokkaa työntekijää' : 'Kirjaa uusi työntekijä'}</h2></div>
            <form className="space-y-8 text-left">
              <div className="space-y-4">
                <h3 className="text-md font-semibold border-b pb-2 flex items-center gap-2"><Contact size={18} className="text-slate-400"/> 1. Henkilö- ja yhteystiedot</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Koko nimi</label><input type="text" defaultValue={editingEmp ? editingEmp.name : ''} className="w-full rounded-lg border p-2.5 text-sm" /></div>
                  <div><label className="block text-sm font-medium mb-1">Henkilötunnus</label><input type="text" defaultValue={editingEmp ? '121280-123X' : ''} className="w-full rounded-lg border p-2.5 text-sm" /></div>
                  <div><label className="block text-sm font-medium mb-1">Sähköposti</label><input type="email" className="w-full rounded-lg border p-2.5 text-sm" /></div>
                  <div><label className="block text-sm font-medium mb-1">Matkapuhelin</label><input type="tel" className="w-full rounded-lg border p-2.5 text-sm" /></div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-md font-semibold border-b pb-2 flex items-center gap-2"><IdCard size={18} className="text-slate-400"/> 2. Pätevyydet ja kortit</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border"><label className="block text-sm font-bold mb-2">Järjestyksenvalvojakortti</label><input type="text" className="w-full rounded-lg border p-2 text-sm" /></div>
                  <div className="bg-slate-50 p-4 rounded-xl border"><label className="block text-sm font-bold mb-2">Vartijakortti</label><input type="text" className="w-full rounded-lg border p-2 text-sm" /></div>
                  <div className="bg-slate-50 p-4 rounded-xl border"><label className="block text-sm font-bold mb-2">Kaasusumuttimen hallussapito</label><input type="text" className="w-full rounded-lg border p-2 text-sm" /></div>
                </div>
              </div>
              <div className="pt-6 flex justify-end gap-3 border-t">
                <button type="button" onClick={() => setActiveTab('planning_employees')} className="px-5 py-2.5 text-sm font-medium bg-slate-100 rounded-lg">Peruuta</button>
                <button type="button" onClick={() => setActiveTab('planning_employees')} className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-lg flex items-center gap-2"><CheckCircle size={18} /> Tallenna</button>
              </div>
            </form>
          </div>
        );
      case 'postevent':
        const radioChannels = ["JV:t Tapahtuma", "JV:t Välitönläheisyys", "Toimintaryhmät", "Toimintaryhmät (vara)", "Backstage", "Raportointi", "Liikenne", "Turvallisuusjohto ja tike"];
        const supervisors = [{r:"Turva 1",n:"Ismo Näkki"},{r:"Turva 2",n:"Liisa Ollila"},{r:"Pääportti 10",n:"Jaakko Mäki"},{r:"Lava 1 10",n:"Markus Joki"},{r:"Lava 2 10",n:"Maria Lohi"},{r:"VIP 10",n:"Sulo Oja"},{r:"Toimintaryhmä 10",n:"Kalevi Mauno"},{r:"Kenttä 10",n:"Jouko Neno"},{r:"Ulko 10",n:"Anna Lahti"}];
        return (
          <div className="space-y-6 max-w-5xl">
            <div className="mb-6 pb-4 border-b border-slate-200">
              <h2 className="text-2xl font-bold flex items-center gap-2"><Layers className="text-indigo-500" size={28} /> FestivaaliX</h2>
              <p className="text-sm text-slate-500 mt-1">Tapahtuman operatiivinen kartta, viestintäkanavat ja johto.</p>
            </div>
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Map className="text-indigo-500" size={20} /> Tapahtuman pohjakartta</h3>
              <div className="w-full bg-slate-50 rounded-lg overflow-hidden border min-h-[300px] md:min-h-[500px] flex items-center justify-center">
                <img src="image_aa9244.png" alt="Tapahtuman pohjakartta" className="max-w-full h-auto object-contain" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/800x400/e2e8f0/64748b?text=Kuva+ei+latautunut' }} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border shadow-sm h-full">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><PhoneCall className="text-emerald-500" size={20} /> Radiopuhelinten kanavalista</h3>
                <ul className="space-y-2">
                  {radioChannels.map((c, i) => (
                    <li key={i} className="flex gap-3 items-center p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100">
                      <span className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">{i + 1}</span> 
                      <span className="text-sm font-medium text-slate-700">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white p-6 rounded-xl border shadow-sm h-full">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Users className="text-blue-500" size={20} /> Esimiehet ja vastuuhenkilöt</h3>
                <ul className="space-y-2">
                  {supervisors.map((s, i) => (
                    <li key={i} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-sm font-bold text-slate-700">{s.r}</span>
                      <span className="text-sm font-medium text-slate-500 bg-white px-2 py-1 rounded shadow-sm border">{s.n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      case 'documents':
      case 'settings':
        return (
          <div className="bg-white p-8 rounded-xl shadow-sm border flex flex-col items-center justify-center min-h-[400px] text-center">
            {activeTab === 'settings' ? <Settings className="text-slate-300 mb-4" size={48} /> : <FileText className="text-slate-300 mb-4" size={48} />}
            <h2 className="text-2xl font-bold mb-2">{activeTab === 'settings' ? 'Asetukset' : 'Lomakkeet & Asiakirjat'}</h2>
            <p className="text-slate-500">Tätä osiota rakennetaan parhaillaan.</p>
          </div>
        );
      default:
        return <div>Näkymää rakennetaan...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <nav className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors">
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('landing')}>
            <ShieldCheck className="text-indigo-400" size={28} />
            <div>
              <h1 className="text-xl font-bold leading-tight tracking-tight">Turvajohto OS</h1>
              <p className="hidden md:block text-xs text-slate-400 font-medium">Tapahtumaturvallisuuden tilannekuva</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="relative">
            <button onClick={() => setShowQuickActions(!showQuickActions)} className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm">
              <AlertTriangle size={16} /> <span className="hidden sm:inline">Pikatoiminnot</span>
            </button>
            {showQuickActions && (
              <div className="absolute right-0 mt-3 w-72 bg-slate-800 rounded-xl shadow-xl border border-slate-700 p-5 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
                  <h3 className="text-white font-bold flex items-center gap-2"><AlertTriangle className="text-rose-400" size={18} /> Kriittiset toiminnot</h3>
                  <button onClick={() => setShowQuickActions(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>
                <div className="space-y-3">
                  <button className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors flex justify-center items-center shadow-sm">SHOW STOP PROTOKOLLA</button>
                  <button className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex justify-center items-center gap-2"><PhoneCall size={18} /> Yhteys Viranomaisiin</button>
                </div>
              </div>
            )}
          </div>
          <div className="hidden md:flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg">
            <Clock size={16} className="text-indigo-400" /> <span className="font-mono text-sm tracking-widest">{formatTime(currentTime)}</span>
          </div>
        </div>
      </nav>

      <div className="flex flex-col md:flex-row min-h-[calc(100vh-73px)]">
        {isSidebarOpen && (
          <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col">
            <div className="p-4 space-y-1">
              <button onClick={() => setActiveTab('landing')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'landing' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><Home size={18} /> Aloitussivu</button>
              <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><Activity size={18} /> Tilannekuva</button>
              <button onClick={() => setActiveTab('reporting')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${(activeTab.startsWith('report') || activeTab.startsWith('tike_')) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><FileText size={18} /> Raportointi</button>
              <button onClick={() => setActiveTab('planning')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab.startsWith('planning') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><Calendar size={18} /> Ennen Tapahtumaa</button>
              <button onClick={() => setActiveTab('postevent')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'postevent' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><Layers size={18} /> FestivaaliX</button>
              <button onClick={() => setActiveTab('documents')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'documents' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><FileText size={18} /> Lomakekartoitus</button>
              <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><Settings size={18} /> Asetukset</button>
            </div>
          </aside>
        )}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">{renderContent()}</main>
      </div>

      {showInfoModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full flex flex-col">
            <div className="flex justify-between items-center p-5 border-b"><h2 className="font-bold text-lg flex items-center gap-2"><Info className="text-indigo-500" /> Lakisääteiset vaatimukset</h2><button onClick={() => setShowInfoModal(false)}><X size={24} /></button></div>
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
              <p className="bg-slate-50 p-4 rounded-lg border">"Järjestyksenvalvojan tulee heti laatia järjestyksenvalvojatehtävissä havaituista kiinniottamiseen tai voimakeinojen käyttöön johtaneista tapahtumista kirjallinen selvitys..."</p>
            </div>
            <div className="p-4 border-t flex justify-end"><button onClick={() => setShowInfoModal(false)} className="px-5 py-2 bg-slate-100 rounded-lg">Sulje</button></div>
          </div>
        </div>
      )}
    </div>
  );
}