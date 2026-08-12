import React, { useState, useEffect, useRef } from 'react';

import { 

&#x20; AlertTriangle, 

&#x20; ShieldCheck, 

&#x20; Activity, 

&#x20; Users, 

&#x20; Clock, 

&#x20; FileText, 

&#x20; PhoneCall,

&#x20; CheckCircle,

&#x20; XCircle,

&#x20; BarChart2,

&#x20; Calendar,

&#x20; Layers,

&#x20; Map,

&#x20; Settings,

&#x20; MessageSquare,

&#x20; ChevronRight,

&#x20; ChevronDown,

&#x20; Info,

&#x20; X,

&#x20; ArrowLeft,

&#x20; LogIn,

&#x20; LogOut,

&#x20; PenTool,

&#x20; HeartPulse,

&#x20; Clipboard,

&#x20; Cloud,

&#x20; ShieldAlert,

&#x20; Package,

&#x20; Wrench,

&#x20; Search,

&#x20; UserPlus,

&#x20; IdCard,

&#x20; UserCheck,

&#x20; Contact,

&#x20; Archive,

&#x20; Camera,

&#x20; Paperclip,

&#x20; FileCheck,

&#x20; Home,

&#x20; DoorOpen,

&#x20; CheckSquare,

&#x20; Menu

} from 'lucide-react';



// --- MOCK DATA ---

const mockAlerts = \[

&#x20; { id: 1, type: 'critical', message: 'Main Stage crowd density > 4 hlö/m²', time: '10:42', location: 'Main Stage' },

&#x20; { id: 2, type: 'warning', message: 'Gate 2 throughput dropping, queue 15m', time: '10:35', location: 'Gate 2' },

&#x20; { id: 3, type: 'info', message: 'Weather update: rain expected at 14:00', time: '10:15', location: 'All Areas' }

];



const mockChecklist = \[

&#x20; { id: 1, task: 'Riskienarviointi päivitetty', status: 'done', category: 'Suunnittelu' },

&#x20; { id: 2, task: 'Pelastussuunnitelma lähetetty', status: 'done', category: 'Luvat' },

&#x20; { id: 3, task: 'JV-mitoitus vahvistettu', status: 'pending', category: 'Resurssit' },

&#x20; { id: 4, task: 'Ensiapupisteet pystytetty', status: 'in-progress', category: 'Operatiivinen' }

];



const mockLogs = \[

&#x20; { id: 101, time: '10:30', user: 'JOKE', action: 'Portit avattu yleisölle' },

&#x20; { id: 102, time: '10:35', user: 'Gate 1', action: 'Kapasiteetti 1500/h saavutettu' },

&#x20; { id: 103, time: '10:42', user: 'Spotter A', action: 'Ilmoitus ruuhkasta Main Stagen edessä' }

];



const mockEmployees = \[

&#x20; "Korhonen Elli Marja Orvokki",

&#x20; "Virtanen Matti Johannes Antero",

&#x20; "Mäkinen Kalle Petteri Aleksi",

&#x20; "Nieminen Anna Sofia Maria",

&#x20; "Lahtinen Oskari Juhani Tapio"

];



const mockCheckedInEmployees = \[

&#x20; { id: 1, name: "Korhonen Elli Marja Orvokki", role: "Järjestyksenvalvoja", vest: true, badge: "1234", headset: true, radio: "R-12" },

&#x20; { id: 2, name: "Virtanen Matti Johannes Antero", role: "Vartija", vest: false, badge: "5521", headset: false, radio: "" },

&#x20; { id: 3, name: "Mäkinen Kalle Petteri Aleksi", role: "Järjestyksenvalvoja", vest: true, badge: "9982", headset: true, radio: "R-05" }

];



const mockReports = \[

&#x20; { id: '26/FesX/1108/099', type: 'Työntekijän uloskirjaus', author: 'TIKE Päivystäjä', time: '14:10', summary: 'Virtanen ulos, radiopuhelin rikki.' },

&#x20; { id: '26/FesX/1108/098', type: 'JV Tapahtumailmoitus', author: 'Korhonen Elli', time: '13:45', summary: 'Kiinniotto portilla 2.' },

&#x20; { id: '26/FesX/1108/097', type: 'Ensiaputilanne', author: 'EA-Päivystys', time: '12:15', summary: 'Nyrjähdys, paikattu pisteellä.' }

];



// --- COMPONENTS ---



const DashboardCard = ({ title, icon: Icon, value, subtitle, trend, trendUp }) => (

&#x20; <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between">

&#x20;   <div className="flex justify-between items-start mb-4">

&#x20;     <div className="p-3 rounded-lg bg-slate-50 text-slate-600">

&#x20;       <Icon size={24} />

&#x20;     </div>

&#x20;     {trend \&\& (

&#x20;       <span className={`text-sm font-medium ${trendUp ? 'text-emerald-500' : 'text-rose-500'} flex items-center`}>

&#x20;         {trend}

&#x20;       </span>

&#x20;     )}

&#x20;   </div>

&#x20;   <div>

&#x20;     <h3 className="text-3xl font-bold text-slate-800 mb-1">{value}</h3>

&#x20;     <p className="text-sm font-medium text-slate-500">{title}</p>

&#x20;     {subtitle \&\& <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}

&#x20;   </div>

&#x20; </div>

);



const AlertBanner = ({ alert }) => {

&#x20; const colors = {

&#x20;   critical: 'bg-rose-50 border-rose-200 text-rose-800',

&#x20;   warning: 'bg-amber-50 border-amber-200 text-amber-800',

&#x20;   info: 'bg-blue-50 border-blue-200 text-blue-800'

&#x20; };

&#x20; 

&#x20; const iconColors = {

&#x20;   critical: 'text-rose-600',

&#x20;   warning: 'text-amber-600',

&#x20;   info: 'text-blue-600'

&#x20; };



&#x20; return (

&#x20;   <div className={`p-4 rounded-lg border flex items-start gap-4 mb-3 ${colors\[alert.type]}`}>

&#x20;     <AlertTriangle className={`mt-0.5 ${iconColors\[alert.type]}`} size={20} />

&#x20;     <div className="flex-1">

&#x20;       <div className="flex justify-between items-center mb-1">

&#x20;         <span className="font-semibold text-sm">{alert.location}</span>

&#x20;         <span className="text-xs font-medium opacity-80">{alert.time}</span>

&#x20;       </div>

&#x20;       <p className="text-sm">{alert.message}</p>

&#x20;     </div>

&#x20;   </div>

&#x20; );

};



// --- MAIN APP COMPONENT ---



