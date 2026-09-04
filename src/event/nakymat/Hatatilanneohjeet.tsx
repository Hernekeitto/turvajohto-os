// Hätätilanneohjeet: toimintakortit ja hätänumerot.
//
// Ensimmäinen App.tsx:stä irrotettu näkymä. Se valittiin aloituskohteeksi koska se on
// kaikkein puhtain: koko näkymä on vakiodataa ja sen esitystä, eikä se kosketa yhtäkään
// App():n kymmenistä tiloista. Rajapinta on kaksi propsia.
//
// KORTIT OVAT DATAA EIVÄTKÄ JSX:ÄÄ. Kuusi korttia samalla rakenteella tarkoittaisi
// kuutta lähes identtistä JSX-lohkoa, joista viidennen muokkaus unohtuisi. Uuden
// toimintakortin lisääminen on nyt yksi rivi taulukkoon.

import { AlertTriangle, Cloud, DoorOpen, PhoneCall, ShieldAlert, Users, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { TakaisinLinkki } from '../../shared/komponentit/TakaisinLinkki';

type Kortti = { title: string; icon: LucideIcon; tone: string; steps: string[] };

// Toimintakortit. Askeleet ovat siinä järjestyksessä kuin ne tehdään, ja ensimmäinen on
// se joka tehdään ennen kuin ehditään lukea loput — siksi hätäilmoitus on kärjessä
// silloin kun se kuuluu sinne.
const KORTIT: Kortti[] = [
  { title: 'Kaikkien alueiden evakuointi', icon: DoorOpen, tone: 'rose', steps: ['Vahvista päätös turvallisuuspäälliköltä', 'Pysäytä esitys ja anna kuulutus', 'Avaa kaikki hätäpoistumistiet', 'Ohjaa yleisö kokoontumispaikoille', 'Kuittaa alueiden tyhjeneminen TIKE:lle'] },
  { title: 'Tulipalo', icon: AlertTriangle, tone: 'amber', steps: ['Hätäilmoitus 112', 'Rajaa alue ja estä pääsy', 'Alkusammutus jos turvallista', 'Opasta pelastuslaitos paikalle', 'Kirjaa tapahtuma-aika ja toimenpiteet'] },
  { title: 'Väkijoukon puristuminen', icon: Users, tone: 'rose', steps: ['Keskeytä esitys välittömästi', 'Avaa sivukäytävät ja purkureitit', 'Ohjaa yleisö taaksepäin kuulutuksella', 'Hälytä ensiapu etualueelle', 'Kirjaa tiheysarvio ja aika'] },
  { title: 'Vakava väkivaltatilanne', icon: ShieldAlert, tone: 'rose', steps: ['Hätäilmoitus 112', 'Suojaa ja siirrä yleisö pois alueelta', 'Älä lähesty ilman poliisia', 'Varmista kohteen tiedot ja kulkusuunta', 'Säilytä tallenteet ja havainnot'] },
  { title: 'Sähkökatko', icon: Wrench, tone: 'slate', steps: ['Varmista varavalaistus', 'Siirry radioyhteyteen', 'Estä pääsy pimeille alueille', 'Ota yhteys tekniseen vastaavaan', 'Arvioi tarve keskeyttää tapahtuma'] },
  { title: 'Sään äkillinen muutos', icon: Cloud, tone: 'sky', steps: ['Seuraa varoituksia', 'Tarkista rakenteiden kiinnitykset', 'Valmistele suojautumisohjeet', 'Harkitse esityksen keskeytystä', 'Tiedota yleisölle ajoissa'] },
];

const SAVYT: Record<string, { bg: string; border: string; text: string; num: string }> = {
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600', num: 'bg-rose-600' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', num: 'bg-amber-600' },
  slate: { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-600', num: 'bg-slate-600' },
  sky: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-600', num: 'bg-sky-600' },
};

type Props = {
  // Tapahtuman aloituslomakkeen kentät. Hätänumerot tulevat sieltä (osio 14).
  lomake: Record<string, any>;
  onTakaisin: () => void;
};

export const Hatatilanneohjeet = ({ lomake, onTakaisin }: Props) => {
  // Numerot tulevat tapahtuman perustiedoista. Aiemmin korteissa luki pelkkä rooli ilman
  // numeroa, eli hätänumerokortti ilman numeroa. 112 on kiinteä, koska se on sama
  // kaikkialla eikä sitä täytetä mihinkään.
  const numerot = [
    { numero: lomake.phoneTurva1, otsikko: 'Turva 1', selite: 'Turvallisuuspäällikkö' },
    { numero: lomake.phoneTurva2, otsikko: 'Turva 2', selite: 'Turvajohto' },
    { numero: lomake.phoneTike, otsikko: 'TIKE', selite: 'Tilannekeskus' },
    { numero: lomake.phoneFirstAid, otsikko: 'EA-päivystys', selite: 'Ensiapu' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
      <TakaisinLinkki onClick={onTakaisin}>Takaisin asiakirjavalikkoon</TakaisinLinkki>

      <div className="mb-6 border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ShieldAlert className="text-rose-500" size={24} />
          Hätätilanneohjeet
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Toimintakortit. Nämä eivät korvaa tapahtuman pelastussuunnitelmaa.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {KORTIT.map((kortti) => {
          const Kuvake = kortti.icon;
          const savy = SAVYT[kortti.tone] || SAVYT.slate;
          return (
            <div key={kortti.title} className={`rounded-xl border p-5 ${savy.bg} ${savy.border}`}>
              <div className="flex items-center gap-2 mb-3">
                <Kuvake className={savy.text} size={20} />
                <h3 className="font-bold text-slate-800 text-sm">{kortti.title}</h3>
              </div>
              <ol className="space-y-2">
                {kortti.steps.map((askel, i) => (
                  <li key={askel} className="flex gap-2 text-sm text-slate-700">
                    <span className={`shrink-0 w-5 h-5 rounded-full ${savy.num} text-white text-xs font-bold flex items-center justify-center mt-0.5`}>
                      {i + 1}
                    </span>
                    <span>{askel}</span>
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
          <a href="tel:112" className="bg-slate-700 hover:bg-slate-600 rounded-lg p-3 transition-colors block">
            <div className="text-2xl font-bold">112</div>
            <div className="text-xs text-slate-300 mt-0.5">Hätäkeskus</div>
          </a>
          {numerot.map((kortti) => {
            const numero = String(kortti.numero || '').trim();
            return numero ? (
              <a
                key={kortti.otsikko}
                href={`tel:${numero}`}
                className="bg-slate-700 hover:bg-slate-600 rounded-lg p-3 transition-colors block"
              >
                <div className="font-bold">{numero}</div>
                <div className="text-xs text-slate-300 mt-0.5">{kortti.otsikko} — {kortti.selite}</div>
              </a>
            ) : (
              // Puuttuva numero näytetään tyhjänä korttina eikä piiloteta: hätätilanteessa
              // on olennaista tietää ETTÄ numeroa ei ole, eikä vain olla näkemättä sitä.
              <div key={kortti.otsikko} className="bg-slate-700/50 rounded-lg p-3">
                <div className="font-bold text-slate-400">Ei numeroa</div>
                <div className="text-xs text-slate-400 mt-0.5">{kortti.otsikko} — {kortti.selite}</div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Numerot täytetään tapahtuman perustiedoissa (osio 14, Viestintä ja hätänumerot).
        </p>
      </div>
    </div>
  );
};
