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
  Menu,
  Plus,
  Briefcase
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

const initialCheckedInEmployees = [
  { id: 1, name: "Korhonen Elli Marja Orvokki", role: "Järjestyksenvalvoja", vest: true, badge: "1234", headset: true, radio: "R-12", checkInDate: "", checkInTime: "10:15", comment: "" },
  { id: 2, name: "Virtanen Matti Johannes Antero", role: "Vartija", vest: false, badge: "5521", headset: false, radio: "", checkInDate: "", checkInTime: "10:22", comment: "" },
  { id: 3, name: "Mäkinen Kalle Petteri Aleksi", role: "Järjestyksenvalvoja", vest: true, badge: "9982", headset: true, radio: "R-05", checkInDate: "", checkInTime: "10:40", comment: "" }
];

const CHECKIN_STORAGE_KEY = 'turvajohto-checkins';

const REPORT_STORAGE_KEY = 'turvajohto-reports';

// Poikkeamiksi laskettavat kirjaustyypit
const DEVIATION_TYPES = ['jvaction', 'firstaid', 'threat', 'fence', 'damage'];

const initialReports = [
  { id: '26/FesX/1108/099', typeId: 'out', type: 'Työntekijän uloskirjaus', author: 'TIKE Päivystäjä', time: '14:10', summary: 'Virtanen ulos, radiopuhelin rikki.' },
  { id: '26/FesX/1108/098', typeId: 'jvaction', type: 'JV:n tai vartijan toimenpide', author: 'Korhonen Elli', time: '13:45', summary: 'Kiinniotto portilla 2.', denied: 0, removed: 1, detained: 1, force: true, tools: true, firearm: false, firstAid: false },
  { id: '26/FesX/1108/097', typeId: 'firstaid', type: 'Ensiaputilanne', author: 'EA-Päivystys', time: '12:15', summary: 'Nyrjähdys, paikattu pisteellä.' },
  { id: '26/FesX/1108/096', typeId: 'jvaction', type: 'JV:n tai vartijan toimenpide', author: 'Mäkinen Kalle', time: '11:50', summary: 'Päihtynyt asiakas poistettu anniskelualueelta.', denied: 0, removed: 2, detained: 0, force: false, tools: false, firearm: false, firstAid: false },
  { id: '26/FesX/1108/095', typeId: 'fence', type: 'Aitojen ylitys / luvaton sisäänpääsy', author: 'Jaakko Mäki', time: '11:20', summary: 'Kaksi henkilöä aidan yli lohkolla C, poistettu alueelta.' },
  { id: '26/FesX/1108/094', typeId: 'firstaid', type: 'Ensiaputilanne', author: 'EA-Päivystys', time: '10:55', summary: 'Lämpöuupumus, seurantaan EA-pisteelle.' },
  { id: '26/FesX/1108/093', typeId: 'threat', type: 'Uhkatilanne', author: 'Liisa Ollila', time: '10:30', summary: 'Sanallinen uhkaus henkilökuntaa kohtaan pääportilla.' },
  { id: '26/FesX/1108/092', typeId: 'damage', type: 'Omaisuusvaurio', author: 'Markus Joki', time: '09:45', summary: 'Aitaelementti vaurioitunut lohkolla B.' },
  { id: '26/FesX/1108/091', typeId: 'jvaction', type: 'JV:n tai vartijan toimenpide', author: 'Korhonen Elli', time: '09:20', summary: 'Pääsy estetty portilla 2, ei lippua.', denied: 3, removed: 0, detained: 0, force: false, tools: false, firearm: false, firstAid: false },
  { id: '26/FesX/1108/090', typeId: 'patrol', type: 'Kierrosraportti', author: 'Anna Lahti', time: '09:00', summary: 'Aamukierros, ei huomautettavaa.' }
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

  // Tapahtumavalinta: null = valintasivu, 'fesx' = tuotantotapahtuma,
  // 'feso' = mallitapahtuma, 'new' = uuden tapahtuman lomake
  const [selectedEvent, setSelectedEvent] = useState(null);

  const emptyNewEvent = {
    clientName: '', businessId: '',
    ordererName: '', ordererPhone: '', ordererEmail: '',
    deciderName: '', deciderPhone: '', deciderEmail: '',
    einvoiceAddress: '', einvoiceOperator: '', billingRef: '',
    eventName: '', eventType: '', eventTypeOther: '',
    publicStartDate: '', publicStartTime: '', publicEndDate: '', publicEndTime: '',
    buildStart: '', buildEnd: '', teardownStart: '', teardownEnd: '',
    address: '', areaType: '', fenced: '', areaNotes: '',
    audienceCount: '', ageProfile: '', audienceNotes: '',
    heldBefore: '', previousIncidents: '',
    hasBar: false, barResponsible: '', barOperator: '',
    performers: '', reactionRisk: false, vipGuests: false, vipNotes: '',
    existingCctv: '', cctvNotes: '', lighting: '', exitRoutes: '',
    policeNotification: '', rescuePlan: '', authorityResponsible: '',
    otherOperators: '', buildPhaseResponsible: ''
  };
  const [newEvent, setNewEvent] = useState(emptyNewEvent);
  const updNewEvent = (key, value) => setNewEvent(prev => ({ ...prev, [key]: value }));
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

  // Sisäänkirjatut työntekijät (yhteinen tila koko sovellukselle)
  const [checkedInEmployees, setCheckedInEmployees] = useState(initialCheckedInEmployees);

  // Kirjaukset ja raportit (yhteinen tila koko sovellukselle)
  const [reports, setReports] = useState(initialReports);

  // Check-in Form State
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkInRole, setCheckInRole] = useState('Järjestyksenvalvoja');
  const [checkInVest, setCheckInVest] = useState(false);
  const [checkInBadge, setCheckInBadge] = useState('');
  const [checkInHeadset, setCheckInHeadset] = useState(false);
  const [checkInRadio, setCheckInRadio] = useState('');
  const [checkInComment, setCheckInComment] = useState('');

  // Check-out Form State
  const [outEmpSearch, setOutEmpSearch] = useState('');
  const [selectedOutEmp, setSelectedOutEmp] = useState(null);
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [showOutTimeInput, setShowOutTimeInput] = useState(false);

  // JV:n / vartijan toimenpide -lomakkeen tila
  const [jvaRole, setJvaRole] = useState('Järjestyksenvalvoja');
  const [jvaSearch, setJvaSearch] = useState('');
  const [jvaName, setJvaName] = useState('');
  const [jvaLocation, setJvaLocation] = useState('');
  const [jvaDate, setJvaDate] = useState('');
  const [jvaTime, setJvaTime] = useState('');
  const [jvaDenied, setJvaDenied] = useState(false);
  const [jvaDeniedCount, setJvaDeniedCount] = useState('');
  const [jvaRemoved, setJvaRemoved] = useState(false);
  const [jvaRemovedCount, setJvaRemovedCount] = useState('');
  const [jvaDetained, setJvaDetained] = useState(false);
  const [jvaDetainedCount, setJvaDetainedCount] = useState('');
  const [jvaForce, setJvaForce] = useState(false);
  const [jvaTools, setJvaTools] = useState(false);
  const [jvaToolList, setJvaToolList] = useState([]);
  const [jvaToolOther, setJvaToolOther] = useState('');
  const [jvaFirearm, setJvaFirearm] = useState(false);
  const [jvaFirstAid, setJvaFirstAid] = useState(false);
  const [jvaDesc, setJvaDesc] = useState('');
  const [jvaReporterFiled, setJvaReporterFiled] = useState(false);

  // Riskin arviointi -lomakkeen tila
  const [raTarget, setRaTarget] = useState('');
  const [raHazard, setRaHazard] = useState('');
  const [raCategory, setRaCategory] = useState('');
  const [raControls, setRaControls] = useState('');
  const [raProb, setRaProb] = useState(0);
  const [raSev, setRaSev] = useState(0);
  const [raActions, setRaActions] = useState('');
  const [raOwner, setRaOwner] = useState('');
  const [raDeadline, setRaDeadline] = useState('');
  const [raResProb, setRaResProb] = useState(0);
  const [raResSev, setRaResSev] = useState(0);

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

  // Ladataan sisäänkirjaukset selaimen muistista sivun avautuessa
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHECKIN_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCheckedInEmployees(parsed);
      }
    } catch {
      // Viallinen tallennus ohitetaan ja jatketaan alkutilalla
    }
  }, []);

  // Tallennetaan muutokset selaimen muistiin
  useEffect(() => {
    try {
      localStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(checkedInEmployees));
    } catch {
      // Tallennus voi epäonnistua esim. yksityisessä selaustilassa
    }
  }, [checkedInEmployees]);

  // Ladataan kirjaukset selaimen muistista sivun avautuessa
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REPORT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setReports(parsed);
      }
    } catch {
      // Viallinen tallennus ohitetaan ja jatketaan alkutilalla
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));
    } catch {
      // Tallennus voi epäonnistua esim. yksityisessä selaustilassa
    }
  }, [reports]);

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

  // Riskin suuruus: todennäköisyys x seurausten vakavuus, tulos 1-5
  const riskMatrix = [
    [1, 2, 3],
    [2, 3, 4],
    [3, 4, 5]
  ];

  const getRiskScore = (prob, sev) => {
    if (!prob || !sev) return 0;
    return riskMatrix[prob - 1][sev - 1];
  };

  const riskLevels = {
    1: { label: 'Merkityksetön riski', tone: 'emerald', action: 'Toimenpiteitä ei tarvita. Tilannetta seurataan normaalisti.' },
    2: { label: 'Vähäinen riski', tone: 'lime', action: 'Seurataan tilannetta. Harkitaan edullisia parannuksia, jos ne ovat helposti toteutettavissa.' },
    3: { label: 'Kohtalainen riski', tone: 'amber', action: 'Toimenpiteet on suunniteltava ja toteutettava määräajassa. Riskiä pienennetään ennen tapahtuman alkua.' },
    4: { label: 'Merkittävä riski', tone: 'orange', action: 'Toimenpiteet ovat välttämättömiä. Toimintaa ei aloiteta ennen kuin riskiä on pienennetty.' },
    5: { label: 'Sietämätön riski', tone: 'rose', action: 'Toiminta keskeytetään tai sitä ei aloiteta. Riski on poistettava ennen jatkamista.' }
  };

  const riskTones = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', solid: 'bg-emerald-600' },
    lime: { bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-700', solid: 'bg-lime-600' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', solid: 'bg-amber-500' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', solid: 'bg-orange-500' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', solid: 'bg-rose-600' }
  };

  const resetRiskForm = () => {
    setRaTarget(''); setRaHazard(''); setRaCategory(''); setRaControls('');
    setRaProb(0); setRaSev(0);
    setRaActions(''); setRaOwner(''); setRaDeadline('');
    setRaResProb(0); setRaResSev(0);
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

  const resetCheckInForm = () => {
    setSelectedEmp('');
    setEmpSearch('');
    setCheckInDate('');
    setCheckInTime('');
    setCheckInRole('Järjestyksenvalvoja');
    setCheckInVest(false);
    setCheckInBadge('');
    setCheckInHeadset(false);
    setCheckInRadio('');
    setCheckInComment('');
  };

  const handleSaveCheckIn = () => {
    if (!selectedEmp) return;
    if (checkedInEmployees.some(e => e.name === selectedEmp)) {
      alert('Työntekijä on jo sisäänkirjattuna.');
      return;
    }
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    setCheckedInEmployees(prev => [...prev, {
      id: Date.now(),
      name: selectedEmp,
      role: checkInRole,
      vest: checkInVest,
      badge: checkInBadge,
      headset: checkInHeadset,
      radio: checkInRadio,
      comment: checkInComment,
      checkInDate: checkInDate || localNow.toISOString().split('T')[0],
      checkInTime: checkInTime || localNow.toISOString().slice(11, 16)
    }]);
    resetCheckInForm();
    setActiveTab('planning_employees');
  };

  const handleCheckOut = () => {
    if (!selectedOutEmp) return;
    setCheckedInEmployees(prev => prev.filter(e => e.id !== selectedOutEmp.id));
    setSelectedOutEmp(null);
    setOutEmpSearch('');
    setShowOutTimeInput(false);
    setCheckOutDate('');
    setCheckOutTime('');
  };

  const handleOpenKirjausNyt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [d, t] = now.toISOString().slice(0, 16).split('T');
    setOpenKirjausDate(d);
    setOpenKirjausTime(t);
  };

  const handleJvaNyt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [d, t] = now.toISOString().slice(0, 16).split('T');
    setJvaDate(d);
    setJvaTime(t);
  };

  const toggleJvaTool = (tool) => {
    setJvaToolList(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]);
  };

  const resetJvaForm = () => {
    setJvaRole('Järjestyksenvalvoja');
    setJvaSearch('');
    setJvaName('');
    setJvaLocation('');
    setJvaDate('');
    setJvaTime('');
    setJvaDenied(false); setJvaDeniedCount('');
    setJvaRemoved(false); setJvaRemovedCount('');
    setJvaDetained(false); setJvaDetainedCount('');
    setJvaForce(false);
    setJvaTools(false); setJvaToolList([]); setJvaToolOther('');
    setJvaFirearm(false);
    setJvaFirstAid(false);
    setJvaDesc('');
    setJvaReporterFiled(false);
  };

  const handleSaveJvaReport = () => {
    if (!jvaName.trim()) {
      alert('Kirjaa toimenpiteen suorittaneen henkilön nimi.');
      return;
    }
    if (!jvaDenied && !jvaRemoved && !jvaDetained && !jvaForce && !jvaTools && !jvaFirearm) {
      alert('Valitse vähintään yksi toimenpide.');
      return;
    }
    const now = new Date();
    const timeLabel = jvaTime || now.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
    const parts = [];
    if (jvaDenied) parts.push(`estetty pääsy ${Number(jvaDeniedCount) || 1}`);
    if (jvaRemoved) parts.push(`poistettu ${Number(jvaRemovedCount) || 1}`);
    if (jvaDetained) parts.push(`kiinniotettu ${Number(jvaDetainedCount) || 1}`);
    if (jvaForce) parts.push('voimakeinoja käytetty');
    if (jvaTools) parts.push(`välineet: ${jvaToolList.join(', ') || 'ei eritelty'}`);
    if (jvaFirearm) parts.push('ampuma-ase esillä tai käytetty');
    if (jvaFirstAid) parts.push('ensiapu tai ensihoito');

    setReports(prev => [{
      id: getDynamicId(),
      typeId: 'jvaction',
      type: 'JV:n tai vartijan toimenpide',
      author: jvaName,
      time: timeLabel,
      summary: `${jvaLocation ? jvaLocation + ': ' : ''}${parts.join(', ')}`,
      denied: jvaDenied ? (Number(jvaDeniedCount) || 1) : 0,
      removed: jvaRemoved ? (Number(jvaRemovedCount) || 1) : 0,
      detained: jvaDetained ? (Number(jvaDetainedCount) || 1) : 0,
      force: jvaForce,
      tools: jvaTools,
      firearm: jvaFirearm,
      firstAid: jvaFirstAid
    }, ...prev]);

    setRunningNumber(prev => prev + 1);
    resetJvaForm();
    setActiveTab('overview');
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
    ? mockEmployees.filter(e => 
        e.toLowerCase().includes(empSearch.toLowerCase()) &&
        !checkedInEmployees.some(c => c.name === e)) 
    : [];

  const filteredOutEmployees = outEmpSearch.length >= 3
    ? checkedInEmployees.filter(e => e.name.toLowerCase().includes(outEmpSearch.toLowerCase()))
    : [];

  // Toimenpiteen tekijän haku: ensisijaisesti sisäänkirjatuista, muuten koko rekisteristä
  const jvaNameOptions = jvaSearch.length >= 3
    ? Array.from(new Set([
        ...checkedInEmployees.filter(e => e.role === jvaRole).map(e => e.name),
        ...mockEmployees
      ])).filter(n => n.toLowerCase().includes(jvaSearch.toLowerCase()))
    : [];

  // Miehityslaskurit sisäänkirjatuista työntekijöistä
  const jvCount = checkedInEmployees.filter(e => e.role === 'Järjestyksenvalvoja').length;
  const guardCount = checkedInEmployees.filter(e => e.role === 'Vartija').length;
  const requiredJv = 142;
  const jvMissing = Math.max(0, requiredJv - jvCount);

  // ---- Tilannekuvan laskurit raportoiduista kirjauksista ----

  // Kellonaika tunteina, käytetään viimeisen tunnin suodatukseen
  const minutesFromTimeString = (t) => {
    if (!t || typeof t !== 'string' || !t.includes(':')) return null;
    const [h, m] = t.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const withinLastHour = (t) => {
    const mins = minutesFromTimeString(t);
    if (mins === null) return false;
    return mins <= nowMinutes && nowMinutes - mins <= 60;
  };

  // Ensiaputapaukset: erilliset ensiapukirjaukset ja ne toimenpiteet,
  // joissa kohdehenkilö on viety ensiapuun tai ensihoitoa on käytetty
  const firstAidReports = reports.filter(r => r.typeId === 'firstaid');
  const firstAidInActions = reports.filter(r => r.typeId === 'jvaction' && r.firstAid);
  const firstAidCount = firstAidReports.length + firstAidInActions.length;
  const firstAidLastHour = [...firstAidReports, ...firstAidInActions].filter(r => withinLastHour(r.time)).length;

  // Poistot: poistettujen henkilöiden yhteismäärä toimenpidekirjauksista
  const removalReports = reports.filter(r => r.typeId === 'jvaction' && Number(r.removed) > 0);
  const removalCount = removalReports.reduce((sum, r) => sum + Number(r.removed || 0), 0);

  // Poikkeamat: JV:n tai vartijan toimenpide, ensiaputilanne, uhkatilanne,
  // aitojen ylitys tai luvaton sisäänpääsy sekä omaisuusvaurio
  const deviationReports = reports.filter(r => DEVIATION_TYPES.includes(r.typeId));
  const deviationCount = deviationReports.length;
  const deviationLastHour = deviationReports.filter(r => withinLastHour(r.time)).length;

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
                  {getGreeting(currentTime)}, <span className="text-indigo-600">Turva 1</span>
                </h2>
                <p className="text-slate-500 font-medium mt-1">Turvajohto</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={() => setActiveTab('overview')}
                  className="flex items-center justify-center gap-3 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-sm hover:shadow group"
                >
                  <Activity size={20} className="group-hover:scale-110 transition-transform" />
                  Tilannekuva
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
                value={jvCount} 
                subtitle={jvMissing === 0
                  ? `Sisäänkirjattu ${jvCount}/${requiredJv} — mitoitus täyttyy`
                  : `Sisäänkirjattu ${jvCount}/${requiredJv} — puuttuu ${jvMissing}`}
              />
              <DashboardCard 
                title="Ensiaputapaukset" 
                icon={HeartPulse} 
                value={firstAidCount} 
                subtitle={`Raportoitu ${firstAidReports.length} ensiapukirjausta ja ${firstAidInActions.length} toimenpiteen yhteydessä | Viimeisen tunnin aikana ${firstAidLastHour}`}
              />
              <DashboardCard 
                title="Poistot" 
                icon={LogOut} 
                value={removalCount} 
                subtitle={removalCount === 0
                  ? 'Ei poistoja kirjattuna'
                  : `${removalReports.length} kirjauksesta, koko tapahtuman ajalta`}
              />
              <DashboardCard 
                title="Poikkeamat" 
                icon={AlertTriangle} 
                value={deviationCount} 
                subtitle={`Toimenpiteet, ensiapu, uhkatilanteet, aitojen ylitykset ja omaisuusvauriot | Viimeisen tunnin aikana ${deviationLastHour}`}
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
                        {reports.slice(0, 5).map((rep, idx) => (
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
                  {reports.slice(0, 5).map((rep, idx) => (
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
          { id: 'jvaction', label: 'JV:n tai vartijan toimenpide', icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
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
                <div className="text-2xl font-bold text-slate-800">{jvCount}</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">JV paikalla</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">{guardCount}</div>
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
                          <input 
                            type="radio" 
                            name="role" 
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" 
                            checked={checkInRole === 'Järjestyksenvalvoja'}
                            onChange={() => setCheckInRole('Järjestyksenvalvoja')}
                          />
                          <span className="text-sm font-medium text-slate-700">Järjestyksenvalvoja</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="role" 
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" 
                            checked={checkInRole === 'Vartija'}
                            onChange={() => setCheckInRole('Vartija')}
                          />
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
                            <input type="radio" name="vest" className="text-emerald-600 focus:ring-emerald-500" checked={checkInVest === true} onChange={() => setCheckInVest(true)} />
                            <span className="text-sm">Kyllä</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="vest" className="text-slate-600 focus:ring-slate-500" checked={checkInVest === false} onChange={() => setCheckInVest(false)} />
                            <span className="text-sm">Ei</span>
                          </label>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <label className="block text-sm font-medium text-slate-700 mb-1">JV yksilötunnus</label>
                        <input type="text" value={checkInBadge} onChange={(e) => setCheckInBadge(e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-emerald-500" placeholder="Esim. 1234" />
                      </div>

                      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="text-sm font-medium text-slate-700">Headset</span>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="headset" className="text-emerald-600 focus:ring-emerald-500" checked={checkInHeadset === true} onChange={() => setCheckInHeadset(true)} />
                            <span className="text-sm">Kyllä</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="headset" className="text-slate-600 focus:ring-slate-500" checked={checkInHeadset === false} onChange={() => setCheckInHeadset(false)} />
                            <span className="text-sm">Ei</span>
                          </label>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Radiopuhelimen nro</label>
                        <input type="text" value={checkInRadio} onChange={(e) => setCheckInRadio(e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-emerald-500" placeholder="Esim. R-12" />
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
                        value={checkInComment}
                        onChange={(e) => setCheckInComment(e.target.value)}
                        className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-emerald-500" 
                        placeholder="Esim. työntekijä joutuu lähtemään ennen työvuoron loppua, varustepuutteet tai muu huomionarvoinen asia..."
                      ></textarea>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={resetCheckInForm}
                      className="px-5 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Peruuta
                    </button>
                    <button 
                      type="button" 
                      onClick={handleSaveCheckIn}
                      className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2"
                    >
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
                <div className="text-2xl font-bold text-slate-800">{jvCount}</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">JV paikalla</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">{guardCount}</div>
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
                          onClick={handleCheckOut}
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
                            onClick={handleCheckOut}
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
      case 'tike_form_jvaction': {
        const jvaTooling = ['Käsiraudat', 'Teleskooppipatukka', 'Patukka', 'Kaasusumutin', 'Sidontaväline', 'Muu'];
        const jvaSelectedCount = [jvaDenied, jvaRemoved, jvaDetained].filter(Boolean).length;
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
                  <ShieldCheck className="text-amber-500" size={24} />
                  Järjestyksenvalvojan tai vartijan toimenpide
                </h2>
                <p className="text-sm text-slate-500 mt-1">TIKE:n oma kirjanpito ja tapahtumien seuranta.</p>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Tunniste</span>
                <div className="text-sm font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
                  {getDynamicId()}
                </div>
              </div>
            </div>

            {/* Huomautus vastuunjaosta */}
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-amber-900">
                <span className="font-bold">Tämä ei korvaa tapahtumailmoitusta.</span> TIKE täyttää tämän lomakkeen omaa
                kirjanpitoa ja tapahtumien seurantaa varten. Toimenpiteen suorittanut järjestyksenvalvoja tai vartija
                täyttää lisäksi itse oman tapahtumailmoituksensa. Voimakeinojen, voimankäyttövälineiden ja ampuma-aseen
                käyttöön liittyy erillinen ilmoitusvelvollisuus, jonka menettely tarkistetaan toimeksiantajan ja
                toimeksisaajan ohjeista.
              </div>
            </div>

            <form className="space-y-6 text-left">

              {/* Rooli */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <label className="block text-sm font-bold text-slate-700 mb-3">Toimenpiteen suorittajan rooli</label>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="jvaRole"
                      className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                      checked={jvaRole === 'Järjestyksenvalvoja'}
                      onChange={() => { setJvaRole('Järjestyksenvalvoja'); setJvaName(''); setJvaSearch(''); }}
                    />
                    <span className="text-sm font-medium text-slate-700">Järjestyksenvalvoja</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="jvaRole"
                      className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                      checked={jvaRole === 'Vartija'}
                      onChange={() => { setJvaRole('Vartija'); setJvaName(''); setJvaSearch(''); }}
                    />
                    <span className="text-sm font-medium text-slate-700">Vartija</span>
                  </label>
                </div>
              </div>

              {/* Nimi ja paikka */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    {jvaRole === 'Vartija' ? 'Vartijan nimi' : 'Järjestyksenvalvojan nimi'}
                  </label>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={jvaSearch}
                        onChange={(e) => { setJvaSearch(e.target.value); setJvaName(''); }}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 text-sm font-medium"
                        placeholder="Kirjoita vähintään 3 merkkiä..."
                      />
                    </div>
                    {jvaSearch.length >= 3 && !jvaName && (
                      <ul className="absolute z-10 bg-white border border-slate-200 rounded-lg shadow-lg w-full mt-1 max-h-60 overflow-y-auto">
                        {jvaNameOptions.length > 0 ? (
                          jvaNameOptions.map((name, idx) => (
                            <li
                              key={idx}
                              onClick={() => { setJvaName(name); setJvaSearch(name); }}
                              className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-medium text-slate-700 border-b border-slate-100 last:border-0"
                            >
                              {name}
                              {checkedInEmployees.some(c => c.name === name) && (
                                <span className="ml-2 text-xs text-emerald-600 font-bold">sisäänkirjattu</span>
                              )}
                            </li>
                          ))
                        ) : (
                          <li
                            onClick={() => setJvaName(jvaSearch)}
                            className="px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            Ei osumia. Käytä kirjoitettua nimeä.
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                  {jvaName && (
                    <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                      <CheckCircle size={14} />
                      Valittu: {jvaName}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Tapahtumapaikka</label>
                  <input
                    type="text"
                    value={jvaLocation}
                    onChange={(e) => setJvaLocation(e.target.value)}
                    className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-amber-500"
                    placeholder="Esim. Portti 2, Main Stage etualue, VIP-alue"
                  />
                </div>
              </div>

              {/* Aika */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <label className="block text-sm font-bold text-slate-700 mb-2">Tapahtuma-aika</label>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input
                      type="date"
                      value={jvaDate}
                      onChange={(e) => setJvaDate(e.target.value)}
                      className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-amber-500"
                    />
                    <input
                      type="time"
                      value={jvaTime}
                      onChange={(e) => setJvaTime(e.target.value)}
                      className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleJvaNyt}
                    className="px-4 py-2 text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-colors shadow-sm"
                  >
                    NYT
                  </button>
                </div>
              </div>

              {/* Toimenpiteet */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex justify-between items-end">
                  <span>Suoritetut toimenpiteet</span>
                  <span className="text-xs font-normal text-slate-500">Valittuna {jvaSelectedCount}</span>
                </h3>

                <div className="space-y-3">
                  <div className={`p-4 rounded-lg border transition-colors ${jvaDenied ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={jvaDenied}
                          onChange={(e) => { setJvaDenied(e.target.checked); if (!e.target.checked) setJvaDeniedCount(''); }}
                          className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                        />
                        <span className="text-sm font-medium text-slate-800">Estetty pääsy</span>
                      </label>
                      {jvaDenied && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Henkilöä</span>
                          <input
                            type="number"
                            min="1"
                            value={jvaDeniedCount}
                            onChange={(e) => setJvaDeniedCount(e.target.value)}
                            className="w-20 rounded-lg border-slate-300 border p-1.5 text-sm focus:ring-2 focus:ring-amber-500"
                            placeholder="1"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg border transition-colors ${jvaRemoved ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={jvaRemoved}
                          onChange={(e) => { setJvaRemoved(e.target.checked); if (!e.target.checked) setJvaRemovedCount(''); }}
                          className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                        />
                        <span className="text-sm font-medium text-slate-800">Poistettu henkilö</span>
                      </label>
                      {jvaRemoved && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Henkilöä</span>
                          <input
                            type="number"
                            min="1"
                            value={jvaRemovedCount}
                            onChange={(e) => setJvaRemovedCount(e.target.value)}
                            className="w-20 rounded-lg border-slate-300 border p-1.5 text-sm focus:ring-2 focus:ring-amber-500"
                            placeholder="1"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg border transition-colors ${jvaDetained ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={jvaDetained}
                          onChange={(e) => { setJvaDetained(e.target.checked); if (!e.target.checked) setJvaDetainedCount(''); }}
                          className="w-5 h-5 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                        />
                        <span className="text-sm font-medium text-slate-800">Otettu henkilö kiinni</span>
                      </label>
                      {jvaDetained && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Henkilöä</span>
                          <input
                            type="number"
                            min="1"
                            value={jvaDetainedCount}
                            onChange={(e) => setJvaDetainedCount(e.target.value)}
                            className="w-20 rounded-lg border-slate-300 border p-1.5 text-sm focus:ring-2 focus:ring-rose-500"
                            placeholder="1"
                          />
                        </div>
                      )}
                    </div>
                    {jvaDetained && (
                      <p className="text-xs text-rose-700 mt-3 pl-8">
                        Kiinniotetusta on ilmoitettava viipymättä poliisille. Kirjaa poliisin toimenpiteet vapaaseen kuvaukseen.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Voimankäyttö */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">Voimankäyttö</h3>

                <div className={`p-4 rounded-lg border transition-colors ${jvaForce ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={jvaForce}
                      onChange={(e) => setJvaForce(e.target.checked)}
                      className="w-5 h-5 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-800">Käytetty voimakeinoja</span>
                  </label>
                </div>

                <div className={`p-4 rounded-lg border transition-colors ${jvaTools ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={jvaTools}
                      onChange={(e) => { setJvaTools(e.target.checked); if (!e.target.checked) { setJvaToolList([]); setJvaToolOther(''); } }}
                      className="w-5 h-5 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-800">Käytetty voimankäyttövälineitä</span>
                  </label>

                  {jvaTools && (
                    <div className="mt-4 pl-8 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <span className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Mitä välineitä käytettiin</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {jvaTooling.map((tool) => (
                          <label key={tool} className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-rose-300 transition-colors">
                            <input
                              type="checkbox"
                              checked={jvaToolList.includes(tool)}
                              onChange={() => toggleJvaTool(tool)}
                              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                            />
                            <span className="text-sm text-slate-700">{tool}</span>
                          </label>
                        ))}
                      </div>
                      {jvaToolList.includes('Muu') && (
                        <input
                          type="text"
                          value={jvaToolOther}
                          onChange={(e) => setJvaToolOther(e.target.value)}
                          className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-rose-500"
                          placeholder="Tarkenna muu väline"
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className={`p-4 rounded-lg border transition-colors ${jvaFirearm ? 'bg-rose-100 border-rose-300' : 'bg-slate-50 border-slate-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={jvaFirearm}
                      onChange={(e) => setJvaFirearm(e.target.checked)}
                      className="w-5 h-5 rounded text-rose-700 focus:ring-rose-600 border-slate-300"
                    />
                    <span className="text-sm font-bold text-slate-900">Otettu esille tai käytetty ampuma-asetta</span>
                  </label>
                  {jvaFirearm && (
                    <div className="mt-3 pl-8 flex gap-2 text-xs text-rose-800 bg-white/70 border border-rose-200 rounded-lg p-3">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <span>
                        Ilmoita välittömästi turvallisuuspäällikölle ja hätäkeskukseen. Ampuma-aseen esille ottaminen ja
                        käyttö edellyttävät erillistä selvitystä ja poliisille tehtävää ilmoitusta.
                      </span>
                    </div>
                  )}
                </div>

                <div className={`p-4 rounded-lg border transition-colors ${jvaFirstAid ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={jvaFirstAid}
                      onChange={(e) => setJvaFirstAid(e.target.checked)}
                      className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-800">Kohdehenkilö viety ensiapuun tai ensihoitoa käytetty</span>
                  </label>
                  {jvaFirstAid && (
                    <p className="text-xs text-emerald-800 mt-3 pl-8">
                      Tee lisäksi erillinen ensiaputilanteen kirjaus TIKE-valikosta.
                    </p>
                  )}
                </div>
              </div>

              {/* Vapaa kuvaus */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Vapaa kuvaus tapahtumasta</label>
                <textarea
                  rows="5"
                  value={jvaDesc}
                  onChange={(e) => setJvaDesc(e.target.value)}
                  className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder="Kuvaa tapahtuman kulku aikajärjestyksessä: mitä havaittiin, mitä tehtiin, miten tilanne päättyi ja ketkä osallistuivat."
                ></textarea>
                <p className="text-xs text-slate-500 mt-1">
                  Kirjaa vain seurannan kannalta tarpeelliset tiedot. Kohdehenkilöiden henkilötiedot kirjataan tapahtumailmoitukseen.
                </p>
              </div>

              {/* Kuittaus tapahtumailmoituksesta */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={jvaReporterFiled}
                    onChange={(e) => setJvaReporterFiled(e.target.checked)}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 mt-0.5"
                  />
                  <span className="text-sm text-indigo-900">
                    Toimenpiteen suorittaja on ilmoittanut täyttäneensä oman tapahtumailmoituksensa
                  </span>
                </label>
                {!jvaReporterFiled && (jvaDetained || jvaForce || jvaTools || jvaFirearm) && (
                  <p className="text-xs text-indigo-700 mt-2 pl-8">
                    Muistuta toimenpiteen suorittajaa tapahtumailmoituksesta ennen vuoron päättymistä.
                  </p>
                )}
              </div>

              {/* Toiminnot */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { resetJvaForm(); setActiveTab('report_tike'); }}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Peruuta
                </button>
                <button
                  type="button"
                  onClick={handleSaveJvaReport}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  <CheckCircle size={18} />
                  Tallenna toimenpidekirjaus
                </button>
              </div>
            </form>
          </div>
        );
      }
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
                <p className="text-sm text-slate-500 mt-1">
                  Sisäänkirjattuna {checkedInEmployees.length} hlö (JV {jvCount}, vartijat {guardCount}). Rekisterissä {mockEmployees.length} hlö.
                </p>
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
                    <th className="p-4">Rooli</th>
                    <th className="p-4">Sisäänkirjattu</th>
                    <th className="p-4">Yksilötunnus</th>
                    <th className="p-4">Varusteet</th>
                    <th className="p-4 text-right">Toiminnot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {checkedInEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-slate-500">
                        Ei sisäänkirjattuja työntekijöitä. Kirjaus tehdään kohdassa Raportointi &rarr; TIKE &rarr; Työntekijän sisäänkirjaus.
                      </td>
                    </tr>
                  ) : checkedInEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-white transition-colors">
                      <td className="p-4 font-medium text-slate-800">{emp.name}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ring-1 ring-inset ${emp.role === 'Järjestyksenvalvoja' ? 'bg-indigo-50 text-indigo-700 ring-indigo-700/10' : 'bg-slate-100 text-slate-700 ring-slate-700/10'}`}>
                          {emp.role}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-600">{emp.checkInTime || '-'}</td>
                      <td className="p-4 text-slate-600">{emp.badge || '-'}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {emp.vest && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">Liivi</span>}
                          {emp.headset && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">Headset</span>}
                          {emp.radio && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">{emp.radio}</span>}
                          {!emp.vest && !emp.headset && !emp.radio && <span className="text-xs text-slate-400">-</span>}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => { setEditingEmp(emp); setActiveTab('planning_employee_new'); }}
                            className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                          >
                            Muokkaa
                          </button>
                          <button 
                            onClick={() => setCheckedInEmployees(prev => prev.filter(e => e.id !== emp.id))}
                            className="text-rose-600 hover:text-rose-800 font-medium text-xs bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-md transition-colors"
                          >
                            Kirjaa ulos
                          </button>
                        </div>
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
      case 'documents': {
        const documentOptions = [
          { id: 'forms', label: 'Täytettävät lomakkeet', icon: Clipboard, color: 'text-indigo-600', bg: 'bg-indigo-50', desc: 'Tapahtumailmoitukset, tarkastuslistat ja viranomaislomakkeet.' },
          { id: 'pdf', label: 'Raporttien PDF-versiot', icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50', desc: 'Valmiit kirjaukset arkistointia ja toimeksiantajaa varten.' },
          { id: 'trash', label: 'Roskakori', icon: Archive, color: 'text-slate-600', bg: 'bg-slate-100', desc: 'Poistetut kirjaukset ja asiakirjat säilytysajan loppuun asti.' },
          { id: 'emergency', label: 'Hätätilanneohjeet', icon: ShieldAlert, color: 'text-rose-600', bg: 'bg-rose-50', desc: 'Toimintakortit poikkeus- ja hätätilanteisiin.' },
          { id: 'risk', label: 'Riskiarviointi', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', desc: 'Tehdyt riskiarviot ja uuden riskin arviointi laskurilla.' }
        ];

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <div className="mb-8 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-indigo-500" size={24} />
                Lomakkeet ja asiakirjat
              </h2>
              <p className="text-sm text-slate-500 mt-1">Valitse asiakirjaryhmä.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {documentOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => setActiveTab(`documents_${option.id}`)}
                    className="flex flex-col items-start p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all text-left group bg-white"
                  >
                    <div className={`p-3 rounded-lg mb-4 transition-transform ${option.bg} ${option.color} group-hover:scale-110 duration-200`}>
                      <Icon size={24} />
                    </div>
                    <span className="font-bold text-slate-800 text-sm">{option.label}</span>
                    <span className="text-xs text-slate-500 mt-1">{option.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      }
      case 'documents_risk': {
        const riskOptions = [
          { id: 'risk_done', label: 'Tehdyt riskiarviot', icon: Archive, color: 'text-indigo-600', bg: 'bg-indigo-50', desc: 'Aiemmin laaditut riskiarviot ja niiden toimenpiteet.' },
          { id: 'risk_new', label: 'Riskin arviointi', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', desc: 'Arvioi yksittäinen riski laskurilla ja kirjaa toimenpiteet.' }
        ];

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <button
              onClick={() => setActiveTab('documents')}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin asiakirjavalikkoon
            </button>

            <div className="mb-8 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={24} />
                Riskiarviointi
              </h2>
              <p className="text-sm text-slate-500 mt-1">Tapahtuman vaarojen tunnistaminen, riskien suuruuden arviointi ja toimenpiteet.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {riskOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => setActiveTab(`documents_${option.id}`)}
                    className="flex flex-col items-start p-5 rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all text-left group bg-white"
                  >
                    <div className={`p-3 rounded-lg mb-4 transition-transform ${option.bg} ${option.color} group-hover:scale-110 duration-200`}>
                      <Icon size={24} />
                    </div>
                    <span className="font-bold text-slate-800 text-sm">{option.label}</span>
                    <span className="text-xs text-slate-500 mt-1">{option.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      }
      case 'documents_risk_done': {
        const doneAssessments = [
          { id: '26/FesX/RA/001', name: 'Yleisön puristuminen etualueella', category: 'Väkijoukko', score: 4, author: 'Ismo Näkki', date: '02.08.2026', status: 'Toimenpiteet kesken' },
          { id: '26/FesX/RA/002', name: 'Lavarakenteiden asennus ja nostotyöt', category: 'Työturvallisuus', score: 3, author: 'Liisa Ollila', date: '28.07.2026', status: 'Hyväksytty' },
          { id: '26/FesX/RA/003', name: 'Anniskelualueen järjestyshäiriöt', category: 'Järjestys', score: 3, author: 'Ismo Näkki', date: '30.07.2026', status: 'Hyväksytty' },
          { id: '26/FesX/RA/004', name: 'Ukkospuuska ja rakenteiden kestävyys', category: 'Sää', score: 5, author: 'Jaakko Mäki', date: '05.08.2026', status: 'Toimenpiteet kesken' },
          { id: '26/FesX/RA/005', name: 'Löytötavaroiden ja epäilyttävien esineiden käsittely', category: 'Turvatoimet', score: 2, author: 'Maria Lohi', date: '01.08.2026', status: 'Hyväksytty' }
        ];

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <button
              onClick={() => setActiveTab('documents_risk')}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin riskiarviointiin
            </button>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Archive className="text-indigo-500" size={24} />
                  Tehdyt riskiarviot
                </h2>
                <p className="text-sm text-slate-500 mt-1">{doneAssessments.length} arviota. Demoaineistoa.</p>
              </div>
              <button
                onClick={() => setActiveTab('documents_risk_new')}
                className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus size={16} />
                Uusi riskiarvio
              </button>
            </div>

            <div className="space-y-3">
              {doneAssessments.map((ra) => {
                const level = riskLevels[ra.score];
                const tone = riskTones[level.tone];
                return (
                  <button
                    key={ra.id}
                    onClick={() => alert(`Demo: riskiarvion ${ra.id} avaaminen toteutetaan taustajärjestelmän kanssa.`)}
                    className="w-full text-left bg-slate-50 hover:bg-white border border-slate-200 hover:border-amber-300 hover:shadow-sm rounded-xl p-4 transition-all flex items-center gap-4"
                  >
                    <div className={`shrink-0 w-12 h-12 rounded-lg ${tone.solid} text-white font-bold text-xl flex items-center justify-center`}>
                      {ra.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800 text-sm">{ra.name}</span>
                        <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded">{ra.category}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex gap-3 flex-wrap">
                        <span className="font-mono">{ra.id}</span>
                        <span>{ra.author}</span>
                        <span>{ra.date}</span>
                      </div>
                    </div>
                    <div className="hidden sm:block text-right shrink-0">
                      <div className={`text-xs font-bold ${tone.text}`}>{level.label}</div>
                      <div className={`text-xs mt-1 px-2 py-0.5 rounded inline-block ${ra.status === 'Hyväksytty' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {ra.status}
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-400 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      }
      case 'documents_risk_new': {
        const probLabels = [
          { value: 1, label: 'Epätodennäköinen', desc: 'Tapahtuu harvoin ja epäsäännöllisesti' },
          { value: 2, label: 'Mahdollinen', desc: 'Tapahtuu joskus, ei kuitenkaan säännöllisesti' },
          { value: 3, label: 'Todennäköinen', desc: 'Tapahtuu usein tai toistuvasti' }
        ];
        const sevLabels = [
          { value: 1, label: 'Vähäiset', desc: 'Ohimenevä haitta, ei hoidon tarvetta' },
          { value: 2, label: 'Haitalliset', desc: 'Hoitoa vaativa vamma tai merkittävä häiriö' },
          { value: 3, label: 'Vakavat', desc: 'Pysyvä vamma, kuolema tai toiminnan keskeytyminen' }
        ];

        const score = getRiskScore(raProb, raSev);
        const level = score ? riskLevels[score] : null;
        const tone = level ? riskTones[level.tone] : null;

        const resScore = getRiskScore(raResProb, raResSev);
        const resLevel = resScore ? riskLevels[resScore] : null;
        const resTone = resLevel ? riskTones[resLevel.tone] : null;

        const inputCls = "w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-amber-500";
        const labelCls = "block text-sm font-bold text-slate-700 mb-1.5";

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <button
              onClick={() => setActiveTab('documents_risk')}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin riskiarviointiin
            </button>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={24} />
                  Riskin arviointi
                </h2>
                <p className="text-sm text-slate-500 mt-1">Tunnista vaara, arvioi riskin suuruus ja kirjaa toimenpiteet.</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Tunniste</span>
                <div className="text-sm font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
                  {getDynamicId()}
                </div>
              </div>
            </div>

            <form className="space-y-6">

              {/* Kohde ja vaara */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">1. Vaaran tunnistaminen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Kohde tai toiminto</label>
                    <input type="text" className={inputCls} value={raTarget} onChange={(e) => setRaTarget(e.target.value)} placeholder="Esim. Lava 1 etualue, Portti 2, rakennusvaihe" />
                  </div>
                  <div>
                    <label className={labelCls}>Riskiluokka</label>
                    <select className={inputCls} value={raCategory} onChange={(e) => setRaCategory(e.target.value)}>
                      <option value="">Valitse</option>
                      <option value="Väkijoukko">Väkijoukko</option>
                      <option value="Järjestys">Järjestyshäiriöt ja väkivalta</option>
                      <option value="Työturvallisuus">Työturvallisuus</option>
                      <option value="Paloturvallisuus">Paloturvallisuus</option>
                      <option value="Sää">Sää ja luonnonolosuhteet</option>
                      <option value="Terveys">Terveys ja ensiapu</option>
                      <option value="Liikenne">Liikenne ja pysäköinti</option>
                      <option value="Tekniikka">Tekniikka ja sähkö</option>
                      <option value="Turvatoimet">Turvatoimet ja tarkastukset</option>
                      <option value="Muu">Muu</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Vaaran kuvaus</label>
                  <textarea rows="3" className={inputCls} value={raHazard} onChange={(e) => setRaHazard(e.target.value)} placeholder="Mikä voi mennä pieleen, kenelle ja missä tilanteessa."></textarea>
                </div>
                <div>
                  <label className={labelCls}>Nykyiset hallintakeinot</label>
                  <textarea rows="3" className={inputCls} value={raControls} onChange={(e) => setRaControls(e.target.value)} placeholder="Mitä on jo tehty: aidat, miehitys, opastus, ohjeistus, tekniset ratkaisut."></textarea>
                </div>
              </div>

              {/* Laskuri */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">2. Riskin suuruus</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <span className={labelCls}>Todennäköisyys</span>
                    <div className="space-y-2">
                      {probLabels.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setRaProb(p.value)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${raProb === p.value ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${raProb === p.value ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                              {p.value}
                            </span>
                            <span className="text-sm font-medium text-slate-800">{p.label}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 pl-8">{p.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className={labelCls}>Seurausten vakavuus</span>
                    <div className="space-y-2">
                      {sevLabels.map((v) => (
                        <button
                          key={v.value}
                          type="button"
                          onClick={() => setRaSev(v.value)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${raSev === v.value ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${raSev === v.value ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                              {v.value}
                            </span>
                            <span className="text-sm font-medium text-slate-800">{v.label}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 pl-8">{v.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Matriisi */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Riskimatriisi</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-center text-sm border-collapse">
                      <thead>
                        <tr>
                          <th className="p-2 text-xs text-slate-500 font-medium text-left">Todennäköisyys \ Seuraukset</th>
                          {sevLabels.map((v) => (
                            <th key={v.value} className="p-2 text-xs text-slate-600 font-semibold">{v.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {probLabels.map((p) => (
                          <tr key={p.value}>
                            <td className="p-2 text-xs text-slate-600 font-semibold text-left">{p.label}</td>
                            {sevLabels.map((v) => {
                              const cellScore = riskMatrix[p.value - 1][v.value - 1];
                              const cellTone = riskTones[riskLevels[cellScore].tone];
                              const active = raProb === p.value && raSev === v.value;
                              return (
                                <td key={v.value} className="p-1">
                                  <button
                                    type="button"
                                    onClick={() => { setRaProb(p.value); setRaSev(v.value); }}
                                    className={`w-full py-3 rounded-lg font-bold text-white transition-all ${cellTone.solid} ${active ? 'ring-4 ring-slate-800 scale-105' : 'opacity-60 hover:opacity-100'}`}
                                  >
                                    {cellScore}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500 mt-3">
                    Riskin suuruus on todennäköisyyden ja seurausten vakavuuden yhdistelmä asteikolla 1-5.
                  </p>
                </div>

                {/* Tulos */}
                {level ? (
                  <div className={`rounded-xl border-2 p-5 ${tone.bg} ${tone.border}`}>
                    <div className="flex items-center gap-4">
                      <div className={`shrink-0 w-16 h-16 rounded-xl ${tone.solid} text-white font-bold text-3xl flex items-center justify-center shadow-sm`}>
                        {score}
                      </div>
                      <div>
                        <div className={`text-lg font-bold ${tone.text}`}>{level.label}</div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          Todennäköisyys {raProb} ja seuraukset {raSev}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 mt-4 pt-4 border-t border-white/60">
                      <span className="font-bold">Toimintaohje: </span>{level.action}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-slate-300 p-8 text-center">
                    <p className="text-sm text-slate-500">Valitse todennäköisyys ja seurausten vakavuus, niin riskin suuruus lasketaan.</p>
                  </div>
                )}
              </div>

              {/* Toimenpiteet */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">3. Toimenpiteet</h3>
                <div>
                  <label className={labelCls}>Päätetyt toimenpiteet riskin pienentämiseksi</label>
                  <textarea rows="4" className={inputCls} value={raActions} onChange={(e) => setRaActions(e.target.value)} placeholder="Konkreettiset toimet: lisämiehitys, rakenteelliset muutokset, ohjeistus, seuranta, keskeytyskriteerit."></textarea>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Vastuuhenkilö</label>
                    <input type="text" className={inputCls} value={raOwner} onChange={(e) => setRaOwner(e.target.value)} placeholder="Nimi ja rooli" />
                  </div>
                  <div>
                    <label className={labelCls}>Toteutettava viimeistään</label>
                    <input type="date" className={inputCls} value={raDeadline} onChange={(e) => setRaDeadline(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Jäännösriski */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">4. Jäännösriski toimenpiteiden jälkeen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Todennäköisyys toimenpiteiden jälkeen</label>
                    <select className={inputCls} value={raResProb} onChange={(e) => setRaResProb(Number(e.target.value))}>
                      <option value={0}>Valitse</option>
                      {probLabels.map((p) => <option key={p.value} value={p.value}>{p.value} {p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Seuraukset toimenpiteiden jälkeen</label>
                    <select className={inputCls} value={raResSev} onChange={(e) => setRaResSev(Number(e.target.value))}>
                      <option value={0}>Valitse</option>
                      {sevLabels.map((v) => <option key={v.value} value={v.value}>{v.value} {v.label}</option>)}
                    </select>
                  </div>
                </div>

                {resLevel && (
                  <div className={`rounded-xl border p-4 flex items-center gap-4 ${resTone.bg} ${resTone.border}`}>
                    <div className={`shrink-0 w-12 h-12 rounded-lg ${resTone.solid} text-white font-bold text-xl flex items-center justify-center`}>
                      {resScore}
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-bold ${resTone.text}`}>{resLevel.label}</div>
                      {score > 0 && (
                        <div className="text-xs text-slate-600 mt-0.5">
                          {resScore < score
                            ? `Riski pienenee ${score} tasolta tasolle ${resScore}.`
                            : resScore === score
                              ? 'Toimenpiteet eivät pienennä riskiä. Harkitse tehokkaampia keinoja.'
                              : `Jäännösriski on suurempi kuin alkuperäinen. Tarkista arviointi.`}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {resScore >= 4 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3">
                    <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={18} />
                    <div className="text-sm text-rose-900">
                      Jäännösriski on edelleen merkittävä tai sietämätön. Vie arvio turvallisuuspäällikön ja toimeksiantajan
                      käsittelyyn ennen toiminnan aloittamista.
                    </div>
                  </div>
                )}
              </div>

              {/* Toiminnot */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { resetRiskForm(); setActiveTab('documents_risk'); }}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Peruuta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!raTarget.trim() || !raHazard.trim()) {
                      alert('Kirjaa vähintään kohde ja vaaran kuvaus.');
                      return;
                    }
                    if (!score) {
                      alert('Valitse todennäköisyys ja seurausten vakavuus.');
                      return;
                    }
                    alert('Demo: riskiarvio ei vielä tallennu taustajärjestelmään.');
                  }}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  <CheckCircle size={18} />
                  Tallenna riskiarvio
                </button>
              </div>
            </form>
          </div>
        );
      }
      case 'documents_forms': {
        const fillableForms = [
          { name: 'Tapahtumailmoitus', desc: 'JV:n tai vartijan oma ilmoitus toimenpiteestä.', tag: 'Viranomaislomake' },
          { name: 'Kiinniottoilmoitus', desc: 'Kiinniotetun luovutus poliisille.', tag: 'Viranomaislomake' },
          { name: 'Voimankäyttöselvitys', desc: 'Selvitys voimakeinojen ja välineiden käytöstä.', tag: 'Sisäinen' },
          { name: 'Ensiapukaavake', desc: 'Ensiaputilanteen kirjaus ja jatkotoimet.', tag: 'Sisäinen' },
          { name: 'Vahinkoilmoitus', desc: 'Omaisuusvaurio ja vastuukysymykset.', tag: 'Sisäinen' },
          { name: 'Löytötavarailmoitus', desc: 'Vastaanotettu tai luovutettu löytötavara.', tag: 'Sisäinen' },
          { name: 'Perehdytyslomake', desc: 'Työntekijän perehdytys ja kuittaus.', tag: 'Sisäinen' },
          { name: 'Vuoron luovutus', desc: 'Vuoronvaihdon tilannekatsaus ja avoimet asiat.', tag: 'Sisäinen' }
        ];

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <button
              onClick={() => setActiveTab('documents')}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin asiakirjavalikkoon
            </button>

            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Clipboard className="text-indigo-500" size={24} />
                Täytettävät lomakkeet
              </h2>
              <p className="text-sm text-slate-500 mt-1">Avaa lomake täytettäväksi tai tulosta tyhjä pohja.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200">
              {fillableForms.map((form, idx) => (
                <div key={idx} className="p-4 flex justify-between items-center gap-4 flex-wrap hover:bg-white transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800 text-sm">{form.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${form.tag === 'Viranomaislomake' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {form.tag}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{form.desc}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors">
                      Täytä
                    </button>
                    <button className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors">
                      Tyhjä pohja
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }
      case 'documents_pdf':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <button
              onClick={() => setActiveTab('documents')}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin asiakirjavalikkoon
            </button>

            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-emerald-500" size={24} />
                Raporttien PDF-versiot
              </h2>
              <p className="text-sm text-slate-500 mt-1">Tallennetut kirjaukset PDF-muodossa. Tunniste vastaa alkuperäistä kirjausta.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Tunniste</th>
                    <th className="p-4">Tyyppi</th>
                    <th className="p-4">Laatija</th>
                    <th className="p-4">Aika</th>
                    <th className="p-4 text-right">Toiminnot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-white transition-colors">
                      <td className="p-4 font-mono text-xs text-slate-700">{report.id}</td>
                      <td className="p-4 font-medium text-slate-800">{report.type}</td>
                      <td className="p-4 text-slate-600">{report.author}</td>
                      <td className="p-4 font-mono text-slate-600">{report.time}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors">
                            Avaa PDF
                          </button>
                          <button className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors">
                            Lataa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-500 mt-4">
              PDF-tiedostot sisältävät henkilötietoja. Käsittele ja jaa vain toimeksiannon edellyttämässä laajuudessa.
            </p>
          </div>
        );
      case 'documents_trash':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <button
              onClick={() => setActiveTab('documents')}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin asiakirjavalikkoon
            </button>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Archive className="text-slate-500" size={24} />
                  Roskakori
                </h2>
                <p className="text-sm text-slate-500 mt-1">Poistetut kirjaukset ja asiakirjat.</p>
              </div>
              <button className="px-4 py-2 text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors">
                Tyhjennä roskakori
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
              <Archive className="text-slate-300 mx-auto mb-3" size={40} />
              <p className="text-sm font-medium text-slate-600">Roskakori on tyhjä.</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Poistetut asiakirjat näkyvät täällä. Kirjauksia ei poisteta lopullisesti ennen säilytysajan päättymistä.
              </p>
            </div>

            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-amber-900">
                Turvallisuusalan kirjauksilla on lakisääteinen säilytysaika. Tarkista säilytys- ja poistokäytännöt
                toimeksiantajan tietosuojaselosteesta ennen roskakorin tyhjentämistä.
              </div>
            </div>
          </div>
        );
      case 'documents_emergency': {
        const emergencyCards = [
          { title: 'Kaikkien alueiden evakuointi', icon: DoorOpen, tone: 'rose', steps: ['Vahvista päätös turvallisuuspäälliköltä', 'Pysäytä esitys ja anna kuulutus', 'Avaa kaikki hätäpoistumistiet', 'Ohjaa yleisö kokoontumispaikoille', 'Kuittaa alueiden tyhjeneminen TIKE:lle'] },
          { title: 'Tulipalo', icon: AlertTriangle, tone: 'amber', steps: ['Hätäilmoitus 112', 'Rajaa alue ja estä pääsy', 'Alkusammutus jos turvallista', 'Opasta pelastuslaitos paikalle', 'Kirjaa tapahtuma-aika ja toimenpiteet'] },
          { title: 'Väkijoukon puristuminen', icon: Users, tone: 'rose', steps: ['Keskeytä esitys välittömästi', 'Avaa sivukäytävät ja purkureitit', 'Ohjaa yleisö taaksepäin kuulutuksella', 'Hälytä ensiapu etualueelle', 'Kirjaa tiheysarvio ja aika'] },
          { title: 'Vakava väkivaltatilanne', icon: ShieldAlert, tone: 'rose', steps: ['Hätäilmoitus 112', 'Suojaa ja siirrä yleisö pois alueelta', 'Älä lähesty ilman poliisia', 'Varmista kohteen tiedot ja kulkusuunta', 'Säilytä tallenteet ja havainnot'] },
          { title: 'Sähkökatko', icon: Wrench, tone: 'slate', steps: ['Varmista varavalaistus', 'Siirry radioyhteyteen', 'Estä pääsy pimeille alueille', 'Ota yhteys tekniseen vastaavaan', 'Arvioi tarve keskeyttää tapahtuma'] },
          { title: 'Sään äkillinen muutos', icon: Cloud, tone: 'sky', steps: ['Seuraa varoituksia', 'Tarkista rakenteiden kiinnitykset', 'Valmistele suojautumisohjeet', 'Harkitse esityksen keskeytystä', 'Tiedota yleisölle ajoissa'] }
        ];
        const toneMap = {
          rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600', num: 'bg-rose-600' },
          amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', num: 'bg-amber-600' },
          slate: { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-600', num: 'bg-slate-600' },
          sky: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-600', num: 'bg-sky-600' }
        };

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <button
              onClick={() => setActiveTab('documents')}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin asiakirjavalikkoon
            </button>

            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <ShieldAlert className="text-rose-500" size={24} />
                Hätätilanneohjeet
              </h2>
              <p className="text-sm text-slate-500 mt-1">Toimintakortit. Nämä eivät korvaa tapahtuman pelastussuunnitelmaa.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {emergencyCards.map((card, idx) => {
                const Icon = card.icon;
                const tone = toneMap[card.tone];
                return (
                  <div key={idx} className={`rounded-xl border p-5 ${tone.bg} ${tone.border}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={tone.text} size={20} />
                      <h3 className="font-bold text-slate-800 text-sm">{card.title}</h3>
                    </div>
                    <ol className="space-y-2">
                      {card.steps.map((step, sIdx) => (
                        <li key={sIdx} className="flex gap-2 text-sm text-slate-700">
                          <span className={`shrink-0 w-5 h-5 rounded-full ${tone.num} text-white text-xs font-bold flex items-center justify-center mt-0.5`}>
                            {sIdx + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 bg-slate-800 rounded-xl p-5 text-white">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <PhoneCall size={18} className="text-rose-400" />
                Hätänumerot
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="bg-slate-700 rounded-lg p-3">
                  <div className="text-2xl font-bold">112</div>
                  <div className="text-xs text-slate-300 mt-0.5">Hätäkeskus</div>
                </div>
                <div className="bg-slate-700 rounded-lg p-3">
                  <div className="font-bold">Turva 1</div>
                  <div className="text-xs text-slate-300 mt-0.5">Turvallisuuspäällikkö</div>
                </div>
                <div className="bg-slate-700 rounded-lg p-3">
                  <div className="font-bold">TIKE</div>
                  <div className="text-xs text-slate-300 mt-0.5">Tilannekeskus</div>
                </div>
                <div className="bg-slate-700 rounded-lg p-3">
                  <div className="font-bold">EA-päivystys</div>
                  <div className="text-xs text-slate-300 mt-0.5">Ensiapupiste 1</div>
                </div>
              </div>
            </div>
          </div>
        );
      }
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

  // ====================== TAPAHTUMAN VALINTA ======================
  if (selectedEvent === null) {
    const eventCards = [
      {
        id: 'fesx',
        name: 'FestivaaliX',
        status: 'Käynnissä',
        statusTone: 'bg-emerald-100 text-emerald-700',
        dates: '11.8.–13.8.2026',
        place: 'Ratinan suvanto, Tampere',
        audience: '14 200 hlö / vrk',
        client: 'Tapahtumatuotanto X Oy',
        accent: 'border-emerald-200 hover:border-emerald-400'
      },
      {
        id: 'feso',
        name: 'FestivaaliÖ',
        status: 'Suunnittelu',
        statusTone: 'bg-slate-200 text-slate-700',
        dates: '5.9.–6.9.2026',
        place: 'Ei vahvistettu',
        audience: 'Arvio puuttuu',
        client: 'Mallitoimeksiantaja',
        accent: 'border-slate-200 hover:border-indigo-400'
      }
    ];

    return (
      <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
        <nav className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-indigo-400" size={28} />
            <div>
              <h1 className="text-xl font-bold leading-tight tracking-tight">Turvajohto OS</h1>
              <p className="hidden md:block text-xs text-slate-400 font-medium">Tapahtumaturvallisuuden hallintatyökalu</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg">
              <Clock size={16} className="text-indigo-400" />
              <span className="font-mono text-sm tracking-widest">{formatTime(currentTime)}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">
              TJ
            </div>
          </div>
        </nav>

        <main className="flex-1 p-6 md:p-10">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-800">Valitse tapahtuma</h2>
              <p className="text-sm text-slate-500 mt-1">
                Avaa olemassa oleva tapahtuma tai luo uusi toimeksianto. Kaikki kirjaukset kohdistuvat valittuun tapahtumaan.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {eventCards.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => { setSelectedEvent(ev.id); setActiveTab('landing'); }}
                  className={`bg-white rounded-xl border-2 ${ev.accent} shadow-sm hover:shadow-md transition-all p-6 text-left group`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform duration-200">
                      <Layers size={24} />
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ev.statusTone}`}>
                      {ev.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">{ev.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{ev.client}</p>

                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar size={15} className="text-slate-400 shrink-0" />
                      <span>{ev.dates}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Map size={15} className="text-slate-400 shrink-0" />
                      <span>{ev.place}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Users size={15} className="text-slate-400 shrink-0" />
                      <span>{ev.audience}</span>
                    </div>
                  </dl>

                  <div className="mt-5 pt-4 border-t border-slate-100 text-sm font-bold text-indigo-600 flex items-center gap-1">
                    Avaa tapahtuma
                    <ChevronRight size={16} />
                  </div>
                </button>
              ))}

              <button
                onClick={() => setSelectedEvent('new')}
                className="bg-white rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all p-6 text-left group flex flex-col justify-center items-center min-h-[240px]"
              >
                <div className="p-4 rounded-full bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors mb-4">
                  <Plus size={28} />
                </div>
                <h3 className="text-lg font-bold text-slate-700 group-hover:text-indigo-700">Luo uusi tapahtuma</h3>
                <p className="text-xs text-slate-500 mt-1 text-center max-w-xs">
                  Kerää toimeksiannon perustiedot ja riskiprofiili aloituslomakkeella.
                </p>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ====================== UUDEN TAPAHTUMAN LOMAKE ======================
  if (selectedEvent === 'new') {
    const inputCls = "w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500";
    const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";
    const sectionCls = "bg-white rounded-xl border border-slate-200 shadow-sm p-6";
    const headCls = "text-md font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2";

    return (
      <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
        <nav className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-indigo-400" size={28} />
            <h1 className="text-xl font-bold leading-tight tracking-tight">Turvajohto OS</h1>
          </div>
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">TJ</div>
        </nav>

        <main className="flex-1 p-6 md:p-10">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => { setSelectedEvent(null); setNewEvent(emptyNewEvent); }}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft size={16} />
              Takaisin tapahtumavalintaan
            </button>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Luo uusi tapahtuma</h2>
              <p className="text-sm text-slate-500 mt-1">
                Toimeksiannon aloituslomake. Tiedot muodostavat pohjan turvallisuussuunnittelulle ja resurssimitoitukselle.
              </p>
            </div>

            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-amber-900">
                <span className="font-bold">Demo.</span> Lomake ei vielä tallenna tietoja eikä luo uutta tapahtumaa.
                Tallennus kytketään käyttöön, kun taustajärjestelmä on toteutettu.
              </div>
            </div>

            <form className="space-y-6">

              {/* 1. Toimeksiantaja */}
              <div className={sectionCls}>
                <h3 className={headCls}><Briefcase size={18} className="text-indigo-500" />1. Toimeksiantajan viralliset tiedot</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Yrityksen tai yhdistyksen virallinen nimi</label>
                    <input type="text" className={inputCls} value={newEvent.clientName} onChange={(e) => updNewEvent('clientName', e.target.value)} placeholder="Esim. Tapahtumatuotanto X Oy" />
                  </div>
                  <div>
                    <label className={labelCls}>Y-tunnus</label>
                    <input type="text" className={inputCls} value={newEvent.businessId} onChange={(e) => updNewEvent('businessId', e.target.value)} placeholder="1234567-8" />
                  </div>
                </div>
              </div>

              {/* 2. Yhteyshenkilöt */}
              <div className={sectionCls}>
                <h3 className={headCls}><Users size={18} className="text-indigo-500" />2. Yhteyshenkilöt</h3>

                <div className="mb-5">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Tilaaja</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Nimi</label>
                      <input type="text" className={inputCls} value={newEvent.ordererName} onChange={(e) => updNewEvent('ordererName', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Puhelinnumero</label>
                      <input type="tel" className={inputCls} value={newEvent.ordererPhone} onChange={(e) => updNewEvent('ordererPhone', e.target.value)} placeholder="+358" />
                    </div>
                    <div>
                      <label className={labelCls}>Sähköpostiosoite</label>
                      <input type="email" className={inputCls} value={newEvent.ordererEmail} onChange={(e) => updNewEvent('ordererEmail', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="bg-rose-50 border border-rose-100 rounded-lg p-4">
                  <div className="text-xs font-bold text-rose-700 uppercase tracking-wide mb-1">Päättävä vastuuhenkilö hätätilanteessa</div>
                  <p className="text-xs text-rose-700 mb-3">Henkilö, joka tekee toimeksiantajan puolesta päätökset esimerkiksi keskeytyksestä ja evakuoinnista.</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Nimi</label>
                      <input type="text" className={inputCls} value={newEvent.deciderName} onChange={(e) => updNewEvent('deciderName', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Puhelinnumero</label>
                      <input type="tel" className={inputCls} value={newEvent.deciderPhone} onChange={(e) => updNewEvent('deciderPhone', e.target.value)} placeholder="+358" />
                    </div>
                    <div>
                      <label className={labelCls}>Sähköpostiosoite</label>
                      <input type="email" className={inputCls} value={newEvent.deciderEmail} onChange={(e) => updNewEvent('deciderEmail', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Laskutus */}
              <div className={sectionCls}>
                <h3 className={headCls}><FileText size={18} className="text-indigo-500" />3. Laskutustiedot</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Verkkolaskuosoite</label>
                    <input type="text" className={inputCls} value={newEvent.einvoiceAddress} onChange={(e) => updNewEvent('einvoiceAddress', e.target.value)} placeholder="003712345678" />
                  </div>
                  <div>
                    <label className={labelCls}>Operaattoritunnus</label>
                    <input type="text" className={inputCls} value={newEvent.einvoiceOperator} onChange={(e) => updNewEvent('einvoiceOperator', e.target.value)} placeholder="Esim. 003721291126" />
                  </div>
                  <div>
                    <label className={labelCls}>Viite tai kustannuspaikka</label>
                    <input type="text" className={inputCls} value={newEvent.billingRef} onChange={(e) => updNewEvent('billingRef', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* 4. Tapahtuman nimi ja luonne */}
              <div className={sectionCls}>
                <h3 className={headCls}><Layers size={18} className="text-indigo-500" />4. Tapahtuman virallinen nimi ja luonne</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Tapahtuman virallinen nimi</label>
                    <input type="text" className={inputCls} value={newEvent.eventName} onChange={(e) => updNewEvent('eventName', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Tapahtuman luonne</label>
                    <select className={inputCls} value={newEvent.eventType} onChange={(e) => updNewEvent('eventType', e.target.value)}>
                      <option value="">Valitse</option>
                      <option value="Festivaali">Festivaali</option>
                      <option value="Urheilutapahtuma">Urheilutapahtuma</option>
                      <option value="Yritystapahtuma">Yritystapahtuma</option>
                      <option value="Mielenosoitus">Mielenosoitus</option>
                      <option value="Muu">Muu</option>
                    </select>
                  </div>
                </div>
                {newEvent.eventType === 'Muu' && (
                  <div className="mt-4">
                    <label className={labelCls}>Tarkenna tapahtuman luonne</label>
                    <input type="text" className={inputCls} value={newEvent.eventTypeOther} onChange={(e) => updNewEvent('eventTypeOther', e.target.value)} />
                  </div>
                )}
              </div>

              {/* 5. Ajankohta */}
              <div className={sectionCls}>
                <h3 className={headCls}><Clock size={18} className="text-indigo-500" />5. Ajankohta ja aikataulu</h3>

                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Aukioloajat yleisölle</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                  <div>
                    <label className={labelCls}>Alkaa</label>
                    <div className="flex gap-2">
                      <input type="date" className={inputCls} value={newEvent.publicStartDate} onChange={(e) => updNewEvent('publicStartDate', e.target.value)} />
                      <input type="time" className={inputCls} value={newEvent.publicStartTime} onChange={(e) => updNewEvent('publicStartTime', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Päättyy</label>
                    <div className="flex gap-2">
                      <input type="date" className={inputCls} value={newEvent.publicEndDate} onChange={(e) => updNewEvent('publicEndDate', e.target.value)} />
                      <input type="time" className={inputCls} value={newEvent.publicEndTime} onChange={(e) => updNewEvent('publicEndTime', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                  <div className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">Rakennus- ja purkuajat</div>
                  <p className="text-xs text-amber-800 mb-3">Työturvallisuuden kannalta riskialtteinta aikaa. Kirjaa myös yöaikainen työskentely.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Rakennus alkaa</label>
                      <input type="datetime-local" className={inputCls} value={newEvent.buildStart} onChange={(e) => updNewEvent('buildStart', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Rakennus päättyy</label>
                      <input type="datetime-local" className={inputCls} value={newEvent.buildEnd} onChange={(e) => updNewEvent('buildEnd', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Purku alkaa</label>
                      <input type="datetime-local" className={inputCls} value={newEvent.teardownStart} onChange={(e) => updNewEvent('teardownStart', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Purku päättyy</label>
                      <input type="datetime-local" className={inputCls} value={newEvent.teardownEnd} onChange={(e) => updNewEvent('teardownEnd', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. Tapahtumapaikka */}
              <div className={sectionCls}>
                <h3 className={headCls}><Map size={18} className="text-indigo-500" />6. Tapahtumapaikka</h3>
                <div className="mb-5">
                  <label className={labelCls}>Tarkka osoite</label>
                  <input type="text" className={inputCls} value={newEvent.address} onChange={(e) => updNewEvent('address', e.target.value)} placeholder="Katuosoite, postinumero ja kunta" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Aluetyyppi</label>
                    <select className={inputCls} value={newEvent.areaType} onChange={(e) => updNewEvent('areaType', e.target.value)}>
                      <option value="">Valitse</option>
                      <option value="Sisätila">Sisätila</option>
                      <option value="Ulkotila">Ulkotila</option>
                      <option value="Sisä- ja ulkotila">Sisä- ja ulkotila</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Onko alue aidattu</label>
                    <select className={inputCls} value={newEvent.fenced} onChange={(e) => updNewEvent('fenced', e.target.value)}>
                      <option value="">Valitse</option>
                      <option value="Kyllä, koko alue">Kyllä, koko alue</option>
                      <option value="Osittain">Osittain</option>
                      <option value="Ei">Ei</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label className={labelCls}>Aluerajaukset ja huomiot</label>
                  <textarea rows="3" className={inputCls} value={newEvent.areaNotes} onChange={(e) => updNewEvent('areaNotes', e.target.value)} placeholder="Sisäänkäynnit, VIP-alueet, backstage, yleisen alueen rajapinnat, liikennejärjestelyt."></textarea>
                </div>
              </div>

              {/* 7. Yleisö */}
              <div className={sectionCls}>
                <h3 className={headCls}><Users size={18} className="text-indigo-500" />7. Arvioitu yleisömäärä ja kohderyhmä</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Arvioitu yleisömäärä (hlö)</label>
                    <input type="number" min="0" className={inputCls} value={newEvent.audienceCount} onChange={(e) => updNewEvent('audienceCount', e.target.value)} placeholder="Esim. 14200" />
                    {newEvent.audienceCount && Number(newEvent.audienceCount) > 0 && (
                      <p className="text-xs text-slate-500 mt-1.5">
                        Suuntaa antava mitoitus 1:100 antaa {Math.ceil(Number(newEvent.audienceCount) / 100)} järjestyksenvalvojaa.
                        Lopullisen määrän vahvistaa poliisi.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Ikärakenne</label>
                    <select className={inputCls} value={newEvent.ageProfile} onChange={(e) => updNewEvent('ageProfile', e.target.value)}>
                      <option value="">Valitse</option>
                      <option value="Perhetapahtuma">Perhetapahtuma, kaikenikäisiä</option>
                      <option value="K-18">K-18</option>
                      <option value="Pääosin nuoret">Pääosin nuoret</option>
                      <option value="Pääosin aikuiset">Pääosin aikuiset</option>
                      <option value="Ei rajoitusta">Ei ikärajoitusta</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label className={labelCls}>Kohderyhmän kuvaus</label>
                  <textarea rows="2" className={inputCls} value={newEvent.audienceNotes} onChange={(e) => updNewEvent('audienceNotes', e.target.value)}></textarea>
                </div>
              </div>

              {/* 8. Riskiprofiili */}
              <div className={sectionCls}>
                <h3 className={headCls}><AlertTriangle size={18} className="text-amber-500" />8. Riskiprofiili ja historia</h3>
                <div className="mb-4">
                  <label className={labelCls}>Onko vastaava tapahtuma järjestetty aiemmin</label>
                  <select className={inputCls} value={newEvent.heldBefore} onChange={(e) => updNewEvent('heldBefore', e.target.value)}>
                    <option value="">Valitse</option>
                    <option value="Kyllä, samassa paikassa">Kyllä, samassa paikassa</option>
                    <option value="Kyllä, muualla">Kyllä, muualla</option>
                    <option value="Ei, ensimmäinen kerta">Ei, ensimmäinen kerta</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Aiemmat järjestyshäiriöt, sairaankuljetukset ja poikkeamat</label>
                  <textarea rows="4" className={inputCls} value={newEvent.previousIncidents} onChange={(e) => updNewEvent('previousIncidents', e.target.value)} placeholder="Kirjaa lukumäärät ja tyypit, jos tiedossa. Esimerkiksi poistot, kiinniotot, ensiaputapahtumat ja poliisin tehtävät."></textarea>
                </div>
              </div>

              {/* 9. Anniskelu */}
              <div className={sectionCls}>
                <h3 className={headCls}><Info size={18} className="text-indigo-500" />9. Alkoholin anniskelu</h3>
                <label className="flex items-center gap-3 cursor-pointer bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <input type="checkbox" checked={newEvent.hasBar} onChange={(e) => updNewEvent('hasBar', e.target.checked)} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                  <span className="text-sm font-medium text-slate-800">Alueella on anniskelualue</span>
                </label>
                {newEvent.hasBar && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className={labelCls}>Anniskelusta vastaa</label>
                      <select className={inputCls} value={newEvent.barResponsible} onChange={(e) => updNewEvent('barResponsible', e.target.value)}>
                        <option value="">Valitse</option>
                        <option value="Toimeksiantaja">Toimeksiantaja</option>
                        <option value="Kolmas osapuoli">Kolmas osapuoli</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Anniskeluluvan haltija ja yhteystiedot</label>
                      <input type="text" className={inputCls} value={newEvent.barOperator} onChange={(e) => updNewEvent('barOperator', e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              {/* 10. Esiintyjät */}
              <div className={sectionCls}>
                <h3 className={headCls}><Users size={18} className="text-indigo-500" />10. Esiintyjät ja ohjelmisto</h3>
                <div className="mb-4">
                  <label className={labelCls}>Esiintyjät ja puhujat</label>
                  <textarea rows="3" className={inputCls} value={newEvent.performers} onChange={(e) => updNewEvent('performers', e.target.value)} placeholder="Nimet ja esiintymisajat, jos tiedossa."></textarea>
                </div>
                <div className="space-y-3">
                  <label className={`flex items-center gap-3 cursor-pointer border rounded-lg p-4 transition-colors ${newEvent.reactionRisk ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                    <input type="checkbox" checked={newEvent.reactionRisk} onChange={(e) => updNewEvent('reactionRisk', e.target.checked)} className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-slate-300" />
                    <span className="text-sm font-medium text-slate-800">Ohjelmistossa on esiintyjiä tai puhujia, jotka voivat herättää voimakkaita reaktioita</span>
                  </label>
                  <label className={`flex items-center gap-3 cursor-pointer border rounded-lg p-4 transition-colors ${newEvent.vipGuests ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                    <input type="checkbox" checked={newEvent.vipGuests} onChange={(e) => updNewEvent('vipGuests', e.target.checked)} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                    <span className="text-sm font-medium text-slate-800">Mukana VIP-vieraita, jotka vaativat henkilösuojausta</span>
                  </label>
                </div>
                {(newEvent.reactionRisk || newEvent.vipGuests) && (
                  <div className="mt-4">
                    <label className={labelCls}>Tarkennus suojaustarpeesta</label>
                    <textarea rows="3" className={inputCls} value={newEvent.vipNotes} onChange={(e) => updNewEvent('vipNotes', e.target.value)} placeholder="Kohteet, saapumisreitit, backstage-järjestelyt, mahdolliset uhka-arviot."></textarea>
                  </div>
                )}
              </div>

              {/* 11. Infrastruktuuri */}
              <div className={sectionCls}>
                <h3 className={headCls}><Wrench size={18} className="text-slate-600" />11. Olemassa oleva infrastruktuuri</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                  <div>
                    <label className={labelCls}>Onko alueella kameravalvontaa</label>
                    <select className={inputCls} value={newEvent.existingCctv} onChange={(e) => updNewEvent('existingCctv', e.target.value)}>
                      <option value="">Valitse</option>
                      <option value="Kyllä, hyödynnettävissä">Kyllä, hyödynnettävissä</option>
                      <option value="Kyllä, ei käyttöoikeutta">Kyllä, mutta ei käyttöoikeutta</option>
                      <option value="Ei">Ei</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Kameravalvonnan tarkennus</label>
                    <input type="text" className={inputCls} value={newEvent.cctvNotes} onChange={(e) => updNewEvent('cctvNotes', e.target.value)} placeholder="Kameroiden määrä, kattavuus, valvomon sijainti." />
                  </div>
                </div>
                <div className="mb-4">
                  <label className={labelCls}>Valaistus pimeän aikaan</label>
                  <textarea rows="2" className={inputCls} value={newEvent.lighting} onChange={(e) => updNewEvent('lighting', e.target.value)} placeholder="Kiinteä valaistus, tilapäisvalaistus, pimeät alueet ja lisävalaistuksen tarve."></textarea>
                </div>
                <div>
                  <label className={labelCls}>Poistumisreitit ja pelastustiet</label>
                  <textarea rows="3" className={inputCls} value={newEvent.exitRoutes} onChange={(e) => updNewEvent('exitRoutes', e.target.value)} placeholder="Sijainnit, leveydet, opastus ja pelastusteiden pitäminen vapaana."></textarea>
                </div>
              </div>

              {/* 12. Viranomaisyhteistyö */}
              <div className={sectionCls}>
                <h3 className={headCls}><ShieldAlert size={18} className="text-rose-500" />12. Viranomaisyhteistyö</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                  <div>
                    <label className={labelCls}>Yleisötilaisuusilmoitus poliisille</label>
                    <select className={inputCls} value={newEvent.policeNotification} onChange={(e) => updNewEvent('policeNotification', e.target.value)}>
                      <option value="">Valitse</option>
                      <option value="Tehty">Tehty</option>
                      <option value="Kesken">Kesken</option>
                      <option value="Ei tehty">Ei tehty</option>
                      <option value="Ei tarvita">Ei tarvita</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Pelastussuunnitelma pelastuslaitokselle</label>
                    <select className={inputCls} value={newEvent.rescuePlan} onChange={(e) => updNewEvent('rescuePlan', e.target.value)}>
                      <option value="">Valitse</option>
                      <option value="Tehty">Tehty</option>
                      <option value="Kesken">Kesken</option>
                      <option value="Ei tehty">Ei tehty</option>
                      <option value="Ei tarvita">Ei tarvita</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Kenen vastuulla asiakirjojen laatiminen on</label>
                  <select className={inputCls} value={newEvent.authorityResponsible} onChange={(e) => updNewEvent('authorityResponsible', e.target.value)}>
                    <option value="">Valitse</option>
                    <option value="Toimeksiantaja">Toimeksiantaja</option>
                    <option value="Turva Oy">Turva Oy</option>
                    <option value="Jaettu vastuu">Jaettu vastuu</option>
                  </select>
                </div>
              </div>

              {/* 13. Muut toimijat */}
              <div className={sectionCls}>
                <h3 className={headCls}><Layers size={18} className="text-indigo-500" />13. Muiden toimijoiden läsnäolo</h3>
                <div className="mb-4">
                  <label className={labelCls}>Alueella toimivat muut osapuolet</label>
                  <textarea rows="3" className={inputCls} value={newEvent.otherOperators} onChange={(e) => updNewEvent('otherOperators', e.target.value)} placeholder="Ensiapupäivystys, liikenteenohjaus, lavarakentajat, siivous, ravintolatoimijat. Kirjaa yhteyshenkilöt."></textarea>
                </div>
                <div>
                  <label className={labelCls}>Päävastuu alueen kokonaisturvallisuudesta rakennusvaiheessa</label>
                  <input type="text" className={inputCls} value={newEvent.buildPhaseResponsible} onChange={(e) => updNewEvent('buildPhaseResponsible', e.target.value)} placeholder="Nimi, rooli ja organisaatio" />
                </div>
              </div>

              {/* Toiminnot */}
              <div className="flex justify-end gap-3 pb-6">
                <button
                  type="button"
                  onClick={() => { setNewEvent(emptyNewEvent); setSelectedEvent(null); }}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Peruuta
                </button>
                <button
                  type="button"
                  onClick={() => alert('Demo: lomake ei vielä tallenna tietoja eikä luo uutta tapahtumaa.')}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  <CheckCircle size={18} />
                  Tallenna tapahtuma
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // ====================== MALLITAPAHTUMA FESTIVAALIÖ ======================
  if (selectedEvent === 'feso') {
    const demoNav = [
      { label: 'Tilannekuva', icon: Activity },
      { label: 'Raportointi ja lomakkeet', icon: PenTool },
      { label: 'Ennen Tapahtumaa', icon: Calendar },
      { label: 'FestivaaliÖ', icon: Layers },
      { label: 'Lomakekartoitus', icon: FileText },
      { label: 'Asetukset', icon: Settings }
    ];

    return (
      <div className="min-h-screen bg-slate-50 font-sans">
        <nav className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-4">
            <div className="p-1.5 text-slate-500">
              <Menu size={24} />
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-indigo-400" size={28} />
              <div>
                <h1 className="text-xl font-bold leading-tight tracking-tight">Turvajohto OS</h1>
                <p className="hidden md:block text-xs text-slate-400 font-medium">Tapahtumaturvallisuuden hallintatyökalu</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2 bg-rose-600/50 text-white/70 px-4 py-2 rounded-lg font-bold text-sm cursor-not-allowed">
              <AlertTriangle size={16} />
              <span className="hidden sm:inline">Pikatoiminnot</span>
            </div>
            <button
              onClick={() => setSelectedEvent(null)}
              className="hidden sm:flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
              Vaihda tapahtuma
            </button>
            <div className="hidden md:flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg">
              <Clock size={16} className="text-indigo-400" />
              <span className="font-mono text-sm tracking-widest">{formatTime(currentTime)}</span>
            </div>
            <div className="flex items-center gap-3 border-l border-slate-700 pl-4 sm:pl-6">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">TJ</div>
            </div>
          </div>
        </nav>

        <div className="flex">
          <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-72px)] p-4 hidden md:block">
            <nav className="space-y-1">
              {demoNav.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-400 cursor-not-allowed select-none"
                  >
                    <Icon size={18} />
                    {item.label}
                  </div>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1 p-6 md:p-8">
            <div className="max-w-4xl">
              <div className="mb-6 pb-4 border-b border-slate-200">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <Layers className="text-indigo-500" size={28} />
                  FestivaaliÖ
                </h2>
                <p className="text-sm text-slate-500 mt-1">Mallitapahtuma. Suunnitteluvaihe, tietoja ei ole vielä täydennetty.</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 mb-6">
                <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-amber-900">
                  <span className="font-bold">Tyhjä pohja.</span> Tämä tapahtuma käyttää samaa Turvajohto OS -runkoa,
                  mutta toiminnot eivät ole käytössä. Valikot ja pikatoiminnot on poistettu käytöstä, koska tapahtuman
                  perustiedot puuttuvat.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                {['Aktiiviset järjestyksenvalvojat', 'Avoimet tehtävät', 'Kirjaukset tänään', 'Yleisöarvio'].map((title, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{title}</span>
                      <div className="p-2 rounded-lg bg-slate-50 text-slate-300">
                        <Activity size={18} />
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-slate-300">-</div>
                    <div className="text-xs text-slate-400 mt-1">Ei tietoja</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <Layers className="text-slate-300 mx-auto mb-4" size={48} />
                <h3 className="text-lg font-bold text-slate-700 mb-1">Tapahtuman tiedot puuttuvat</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Täytä toimeksiannon perustiedot, jotta tilannekuva, resurssimitoitus ja raportointi saadaan käyttöön.
                </p>
                <button
                  onClick={() => setSelectedEvent('new')}
                  className="mt-5 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <Plus size={18} />
                  Täytä tapahtuman tiedot
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

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
              <p className="hidden md:block text-xs text-slate-400 font-medium">Tapahtumaturvallisuuden hallintatyökalu</p>
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
              <div className="absolute right-0 mt-3 w-80 bg-slate-800 rounded-xl shadow-xl border border-slate-700 p-5 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-end mb-3">
                  <button onClick={() => setShowQuickActions(false)} className="text-slate-400 hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-5">
                  <button className="w-full py-4 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors flex justify-center items-center gap-2 shadow-sm text-center leading-tight">
                    <AlertTriangle size={20} className="shrink-0" />
                    KAIKKIEN ALUEIDEN EVAKUOINTI
                  </button>

                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <PhoneCall size={14} />
                      Yhteys viranomaisiin
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      <button className="py-3 px-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg transition-colors border border-slate-600 leading-tight">
                        Oma Turva
                      </button>
                      <button className="py-3 px-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg transition-colors border border-slate-600 leading-tight">
                        Turva + VIRA
                      </button>
                      <button className="py-3 px-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg transition-colors border border-slate-600 leading-tight">
                        Varautumis&shy;tilanne
                      </button>
                    </div>
                  </div>

                  <button className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex justify-center items-center gap-2">
                    <Layers size={18} /> Lähetä toimintaohjeita
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => { setSelectedEvent(null); setActiveTab('landing'); setShowQuickActions(false); }}
            className="hidden sm:flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            Vaihda tapahtuma
          </button>

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