export default function App() {

&#x20; const \[activeTab, setActiveTab] = useState('landing');

&#x20; const \[currentTime, setCurrentTime] = useState(new Date());

&#x20; const \[showInfoModal, setShowInfoModal] = useState(false);

&#x20; const \[showQuickActions, setShowQuickActions] = useState(false);

&#x20; const \[isSidebarOpen, setIsSidebarOpen] = useState(true);

&#x20; 

&#x20; // Overview Tab State

&#x20; const \[overviewCardTab, setOverviewCardTab] = useState('checklist'); // 'checklist' | 'reports'



&#x20; // JV Form State

&#x20; const \[eventDate, setEventDate] = useState('');

&#x20; const \[eventTimeStr, setEventTimeStr] = useState('');

&#x20; const timeInputRef = useRef(null);



&#x20; // Check-in Form State

&#x20; const \[empSearch, setEmpSearch] = useState('');

&#x20; const \[selectedEmp, setSelectedEmp] = useState('');

&#x20; const \[checkInDate, setCheckInDate] = useState('');

&#x20; const \[checkInTime, setCheckInTime] = useState('');



&#x20; // Check-out Form State

&#x20; const \[outEmpSearch, setOutEmpSearch] = useState('');

&#x20; const \[selectedOutEmp, setSelectedOutEmp] = useState(null);

&#x20; const \[checkOutDate, setCheckOutDate] = useState('');

&#x20; const \[checkOutTime, setCheckOutTime] = useState('');

&#x20; const \[showOutTimeInput, setShowOutTimeInput] = useState(false);



&#x20; // Open Log Form State

&#x20; const \[openKirjausDate, setOpenKirjausDate] = useState('');

&#x20; const \[openKirjausTime, setOpenKirjausTime] = useState('');

&#x20; const \[openKirjausText, setOpenKirjausText] = useState('');

&#x20; const \[fileName, setFileName] = useState('');

&#x20; const \[runningNumber, setRunningNumber] = useState(100);



&#x20; // First Aid Form State

&#x20; const \[faDate, setFaDate] = useState('');

&#x20; const \[faTime, setFaTime] = useState('');

&#x20; const \[faDesc, setFaDesc] = useState('');

&#x20; const \[faActions, setFaActions] = useState('');

&#x20; const \[faResources, setFaResources] = useState('');

&#x20; const \[faEmployees, setFaEmployees] = useState('');

&#x20; const \[faFileName, setFaFileName] = useState('');



&#x20; // Patrol Form State (Kierrosraportti)

&#x20; const \[patrolDate, setPatrolDate] = useState('');

&#x20; const \[patrolTime, setPatrolTime] = useState('');

&#x20; const \[patrolPerson, setPatrolPerson] = useState('');

&#x20; const \[patrolAreas, setPatrolAreas] = useState('');

&#x20; const \[patrolDeviations, setPatrolDeviations] = useState('');

&#x20; const \[patrolFile, setPatrolFile] = useState('');



&#x20; // Generic TIKE Reports State

&#x20; const \[genRepDate, setGenRepDate] = useState('');

&#x20; const \[genRepTime, setGenRepTime] = useState('');

&#x20; const \[genRepDesc, setGenRepDesc] = useState('');

&#x20; const \[genRepActions, setGenRepActions] = useState('');

&#x20; const \[genRepEmps, setGenRepEmps] = useState('');

&#x20; const \[genRepFile, setGenRepFile] = useState('');



&#x20; // Edit Employee Form State

&#x20; const \[editingEmp, setEditingEmp] = useState(null);



&#x20; // Readiness Form State

&#x20; const \[targetOpeningTime, setTargetOpeningTime] = useState('16:00');

&#x20; const \[readinessChecks, setReadinessChecks] = useState({

&#x20;   exits: false,

&#x20;   guards: false,

&#x20;   vehicles: false,

&#x20;   production: false,

&#x20;   security: false

&#x20; });

&#x20; const \[readinessComments, setReadinessComments] = useState('');



&#x20; useEffect(() => {

&#x20;   const timer = setInterval(() => setCurrentTime(new Date()), 1000);

&#x20;   return () => clearInterval(timer);

&#x20; }, \[]);



&#x20; const formatTime = (date) => {

&#x20;   return date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

&#x20; };



&#x20; const getGreeting = (date) => {

&#x20;   const hour = date.getHours();

&#x20;   if (hour >= 5 \&\& hour < 10) return 'Hyvää huomenta';

&#x20;   if (hour >= 10 \&\& hour < 17) return 'Hyvää päivää';

&#x20;   if (hour >= 17 \&\& hour < 22) return 'Hyvää iltaa';

&#x20;   return 'Hyvää yötä';

&#x20; };



&#x20; const getDynamicId = () => {

&#x20;   const now = new Date();

&#x20;   const yy = String(now.getFullYear()).slice(-2);

&#x20;   const dd = String(now.getDate()).padStart(2, '0');

&#x20;   const mm = String(now.getMonth() + 1).padStart(2, '0');

&#x20;   return `${yy}/FesX/${dd}${mm}/${runningNumber}`;

&#x20; };



&#x20; const handleTamaPvm = () => {

&#x20;   const now = new Date();

&#x20;   now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

&#x20;   setEventDate(now.toISOString().split('T')\[0]);

&#x20;   if (timeInputRef.current) {

&#x20;     timeInputRef.current.focus();

&#x20;   }

&#x20; };



&#x20; const handleNyt = () => {

&#x20;   const now = new Date();

&#x20;   now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

&#x20;   const \[d, t] = now.toISOString().slice(0, 16).split('T');

&#x20;   setEventDate(d);

&#x20;   setEventTimeStr(t);

&#x20; };



&#x20; const handleCheckInNyt = () => {

&#x20;   const now = new Date();

&#x20;   now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

&#x20;   const \[d, t] = now.toISOString().slice(0, 16).split('T');

&#x20;   setCheckInDate(d);

&#x20;   setCheckInTime(t);

&#x20; };



&#x20; const handleOpenKirjausNyt = () => {

&#x20;   const now = new Date();

&#x20;   now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

&#x20;   const \[d, t] = now.toISOString().slice(0, 16).split('T');

&#x20;   setOpenKirjausDate(d);

&#x20;   setOpenKirjausTime(t);

&#x20; };



&#x20; const handleFaNyt = () => {

&#x20;   const now = new Date();

&#x20;   now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

&#x20;   const \[d, t] = now.toISOString().slice(0, 16).split('T');

&#x20;   setFaDate(d);

&#x20;   setFaTime(t);

&#x20; };



&#x20; const handlePatrolNyt = () => {

&#x20;   const now = new Date();

&#x20;   now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

&#x20;   const \[d, t] = now.toISOString().slice(0, 16).split('T');

&#x20;   setPatrolDate(d);

&#x20;   setPatrolTime(t);

&#x20; };



&#x20; const handleGenRepNyt = () => {

&#x20;   const now = new Date();

&#x20;   now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

&#x20;   const \[d, t] = now.toISOString().slice(0, 16).split('T');

&#x20;   setGenRepDate(d);

&#x20;   setGenRepTime(t);

&#x20; };



&#x20; const toggleReadinessCheck = (key) => {

&#x20;   setReadinessChecks(prev => ({ ...prev, \[key]: !prev\[key] }));

&#x20; };



&#x20; const filteredEmployees = empSearch.length >= 3 

&#x20;   ? mockEmployees.filter(e => e.toLowerCase().includes(empSearch.toLowerCase())) 

&#x20;   : \[];



&#x20; const filteredOutEmployees = outEmpSearch.length >= 3

&#x20;   ? mockCheckedInEmployees.filter(e => e.name.toLowerCase().includes(outEmpSearch.toLowerCase()))

&#x20;   : \[];



&#x20; // Readiness logic computations

&#x20; const completedChecksCount = Object.values(readinessChecks).filter(Boolean).length;

&#x20; const missingChecksCount = 5 - completedChecksCount;

&#x20; const isReadyForOpening = missingChecksCount === 0;



&#x20; const checkIsLate = () => {

&#x20;   if (!targetOpeningTime) return false;

&#x20;   const \[hours, minutes] = targetOpeningTime.split(':').map(Number);

&#x20;   const targetDate = new Date(currentTime);

&#x20;   targetDate.setHours(hours, minutes, 0, 0);

&#x20;   return currentTime > targetDate;

&#x20; };

&#x20; const isLate = checkIsLate();



&#x20; let readinessStatusColor = 'bg-blue-50 border-blue-200 text-blue-800';

&#x20; let readinessStatusIconColor = 'text-blue-500';

&#x20; let readinessStatusText = `Avausvalmius kesken. ${missingChecksCount} kohtaa puuttuu.`;



&#x20; if (isReadyForOpening) {

&#x20;   readinessStatusColor = 'bg-emerald-50 border-emerald-200 text-emerald-800';

&#x20;   readinessStatusIconColor = 'text-emerald-500';

&#x20;   readinessStatusText = 'Tapahtuma voidaan aloittaa (Portit avata).';

&#x20; } else if (isLate) {

&#x20;   readinessStatusColor = 'bg-rose-50 border-rose-200 text-rose-800';

&#x20;   readinessStatusIconColor = 'text-rose-500';

&#x20;   readinessStatusText = `Avaus on myöhässä! ${missingChecksCount} kohtaa puuttuu.`;

&#x20; }



&#x20; const renderContent = () => {

&#x20;   switch (activeTab) {

&#x20;     case 'landing':

&#x20;       return (

&#x20;         <div className="flex flex-col items-center justify-center min-h-\[calc(100vh-120px)] animate-in fade-in zoom-in-95 duration-500">

&#x20;           <div className="bg-white p-10 md:p-14 rounded-3xl shadow-xl border border-slate-100 text-center max-w-2xl w-full">

&#x20;             <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-indigo-50/50">

&#x20;               <ShieldCheck size={48} />

&#x20;             </div>

&#x20;             <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-3 tracking-tight">Turvajohto OS</h1>

&#x20;             

&#x20;             <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mt-6 mb-10">

&#x20;               <h2 className="text-xl md:text-2xl font-semibold text-slate-700">

&#x20;                 {getGreeting(currentTime)}, <span className="text-indigo-600">oletuskäyttäjä</span>

&#x20;               </h2>

&#x20;               <p className="text-slate-500 font-medium mt-1">Turvajohto</p>

&#x20;             </div>



&#x20;             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

&#x20;               <button 

&#x20;                 onClick={() => setActiveTab('overview')}

&#x20;                 className="flex items-center justify-center gap-3 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-sm hover:shadow group"

&#x20;               >

&#x20;                 <Activity size={20} className="group-hover:scale-110 transition-transform" />

&#x20;                 Siirry tilannekuvaan

&#x20;               </button>

&#x20;               <button 

&#x20;                 onClick={() => setActiveTab('reporting')}

&#x20;                 className="flex items-center justify-center gap-3 p-4 bg-white border-2 border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all"

&#x20;               >

&#x20;                 <FileText size={20} className="text-indigo-500" />

&#x20;                 Avaa raportointi

&#x20;               </button>

&#x20;             </div>

&#x20;           </div>

&#x20;           

&#x20;           <div className="mt-12 text-slate-400 text-sm font-medium flex items-center gap-2">

&#x20;             <Clock size={16} />

&#x20;             Kirjautumisaika: {formatTime(currentTime)}

&#x20;           </div>

&#x20;         </div>

&#x20;       );

&#x20;     case 'overview':

&#x20;       return (

&#x20;         <div className="space-y-6">

&#x20;           {/\* KPI Row \*/}

&#x20;           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

&#x20;             <DashboardCard 

&#x20;               title="Aktiiviset Järjestyksenvalvojat" 

&#x20;               icon={ShieldCheck} 

&#x20;               value="142" 

&#x20;               subtitle="Mitoitus: 1:100 (vaatimus 142)"

&#x20;             />

&#x20;             <DashboardCard 

&#x20;               title="Ensiaputapaukset" 

&#x20;               icon={HeartPulse} 

&#x20;               value="12" 

&#x20;               subtitle="Viimeisen tunnin aikana: 3"

&#x20;             />

&#x20;             <DashboardCard 

&#x20;               title="Poistot" 

&#x20;               icon={LogOut} 

&#x20;               value="8" 

&#x20;               subtitle="Koko tapahtuman ajalta"

&#x20;             />

&#x20;             <DashboardCard 

&#x20;               title="Poikkeamat" 

&#x20;               icon={AlertTriangle} 

&#x20;               value="3" 

&#x20;               subtitle="Avoinna olevat tilanteet"

&#x20;             />

&#x20;           </div>



&#x20;           {/\* Main Content Grid \*/}

&#x20;           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

&#x20;             {/\* Left Column - Alerts \& Status \*/}

&#x20;             <div className="lg:col-span-2 space-y-6">

&#x20;               <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">

&#x20;                 <div className="flex justify-between items-center mb-6">

&#x20;                   <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">

&#x20;                     <Activity className="text-rose-500" size={20} />

&#x20;                     Aktiiviset Hälytykset ja Poikkeamat

&#x20;                   </h2>

&#x20;                   <button className="text-sm text-indigo-600 font-medium hover:text-indigo-700">Näytä Kaikki</button>

&#x20;                 </div>

&#x20;                 <div className="space-y-1">

&#x20;                   {mockAlerts.map(alert => (

&#x20;                     <AlertBanner key={alert.id} alert={alert} />

&#x20;                   ))}

&#x20;                 </div>

&#x20;               </div>



&#x20;               <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">

&#x20;                  <div className="flex justify-between items-center mb-6">

&#x20;                   <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">

&#x20;                     <MessageSquare className="text-indigo-500" size={20} />

&#x20;                     JOKE Loki (Viimeisimmät)

&#x20;                   </h2>

&#x20;                   <button className="px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100 transition-colors">

&#x20;                     + Uusi Kirjaus

&#x20;                   </button>

&#x20;                 </div>

&#x20;                 <div className="space-y-4">

&#x20;                   {mockLogs.map(log => (

&#x20;                     <div key={log.id} className="flex gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors border-b border-slate-50 last:border-0">

&#x20;                       <div className="text-sm font-mono text-slate-400 w-16 pt-0.5">{log.time}</div>

&#x20;                       <div className="flex-1">

&#x20;                         <p className="text-sm font-medium text-slate-800">{log.action}</p>

&#x20;                         <p className="text-xs text-slate-500 mt-1">Kirjaaja: {log.user}</p>

&#x20;                       </div>

&#x20;                     </div>

&#x20;                   ))}

&#x20;                 </div>

&#x20;               </div>

&#x20;             </div>



&#x20;             {/\* Right Column - Checklist \& Actions \*/}

&#x20;             <div className="space-y-6">

&#x20;               {/\* Swaippattava / Välilehdellinen kortti \*/}

&#x20;               <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">

&#x20;                 <div className="flex border-b border-slate-100">

&#x20;                   <button 

&#x20;                     onClick={() => setOverviewCardTab('checklist')}

&#x20;                     className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${overviewCardTab === 'checklist' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:bg-slate-50'}`}

&#x20;                   >

&#x20;                     <CheckCircle size={16} />

&#x20;                     Valmiustarkastus

&#x20;                   </button>

&#x20;                   <button 

&#x20;                     onClick={() => setOverviewCardTab('reports')}

&#x20;                     className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${overviewCardTab === 'reports' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:bg-slate-50'}`}

&#x20;                   >

&#x20;                     <Archive size={16} />

&#x20;                     Uusimmat raportit

&#x20;                   </button>

&#x20;                 </div>

&#x20;                 

&#x20;                 <div className="p-6">

&#x20;                   {overviewCardTab === 'checklist' ? (

&#x20;                     <div className="space-y-3 animate-in fade-in duration-300">

&#x20;                       {mockChecklist.map(item => (

&#x20;                         <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50">

&#x20;                           <div className="mt-0.5">

&#x20;                             {item.status === 'done' ? (

&#x20;                               <CheckCircle className="text-emerald-500" size={18} />

&#x20;                             ) : item.status === 'in-progress' ? (

&#x20;                               <Clock className="text-amber-500" size={18} />

&#x20;                             ) : (

&#x20;                               <div className="w-\[18px] h-\[18px] rounded-full border-2 border-slate-300"></div>

&#x20;                             )}

&#x20;                           </div>

&#x20;                           <div>

&#x20;                             <p className={`text-sm font-medium ${item.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>

&#x20;                               {item.task}

&#x20;                             </p>

&#x20;                             <p className="text-xs text-slate-400">{item.category}</p>

&#x20;                           </div>

&#x20;                         </div>

&#x20;                       ))}

&#x20;                     </div>

&#x20;                   ) : (

&#x20;                     <div className="space-y-3 animate-in fade-in duration-300">

&#x20;                       {mockReports.map((rep, idx) => (

&#x20;                         <div key={idx} className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer">

&#x20;                           <div className="flex justify-between items-center">

&#x20;                             <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{rep.type}</span>

&#x20;                             <span className="text-xs font-mono text-slate-400">{rep.time}</span>

&#x20;                           </div>

&#x20;                           <p className="text-sm font-medium text-slate-800 line-clamp-1">{rep.summary}</p>

&#x20;                           <p className="text-xs text-slate-500">Kirjaaja: {rep.author} | ID: {rep.id.split('/').pop()}</p>

&#x20;                         </div>

&#x20;                       ))}

&#x20;                       <button 

&#x20;                         onClick={() => setActiveTab('report\_list')}

&#x20;                         className="w-full mt-2 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"

&#x20;                       >

&#x20;                         Näytä kaikki raportit

&#x20;                       </button>

&#x20;                     </div>

&#x20;                   )}

&#x20;                 </div>

&#x20;               </div>

&#x20;             </div>

&#x20;           </div>

&#x20;         </div>

&#x20;       );

&#x20;     case 'reporting':

&#x20;       return (

&#x20;         <div className="space-y-6 max-w-5xl">

&#x20;           <div className="mb-6 pb-4 border-b border-slate-200">

&#x20;             <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">

&#x20;               <FileText className="text-indigo-500" size={28} />

&#x20;               Raportointi ja lomakkeet

&#x20;             </h2>

&#x20;             <p className="text-sm text-slate-500 mt-1">Valitse täytettävä raportti tai tarkastele tallennettuja asiakirjoja.</p>

&#x20;           </div>

&#x20;           

&#x20;           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

&#x20;             {/\* JV Card \*/}

&#x20;             <button 

&#x20;               onClick={() => setActiveTab('report\_jv')}

&#x20;               className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all text-left group"

&#x20;             >

&#x20;               <div className="flex items-center justify-between mb-4">

&#x20;                 <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 transition-colors">

&#x20;                   <ShieldCheck size={24} />

&#x20;                 </div>

&#x20;                 <ChevronRight className="text-slate-400 group-hover:text-indigo-500 transition-colors" size={20} />

&#x20;               </div>

&#x20;               <h3 className="text-lg font-bold text-slate-800 mb-1">Järjestyksenvalvojan tapahtumailmoitus</h3>

&#x20;               <p className="text-sm text-slate-500 line-clamp-2">Lakisääteinen ilmoitus kiinniotto- ja voimankäyttötilanteista (LYTP 33 §).</p>

&#x20;             </button>



&#x20;             {/\* TIKE Card \*/}

&#x20;             <button 

&#x20;               onClick={() => setActiveTab('report\_tike')}

&#x20;               className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left group"

&#x20;             >

&#x20;               <div className="flex items-center justify-between mb-4">

&#x20;                 <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition-colors">

&#x20;                   <Activity size={24} />

&#x20;                 </div>

&#x20;                 <ChevronRight className="text-slate-400 group-hover:text-emerald-500 transition-colors" size={20} />

&#x20;               </div>

&#x20;               <h3 className="text-lg font-bold text-slate-800 mb-1">TIKE:n raportointi</h3>

&#x20;               <p className="text-sm text-slate-500 line-clamp-2">Tilannekeskuksen seuranta, kirjaukset ja laajemmat poikkeamaraportit.</p>

&#x20;             </button>



&#x20;              {/\* Raportit Arkisto Card \*/}

&#x20;              <button 

&#x20;               onClick={() => setActiveTab('report\_list')}

&#x20;               className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group"

&#x20;             >

&#x20;               <div className="flex items-center justify-between mb-4">

&#x20;                 <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">

&#x20;                   <Archive size={24} />

&#x20;                 </div>

&#x20;                 <ChevronRight className="text-slate-400 group-hover:text-blue-500 transition-colors" size={20} />

&#x20;               </div>

&#x20;               <h3 className="text-lg font-bold text-slate-800 mb-1">Tallennetut raportit</h3>

&#x20;               <p className="text-sm text-slate-500 line-clamp-2">Selaa, hae ja tarkastele kaikkia järjestelmään luotuja raportteja.</p>

&#x20;             </button>

&#x20;           </div>

&#x20;         </div>

&#x20;       );

&#x20;     case 'report\_list':

&#x20;       return (

&#x20;         <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">

&#x20;            <button 

&#x20;             onClick={() => setActiveTab('reporting')}

&#x20;             className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"

&#x20;           >

&#x20;             <ArrowLeft size={16} />

&#x20;             Takaisin raportointivalikkoon

&#x20;           </button>



&#x20;           <div className="mb-6 flex justify-between items-end border-b border-slate-100 pb-4">

&#x20;             <div>

&#x20;               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">

&#x20;                 <Archive className="text-blue-500" size={24} />

&#x20;                 Tallennetut raportit

&#x20;               </h2>

&#x20;               <p className="text-sm text-slate-500 mt-1">Selaa ja tarkastele kaikkia tehtyjä kirjauksia ja ilmoituksia.</p>

&#x20;             </div>

&#x20;             <div className="relative w-64">

&#x20;               <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />

&#x20;               <input type="text" placeholder="Hae raporteista..." className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />

&#x20;             </div>

&#x20;           </div>



&#x20;           <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">

&#x20;             <table className="w-full text-left text-sm">

&#x20;               <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">

&#x20;                 <tr>

&#x20;                   <th className="p-4">Tunniste</th>

&#x20;                   <th className="p-4">Aika</th>

&#x20;                   <th className="p-4">Tyyppi</th>

&#x20;                   <th className="p-4">Kirjaaja</th>

&#x20;                   <th className="p-4">Tiivistelmä</th>

&#x20;                   <th className="p-4 text-right">Toiminnot</th>

&#x20;                 </tr>

&#x20;               </thead>

&#x20;               <tbody className="divide-y divide-slate-200">

&#x20;                 {mockReports.map((rep, idx) => (

&#x20;                   <tr key={idx} className="hover:bg-white transition-colors cursor-pointer">

&#x20;                     <td className="p-4 font-mono text-xs text-slate-500">{rep.id}</td>

&#x20;                     <td className="p-4 font-medium text-slate-800">{rep.time}</td>

&#x20;                     <td className="p-4">

&#x20;                       <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700">

&#x20;                         {rep.type}

&#x20;                       </span>

&#x20;                     </td>

&#x20;                     <td className="p-4 text-slate-600">{rep.author}</td>

&#x20;                     <td className="p-4 text-slate-600 line-clamp-1 max-w-\[200px]">{rep.summary}</td>

&#x20;                     <td className="p-4 text-right">

&#x20;                       <button className="text-blue-600 hover:text-blue-900 font-medium text-xs bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors">

&#x20;                         Avaa

&#x20;                       </button>

&#x20;                     </td>

&#x20;                   </tr>

&#x20;                 ))}

&#x20;               </tbody>

&#x20;             </table>

&#x20;           </div>

&#x20;         </div>

&#x20;       );

&#x20;     case 'report\_jv':

&#x20;       return (

&#x20;         <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">

&#x20;           <button 

&#x20;             onClick={() => setActiveTab('reporting')}

&#x20;             className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"

&#x20;           >

&#x20;             <ArrowLeft size={16} />

&#x20;             Takaisin raportointivalikkoon

&#x20;           </button>

&#x20;           <div className="mb-6 border-b border-slate-100 pb-4">

&#x20;             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">

&#x20;               <FileText className="text-indigo-500" size={24} />

&#x20;               Järjestyksenvalvojan tapahtumailmoitus

&#x20;             </h2>

&#x20;             <p className="text-sm text-slate-500 mt-1">LYTP:n mukainen lakisääteinen ilmoitus kiinniotto- ja voimankäyttötilanteista sekä ensihoidon käytöstä.</p>

&#x20;           </div>

&#x20;           

&#x20;           <form className="space-y-8 text-left">

&#x20;             {/\* Osa 1: Perustiedot \*/}

&#x20;             <div className="space-y-4">

&#x20;               <div className="flex items-center justify-between border-b pb-2 mb-2">

&#x20;                 <h3 className="text-md font-semibold text-slate-700">1. Perustiedot</h3>

&#x20;                 <button 

&#x20;                   type="button" 

&#x20;                   onClick={() => setShowInfoModal(true)}

&#x20;                   className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg"

&#x20;                 >

&#x20;                   <Info size={16} />

&#x20;                   Lain vaatimukset (LYTP)

&#x20;                 </button>

&#x20;               </div>

&#x20;               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

&#x20;                 <div>

&#x20;                   <label className="block text-sm font-medium text-slate-700 mb-1">Järjestyksenvalvojan nimi</label>

&#x20;                   <input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Etunimi Sukunimi" />

&#x20;                 </div>

&#x20;                 <div>

&#x20;                   <label className="block text-sm font-medium text-slate-700 mb-1">Turvallisuusalan elinkeinoluvan haltija</label>

&#x20;                   <input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Turva Oy" />

&#x20;                 </div>

&#x20;                 <div>

&#x20;                   <label className="block text-sm font-medium text-slate-700 mb-1">Tapahtuma-aika</label>

&#x20;                   <div className="flex gap-2">

&#x20;                     <input 

&#x20;                       type="date" 

&#x20;                       value={eventDate}

&#x20;                       onChange={(e) => setEventDate(e.target.value)}

&#x20;                       className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" 

&#x20;                     />

&#x20;                     <input 

&#x20;                       type="time" 

&#x20;                       ref={timeInputRef}

&#x20;                       value={eventTimeStr}

&#x20;                       onChange={(e) => setEventTimeStr(e.target.value)}

&#x20;                       className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" 

&#x20;                     />

&#x20;                   </div>

&#x20;                   <div className="flex gap-2 mt-2">

&#x20;                     <button 

&#x20;                       type="button" 

&#x20;                       onClick={handleTamaPvm}

&#x20;                       className="px-3 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"

&#x20;                     >

&#x20;                       Tämä pvm

&#x20;                     </button>

&#x20;                     <button 

&#x20;                       type="button" 

&#x20;                       onClick={handleNyt}

&#x20;                       className="px-3 py-1 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-colors"

&#x20;                     >

&#x20;                       Nyt

&#x20;                     </button>

&#x20;                   </div>

&#x20;                 </div>

&#x20;                 <div>

&#x20;                   <label className="block text-sm font-medium text-slate-700 mb-1">Tapahtumapaikka</label>

&#x20;                   <input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Main Stage, portti 2..." />

&#x20;                 </div>

&#x20;               </div>

&#x20;             </div>



&#x20;             {/\* Osa 2: Toimenpiteet \*/}

&#x20;             <div className="space-y-4">

&#x20;               <h3 className="text-md font-semibold text-slate-700 border-b pb-2">2. Toimenpiteet</h3>

&#x20;               <div className="space-y-3">

&#x20;                 <label className="flex items-center gap-3">

&#x20;                   <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />

&#x20;                   <span className="text-sm font-medium text-slate-700">Otettu kiinni tai käytetty voimakeinoja</span>

&#x20;                 </label>

&#x20;                 <label className="flex items-center gap-3">

&#x20;                   <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />

&#x20;                   <span className="text-sm font-medium text-slate-700">Käytetty voimankäyttövälineitä (esim. käsiraudat, patukka, kaasu)</span>

&#x20;                 </label>

&#x20;                 <label className="flex items-center gap-3">

&#x20;                   <input type="checkbox" className="w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500" />

&#x20;                   <span className="text-sm font-medium text-slate-700">Otettu esille tai käytetty ampuma-asetta</span>

&#x20;                 </label>

&#x20;                 <label className="flex items-center gap-3">

&#x20;                   <input type="checkbox" className="w-5 h-5 text-amber-500 rounded border-slate-300 focus:ring-amber-500" />

&#x20;                   <span className="text-sm font-medium text-slate-700">Kohdehenkilö on viety ensiapuun tai ensihoitoa on käytetty tilanteessa</span>

&#x20;                 </label>

&#x20;               </div>

&#x20;             </div>



&#x20;             {/\* Osa 3: Kohdehenkilö ja havainnot \*/}

&#x20;             <div className="space-y-4">

&#x20;               <h3 className="text-md font-semibold text-slate-700 border-b pb-2">3. Kohdehenkilö ja havainnot (Havaintotiedot)</h3>

&#x20;               <div className="space-y-4">

&#x20;                 <div>

&#x20;                   <label className="block text-sm font-medium text-slate-700 mb-1">Kohdehenkilön tuntomerkit (tunnistamista varten)</label>

&#x20;                   <textarea rows="2" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Pituus, vartalonrakenne, vaatetus, erityistuntomerkit..."></textarea>

&#x20;                 </div>

&#x20;                 <div>

&#x20;                   <label className="block text-sm font-medium text-slate-700 mb-1">Havainnot käyttäytymisestä ja tilasta</label>

&#x20;                   <textarea rows="2" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. aggressiivinen, sekava, vahvasti päihtynyt, yhteistyökykyinen..."></textarea>

&#x20;                 </div>

&#x20;               </div>

&#x20;             </div>



&#x20;             {/\* Osa 4: Lisätiedot \*/}

&#x20;             <div className="space-y-4">

&#x20;               <h3 className="text-md font-semibold text-slate-700 border-b pb-2">4. Vapaa kuvaus ja lisätiedot</h3>

&#x20;               <div>

&#x20;                 <textarea rows="4" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Tarkempi kuvaus tilanteen kulusta, toimenpiteistä, ensihoidon antamista tiedoista yms..."></textarea>

&#x20;               </div>

&#x20;             </div>



&#x20;             <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">

&#x20;               <button type="button" className="px-5 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">

&#x20;                 Tyhjennä

&#x20;               </button>

&#x20;               <button type="button" className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2">

&#x20;                 <CheckCircle size={16} />

&#x20;                 Tallenna ilmoitus

&#x20;               </button>

&#x20;             </div>



&#x20;             {/\* TIKE-osio \*/}

&#x20;             <div className="mt-10 bg-slate-50 border border-slate-200 rounded-xl p-6 relative overflow-hidden">

&#x20;               <div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div>

&#x20;               <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3 border-b border-slate-200 pb-2">

&#x20;                 TIKE:n muistilista (päivystäjälle)

&#x20;               </h3>

&#x20;               <ul className="space-y-1.5 mb-5 text-sm text-slate-600 list-disc list-inside">

&#x20;                 <li>Onko TR käynyt paikalla?</li>

&#x20;                 <li>Onko työntekijälle tullut vammoja?</li>

&#x20;                 <li>Onko Turva 1 ja Turva 2 infottu asiasta?</li>

&#x20;                 <li>Tarvitseeko tapahtumatuotannolle ilmoittaa?</li>

&#x20;               </ul>

&#x20;               <div>

&#x20;                 <label className="block text-sm font-bold text-slate-800 mb-2">TIKE:n kommentti:</label>

&#x20;                 <textarea 

&#x20;                   rows="3" 

&#x20;                   className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" 

&#x20;                   placeholder="Kirjaa tilannekeskuksen toimenpiteet ja lisähuomiot..."

&#x20;                 ></textarea>

&#x20;               </div>

&#x20;             </div>

&#x20;           </form>

&#x20;         </div>

&#x20;       );

&#x20;     case 'report\_tike':

&#x20;       const tikeOptions = \[

&#x20;         { id: 'in', label: 'Työntekijän sisäänkirjaus', icon: LogIn, color: 'text-emerald-600', bg: 'bg-emerald-50' },

&#x20;         { id: 'out', label: 'Työntekijän uloskirjaus', icon: LogOut, color: 'text-rose-600', bg: 'bg-rose-50' },

&#x20;         { id: 'open', label: 'Avoin kirjaus', icon: PenTool, color: 'text-indigo-600', bg: 'bg-indigo-50' },

&#x20;         { id: 'firstaid', label: 'Ensiaputilanne', icon: HeartPulse, color: 'text-rose-600', bg: 'bg-rose-50' },

&#x20;         { id: 'threat', label: 'Uhkatilanne', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },

&#x20;         { id: 'fence', label: 'Aitojen ylitys / luvaton sisäänpääsy', icon: ShieldAlert, color: 'text-orange-600', bg: 'bg-orange-50' },

&#x20;         { id: 'damage', label: 'Omaisuusvaurio', icon: Wrench, color: 'text-slate-600', bg: 'bg-slate-100' },

&#x20;         { id: 'lostfound', label: 'Löytötavara', icon: Package, color: 'text-slate-600', bg: 'bg-slate-100' },

&#x20;         { id: 'patrol', label: 'Kierrosraportti', icon: Clipboard, color: 'text-blue-600', bg: 'bg-blue-50' },

&#x20;         { id: 'queue', label: 'Portin jonon odotusaika', icon: Clock, color: 'text-slate-600', bg: 'bg-slate-100' },

&#x20;         { id: 'weather', label: 'Sääraportti', icon: Cloud, color: 'text-sky-600', bg: 'bg-sky-50' },

&#x20;         { id: 'briefing', label: 'Briefing', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },

&#x20;         { id: 'management', label: 'Johdon tilannekatsaus', icon: BarChart2, color: 'text-purple-600', bg: 'bg-purple-50' },

&#x20;       ];



&#x20;       return (

&#x20;         <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">

&#x20;           <button 

&#x20;             onClick={() => setActiveTab('reporting')}

&#x20;             className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"

&#x20;           >

&#x20;             <ArrowLeft size={16} />

&#x20;             Takaisin raportointivalikkoon

&#x20;           </button>

&#x20;           

&#x20;           <div className="mb-8 border-b border-slate-100 pb-4">

&#x20;             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">

&#x20;               <Activity className="text-emerald-500" size={24} />

&#x20;               TIKE:n raportointi ja seuranta

&#x20;             </h2>

&#x20;             <p className="text-sm text-slate-500 mt-1">Valitse uuden kirjauksen tai toimenpiteen tyyppi aloittaaksesi.</p>

&#x20;           </div>



&#x20;           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

&#x20;             {tikeOptions.map((option) => {

&#x20;               const Icon = option.icon;

&#x20;               return (

&#x20;                 <button

&#x20;                   key={option.id}

&#x20;                   onClick={() => setActiveTab(`tike\_form\_${option.id}`)}

&#x20;                   className="flex flex-col items-start p-5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all text-left group bg-white"

&#x20;                 >

&#x20;                   <div className={`p-3 rounded-lg mb-4 transition-colors ${option.bg} ${option.color} group-hover:scale-110 transform duration-200`}>

&#x20;                     <Icon size={24} />

&#x20;                   </div>

&#x20;                   <span className="font-bold text-slate-800 text-sm">{option.label}</span>

&#x20;                 </button>

&#x20;               );

&#x20;             })}

&#x20;           </div>

&#x20;         </div>

&#x20;       );

&#x20;     case 'tike\_form\_in':

&#x20;       return (

&#x20;         <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">

&#x20;           <button 

&#x20;             onClick={() => { setActiveTab('report\_tike'); setSelectedEmp(''); setEmpSearch(''); }}

&#x20;             className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"

&#x20;           >

&#x20;             <ArrowLeft size={16} />

&#x20;             Takaisin TIKE-valikkoon

&#x20;           </button>



&#x20;           <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end">

&#x20;             <div>

&#x20;               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">

&#x20;                 <LogIn className="text-emerald-500" size={24} />

&#x20;                 Työntekijän sisäänkirjaus

&#x20;               </h2>

&#x20;               <p className="text-sm text-slate-500 mt-1">Kirjaa työntekijä sisään ja merkitse luovutetut välineet.</p>

&#x20;             </div>

&#x20;           </div>



&#x20;           {/\* Info Boxes / Työntekijätilanne \*/}

&#x20;           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">

&#x20;             <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">

&#x20;               <div className="text-2xl font-bold text-slate-800">142</div>

&#x20;               <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">JV paikalla</div>

&#x20;             </div>

&#x20;             <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">

&#x20;               <div className="text-2xl font-bold text-slate-800">25</div>

&#x20;               <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">Vartijat</div>

&#x20;             </div>

&#x20;             <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">

&#x20;               <div className="text-2xl font-bold text-slate-800">12</div>

&#x20;               <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">EA henkilöt</div>

&#x20;             </div>

&#x20;             <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">

&#x20;               <div className="text-2xl font-bold text-slate-800">8</div>

&#x20;               <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">Muu avoin</div>

&#x20;             </div>

&#x20;             <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-center flex flex-col justify-center">

&#x20;               <div className="text-2xl font-bold text-amber-700">3</div>

&#x20;               <div className="text-xs text-amber-600 font-medium uppercase tracking-wide mt-1">Poikkeamat</div>

&#x20;             </div>

&#x20;           </div>



&#x20;           <form className="space-y-8 text-left">

&#x20;             {/\* Haku \*/}

&#x20;             <div>

&#x20;               <label className="block text-sm font-bold text-slate-700 mb-2">Työntekijän haku (Sukunimi Etunimi...)</label>

&#x20;               <div className="relative">

&#x20;                 <div className="relative">

&#x20;                   <Search className="absolute left-3 top-3 text-slate-400" size={18} />

&#x20;                   <input 

&#x20;                     type="text" 

&#x20;                     value={empSearch}

&#x20;                     onChange={(e) => {

&#x20;                       setEmpSearch(e.target.value);

&#x20;                       setSelectedEmp('');

&#x20;                     }}

&#x20;                     className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm font-medium" 

&#x20;                     placeholder="Kirjoita vähintään 3 merkkiä hakeaksesi..."

&#x20;                   />

&#x20;                 </div>

&#x20;                 

&#x20;                 {empSearch.length >= 3 \&\& !selectedEmp \&\& (

&#x20;                   <ul className="absolute z-10 bg-white border border-slate-200 rounded-lg shadow-lg w-full mt-1 max-h-60 overflow-y-auto">

&#x20;                     {filteredEmployees.length > 0 ? (

&#x20;                       filteredEmployees.map((emp, idx) => (

&#x20;                         <li 

&#x20;                           key={idx} 

&#x20;                           onClick={() => {

&#x20;                             setSelectedEmp(emp);

&#x20;                             setEmpSearch(emp);

&#x20;                           }}

&#x20;                           className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-medium text-slate-700 border-b border-slate-100 last:border-0"

&#x20;                         >

&#x20;                           {emp}

&#x20;                         </li>

&#x20;                       ))

&#x20;                     ) : (

&#x20;                       <li className="px-4 py-3 text-sm text-slate-500">Ei osumia työntekijärekisteristä.</li>

&#x20;                     )}

&#x20;                   </ul>

&#x20;                 )}

&#x20;               </div>

&#x20;             </div>



&#x20;             {/\* Kirjauslomake (näytetään vain kun työntekijä on valittu) \*/}

&#x20;             {selectedEmp \&\& (

&#x20;               <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-8 border-t border-slate-200 pt-6">

&#x20;                 

&#x20;                 {/\* Rooli ja Aika \*/}

&#x20;                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

&#x20;                   <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col justify-center">

&#x20;                     <label className="block text-sm font-bold text-slate-700 mb-3">Työntekijän rooli</label>

&#x20;                     <div className="flex gap-6">

&#x20;                       <label className="flex items-center gap-2 cursor-pointer">

&#x20;                         <input type="radio" name="role" className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" defaultChecked />

&#x20;                         <span className="text-sm font-medium text-slate-700">Järjestyksenvalvoja</span>

&#x20;                       </label>

&#x20;                       <label className="flex items-center gap-2 cursor-pointer">

&#x20;                         <input type="radio" name="role" className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" />

&#x20;                         <span className="text-sm font-medium text-slate-700">Vartija</span>

&#x20;                       </label>

&#x20;                     </div>

&#x20;                   </div>



&#x20;                   <div>

&#x20;                     <label className="block text-sm font-medium text-slate-700 mb-1">Sisäänkirjausaika</label>

&#x20;                     <div className="flex gap-2">

&#x20;                       <input 

&#x20;                         type="date" 

&#x20;                         value={checkInDate}

&#x20;                         onChange={(e) => setCheckInDate(e.target.value)}

&#x20;                         className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-emerald-500" 

&#x20;                       />

&#x20;                       <input 

&#x20;                         type="time" 

&#x20;                         value={checkInTime}

&#x20;                         onChange={(e) => setCheckInTime(e.target.value)}

&#x20;                         className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-emerald-500" 

&#x20;                       />

&#x20;                     </div>

&#x20;                     <div className="mt-2">

&#x20;                       <button 

&#x20;                         type="button" 

&#x20;                         onClick={handleCheckInNyt}

&#x20;                         className="px-4 py-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md transition-colors"

&#x20;                       >

&#x20;                         Nyt

&#x20;                       </button>

&#x20;                     </div>

&#x20;                   </div>

&#x20;                 </div>



&#x20;                 {/\* Välineet \*/}

&#x20;                 <div className="space-y-4">

&#x20;                   <h3 className="text-md font-semibold text-slate-700 border-b pb-2">Luovutetut välineet</h3>

&#x20;                   <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">

&#x20;                     

&#x20;                     <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">

&#x20;                       <span className="text-sm font-medium text-slate-700">JV / Vartijan liivi</span>

&#x20;                       <div className="flex gap-4">

&#x20;                         <label className="flex items-center gap-2 cursor-pointer">

&#x20;                           <input type="radio" name="vest" className="text-emerald-600 focus:ring-emerald-500" />

&#x20;                           <span className="text-sm">Kyllä</span>

&#x20;                         </label>

&#x20;                         <label className="flex items-center gap-2 cursor-pointer">

&#x20;                           <input type="radio" name="vest" className="text-slate-600 focus:ring-slate-500" defaultChecked />

&#x20;                           <span className="text-sm">Ei</span>

&#x20;                         </label>

&#x20;                       </div>

&#x20;                     </div>



&#x20;                     <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">

&#x20;                       <label className="block text-sm font-medium text-slate-700 mb-1">JV yksilötunnus</label>

&#x20;                       <input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-emerald-500" placeholder="Esim. 1234" />

&#x20;                     </div>



&#x20;                     <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">

&#x20;                       <span className="text-sm font-medium text-slate-700">Headset</span>

&#x20;                       <div className="flex gap-4">

&#x20;                         <label className="flex items-center gap-2 cursor-pointer">

&#x20;                           <input type="radio" name="headset" className="text-emerald-600 focus:ring-emerald-500" />

&#x20;                           <span className="text-sm">Kyllä</span>

&#x20;                         </label>

&#x20;                         <label className="flex items-center gap-2 cursor-pointer">

&#x20;                           <input type="radio" name="headset" className="text-slate-600 focus:ring-slate-500" defaultChecked />

&#x20;                           <span className="text-sm">Ei</span>

&#x20;                         </label>

&#x20;                       </div>

&#x20;                     </div>



&#x20;                     <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">

&#x20;                       <label className="block text-sm font-medium text-slate-700 mb-1">Radiopuhelimen nro</label>

&#x20;                       <input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-emerald-500" placeholder="Esim. R-12" />

&#x20;                     </div>

&#x20;                     

&#x20;                   </div>

&#x20;                 </div>



&#x20;                 {/\* Poikkeamakommentit \*/}

&#x20;                 <div className="space-y-4">

&#x20;                   <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex justify-between items-end">

&#x20;                     <span>Avoin poikkeamakommentti</span>

&#x20;                     <span className="text-xs font-normal text-slate-500">Nämä kirjaukset näkyvät etusivun tilastoissa</span>

&#x20;                   </h3>

&#x20;                   <div>

&#x20;                     <textarea 

&#x20;                       rows="3" 

&#x20;                       className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-emerald-500" 

&#x20;                       placeholder="Esim. työntekijä joutuu lähtemään ennen työvuoron loppua, varustepuutteet tai muu huomionarvoinen asia..."

&#x20;                     ></textarea>

&#x20;                   </div>

&#x20;                 </div>



&#x20;                 <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">

&#x20;                   <button 

&#x20;                     type="button" 

&#x20;                     onClick={() => { setSelectedEmp(''); setEmpSearch(''); }}

&#x20;                     className="px-5 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"

&#x20;                   >

&#x20;                     Peruuta

&#x20;                   </button>

&#x20;                   <button type="button" className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2">

&#x20;                     <CheckCircle size={16} />

&#x20;                     Tallenna kirjaus

&#x20;                   </button>

&#x20;                 </div>

&#x20;               </div>

&#x20;             )}

&#x20;           </form>

&#x20;         </div>

&#x20;       );

&#x20;     case 'tike\_form\_out':

&#x20;       return (

&#x20;         <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">

&#x20;           <button 

&#x20;             onClick={() => { setActiveTab('report\_tike'); setSelectedOutEmp(null); setOutEmpSearch(''); setShowOutTimeInput(false); }}

&#x20;             className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"

&#x20;           >

&#x20;             <ArrowLeft size={16} />

&#x20;             Takaisin TIKE-valikkoon

&#x20;           </button>



&#x20;           <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end">

&#x20;             <div>

&#x20;               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">

&#x20;                 <LogOut className="text-rose-500" size={24} />

&#x20;                 Työntekijän uloskirjaus

&#x20;               </h2>

&#x20;               <p className="text-sm text-slate-500 mt-1">Päätä työvuoro, palauta välineet ja kirjaa mahdolliset puutteet.</p>

&#x20;             </div>

&#x20;           </div>



&#x20;           {/\* Info Boxes / Työntekijätilanne \*/}

&#x20;           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">

&#x20;             <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">

&#x20;               <div className="text-2xl font-bold text-slate-800">142</div>

&#x20;               <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">JV paikalla</div>

&#x20;             </div>

&#x20;             <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">

&#x20;               <div className="text-2xl font-bold text-slate-800">25</div>

&#x20;               <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">Vartijat</div>

&#x20;             </div>

&#x20;             <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">

&#x20;               <div className="text-2xl font-bold text-slate-800">12</div>

&#x20;               <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">EA henkilöt</div>

&#x20;             </div>

&#x20;             <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">

&#x20;               <div className="text-2xl font-bold text-slate-800">8</div>

&#x20;               <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">Muu avoin</div>

&#x20;             </div>

&#x20;             <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-center flex flex-col justify-center">

&#x20;               <div className="text-2xl font-bold text-amber-700">3</div>

&#x20;               <div className="text-xs text-amber-600 font-medium uppercase tracking-wide mt-1">Poikkeamat</div>

&#x20;             </div>

&#x20;           </div>



&#x20;           <form className="space-y-8 text-left">

&#x20;             {/\* Haku \*/}

&#x20;             <div>

&#x20;               <label className="block text-sm font-bold text-slate-700 mb-2">Hae sisäänkirjattu työntekijä</label>

&#x20;               <div className="relative">

&#x20;                 <div className="relative">

&#x20;                   <Search className="absolute left-3 top-3 text-slate-400" size={18} />

&#x20;                   <input 

&#x20;                     type="text" 

&#x20;                     value={outEmpSearch}

&#x20;                     onChange={(e) => {

&#x20;                       setOutEmpSearch(e.target.value);

&#x20;                       setSelectedOutEmp(null);

&#x20;                       setShowOutTimeInput(false);

&#x20;                     }}

&#x20;                     className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500 text-sm font-medium" 

&#x20;                     placeholder="Kirjoita vähintään 3 merkkiä hakeaksesi (esim. Kor tai Vir)..."

&#x20;                   />

&#x20;                 </div>

&#x20;                 

&#x20;                 {outEmpSearch.length >= 3 \&\& !selectedOutEmp \&\& (

&#x20;                   <ul className="absolute z-10 bg-white border border-slate-200 rounded-lg shadow-lg w-full mt-1 max-h-60 overflow-y-auto">

&#x20;                     {filteredOutEmployees.length > 0 ? (

&#x20;                       filteredOutEmployees.map((emp) => (

&#x20;                         <li 

&#x20;                           key={emp.id} 

&#x20;                           onClick={() => {

&#x20;                             setSelectedOutEmp(emp);

&#x20;                             setOutEmpSearch(emp.name);

&#x20;                           }}

&#x20;                           className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-medium text-slate-700 border-b border-slate-100 last:border-0 flex justify-between items-center"

&#x20;                         >

&#x20;                           <span>{emp.name}</span>

&#x20;                           <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">{emp.role}</span>

&#x20;                         </li>

&#x20;                       ))

&#x20;                     ) : (

&#x20;                       <li className="px-4 py-3 text-sm text-slate-500">Ei osumia sisäänkirjatuista työntekijöistä.</li>

&#x20;                     )}

&#x20;                   </ul>

&#x20;                 )}

&#x20;               </div>

&#x20;             </div>



&#x20;             {/\* Uloskirjauslomake (näytetään vain kun työntekijä on valittu) \*/}

&#x20;             {selectedOutEmp \&\& (

&#x20;               <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-6 border-t border-slate-200 pt-6">

&#x20;                 

&#x20;                 {/\* Yhteenveto sisäänkirjauksesta \*/}

&#x20;                 <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">

&#x20;                   <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b border-slate-200 pb-2">

&#x20;                     Sisäänkirjauksen tiedot

&#x20;                   </h3>

&#x20;                   <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">

&#x20;                     <div>

&#x20;                       <span className="block text-slate-500 text-xs mb-1">Rooli</span>

&#x20;                       <span className="font-semibold text-slate-800">{selectedOutEmp.role}</span>

&#x20;                     </div>

&#x20;                     <div>

&#x20;                       <span className="block text-slate-500 text-xs mb-1">JV Yksilötunnus</span>

&#x20;                       <span className="font-semibold text-slate-800">{selectedOutEmp.badge || '-'}</span>

&#x20;                     </div>

&#x20;                     <div>

&#x20;                       <span className="block text-slate-500 text-xs mb-1">Liivi luovutettu</span>

&#x20;                       <span className="font-semibold text-slate-800 flex items-center gap-1">

&#x20;                         {selectedOutEmp.vest ? <CheckCircle size={14} className="text-emerald-500"/> : <XCircle size={14} className="text-rose-500"/>}

&#x20;                         {selectedOutEmp.vest ? 'Kyllä' : 'Ei'}

&#x20;                       </span>

&#x20;                     </div>

&#x20;                     <div>

&#x20;                       <span className="block text-slate-500 text-xs mb-1">Radiopuhelin</span>

&#x20;                       <span className="font-semibold text-slate-800">{selectedOutEmp.radio || '-'}</span>

&#x20;                     </div>

&#x20;                     <div>

&#x20;                       <span className="block text-slate-500 text-xs mb-1">Headset</span>

&#x20;                       <span className="font-semibold text-slate-800 flex items-center gap-1">

&#x20;                         {selectedOutEmp.headset ? <CheckCircle size={14} className="text-emerald-500"/> : <XCircle size={14} className="text-rose-500"/>}

&#x20;                         {selectedOutEmp.headset ? 'Kyllä' : 'Ei'}

&#x20;                       </span>

&#x20;                     </div>

&#x20;                   </div>

&#x20;                 </div>



&#x20;                 {/\* Uloskirjauksen kommentti \*/}

&#x20;                 <div>

&#x20;                   <label className="block text-sm font-bold text-slate-700 mb-2">Uloskirjauksen kommentit ja huomiot</label>

&#x20;                   <textarea 

&#x20;                     rows="3" 

&#x20;                     className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-rose-500" 

&#x20;                     placeholder="Kirjaa ylös jos välineitä on hajonnut, kadonnut, tai jos työntekijällä on jotain raportoitavaa vuoron päätteeksi..."

&#x20;                   ></textarea>

&#x20;                 </div>



&#x20;                 {/\* Toiminnot \*/}

&#x20;                 <div className="pt-2">

&#x20;                   {!showOutTimeInput ? (

&#x20;                     <div className="flex flex-col sm:flex-row gap-3">

&#x20;                       <button 

&#x20;                         type="button" 

&#x20;                         onClick={() => {

&#x20;                           // Tässä tallennetaan data nykyajalla. UI:n tyhjennys demo-tarkoituksessa:

&#x20;                           setSelectedOutEmp(null);

&#x20;                           setOutEmpSearch('');

&#x20;                         }}

&#x20;                         className="flex-1 py-3 px-4 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors flex justify-center items-center gap-2 shadow-sm"

&#x20;                       >

&#x20;                         <LogOut size={18} />

&#x20;                         KIRJAA ULOS NYT

&#x20;                       </button>

&#x20;                       <button 

&#x20;                         type="button" 

&#x20;                         onClick={() => setShowOutTimeInput(true)}

&#x20;                         className="flex-1 py-3 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex justify-center items-center gap-2"

&#x20;                       >

&#x20;                         <Clock size={18} />

&#x20;                         Kirjaa ulos muu aika

&#x20;                       </button>

&#x20;                     </div>

&#x20;                   ) : (

&#x20;                     <div className="bg-rose-50/50 p-5 rounded-xl border border-rose-100 animate-in fade-in slide-in-from-bottom-2">

&#x20;                       <label className="block text-sm font-bold text-slate-800 mb-3">Valitse poikkeava uloskirjausaika</label>

&#x20;                       <div className="flex gap-3 mb-5">

&#x20;                         <input 

&#x20;                           type="date" 

&#x20;                           value={checkOutDate}

&#x20;                           onChange={(e) => setCheckOutDate(e.target.value)}

&#x20;                           className="flex-1 rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-rose-500 bg-white" 

&#x20;                         />

&#x20;                         <input 

&#x20;                           type="time" 

&#x20;                           value={checkOutTime}

&#x20;                           onChange={(e) => setCheckOutTime(e.target.value)}

&#x20;                           className="flex-1 rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-rose-500 bg-white" 

&#x20;                         />

&#x20;                       </div>

&#x20;                       <div className="flex gap-3">

&#x20;                         <button 

&#x20;                           type="button" 

&#x20;                           onClick={() => {

&#x20;                             setSelectedOutEmp(null);

&#x20;                             setOutEmpSearch('');

&#x20;                             setShowOutTimeInput(false);

&#x20;                           }}

&#x20;                           className="px-5 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm flex-1"

&#x20;                         >

&#x20;                           Tallenna uloskirjaus

&#x20;                         </button>

&#x20;                         <button 

&#x20;                           type="button" 

&#x20;                           onClick={() => setShowOutTimeInput(false)}

&#x20;                           className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"

&#x20;                         >

&#x20;                           Peruuta ajan valinta

&#x20;                         </button>

&#x20;                       </div>

&#x20;                     </div>

&#x20;                   )}

&#x20;                 </div>

&#x20;               </div>

&#x20;             )}

&#x20;           </form>

&#x20;         </div>

&#x20;       );

&#x20;     case 'tike\_form\_open':

&#x20;       return (

&#x20;         <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">

&#x20;           <button 

&#x20;             onClick={() => setActiveTab('report\_tike')}

&#x20;             className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"

&#x20;           >

&#x20;             <ArrowLeft size={16} />

&#x20;             Takaisin TIKE-valikkoon

&#x20;           </button>



&#x20;           <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">

&#x20;             <div>

&#x20;               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">

&#x20;                 <PenTool className="text-indigo-500" size={24} />

&#x20;                 Avoin kirjaus

&#x20;               </h2>

&#x20;               <p className="text-sm text-slate-500 mt-1">Vapaamuotoinen lokikirjaus poikkeamista tai toimenpiteistä.</p>

&#x20;             </div>

&#x20;             

&#x20;             {/\* Dynaaminen tunniste \*/}

&#x20;             <div className="flex flex-col items-end">

&#x20;               <span className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Tunniste</span>

&#x20;               <div className="text-sm font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">

&#x20;                 {getDynamicId()}

&#x20;               </div>

&#x20;             </div>

&#x20;           </div>



&#x20;           <form className="space-y-6 text-left">

&#x20;             

&#x20;             <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">

&#x20;               <label className="block text-sm font-bold text-slate-700 mb-2">Tapahtuma-aika</label>

&#x20;               <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">

&#x20;                 <div className="flex gap-2 w-full sm:w-auto">

&#x20;                   <input 

&#x20;                     type="date" 

&#x20;                     value={openKirjausDate}

&#x20;                     onChange={(e) => setOpenKirjausDate(e.target.value)}

&#x20;                     className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" 

&#x20;                   />

&#x20;                   <input 

&#x20;                     type="time" 

&#x20;                     value={openKirjausTime}

&#x20;                     onChange={(e) => setOpenKirjausTime(e.target.value)}

&#x20;                     className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" 

&#x20;                   />

&#x20;                 </div>

&#x20;                 <button 

&#x20;                   type="button" 

&#x20;                   onClick={handleOpenKirjausNyt}

&#x20;                   className="px-4 py-2 text-xs font-bold bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg transition-colors shadow-sm"

&#x20;                 >

&#x20;                   NYT

&#x20;                 </button>

&#x20;               </div>

&#x20;             </div>



&#x20;             <div>

&#x20;               <label className="block text-sm font-bold text-slate-700 mb-2">Kuvaus tapahtuneesta</label>

&#x20;               <textarea 

&#x20;                 rows="6" 

&#x20;                 value={openKirjausText}

&#x20;                 onChange={(e) => setOpenKirjausText(e.target.value)}

&#x20;                 className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-indigo-500" 

&#x20;                 placeholder="Kirjoita tarkka ja ytimekäs kuvaus tilanteesta ja tehdyistä toimenpiteistä..."

&#x20;               ></textarea>

&#x20;             </div>



&#x20;             <div className="border border-dashed border-slate-300 rounded-xl p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-3">

&#x20;               <div className="flex gap-4">

&#x20;                 {/\* Mobiilikamera-painike (capture="environment") \*/}

&#x20;                 <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-indigo-300 rounded-lg transition-all text-sm font-medium text-slate-700">

&#x20;                   <Camera size={18} className="text-indigo-500" />

&#x20;                   Ota kuva

&#x20;                   <input 

&#x20;                     type="file" 

&#x20;                     accept="image/\*" 

&#x20;                     capture="environment" 

&#x20;                     className="hidden" 

&#x20;                     onChange={(e) => setFileName(e.target.files\[0]?.name || '')}

&#x20;                   />

&#x20;                 </label>



&#x20;                 {/\* Tiedoston valinta \*/}

&#x20;                 <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-indigo-300 rounded-lg transition-all text-sm font-medium text-slate-700">

&#x20;                   <Paperclip size={18} className="text-indigo-500" />

&#x20;                   Liitä tiedosto

&#x20;                   <input 

&#x20;                     type="file" 

&#x20;                     className="hidden" 

&#x20;                     onChange={(e) => setFileName(e.target.files\[0]?.name || '')}

&#x20;                   />

&#x20;                 </label>

&#x20;               </div>

&#x20;               {fileName \&\& (

&#x20;                 <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 mt-2">

&#x20;                   <FileCheck size={16} />

&#x20;                   Liitetty: {fileName}

&#x20;                 </div>

&#x20;               )}

&#x20;             </div>



&#x20;             <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">

&#x20;               <button 

&#x20;                 type="button" 

&#x20;                 onClick={() => { 

&#x20;                   setActiveTab('report\_tike'); 

&#x20;                   setOpenKirjausText(''); 

&#x20;                   setFileName(''); 

&#x20;                 }}

&#x20;                 className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"

&#x20;               >

&#x20;                 Peruuta

&#x20;               </button>

&#x20;               <button 

&#x20;                 type="button" 

&#x20;                 onClick={() => {

&#x20;                   // Tallennuksen yhteydessä juokseva numero kasvaa

&#x20;                   setRunningNumber(prev => prev + 1);

&#x20;                   setActiveTab('report\_tike');

&#x20;                   setOpenKirjausText('');

&#x20;                   setFileName('');

&#x20;                 }}

&#x20;                 className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"

&#x20;               >

&#x20;                 <CheckCircle size={18} />

&#x20;                 Tallenna kirjaus

&#x20;               </button>

&#x20;             </div>

&#x20;           </form>

&#x20;         </div>

&#x20;       );

&#x20;     case 'tike\_form\_firstaid':

&#x20;       return (

&#x20;         <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">

&#x20;           <button 

&#x20;             onClick={() => setActiveTab('report\_tike')}

&#x20;             className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"

&#x20;           >

&#x20;             <ArrowLeft size={16} />

&#x20;             Takaisin TIKE-valikkoon

&#x20;           </button>



&#x20;           <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">

&#x20;             <div>

&#x20;               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">

&#x20;                 <HeartPulse className="text-rose-500" size={24} />

&#x20;                 Ensiaputilanne

&#x20;               </h2>

&#x20;               <p className="text-sm text-slate-500 mt-1">Kirjaa ensiapua vaatineet tapahtumat ja resurssien käyttö.</p>

&#x20;             </div>

&#x20;             

&#x20;             {/\* Dynaaminen tunniste \*/}

&#x20;             <div className="flex flex-col items-end">

&#x20;               <span className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Tunniste</span>

&#x20;               <div className="text-sm font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">

&#x20;                 {getDynamicId()}

&#x20;               </div>

&#x20;             </div>

&#x20;           </div>



&#x20;           <form className="space-y-6 text-left">

&#x20;             

&#x20;             <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">

&#x20;               <label className="block text-sm font-bold text-slate-700 mb-2">Tapahtuma-aika</label>

&#x20;               <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">

&#x20;                 <div className="flex gap-2 w-full sm:w-auto">

&#x20;                   <input 

&#x20;                     type="date" 

&#x20;                     value={faDate}

&#x20;                     onChange={(e) => setFaDate(e.target.value)}

&#x20;                     className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-rose-500" 

&#x20;                   />

&#x20;                   <input 

&#x20;                     type="time" 

&#x20;                     value={faTime}

&#x20;                     onChange={(e) => setFaTime(e.target.value)}

&#x20;                     className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-rose-500" 

&#x20;                   />

&#x20;                 </div>

&#x20;                 <button 

&#x20;                   type="button" 

&#x20;                   onClick={handleFaNyt}

&#x20;                   className="px-4 py-2 text-xs font-bold bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg transition-colors shadow-sm"

&#x20;                 >

&#x20;                   NYT

&#x20;                 </button>

&#x20;               </div>

&#x20;             </div>



&#x20;             <div className="space-y-4">

&#x20;               <div>

&#x20;                 <label className="block text-sm font-bold text-slate-700 mb-1">Tapahtuman kuvaus</label>

&#x20;                 <textarea 

&#x20;                   rows="3" 

&#x20;                   value={faDesc}

&#x20;                   onChange={(e) => setFaDesc(e.target.value)}

&#x20;                   className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-rose-500" 

&#x20;                   placeholder="Mitä tapahtui? Potilaan tila ja oireet..."

&#x20;                 ></textarea>

&#x20;               </div>

&#x20;               

&#x20;               <div>

&#x20;                 <label className="block text-sm font-bold text-slate-700 mb-1">Tehdyt toimenpiteet</label>

&#x20;                 <textarea 

&#x20;                   rows="3" 

&#x20;                   value={faActions}

&#x20;                   onChange={(e) => setFaActions(e.target.value)}

&#x20;                   className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-rose-500" 

&#x20;                   placeholder="Mitä toimenpiteitä tehtiin? (esim. haavan puhdistus, sidonta, ohjaus jatkohoitoon)"

&#x20;                 ></textarea>

&#x20;               </div>



&#x20;               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

&#x20;                 <div>

&#x20;                   <label className="block text-sm font-bold text-slate-700 mb-1">Mitä resursseja kului</label>

&#x20;                   <textarea 

&#x20;                     rows="2" 

&#x20;                     value={faResources}

&#x20;                     onChange={(e) => setFaResources(e.target.value)}

&#x20;                     className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-rose-500" 

&#x20;                     placeholder="Esim. ensihoitotarvikkeet, lanssin tilaus..."

&#x20;                   ></textarea>

&#x20;                 </div>

&#x20;                 <div>

&#x20;                   <label className="block text-sm font-bold text-slate-700 mb-1">Mitkä työntekijät paikalla olivat</label>

&#x20;                   <textarea 

&#x20;                     rows="2" 

&#x20;                     value={faEmployees}

&#x20;                     onChange={(e) => setFaEmployees(e.target.value)}

&#x20;                     className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-rose-500" 

&#x20;                     placeholder="Nimet / kutsumanimet"

&#x20;                   ></textarea>

&#x20;                 </div>

&#x20;               </div>

&#x20;             </div>



&#x20;             <div className="border border-dashed border-slate-300 rounded-xl p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-3">

&#x20;               <div className="flex gap-4">

&#x20;                 {/\* Mobiilikamera-painike \*/}

&#x20;                 <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-rose-300 rounded-lg transition-all text-sm font-medium text-slate-700">

&#x20;                   <Camera size={18} className="text-rose-500" />

&#x20;                   Ota kuva

&#x20;                   <input 

&#x20;                     type="file" 

&#x20;                     accept="image/\*" 

&#x20;                     capture="environment" 

&#x20;                     className="hidden" 

&#x20;                     onChange={(e) => setFaFileName(e.target.files\[0]?.name || '')}

&#x20;                   />

&#x20;                 </label>



&#x20;                 {/\* Tiedoston valinta \*/}

&#x20;                 <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-rose-300 rounded-lg transition-all text-sm font-medium text-slate-700">

&#x20;                   <Paperclip size={18} className="text-rose-500" />

&#x20;                   Liitä tiedosto

&#x20;                   <input 

&#x20;                     type="file" 

&#x20;                     className="hidden" 

&#x20;                     onChange={(e) => setFaFileName(e.target.files\[0]?.name || '')}

&#x20;                   />

&#x20;                 </label>

&#x20;               </div>

&#x20;               {faFileName \&\& (

&#x20;                 <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 mt-2">

&#x20;                   <FileCheck size={16} />

&#x20;                   Liitetty: {faFileName}

&#x20;                 </div>

&#x20;               )}

&#x20;             </div>



&#x20;             <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">

&#x20;               <button 

&#x20;                 type="button" 

&#x20;                 onClick={() => { 

&#x20;                   setActiveTab('report\_tike'); 

&#x20;                   setFaDesc(''); setFaActions(''); setFaResources(''); setFaEmployees(''); setFaFileName(''); 

&#x20;                 }}

&#x20;                 className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"

&#x20;               >

&#x20;                 Peruuta

&#x20;               </button>

&#x20;               <button 

&#x20;                 type="button" 

&#x20;                 onClick={() => {

&#x20;                   setRunningNumber(prev => prev + 1);

&#x20;                   setActiveTab('report\_tike');

&#x20;                   setFaDesc(''); setFaActions(''); setFaResources(''); setFaEmployees(''); setFaFileName('');

&#x20;                 }}

&#x20;                 className="px-5 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"

&#x20;               >

&#x20;                 <CheckCircle size={18} />

&#x20;                 Tallenna EA-kirjaus

&#x20;               </button>

&#x20;             </div>

&#x20;           </form>

&#x20;         </div>

&#x20;       );

&#x20;     case 'tike\_form\_patrol':

&#x20;       return (

&#x20;         <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">

&#x20;           <button 

&#x20;             onClick={() => {

&#x20;               setActiveTab('report\_tike');

&#x20;               setPatrolDate(''); setPatrolTime(''); setPatrolPerson(''); setPatrolAreas(''); setPatrolDeviations(''); setPatrolFile('');

&#x20;             }}

&#x20;             className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"

&#x20;           >

&#x20;             <ArrowLeft size={16} />

&#x20;             Takaisin TIKE-valikkoon

&#x20;           </button>



&#x20;           <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">

&#x20;             <div>

&#x20;               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">

&#x20;                 <Clipboard className="text-blue-600" size={24} />

&#x20;                 Kierrosraportti

&#x20;               </h2>

&#x20;               <p className="text-sm text-slate-500 mt-1">Kirjaa suoritetut partio- ja tarkastuskierrokset.</p>

&#x20;             </div>

&#x20;             

&#x20;             {/\* Dynaaminen tunniste \*/}

&#x20;             <div className="flex flex-col items-end">

&#x20;               <span className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Tunniste</span>

&#x20;               <div className="text-sm font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">

&#x20;                 {getDynamicId()}

&#x20;               </div>

&#x20;             </div>

&#x20;           </div>



&#x20;           <form className="space-y-6 text-left">

&#x20;             <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">

&#x20;               <label className="block text-sm font-bold text-slate-700 mb-2">Tapahtuma-aika</label>

&#x20;               <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">

&#x20;                 <div className="flex gap-2 w-full sm:w-auto">

&#x20;                   <input 

&#x20;                     type="date" 

&#x20;                     value={patrolDate}

&#x20;                     onChange={(e) => setPatrolDate(e.target.value)}

&#x20;                     className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-blue-500" 

&#x20;                   />

&#x20;                   <input 

&#x20;                     type="time" 

&#x20;                     value={patrolTime}

&#x20;                     onChange={(e) => setPatrolTime(e.target.value)}

&#x20;                     className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-blue-500" 

&#x20;                   />

&#x20;                 </div>

&#x20;                 <button 

&#x20;                   type="button" 

&#x20;                   onClick={handlePatrolNyt}

&#x20;                   className="px-4 py-2 text-xs font-bold bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg transition-colors shadow-sm"

&#x20;                 >

&#x20;                   NYT

&#x20;                 </button>

&#x20;               </div>

&#x20;             </div>



&#x20;             <div className="space-y-4">

&#x20;               <div>

&#x20;                 <label className="block text-sm font-bold text-slate-700 mb-1">Kuka kierroksen on suorittanut</label>

&#x20;                 <input 

&#x20;                   type="text"

&#x20;                   value={patrolPerson}

&#x20;                   onChange={(e) => setPatrolPerson(e.target.value)}

&#x20;                   className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-blue-500"

&#x20;                   placeholder="Esim. Partio 3 (Virtanen \& Korhonen) tai Turva 2..."

&#x20;                 />

&#x20;               </div>



&#x20;               <div>

&#x20;                 <label className="block text-sm font-bold text-slate-700 mb-1">Mitkä alueet on tarkastettu</label>

&#x20;                 <textarea 

&#x20;                   rows="3" 

&#x20;                   value={patrolAreas}

&#x20;                   onChange={(e) => setPatrolAreas(e.target.value)}

&#x20;                   className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-blue-500" 

&#x20;                   placeholder="Luettele tarkastetut portit, lohkot, reitit tai VIP-alueet..."

&#x20;                 ></textarea>

&#x20;               </div>

&#x20;               

&#x20;               <div>

&#x20;                 <label className="block text-sm font-bold text-slate-700 mb-1">Poikkeamat</label>

&#x20;                 <textarea 

&#x20;                   rows="3" 

&#x20;                   value={patrolDeviations}

&#x20;                   onChange={(e) => setPatrolDeviations(e.target.value)}

&#x20;                   className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-blue-500" 

&#x20;                   placeholder="Havaitut puutteet, vaaranpaikat tai erikoisuudet kierroksen aikana..."

&#x20;                 ></textarea>

&#x20;               </div>

&#x20;             </div>



&#x20;             <div className="border border-dashed border-slate-300 rounded-xl p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-3">

&#x20;               <div className="flex gap-4">

&#x20;                 <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-blue-300 rounded-lg transition-all text-sm font-medium text-slate-700">

&#x20;                   <Camera size={18} className="text-blue-500" />

&#x20;                   Ota kuva

&#x20;                   <input 

&#x20;                     type="file" 

&#x20;                     accept="image/\*" 

&#x20;                     capture="environment" 

&#x20;                     className="hidden" 

&#x20;                     onChange={(e) => setPatrolFile(e.target.files\[0]?.name || '')}

&#x20;                   />

&#x20;                 </label>



&#x20;                 <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-blue-300 rounded-lg transition-all text-sm font-medium text-slate-700">

&#x20;                   <Paperclip size={18} className="text-blue-500" />

&#x20;                   Liitä tiedosto

&#x20;                   <input 

&#x20;                     type="file" 

&#x20;                     className="hidden" 

&#x20;                     onChange={(e) => setPatrolFile(e.target.files\[0]?.name || '')}

&#x20;                   />

&#x20;                 </label>

&#x20;               </div>

&#x20;               {patrolFile \&\& (

&#x20;                 <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 mt-2">

&#x20;                   <FileCheck size={16} />

&#x20;                   Liitetty: {patrolFile}

&#x20;                 </div>

&#x20;               )}

&#x20;             </div>



&#x20;             <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">

&#x20;               <button 

&#x20;                 type="button" 

&#x20;                 onClick={() => { 

&#x20;                   setActiveTab('report\_tike'); 

&#x20;                   setPatrolDate(''); setPatrolTime(''); setPatrolPerson(''); setPatrolAreas(''); setPatrolDeviations(''); setPatrolFile(''); 

&#x20;                 }}

&#x20;                 className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"

&#x20;               >

&#x20;                 Peruuta

&#x20;               </button>

&#x20;               <button 

&#x20;                 type="button" 

&#x20;                 onClick={() => {

&#x20;                   setRunningNumber(prev => prev + 1);

&#x20;                   setActiveTab('report\_tike');

&#x20;                   setPatrolDate(''); setPatrolTime(''); setPatrolPerson(''); setPatrolAreas(''); setPatrolDeviations(''); setPatrolFile('');

&#x20;                 }}

&#x20;                 className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"

&#x20;               >

&#x20;                 <CheckCircle size={18} />

&#x20;                 Tallenna kirjaus

&#x20;               </button>

&#x20;             </div>

&#x20;           </form>

&#x20;         </div>

&#x20;       );

&#x20;     case 'tike\_form\_threat':

&#x20;     case 'tike\_form\_damage':

&#x20;     case 'tike\_form\_lostfound':

&#x20;     case 'tike\_form\_queue':

&#x20;     case 'tike\_form\_weather': {

&#x20;       const genericForms = {

&#x20;         tike\_form\_threat: { title: 'Uhkatilanne', icon: AlertTriangle, iconColor: 'text-amber-500', btnBg: 'bg-amber-600 hover:bg-amber-700', nytBg: 'bg-amber-100 hover:bg-amber-200 text-amber-800', focusRing: 'focus:ring-amber-500', desc: 'Kirjaa havaitut uhkatilanteet ja niihin liittyvät toimenpiteet.' },

&#x20;         tike\_form\_damage: { title: 'Omaisuusvaurio', icon: Wrench, iconColor: 'text-slate-600', btnBg: 'bg-slate-600 hover:bg-slate-700', nytBg: 'bg-slate-200 hover:bg-slate-300 text-slate-800', focusRing: 'focus:ring-slate-500', desc: 'Kirjaa alueella tapahtuneet omaisuusvauriot ja rikkoutumiset.' },

&#x20;         tike\_form\_lostfound: { title: 'Löytötavara', icon: Package, iconColor: 'text-indigo-500', btnBg: 'bg-indigo-600 hover:bg-indigo-700', nytBg: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800', focusRing: 'focus:ring-indigo-500', desc: 'Kirjaa vastaanotetut tai toimitetut löytötavarat.' },

&#x20;         tike\_form\_queue: { title: 'Portin jonon odotusaika', icon: Clock, iconColor: 'text-blue-500', btnBg: 'bg-blue-600 hover:bg-blue-700', nytBg: 'bg-blue-100 hover:bg-blue-200 text-blue-800', focusRing: 'focus:ring-blue-500', desc: 'Kirjaa porttien jonotilanne ja odotusajat.' },

&#x20;         tike\_form\_weather: { title: 'Sääraportti', icon: Cloud, iconColor: 'text-sky-500', btnBg: 'bg-sky-600 hover:bg-sky-700', nytBg: 'bg-sky-100 hover:bg-sky-200 text-sky-800', focusRing: 'focus:ring-sky-500', desc: 'Kirjaa sääolosuhteiden muutokset ja varautumistoimenpiteet.' },

&#x20;       };

&#x20;       

&#x20;       const config = genericForms\[activeTab];

&#x20;       const Icon = config.icon;



&#x20;       return (

&#x20;         <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">

&#x20;           <button 

&#x20;             onClick={() => {

&#x20;               setActiveTab('report\_tike');

&#x20;               setGenRepDate(''); setGenRepTime(''); setGenRepDesc(''); setGenRepActions(''); setGenRepEmps(''); setGenRepFile('');

&#x20;             }}

&#x20;             className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"

&#x20;           >

&#x20;             <ArrowLeft size={16} />

&#x20;             Takaisin TIKE-valikkoon

&#x20;           </button>



&#x20;           <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">

&#x20;             <div>

&#x20;               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">

&#x20;                 <Icon className={config.iconColor} size={24} />

&#x20;                 {config.title}

&#x20;               </h2>

&#x20;               <p className="text-sm text-slate-500 mt-1">{config.desc}</p>

&#x20;             </div>

&#x20;             

&#x20;             <div className="flex flex-col items-end">

&#x20;               <span className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Tunniste</span>

&#x20;               <div className="text-sm font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">

&#x20;                 {getDynamicId()}

&#x20;               </div>

&#x20;             </div>

&#x20;           </div>



&#x20;           <form className="space-y-6 text-left">

&#x20;             <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">

&#x20;               <label className="block text-sm font-bold text-slate-700 mb-2">Tapahtuma-aika</label>

&#x20;               <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">

&#x20;                 <div className="flex gap-2 w-full sm:w-auto">

&#x20;                   <input 

&#x20;                     type="date" 

&#x20;                     value={genRepDate}

&#x20;                     onChange={(e) => setGenRepDate(e.target.value)}

&#x20;                     className={`w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm ${config.focusRing}`}

&#x20;                   />

&#x20;                   <input 

&#x20;                     type="time" 

&#x20;                     value={genRepTime}

&#x20;                     onChange={(e) => setGenRepTime(e.target.value)}

&#x20;                     className={`w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm ${config.focusRing}`}

&#x20;                   />

&#x20;                 </div>

&#x20;                 <button 

&#x20;                   type="button" 

&#x20;                   onClick={handleGenRepNyt}

&#x20;                   className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm ${config.nytBg}`}

&#x20;                 >

&#x20;                   NYT

&#x20;                 </button>

&#x20;               </div>

&#x20;             </div>



&#x20;             <div className="space-y-4">

&#x20;               <div>

&#x20;                 <label className="block text-sm font-bold text-slate-700 mb-1">Tapahtuman kuvaus</label>

&#x20;                 <textarea 

&#x20;                   rows="3" 

&#x20;                   value={genRepDesc}

&#x20;                   onChange={(e) => setGenRepDesc(e.target.value)}

&#x20;                   className={`w-full rounded-lg border-slate-300 border p-3 text-sm ${config.focusRing}`}

&#x20;                   placeholder="Mitä havaittiin tai tapahtui..."

&#x20;                 ></textarea>

&#x20;               </div>

&#x20;               

&#x20;               <div>

&#x20;                 <label className="block text-sm font-bold text-slate-700 mb-1">Tehdyt toimenpiteet</label>

&#x20;                 <textarea 

&#x20;                   rows="3" 

&#x20;                   value={genRepActions}

&#x20;                   onChange={(e) => setGenRepActions(e.target.value)}

&#x20;                   className={`w-full rounded-lg border-slate-300 border p-3 text-sm ${config.focusRing}`}

&#x20;                   placeholder="Miten tilanteeseen reagoitiin, kenelle ilmoitettu..."

&#x20;                 ></textarea>

&#x20;               </div>



&#x20;               <div>

&#x20;                 <label className="block text-sm font-bold text-slate-700 mb-1">Mitkä työntekijät paikalla olivat</label>

&#x20;                 <textarea 

&#x20;                   rows="2" 

&#x20;                   value={genRepEmps}

&#x20;                   onChange={(e) => setGenRepEmps(e.target.value)}

&#x20;                   className={`w-full rounded-lg border-slate-300 border p-3 text-sm ${config.focusRing}`}

&#x20;                   placeholder="Paikalla olleiden työntekijöiden nimet tai kutsutunnukset..."

&#x20;                 ></textarea>

&#x20;               </div>

&#x20;             </div>



&#x20;             <div className="border border-dashed border-slate-300 rounded-xl p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-3">

&#x20;               <div className="flex gap-4">

&#x20;                 <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 rounded-lg transition-all text-sm font-medium text-slate-700">

&#x20;                   <Camera size={18} className={config.iconColor} />

&#x20;                   Ota kuva

&#x20;                   <input 

&#x20;                     type="file" 

&#x20;                     accept="image/\*" 

&#x20;                     capture="environment" 

&#x20;                     className="hidden" 

&#x20;                     onChange={(e) => setGenRepFile(e.target.files\[0]?.name || '')}

&#x20;                   />

&#x20;                 </label>



&#x20;                 <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 rounded-lg transition-all text-sm font-medium text-slate-700">

&#x20;                   <Paperclip size={18} className={config.iconColor} />

&#x20;                   Liitä tiedosto

&#x20;                   <input 

&#x20;                     type="file" 

&#x20;                     className="hidden" 

&#x20;                     onChange={(e) => setGenRepFile(e.target.files\[0]?.name || '')}

&#x20;                   />

&#x20;                 </label>

&#x20;               </div>

&#x20;               {genRepFile \&\& (

&#x20;                 <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 mt-2">

&#x20;                   <FileCheck size={16} />

&#x20;                   Liitetty: {genRepFile}

&#x20;                 </div>

&#x20;               )}

&#x20;             </div>



&#x20;             <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">

&#x20;               <button 

&#x20;                 type="button" 

&#x20;                 onClick={() => { 

&#x20;                   setActiveTab('report\_tike'); 

&#x20;                   setGenRepDate(''); setGenRepTime(''); setGenRepDesc(''); setGenRepActions(''); setGenRepEmps(''); setGenRepFile(''); 

&#x20;                 }}

&#x20;                 className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"

&#x20;               >

&#x20;                 Peruuta

&#x20;               </button>

&#x20;               <button 

&#x20;                 type="button" 

&#x20;                 onClick={() => {

&#x20;                   setRunningNumber(prev => prev + 1);

&#x20;                   setActiveTab('report\_tike');

&#x20;                   setGenRepDate(''); setGenRepTime(''); setGenRepDesc(''); setGenRepActions(''); setGenRepEmps(''); setGenRepFile('');

&#x20;                 }}

&#x20;                 className={`px-5 py-2.5 text-sm font-bold text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm ${config.btnBg}`}

&#x20;               >

&#x20;                 <CheckCircle size={18} />

&#x20;                 Tallenna kirjaus

&#x20;               </button>

&#x20;             </div>

&#x20;           </form>

&#x20;         </div>

&#x20;       );

&#x20;     }

&#x20;     case 'planning':

&#x20;       return (

&#x20;         <div className="space-y-6 max-w-5xl">

&#x20;           {/\* Status Banner \*/}

&#x20;           <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm ${readinessStatusColor}`}>

&#x20;             <div className="flex items-center gap-3">

&#x20;               <div className={`p-2 bg-white rounded-lg ${readinessStatusIconColor} shadow-sm`}>

&#x20;                 <DoorOpen size={24} />

&#x20;               </div>

&#x20;               <div>

&#x20;                 <h3 className="font-bold text-lg leading-tight">Avausvalmius</h3>

&#x20;                 <p className="text-sm font-medium">{readinessStatusText}</p>

&#x20;               </div>

&#x20;             </div>

&#x20;             <div className="text-3xl font-black tabular-nums tracking-tighter">

&#x20;               {completedChecksCount}/5

&#x20;             </div>

&#x20;           </div>



&#x20;           <div className="mb-6 pb-4 border-b border-slate-200">

&#x20;             <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">

&#x20;               <Calendar className="text-indigo-500" size={28} />

&#x20;               Ennen tapahtumaa

&#x20;             </h2>

&#x20;             <p className="text-sm text-slate-500 mt-1">Suunnittelu, varautuminen ja henkilöstöhallinto.</p>

&#x20;           </div>

&#x20;           

&#x20;           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

&#x20;             {/\* Avausvalmius Card \*/}

&#x20;             <button 

&#x20;               onClick={() => setActiveTab('planning\_readiness')}

&#x20;               className={`bg-white p-6 rounded-xl border shadow-sm transition-all text-left group hover:shadow-md ${isReadyForOpening ? 'border-emerald-200 hover:border-emerald-300' : isLate ? 'border-rose-200 hover:border-rose-300' : 'border-slate-200 hover:border-blue-300'}`}

&#x20;             >

&#x20;               <div className="flex items-center justify-between mb-4">

&#x20;                 <div className={`p-3 rounded-lg transition-colors ${isReadyForOpening ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100' : isLate ? 'bg-rose-50 text-rose-600 group-hover:bg-rose-100' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'}`}>

&#x20;                   <DoorOpen size={24} />

&#x20;                 </div>

&#x20;                 <ChevronRight className="text-slate-400 group-hover:text-slate-600 transition-colors" size={20} />

&#x20;               </div>

&#x20;               <h3 className="text-lg font-bold text-slate-800 mb-1">Avausvalmius</h3>

&#x20;               <p className="text-sm text-slate-500 line-clamp-2">Porttien avauksen edellytysten kuittaus ja tavoiteaika.</p>

&#x20;             </button>



&#x20;             {/\* Työntekijärekisteri Card \*/}

&#x20;             <button 

&#x20;               onClick={() => setActiveTab('planning\_employees')}

&#x20;               className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all text-left group"

&#x20;             >

&#x20;               <div className="flex items-center justify-between mb-4">

&#x20;                 <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 transition-colors">

&#x20;                   <Users size={24} />

&#x20;                 </div>

&#x20;                 <ChevronRight className="text-slate-400 group-hover:text-indigo-500 transition-colors" size={20} />

&#x20;               </div>

&#x20;               <h3 className="text-lg font-bold text-slate-800 mb-1">Tapahtuman työntekijät</h3>

&#x20;               <p className="text-sm text-slate-500 line-clamp-2">Henkilöstörekisteri, pätevyydet ja osallistuvat työntekijät.</p>

&#x20;             </button>



&#x20;             {/\* Uusi työntekijä Card \*/}

&#x20;             <button 

&#x20;               onClick={() => { setEditingEmp(null); setActiveTab('planning\_employee\_new'); }}

&#x20;               className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left group"

&#x20;             >

&#x20;               <div className="flex items-center justify-between mb-4">

&#x20;                 <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition-colors">

&#x20;                   <UserPlus size={24} />

&#x20;                 </div>

&#x20;                 <ChevronRight className="text-slate-400 group-hover:text-emerald-500 transition-colors" size={20} />

&#x20;               </div>

&#x20;               <h3 className="text-lg font-bold text-slate-800 mb-1">Kirjaa uusi työntekijä</h3>

&#x20;               <p className="text-sm text-slate-500 line-clamp-2">Lisää työntekijä rekisteriin ja tarkista luvat sekä koulutukset.</p>

&#x20;             </button>

&#x20;           </div>

&#x20;         </div>

&#x20;       );

&#x20;     case 'planning\_readiness':

&#x20;       const checklistItems = \[

&#x20;         { key: 'exits', label: 'Hätäuloskäynnit miehitetty' },

&#x20;         { key: 'guards', label: 'Vähintään 80% järjestyksenvalvojista paikalla' },

&#x20;         { key: 'vehicles', label: 'Ajoneuvot pois alueelta' },

&#x20;         { key: 'production', label: 'Tuotanto valmis avaukseen' },

&#x20;         { key: 'security', label: 'Turvajohto valmis avaukseen' }

&#x20;       ];



&#x20;       return (

&#x20;         <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-3xl mx-auto">

&#x20;           <button 

&#x20;             onClick={() => setActiveTab('planning')}

&#x20;             className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"

&#x20;           >

&#x20;             <ArrowLeft size={16} />

&#x20;             Takaisin suunnitteluvalikkoon

&#x20;           </button>

&#x20;           

&#x20;           <div className="mb-6 border-b border-slate-100 pb-4">

&#x20;             <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">

&#x20;               <DoorOpen className="text-indigo-500" size={28} />

&#x20;               Avausvalmius (Green Light)

&#x20;             </h2>

&#x20;             <p className="text-sm text-slate-500 mt-1">Kuittaa tapahtuman avauksen edellytykset ennen porttien avaamista yleisölle.</p>

&#x20;           </div>



&#x20;           <form className="space-y-8 text-left">

&#x20;             {/\* Tavoiteaika \*/}

&#x20;             <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex items-center justify-between gap-4 flex-wrap">

&#x20;               <div>

&#x20;                 <h3 className="text-sm font-bold text-slate-800 mb-1">Tavoiteltu avausaika</h3>

&#x20;                 <p className="text-xs text-slate-500">Aseta kellonaika, jolloin portit on tarkoitus avata. Jos valmiutta ei ole kuitattu tähän mennessä, järjestelmä hälyttää myöhästymisestä.</p>

&#x20;               </div>

&#x20;               <div className="flex items-center gap-2">

&#x20;                 <Clock className="text-slate-400" size={18} />

&#x20;                 <input 

&#x20;                   type="time" 

&#x20;                   value={targetOpeningTime}

&#x20;                   onChange={(e) => setTargetOpeningTime(e.target.value)}

&#x20;                   className="w-28 rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 text-center font-bold" 

&#x20;                 />

&#x20;               </div>

&#x20;             </div>



&#x20;             {/\* Tarkistuslista \*/}

&#x20;             <div>

&#x20;               <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">

&#x20;                 <CheckSquare className="text-slate-400" size={20} />

&#x20;                 Edellytysten kuittaus

&#x20;               </h3>

&#x20;               <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">

&#x20;                 {checklistItems.map(item => (

&#x20;                   <label key={item.key} className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">

&#x20;                     <div className="relative flex items-center justify-center">

&#x20;                       <input 

&#x20;                         type="checkbox" 

&#x20;                         checked={readinessChecks\[item.key]}

&#x20;                         onChange={() => toggleReadinessCheck(item.key)}

&#x20;                         className="w-6 h-6 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 transition-all cursor-pointer" 

&#x20;                       />

&#x20;                     </div>

&#x20;                     <span className={`text-base font-medium transition-colors ${readinessChecks\[item.key] ? 'text-slate-800' : 'text-slate-600'}`}>

&#x20;                       {item.label}

&#x20;                     </span>

&#x20;                     {readinessChecks\[item.key] \&\& (

&#x20;                       <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Kyllä</span>

&#x20;                     )}

&#x20;                   </label>

&#x20;                 ))}

&#x20;               </div>

&#x20;             </div>



&#x20;             {/\* Poikkeamat \*/}

&#x20;             <div>

&#x20;               <label className="block text-sm font-bold text-slate-700 mb-2">Avauksen poikkeamat ja lisätiedot</label>

&#x20;               <textarea 

&#x20;                 rows="4" 

&#x20;                 value={readinessComments}

&#x20;                 onChange={(e) => setReadinessComments(e.target.value)}

&#x20;                 className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-indigo-500" 

&#x20;                 placeholder="Kirjaa ylös syyt mahdolliseen myöhästymiseen tai muut huomionarvoiset poikkeamat (esim. 'Turvatarkastuslinja 2 ei käytössä kortinlukijan vian vuoksi')..."

&#x20;               ></textarea>

&#x20;             </div>



&#x20;             {/\* Toiminnot \*/}

&#x20;             <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">

&#x20;               <button 

&#x20;                 type="button" 

&#x20;                 onClick={() => setActiveTab('planning')}

&#x20;                 className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"

&#x20;               >

&#x20;                 <CheckCircle size={18} />

&#x20;                 Tallenna ja sulje

&#x20;               </button>

&#x20;             </div>

&#x20;           </form>

&#x20;         </div>

&#x20;       );

&#x20;     case 'postevent':

&#x20;       const radioChannels = \[

&#x20;         "JV:t Tapahtuma",

&#x20;         "JV:t Välitönläheisyys",

&#x20;         "Toimintaryhmät",

&#x20;         "Toimintaryhmät (vara)",

&#x20;         "Backstage",

&#x20;         "Raportointi",

&#x20;         "Liikenne",

&#x20;         "Turvallisuusjohto ja tike (tarvittaessa viranomaiset)"

&#x20;       ];



&#x20;       const supervisors = \[

&#x20;         { role: "Turva 1", name: "Ismo Näkki" },

&#x20;         { role: "Turva 2", name: "Liisa Ollila" },

&#x20;         { role: "Pääportti 10", name: "Jaakko Mäki" },

&#x20;         { role: "Lava 1 10", name: "Markus Joki" },

&#x20;         { role: "Lava 2 10", name: "Maria Lohi" },

&#x20;         { role: "VIP 10", name: "Sulo Oja" },

&#x20;         { role: "Toimintaryhmä 10", name: "Kalevi Mauno" },

&#x20;         { role: "Kenttä 10", name: "Jouko Neno" },

&#x20;         { role: "Ulko 10", name: "Anna Lahti" }

&#x20;       ];



&#x20;       return (

&#x20;         <div className="space-y-6 max-w-5xl">

&#x20;           <div className="mb-6 pb-4 border-b border-slate-200">

&#x20;             <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">

&#x20;               <Layers className="text-indigo-500" size={28} />

&#x20;               FestivaaliX

&#x20;             </h2>

&#x20;             <p className="text-sm text-slate-500 mt-1">Tapahtuman operatiivinen kartta, viestintäkanavat ja johto.</p>

&#x20;           </div>



&#x20;           {/\* Kartta \*/}

&#x20;           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">

&#x20;             <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">

&#x20;               <Map className="text-indigo-500" size={20} />

&#x20;               Tapahtuman pohjakartta

&#x20;             </h3>

&#x20;             <div className="w-full bg-slate-50 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center min-h-\[300px] md:min-h-\[500px]">

&#x20;               <img 

&#x20;                 src="image\_aa9244.png" 

&#x20;                 alt="Tapahtuman pohjakartta" 

&#x20;                 className="max-w-full h-auto object-contain" 

&#x20;                 onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/800x400/e2e8f0/64748b?text=Kuva+ei+latautunut' }} 

&#x20;               />

&#x20;             </div>

&#x20;           </div>



&#x20;           {/\* Grid for Radios and Supervisors \*/}

&#x20;           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

&#x20;             {/\* Radiokanavat \*/}

&#x20;             <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full">

&#x20;               <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">

&#x20;                 <PhoneCall className="text-emerald-500" size={20} />

&#x20;                 Radiopuhelinten kanavalista

&#x20;               </h3>

&#x20;               <ul className="space-y-2">

&#x20;                 {radioChannels.map((channel, idx) => (

&#x20;                   <li key={idx} className="flex gap-3 items-center p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-colors">

&#x20;                     <span className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">

&#x20;                       {idx + 1}

&#x20;                     </span> 

&#x20;                     <span className="text-sm font-medium text-slate-700">{channel}</span>

&#x20;                   </li>

&#x20;                 ))}

&#x20;               </ul>

&#x20;             </div>



&#x20;             {/\* Esimiehet \*/}

&#x20;             <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full">

&#x20;               <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">

&#x20;                 <Users className="text-blue-500" size={20} />

&#x20;                 Esimiehet ja vastuuhenkilöt

&#x20;               </h3>

&#x20;               <ul className="space-y-2">

&#x20;                 {supervisors.map((sup, idx) => (

&#x20;                   <li key={idx} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg border border-slate-100 transition-colors">

&#x20;                     <span className="text-sm font-bold text-slate-700">{sup.role}</span>

&#x20;                     <span className="text-sm font-medium text-slate-500 bg-white px-2 py-1 rounded shadow-sm border border-slate-200">{sup.name}</span>

&#x20;                   </li>

&#x20;                 ))}

&#x20;               </ul>

&#x20;             </div>

&#x20;           </div>

&#x20;         </div>

&#x20;       );

&#x20;     case 'planning\_employees':

&#x20;       return (

&#x20;         <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">

&#x20;           <button 

&#x20;             onClick={() => setActiveTab('planning')}

&#x20;             className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"

&#x20;           >

&#x20;             <ArrowLeft size={16} />

&#x20;             Takaisin suunnitteluvalikkoon

&#x20;           </button>

&#x20;           

&#x20;           <div className="mb-6 flex justify-between items-end border-b border-slate-100 pb-4">

&#x20;             <div>

&#x20;               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">

&#x20;                 <Users className="text-indigo-500" size={24} />

&#x20;                 Tapahtuman työntekijät

&#x20;               </h2>

&#x20;               <p className="text-sm text-slate-500 mt-1">Tapahtumaan rekisteröity henkilöstö ({mockEmployees.length} henkilöä).</p>

&#x20;             </div>

&#x20;             <button 

&#x20;               onClick={() => { setEditingEmp(null); setActiveTab('planning\_employee\_new'); }}

&#x20;               className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"

&#x20;             >

&#x20;               <UserPlus size={16} />

&#x20;               Lisää uusi

&#x20;             </button>

&#x20;           </div>



&#x20;           <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">

&#x20;             <table className="w-full text-left text-sm">

&#x20;               <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">

&#x20;                 <tr>

&#x20;                   <th className="p-4">Nimi</th>

&#x20;                   <th className="p-4">Roolit</th>

&#x20;                   <th className="p-4">Kortit tarkistettu</th>

&#x20;                   <th className="p-4 text-right">Toiminnot</th>

&#x20;                 </tr>

&#x20;               </thead>

&#x20;               <tbody className="divide-y divide-slate-200">

&#x20;                 {mockCheckedInEmployees.map((emp) => (

&#x20;                   <tr key={emp.id} className="hover:bg-white transition-colors">

&#x20;                     <td className="p-4 font-medium text-slate-800">{emp.name}</td>

&#x20;                     <td className="p-4">

&#x20;                       <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-700/10">

&#x20;                         {emp.role}

&#x20;                       </span>

&#x20;                     </td>

&#x20;                     <td className="p-4">

&#x20;                       <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold">

&#x20;                         <CheckCircle size={14} /> OK

&#x20;                       </span>

&#x20;                     </td>

&#x20;                     <td className="p-4 text-right">

&#x20;                       <button 

&#x20;                         onClick={() => { setEditingEmp(emp); setActiveTab('planning\_employee\_new'); }}

&#x20;                         className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"

&#x20;                       >

&#x20;                         Muokkaa

&#x20;                       </button>

&#x20;                     </td>

&#x20;                   </tr>

&#x20;                 ))}

&#x20;               </tbody>

&#x20;             </table>

&#x20;           </div>

&#x20;         </div>

&#x20;       );

&#x20;     case 'planning\_employee\_new':

&#x20;       return (

&#x20;         <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">

&#x20;           <button 

&#x20;             onClick={() => { setEditingEmp(null); setActiveTab('planning\_employees'); }}

&#x20;             className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"

&#x20;           >

&#x20;             <ArrowLeft size={16} />

&#x20;             Takaisin työntekijälistaan

&#x20;           </button>

&#x20;           

&#x20;           <div className="mb-6 border-b border-slate-100 pb-4">

&#x20;             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">

&#x20;               {editingEmp ? <UserCheck className="text-indigo-500" size={24} /> : <UserPlus className="text-emerald-500" size={24} />}

&#x20;               {editingEmp ? 'Muokkaa työntekijää' : 'Kirjaa uusi työntekijä'}

&#x20;             </h2>

&#x20;             <p className="text-sm text-slate-500 mt-1">

&#x20;               {editingEmp ? 'Päivitä työntekijän perustiedot, luvat ja suoritetut koulutukset.' : 'Lisää työntekijän perustiedot, pätevyydet ja suoritetut koulutukset rekisteriin.'}

&#x20;             </p>

&#x20;           </div>



&#x20;           <form className="space-y-8 text-left">

&#x20;             {/\* Osa 1: Yhteys- ja henkilötiedot \*/}

&#x20;             <div className="space-y-4">

&#x20;               <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">

&#x20;                 <Contact size={18} className="text-slate-400"/>

&#x20;                 1. Henkilö- ja yhteystiedot

&#x20;               </h3>

&#x20;               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

&#x20;                 <div className="md:col-span-2">

&#x20;                   <label className="block text-sm font-medium text-slate-700 mb-1">Koko nimi (Sukunimi Etunimi Toiset nimet)</label>

&#x20;                   <input type="text" defaultValue={editingEmp ? editingEmp.name : ''} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Korhonen Elli Marja Orvokki" />

&#x20;                 </div>

&#x20;                 <div>

&#x20;                   <label className="block text-sm font-medium text-slate-700 mb-1">Henkilötunnus</label>

&#x20;                   <input type="text" defaultValue={editingEmp ? '121280-123X' : ''} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="PPKKVV-XXXX" />

&#x20;                 </div>

&#x20;                 <div>

&#x20;                   <label className="block text-sm font-medium text-slate-700 mb-1">Sähköposti</label>

&#x20;                   <input type="email" className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="etunimi.sukunimi@esimerkki.fi" />

&#x20;                 </div>

&#x20;                 <div>

&#x20;                   <label className="block text-sm font-medium text-slate-700 mb-1">Matkapuhelin</label>

&#x20;                   <input type="tel" className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="040 123 4567" />

&#x20;                 </div>

&#x20;                 <div className="grid grid-cols-2 gap-4">

&#x20;                    <div className="col-span-2 sm:col-span-1">

&#x20;                     <label className="block text-sm font-medium text-slate-700 mb-1">Katuosoite</label>

&#x20;                     <input type="text" className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esimerkkikatu 1 A 2" />

&#x20;                   </div>

&#x20;                   <div className="col-span-2 sm:col-span-1">

&#x20;                     <label className="block text-sm font-medium text-slate-700 mb-1">Postinumero</label>

&#x20;                     <input type="text" className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="00100" />

&#x20;                   </div>

&#x20;                 </div>

&#x20;               </div>

&#x20;             </div>



&#x20;             {/\* Osa 2: Luvat ja kortit \*/}

&#x20;             <div className="space-y-4">

&#x20;               <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">

&#x20;                 <IdCard size={18} className="text-slate-400"/>

&#x20;                 2. Pätevyydet ja kortit

&#x20;               </h3>

&#x20;               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

&#x20;                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">

&#x20;                   <label className="block text-sm font-bold text-slate-800 mb-2">Järjestyksenvalvojakortti</label>

&#x20;                   <input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Kortin numero" />

&#x20;                 </div>

&#x20;                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">

&#x20;                   <label className="block text-sm font-bold text-slate-800 mb-2">Vartijakortti</label>

&#x20;                   <input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Kortin numero" />

&#x20;                 </div>

&#x20;                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">

&#x20;                   <label className="block text-sm font-bold text-slate-800 mb-2">Kaasusumuttimen hallussapito</label>

&#x20;                   <input type="text" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Lupanumero" />

&#x20;                 </div>

&#x20;               </div>

&#x20;             </div>



&#x20;             {/\* Osa 3: Erityiskoulutukset \*/}

&#x20;             <div className="space-y-4">

&#x20;               <div className="flex justify-between items-end border-b pb-2">

&#x20;                 <h3 className="text-md font-semibold text-slate-700 flex items-center gap-2">

&#x20;                   <UserCheck size={18} className="text-slate-400"/>

&#x20;                   3. Erityiskoulutukset

&#x20;                 </h3>

&#x20;                 <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">Ruksaa vain jos suoritettu ja todistus mukana</span>

&#x20;               </div>

&#x20;               

&#x20;               <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">

&#x20;                 <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">

&#x20;                   <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />

&#x20;                   <div>

&#x20;                     <span className="block text-sm font-bold text-slate-800">Järjestyksenvalvojan voimankäytön lisäkoulutus</span>

&#x20;                     <span className="block text-xs text-slate-500 mt-0.5">Oikeuttaa kantaa voimankäyttövälineitä (jos muut luvat kunnossa).</span>

&#x20;                   </div>

&#x20;                 </label>

&#x20;                 <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">

&#x20;                   <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />

&#x20;                   <span className="text-sm font-bold text-slate-800">Kaasusumutinkoulutus</span>

&#x20;                 </label>

&#x20;                 <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">

&#x20;                   <input type="checkbox" className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />

&#x20;                   <span className="text-sm font-bold text-slate-800">Teleskooppipatukkakoulutus</span>

&#x20;                 </label>

&#x20;                 

&#x20;                 <div className="p-4 bg-slate-50 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">

&#x20;                   <div>

&#x20;                     <span className="block text-sm font-bold text-slate-800">Voimankäyttövälineiden kertauskoulutus</span>

&#x20;                     <span className="block text-xs text-slate-500 mt-0.5">Vuosittainen kertaus. Kirjaa mihin asti todistus on voimassa.</span>

&#x20;                   </div>

&#x20;                   <div className="min-w-\[200px]">

&#x20;                     <input type="date" className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" />

&#x20;                   </div>

&#x20;                 </div>

&#x20;               </div>

&#x20;             </div>



&#x20;             <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">

&#x20;               <button 

&#x20;                 type="button" 

&#x20;                 onClick={() => { setEditingEmp(null); setActiveTab('planning\_employees'); }}

&#x20;                 className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"

&#x20;               >

&#x20;                 Peruuta

&#x20;               </button>

&#x20;               <button 

&#x20;                 type="button" 

&#x20;                 onClick={() => { setEditingEmp(null); setActiveTab('planning\_employees'); }}

&#x20;                 className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"

&#x20;               >

&#x20;                 <CheckCircle size={18} />

&#x20;                 {editingEmp ? 'Tallenna muutokset' : 'Tallenna työntekijä'}

&#x20;               </button>

&#x20;             </div>

&#x20;           </form>

&#x20;         </div>

&#x20;       );

&#x20;     case 'documents':

&#x20;       return (

&#x20;         <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-\[400px] text-center">

&#x20;           <FileText className="text-slate-300 mb-4" size={48} />

&#x20;           <h2 className="text-2xl font-bold text-slate-800 mb-2">Lomakkeet \& Asiakirjat</h2>

&#x20;           <p className="text-slate-500 max-w-md">Viranomaislomakkeet, JOKE-loki, ja poikkeamaraportit (Osa 4).</p>

&#x20;         </div>

&#x20;       );

&#x20;     case 'settings':

&#x20;       return (

&#x20;         <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-\[400px] text-center">

&#x20;           <Settings className="text-slate-300 mb-4" size={48} />

&#x20;           <h2 className="text-2xl font-bold text-slate-800 mb-2">Asetukset</h2>

&#x20;           <p className="text-slate-500 max-w-md">Järjestelmän asetukset, käyttäjänhallinta ja integraatiot.</p>

&#x20;         </div>

&#x20;       );

&#x20;     default:

&#x20;       if (activeTab.startsWith('tike\_form\_')) {

&#x20;         return (

&#x20;            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl text-center py-16">

&#x20;              <button 

&#x20;               onClick={() => setActiveTab('report\_tike')}

&#x20;               className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6 mx-auto"

&#x20;             >

&#x20;               <ArrowLeft size={16} />

&#x20;               Takaisin TIKE-valikkoon

&#x20;             </button>

&#x20;             <Wrench className="text-slate-300 mx-auto mb-4" size={48} />

&#x20;             <h2 className="text-2xl font-bold text-slate-800 mb-2">Osio rakenteilla</h2>

&#x20;             <p className="text-slate-500 max-w-md mx-auto">Tämä lomakepohja ({activeTab.replace('tike\_form\_', '')}) toteutetaan seuraavassa vaiheessa.</p>

&#x20;           </div>

&#x20;         );

&#x20;       }

&#x20;       return <div>Osio rakenteilla.</div>;

&#x20;   }

&#x20; };



&#x20; return (

&#x20;   <div className="min-h-screen bg-slate-50 font-sans">

&#x20;     {/\* Top Navigation Bar \*/}

&#x20;     <nav className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-md">

&#x20;       <div className="flex items-center gap-4">

&#x20;         <button 

&#x20;           onClick={() => setIsSidebarOpen(!isSidebarOpen)}

&#x20;           className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"

&#x20;           aria-label="Kutista tai laajenna sivuvalikko"

&#x20;         >

&#x20;           <Menu size={24} />

&#x20;         </button>

&#x20;         <div 

&#x20;           className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"

&#x20;           onClick={() => setActiveTab('landing')}

&#x20;         >

&#x20;           <ShieldCheck className="text-indigo-400" size={28} />

&#x20;           <div>

&#x20;             <h1 className="text-xl font-bold leading-tight tracking-tight">Turvajohto OS</h1>

&#x20;             <p className="hidden md:block text-xs text-slate-400 font-medium">Tapahtumaturvallisuuden tilannekuva</p>

&#x20;           </div>

&#x20;         </div>

&#x20;       </div>

&#x20;       <div className="flex items-center gap-4 sm:gap-6">

&#x20;         

&#x20;         {/\* Pikatoiminnot -ponnahdusvalikko \*/}

&#x20;         <div className="relative">

&#x20;           <button 

&#x20;             onClick={() => setShowQuickActions(!showQuickActions)}

&#x20;             className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm"

&#x20;           >

&#x20;             <AlertTriangle size={16} />

&#x20;             <span className="hidden sm:inline">Pikatoiminnot</span>

&#x20;           </button>

&#x20;           

&#x20;           {showQuickActions \&\& (

&#x20;             <div className="absolute right-0 mt-3 w-72 bg-slate-800 rounded-xl shadow-xl border border-slate-700 p-5 z-50 animate-in fade-in slide-in-from-top-2">

&#x20;               <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">

&#x20;                 <h3 className="text-white font-bold flex items-center gap-2">

&#x20;                   <AlertTriangle className="text-rose-400" size={18} />

&#x20;                   Kriittiset toiminnot

&#x20;                 </h3>

&#x20;                 <button onClick={() => setShowQuickActions(false)} className="text-slate-400 hover:text-white transition-colors">

&#x20;                   <X size={18} />

&#x20;                 </button>

&#x20;               </div>

&#x20;               <div className="space-y-3">

&#x20;                 <button className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors flex justify-center items-center gap-2 shadow-sm">

&#x20;                   SHOW STOP PROTOKOLLA

&#x20;                 </button>

&#x20;                 <button className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex justify-center items-center gap-2">

&#x20;                   <PhoneCall size={18} /> Yhteys Viranomaisiin

&#x20;                 </button>

&#x20;                 <button className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex justify-center items-center gap-2">

&#x20;                   <Layers size={18} /> Eskaloi Tilanne

&#x20;                 </button>

&#x20;               </div>

&#x20;             </div>

&#x20;           )}

&#x20;         </div>



&#x20;         <div className="hidden md:flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg">

&#x20;           <Clock size={16} className="text-indigo-400" />

&#x20;           <span className="font-mono text-sm tracking-widest">{formatTime(currentTime)}</span>

&#x20;         </div>

&#x20;         <div className="flex items-center gap-3 border-l border-slate-700 pl-4 sm:pl-6">

&#x20;           <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">

&#x20;             TJ

&#x20;           </div>

&#x20;         </div>

&#x20;       </div>

&#x20;     </nav>



&#x20;     <div className="flex flex-col md:flex-row min-h-\[calc(100vh-73px)]">

&#x20;       {/\* Sidebar Navigation \*/}

&#x20;       {isSidebarOpen \&\& (

&#x20;         <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col">

&#x20;           <div className="p-4 space-y-1">

&#x20;             <button 

&#x20;               onClick={() => setActiveTab('landing')}

&#x20;               className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'landing' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}

&#x20;             >

&#x20;               <Home size={18} />

&#x20;               Aloitussivu

&#x20;             </button>

&#x20;             <button 

&#x20;               onClick={() => setActiveTab('overview')}

&#x20;               className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}

&#x20;             >

&#x20;               <Activity size={18} />

&#x20;               Tilannekuva

&#x20;             </button>

&#x20;             <button 

&#x20;               onClick={() => setActiveTab('reporting')}

&#x20;               className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${(activeTab.startsWith('report') || activeTab.startsWith('tike\_')) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}

&#x20;             >

&#x20;               <FileText size={18} />

&#x20;               Raportointi

&#x20;             </button>

&#x20;             <button 

&#x20;               onClick={() => setActiveTab('planning')}

&#x20;               className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab.startsWith('planning') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}

&#x20;             >

&#x20;               <Calendar size={18} />

&#x20;               Ennen Tapahtumaa

&#x20;             </button>

&#x20;              <button 

&#x20;               onClick={() => setActiveTab('postevent')}

&#x20;               className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'postevent' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}

&#x20;             >

&#x20;               <Layers size={18} />

&#x20;               FestivaaliX

&#x20;             </button>

&#x20;             <button 

&#x20;               onClick={() => setActiveTab('documents')}

&#x20;               className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'documents' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}

&#x20;             >

&#x20;               <FileText size={18} />

&#x20;               Lomakekartoitus

&#x20;             </button>

&#x20;             <button 

&#x20;               onClick={() => setActiveTab('settings')}

&#x20;               className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}

&#x20;             >

&#x20;               <Settings size={18} />

&#x20;               Asetukset

&#x20;             </button>

&#x20;           </div>

&#x20;         </aside>

&#x20;       )}



&#x20;       {/\* Main Content Area \*/}

&#x20;       <main className="flex-1 p-6 md:p-8 overflow-y-auto">

&#x20;         {renderContent()}

&#x20;       </main>

&#x20;     </div>



&#x20;     {/\* LYTP Info Modal \*/}

&#x20;     {showInfoModal \&\& (

&#x20;       <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-\[100] flex items-center justify-center p-4">

&#x20;         <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-\[90vh] flex flex-col">

&#x20;           <div className="flex justify-between items-center p-5 border-b border-slate-100">

&#x20;             <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">

&#x20;               <Info className="text-indigo-500" size={24} />

&#x20;               Lakisääteiset vaatimukset

&#x20;             </h2>

&#x20;             <button 

&#x20;               onClick={() => setShowInfoModal(false)}

&#x20;               className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors"

&#x20;             >

&#x20;               <X size={24} />

&#x20;             </button>

&#x20;           </div>

&#x20;           

&#x20;           <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 leading-relaxed text-left">

&#x20;             <div>

&#x20;               <h3 className="font-bold text-slate-900 mb-2 text-base">Laki yksityisistä turvallisuuspalveluista (1085/2015) 33 §</h3>

&#x20;               <p className="bg-slate-50 p-4 rounded-lg border border-slate-100">

&#x20;                 "Järjestyksenvalvojan tulee heti laatia järjestyksenvalvojatehtävissä havaituista kiinniottamiseen 

&#x20;                 tai voimakeinojen käyttöön johtaneista tapahtumista kirjallinen selvitys (tapahtumailmoitus). 

&#x20;                 Järjestyksenvalvoja voi laatia tapahtumailmoituksen myös muista toimenpiteisiin johtaneista tapahtumista. 

&#x20;                 Tapahtumailmoituksesta tulee käydä ilmi järjestyksenvalvojan kyseiseen tapahtumaan liittyvät havainnot ja 

&#x20;                 toimenpiteet. Toimenpiteiden kohteena olleiden sukunimi, etunimet, henkilötunnus ja osoitetiedot saadaan 

&#x20;                 kirjata tapahtumailmoitukseen."

&#x20;               </p>

&#x20;             </div>

&#x20;             

&#x20;             <div>

&#x20;               <h3 className="font-bold text-slate-900 mb-2 text-base">Valtioneuvoston asetus yksityisistä turvallisuuspalveluista (874/2016) 18 §</h3>

&#x20;               <p className="mb-2">Sen lisäksi, mitä yksityisistä turvallisuuspalveluista annetun lain 8 ja 33 §:ssä säädetään, tapahtumailmoituksessa on mainittava:</p>

&#x20;               <ol className="list-decimal list-inside space-y-1 mb-4 ml-2">

&#x20;                 <li>vartijan tai järjestyksenvalvojan nimi ja turvallisuusalan elinkeinoluvan haltija, jonka palveluksessa vartija tai järjestyksenvalvoja on;</li>

&#x20;                 <li>tapahtuma-aika ja -paikka;</li>

&#x20;                 <li>tieto siitä, onko vartija tai järjestyksenvalvoja ottanut jonkun kiinni tai käyttänyt voimakeinoja;</li>

&#x20;                 <li>tieto siitä, onko vartija tai järjestyksenvalvoja käyttänyt voimankäyttövälineitä; sekä</li>

&#x20;                 <li>tieto siitä, onko vartija ottanut esille ampuma-aseen tai käyttänyt sitä.</li>

&#x20;               </ol>

&#x20;               <p className="mb-2">Tapahtumailmoituksessa saadaan tarvittaessa mainita havaintotietoina:</p>

&#x20;               <ol className="list-decimal list-inside space-y-1 ml-2">

&#x20;                 <li>toimenpiteen kohteena olleen henkilön tuntomerkit henkilön tunnistamiseksi; sekä</li>

&#x20;                 <li>havaintoja kohdehenkilön käyttäytymisestä ja tilasta.</li>

&#x20;               </ol>

&#x20;             </div>

&#x20;           </div>

&#x20;           

&#x20;           <div className="p-4 border-t border-slate-100 flex justify-end">

&#x20;             <button 

&#x20;               onClick={() => setShowInfoModal(false)}

&#x20;               className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"

&#x20;             >

&#x20;               Sulje

&#x20;             </button>

&#x20;           </div>

&#x20;         </div>

&#x20;       </div>

&#x20;     )}

&#x20;   </div>

&#x20; );

}

