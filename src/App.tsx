import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, ShieldCheck, Activity, Users, Clock, FileText, PhoneCall,
  CheckCircle, XCircle, BarChart2, Calendar, Layers, Map, Settings,
  MessageSquare, ChevronRight, Info, X, ArrowLeft, LogIn,
  LogOut, PenTool, HeartPulse, Clipboard, Cloud, ShieldAlert, Package,
  Wrench, Search, UserPlus, IdCard, UserCheck, Contact, Archive, Camera,
  Paperclip, FileCheck, Home, DoorOpen, CheckSquare, Menu, Lock
} from 'lucide-react';

// --- MOCK DATA ---
const mockAlerts = [
  { id: 1, type: 'critical', message: 'Main Stage crowd density > 4 hlö/m²', time: '10:42', location: 'Main Stage' },
  { id: 2, type: 'warning', message: 'Gate 2 throughput dropping, queue 15m', time: '10:35', location: 'Gate 2' },
];

const mockLogs = [
  { id: 101, time: '10:30', user: 'JOKE', action: 'Portit avattu yleisölle' },
  { id: 102, time: '10:35', user: 'Gate 1', action: 'Kapasiteetti 1500/h saavutettu' },
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

// --- MAIN APP COMPONENT ---
export default function App() {
  // 1. KIRJAUTUMISTILA (Kevyt suojaus)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  // 2. SOVELLUKSEN TILAT
  const [activeTab, setActiveTab] = useState('landing');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [overviewCardTab, setOverviewCardTab] = useState('checklist');
  const [runningNumber, setRunningNumber] = useState(100);

  // 3. TYÖNTEKIJÄTIETOKANTA (Reaktiivinen State)
  const [employees, setEmployees] = useState([
    { id: 1, name: "Korhonen Elli Marja Orvokki", role: "Järjestyksenvalvoja", checkedIn: true, email: "elli@esimerkki.fi" },
    { id: 2, name: "Virtanen Matti Johannes", role: "Vartija", checkedIn: true, email: "matti@esimerkki.fi" },
    { id: 3, name: "Mäkinen Kalle Petteri", role: "Järjestyksenvalvoja", checkedIn: true, email: "kalle@esimerkki.fi" },
    { id: 4, name: "Nieminen Anna Sofia", role: "Järjestyksenvalvoja", checkedIn: false, email: "anna@esimerkki.fi" },
    { id: 5, name: "Lahtinen Oskari Juhani", role: "Vartija", checkedIn: false, email: "oskari@esimerkki.fi" }
  ]);

  const [checkedInEmployees, setCheckedInEmployees] = useState([
    { id: 101, empId: 1, name: "Korhonen Elli Marja Orvokki", role: "Järjestyksenvalvoja", vest: true, badge: "1234", headset: true, radio: "R-12" },
    { id: 102, empId: 2, name: "Virtanen Matti Johannes", role: "Vartija", vest: false, badge: "5521", headset: false, radio: "" },
    { id: 103, empId: 3, name: "Mäkinen Kalle Petteri", role: "Järjestyksenvalvoja", vest: true, badge: "9982", headset: true, radio: "R-05" }
  ]);

  // KPI Datan laskenta sisäänkirjatuista
  const activeJvCount = checkedInEmployees.filter(e => e.role === 'Järjestyksenvalvoja').length;
  const activeVartijaCount = checkedInEmployees.filter(e => e.role === 'Vartija').length;

  // LOMAKKEIDEN TILAT
  // Työntekijän hallinta
  const [editingEmp, setEditingEmp] = useState(null);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('Järjestyksenvalvoja');

  // Sisäänkirjaus
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkInRole, setCheckInRole] = useState('Järjestyksenvalvoja');
  
  // Uloskirjaus
  const [outEmpSearch, setOutEmpSearch] = useState('');
  const [selectedOutEmp, setSelectedOutEmp] = useState(null);
  
  // Avausvalmius
  const [targetOpeningTime, setTargetOpeningTime] = useState('16:00');
  const [readinessChecks, setReadinessChecks] = useState({
    exits: false, guards: false, vehicles: false, production: false, security: false
  });

  // Aika päivitys
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Kirjautumisen käsittely
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

  // Jos ei kirjautunut, näytä vain login screen
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

  // --- FUNKTIOT JA LOGIIKAT ---
  const handleCheckInNyt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [d, t] = now.toISOString().slice(0, 16).split('T');
    setCheckInDate(d); setCheckInTime(t);
  };

  const openEmployeeForm = (emp = null) => {
    setEditingEmp(emp);
    if (emp) { setNewEmpName(emp.name); setNewEmpRole(emp.role); } 
    else { setNewEmpName(''); setNewEmpRole('Järjestyksenvalvoja'); }
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

  const handleSaveCheckInFinal = () => {
    if (!selectedEmp) return;
    const newCI = { id: Date.now(), empId: selectedEmp.id, name: selectedEmp.name, role: checkInRole, vest: true, badge: "123", headset: false, radio: "" };
    setCheckedInEmployees([...checkedInEmployees, newCI]);
    setEmployees(employees.map(e => e.id === selectedEmp.id ? { ...e, checkedIn: true, role: checkInRole } : e));
    setSelectedEmp(null); setEmpSearch(''); setActiveTab('report_tike');
  };

  const handleSaveCheckOutFinal = () => {
    if (!selectedOutEmp) return;
    setCheckedInEmployees(checkedInEmployees.filter(e => e.empId !== selectedOutEmp.empId));
    setEmployees(employees.map(e => e.id === selectedOutEmp.empId ? { ...e, checkedIn: false } : e));
    setSelectedOutEmp(null); setOutEmpSearch(''); setActiveTab('report_tike');
  };

  const filteredEmployeesForCheckIn = empSearch.length >= 3 
    ? employees.filter(e => !e.checkedIn && e.name.toLowerCase().includes(empSearch.toLowerCase())) 
    : [];

  const filteredOutEmployees = outEmpSearch.length >= 3
    ? checkedInEmployees.filter(e => e.name.toLowerCase().includes(outEmpSearch.toLowerCase()))
    : [];

  // PÄÄSISÄLLÖN RENDERÖINTI
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
                  {currentTime.getHours() >= 5 && currentTime.getHours() < 10 ? 'Hyvää huomenta' : 
                   currentTime.getHours() >= 10 && currentTime.getHours() < 17 ? 'Hyvää päivää' : 
                   currentTime.getHours() >= 17 && currentTime.getHours() < 22 ? 'Hyvää iltaa' : 'Hyvää yötä'}, <span className="text-indigo-600">oletuskäyttäjä</span>
                </h2>
                <p className="text-slate-500 font-medium mt-1">Turvajohto</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={() => setActiveTab('overview')} className="flex items-center justify-center gap-3 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-sm hover:shadow group">
                  <Activity size={20} className="group-hover:scale-110 transition-transform" />
                  Siirry tilannekuvaan
                </button>
                <button onClick={() => setActiveTab('reporting')} className="flex items-center justify-center gap-3 p-4 bg-white border-2 border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all">
                  <FileText size={20} className="text-indigo-500" />
                  Avaa raportointi
                </button>
              </div>
            </div>
          </div>
        );
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <DashboardCard title="Aktiiviset Järjestyksenvalvojat" icon={ShieldCheck} value={activeJvCount.toString()} subtitle="Dynaaminen luku sisäänkirjatuista" />
              <DashboardCard title="Aktiiviset Vartijat" icon={Users} value={activeVartijaCount.toString()} subtitle="Dynaaminen luku sisäänkirjatuista" />
              <DashboardCard title="Ensiaputapaukset" icon={HeartPulse} value="12" subtitle="Viimeisen tunnin aikana: 3" />
              <DashboardCard title="Poikkeamat" icon={AlertTriangle} value="3" subtitle="Avoinna olevat tilanteet" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                  <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Activity className="text-rose-500" size={20} /> Aktiiviset Hälytykset
                  </h2>
                  <div className="space-y-1">
                    {mockAlerts.map(alert => <AlertBanner key={alert.id} alert={alert} />)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'planning':
        return (
          <div className="space-y-6 max-w-5xl">
            <div className="mb-6 pb-4 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="text-indigo-500" size={28} /> Ennen tapahtumaa
              </h2>
              <p className="text-sm text-slate-500 mt-1">Suunnittelu, varautuminen ja henkilöstöhallinto.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <button onClick={() => setActiveTab('planning_readiness')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all text-left">
                <DoorOpen size={24} className="text-indigo-600 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">Avausvalmius</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Porttien avauksen edellytysten kuittaus.</p>
              </button>
              <button onClick={() => setActiveTab('planning_employees')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all text-left">
                <Users size={24} className="text-indigo-600 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">Tapahtuman työntekijät</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Henkilöstörekisteri ja tilat.</p>
              </button>
              <button onClick={() => openEmployeeForm(null)} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 transition-all text-left">
                <UserPlus size={24} className="text-emerald-600 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">Kirjaa uusi työntekijä</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Lisää työntekijä rekisteriin.</p>
              </button>
            </div>
          </div>
        );
      case 'planning_employees':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 max-w-5xl">
            <div className="mb-6 flex justify-between items-end border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Users className="text-indigo-500" size={24} /> Tapahtuman työntekijät
                </h2>
                <p className="text-sm text-slate-500 mt-1">Yhteensä {employees.length} henkilöä.</p>
              </div>
              <button onClick={() => openEmployeeForm(null)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                <UserPlus size={16} /> Lisää uusi
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-4">Nimi</th>
                    <th className="p-4">Rooli</th>
                    <th className="p-4">Tila</th>
                    <th className="p-4 text-right">Toiminnot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-white transition-colors">
                      <td className="p-4 font-medium text-slate-800">{emp.name}</td>
                      <td className="p-4">
                        <span className="inline-flex px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700">{emp.role}</span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${emp.checkedIn ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${emp.checkedIn ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          {emp.checkedIn ? 'Sisällä' : 'Ei sisällä'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => openEmployeeForm(emp)} className="text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-md font-medium text-xs">Muokkaa</button>
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 max-w-4xl">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">
              <UserPlus className="text-emerald-500" size={24} /> {editingEmp ? 'Muokkaa työntekijää' : 'Kirjaa uusi työntekijä'}
            </h2>
            <form className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-1">Nimi</label>
                <input type="text" value={newEmpName} onChange={e => setNewEmpName(e.target.value)} className="w-full border rounded-lg p-2.5" placeholder="Koko nimi..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rooli</label>
                <select value={newEmpRole} onChange={e => setNewEmpRole(e.target.value)} className="w-full border rounded-lg p-2.5">
                  <option>Järjestyksenvalvoja</option>
                  <option>Vartija</option>
                  <option>EA-henkilö</option>
                  <option>Tuotanto</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setActiveTab('planning_employees')} className="px-5 py-2.5 bg-slate-100 rounded-lg text-sm font-medium">Peruuta</button>
                <button type="button" onClick={handleSaveEmployee} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold">Tallenna</button>
              </div>
            </form>
          </div>
        );
      case 'reporting':
        return (
          <div className="space-y-6 max-w-5xl">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 border-b pb-4"><FileText className="text-indigo-500" /> Raportointi</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => setActiveTab('report_tike')} className="bg-white p-6 rounded-xl border hover:border-emerald-300 text-left">
                <Activity size={24} className="text-emerald-600 mb-4" />
                <h3 className="font-bold text-lg mb-1">TIKE:n raportointi</h3>
                <p className="text-sm text-slate-500">Sisään/uloskirjaukset ja lokit.</p>
              </button>
            </div>
          </div>
        );
      case 'report_tike':
        return (
          <div className="bg-white rounded-xl border border-slate-100 p-6 max-w-5xl">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4"><Activity className="text-emerald-500" /> TIKE:n toiminnot</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <button onClick={() => setActiveTab('tike_form_in')} className="p-5 border rounded-xl hover:border-emerald-300 text-left flex flex-col items-start">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg mb-3"><LogIn size={24} /></div>
                <span className="font-bold text-sm">Sisäänkirjaus</span>
              </button>
              <button onClick={() => setActiveTab('tike_form_out')} className="p-5 border rounded-xl hover:border-rose-300 text-left flex flex-col items-start">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-lg mb-3"><LogOut size={24} /></div>
                <span className="font-bold text-sm">Uloskirjaus</span>
              </button>
            </div>
          </div>
        );
      case 'tike_form_in':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 max-w-4xl">
             <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">
              <LogIn className="text-emerald-500" /> Työntekijän sisäänkirjaus
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold mb-2">Hae työntekijä (Ei sisällä)</label>
                <input type="text" value={empSearch} onChange={e => {setEmpSearch(e.target.value); setSelectedEmp(null);}} className="w-full border rounded-lg p-2.5" placeholder="Hae..." />
                {empSearch.length >= 3 && !selectedEmp && (
                  <ul className="border rounded-lg mt-1 bg-white shadow-lg absolute z-10 w-full max-w-xl">
                    {filteredEmployeesForCheckIn.map(emp => (
                      <li key={emp.id} onClick={() => handleSelectEmpForCheckIn(emp)} className="p-3 border-b hover:bg-slate-50 cursor-pointer">
                        {emp.name} ({emp.role})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {selectedEmp && (
                <div className="border-t pt-4">
                  <h3 className="font-bold text-lg mb-4">Valittu: {selectedEmp.name}</h3>
                  <button onClick={handleSaveCheckInFinal} className="px-5 py-3 bg-emerald-600 text-white font-bold rounded-lg w-full">Kirjaa sisään</button>
                </div>
              )}
            </div>
          </div>
        );
      case 'tike_form_out':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 max-w-4xl">
             <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">
              <LogOut className="text-rose-500" /> Työntekijän uloskirjaus
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold mb-2">Hae sisäänkirjattu työntekijä</label>
                <input type="text" value={outEmpSearch} onChange={e => {setOutEmpSearch(e.target.value); setSelectedOutEmp(null);}} className="w-full border rounded-lg p-2.5" placeholder="Hae..." />
                {outEmpSearch.length >= 3 && !selectedOutEmp && (
                  <ul className="border rounded-lg mt-1 bg-white shadow-lg absolute z-10 w-full max-w-xl">
                    {filteredOutEmployees.map(emp => (
                      <li key={emp.empId} onClick={() => {setSelectedOutEmp(emp); setOutEmpSearch(emp.name);}} className="p-3 border-b hover:bg-slate-50 cursor-pointer">
                        {emp.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {selectedOutEmp && (
                <div className="border-t pt-4">
                  <h3 className="font-bold text-lg mb-4">Valittu: {selectedOutEmp.name}</h3>
                  <button onClick={handleSaveCheckOutFinal} className="px-5 py-3 bg-rose-600 text-white font-bold rounded-lg w-full">Kirjaa ulos</button>
                </div>
              )}
            </div>
          </div>
        );
      case 'postevent':
        return (
          <div className="space-y-6 max-w-5xl">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 border-b pb-4"><Layers className="text-indigo-500" /> FestivaaliX</h2>
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Map className="text-indigo-500" /> Tapahtuman pohjakartta</h3>
              <div className="w-full bg-slate-50 rounded-lg overflow-hidden border min-h-[300px] flex items-center justify-center">
                <img src="image_aa9244.png" alt="Kartta" className="max-w-full h-auto" onError={(e) => { e.target.style.display = 'none'; }} />
                <span className="text-slate-400 absolute">Kartta ei latautunut</span>
              </div>
            </div>
          </div>
        );
      default:
        return <div className="p-8 text-center text-slate-500">Näkymää rakennetaan...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <nav className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300">
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('landing')}>
            <ShieldCheck className="text-indigo-400" size={28} />
            <div>
              <h1 className="text-xl font-bold leading-tight">Turvajohto OS</h1>
            </div>
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
                </div>
              </div>
            )}
          </div>
          <div className="hidden md:flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg">
            <Clock size={16} className="text-indigo-400" />
            <span className="font-mono text-sm tracking-widest">{formatTime(currentTime)}</span>
          </div>
          <button onClick={() => setIsAuthenticated(false)} className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-slate-300 ml-2" title="Kirjaudu ulos">
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