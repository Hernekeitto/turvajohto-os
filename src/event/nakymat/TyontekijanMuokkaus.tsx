// Työntekijäpankin lomake: uuden työntekijän kirjaus ja olemassa olevan muokkaus.
//
// Irrotettu App.tsx:stä. Pankin lista on TyontekijaLista.tsx; kutsuja valitsee kumman
// renderöi. Sivun kuori jää App.tsx:ään (ks. AuditLoki.tsx:n perustelu).
//
// Lomakkeen tila (empForm) jää App():een eikä siirry tänne. Sama tila ohjaa myös
// tallennusta ja käyttäjätunnusmodaalia, joten sen siirtäminen olisi tarkoittanut
// tilan nostamista takaisin ylös ensimmäisellä muutoksella.
//
// Muokkausoikeus tulee yhtenä totuusarvona eikä perms/selectedEvent-parina, samasta
// syystä kuin listassa.

import { BadgeCheck, Briefcase, CheckCircle, Contact, HardHat, Home, IdCard, Info,
  KeyRound, Landmark, Languages, Plus, Trash2, UserCheck, UserPlus } from 'lucide-react';

import { muotoileEuro, laskeKokonaispalkka } from '../../shared/muotoilu';
import { paikallinenPaiva } from '../../shared/ajat';
import { muotoileTunniste } from '../../shared/tunnisteet';
import type { Tyontekija, TyontekijaLomake } from '../tyontekijat';
import type { KayttajaRivi } from '../tyypit';

type Props = {
  lomake: TyontekijaLomake;
  // Sama allekirjoitus kuin App():n updEmpForm: avain rajattu lomakkeen kenttiin ja
  // arvo sen kentän tyyppiin.
  onKentta: <K extends keyof TyontekijaLomake>(avain: K, arvo: TyontekijaLomake[K]) => void;
  // null = uusi työntekijä, muuten muokattava tietue.
  muokattava: Tyontekija | null;
  saaMuokata: boolean;
  onTallenna: () => void;
  onPeruuta: () => void;
  onPoista: (tyontekija: Tyontekija) => void;
  // Nimestä johdettu käyttäjätunnus ja sitä vastaava olemassa oleva tunnus, jos on.
  kayttajatunnus: string;
  olemassaOlevaTunnus: KayttajaRivi | null;
  onAvaaTunnus: () => void;
  // Kielitaitorivien muokkaus; rivit ovat lomake.languages-taulukossa.
  onLisaaKieli: () => void;
  onPoistaKieli: (idx: number) => void;
  onMuutaKieli: (idx: number, avain: string, arvo: any) => void;
};

export const TyontekijanMuokkaus = ({
  lomake, onKentta, muokattava, saaMuokata, onTallenna, onPeruuta, onPoista,
  kayttajatunnus, olemassaOlevaTunnus, onAvaaTunnus,
  onLisaaKieli, onPoistaKieli, onMuutaKieli,
}: Props) => (
<div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
  <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-start">
    <div>
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        {muokattava ? <UserCheck className="text-indigo-500" size={24} /> : <UserPlus className="text-emerald-500" size={24} />}
        {muokattava ? 'Muokkaa työntekijää' : 'Kirjaa uusi työntekijä'}
      </h2>
      <p className="text-sm text-slate-500 mt-1">
        {muokattava ? 'Päivitä työntekijän perustiedot, luvat ja suoritetut koulutukset.' : 'Lisää työntekijän perustiedot, pätevyydet ja suoritetut koulutukset rekisteriin.'}
      </p>
    </div>
    {muokattava && saaMuokata && (
      <button
        onClick={() => onPoista(muokattava)}
        title="Poista työntekijä"
        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors shrink-0"
      >
        <Trash2 size={20} />
      </button>
    )}
  </div>

  <form className="space-y-8 text-left" onSubmit={(e) => e.preventDefault()}>
    {/* Osa 1: Henkilötiedot */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
        <Contact size={18} className="text-slate-400"/>
        1. Henkilötiedot
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Etunimi</label>
          <input type="text" value={lomake.firstName} onChange={(e) => onKentta('firstName', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Elli Marja Orvokki" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Sukunimi</label>
          <input type="text" value={lomake.lastName} onChange={(e) => onKentta('lastName', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Korhonen" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Henkilötunnus</label>
          <input type="text" value={lomake.personalId} onChange={(e) => onKentta('personalId', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="PPKKVV-XXXX" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Syntymäaika</label>
          <input type="date" value={lomake.birthDate} onChange={(e) => onKentta('birthDate', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Kansalaisuus</label>
          <input type="text" value={lomake.nationality} onChange={(e) => onKentta('nationality', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Suomi" />
        </div>
      </div>
    </div>

    {/* Osa 2: Yhteystiedot */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
        <Home size={18} className="text-slate-400"/>
        2. Yhteystiedot
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Katuosoite</label>
          <input type="text" value={lomake.address} onChange={(e) => onKentta('address', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esimerkkikatu 1 A 2" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Postinumero</label>
            <input type="text" value={lomake.postalCode} onChange={(e) => onKentta('postalCode', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="00100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Postitoimipaikka</label>
            <input type="text" value={lomake.postalCity} onChange={(e) => onKentta('postalCity', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Helsinki" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Sähköposti</label>
          <input type="email" value={lomake.email} onChange={(e) => onKentta('email', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="etunimi.sukunimi@esimerkki.fi" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Matkapuhelin</label>
          <input type="tel" value={lomake.phone} onChange={(e) => onKentta('phone', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="040 123 4567" />
        </div>
      </div>
    </div>

    {/* Osa 3: Pankkitiedot */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
        <Landmark size={18} className="text-slate-400"/>
        3. Pankkitiedot
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tilinumero (IBAN)</label>
          <input type="text" value={lomake.iban} onChange={(e) => onKentta('iban', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="FI00 0000 0000 0000 00" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">BIC</label>
          <input type="text" value={lomake.bic} onChange={(e) => onKentta('bic', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. NDEAFIHH" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Pankki</label>
          <input type="text" value={lomake.bankName} onChange={(e) => onKentta('bankName', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Nordea" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Veronumero</label>
          <input type="text" inputMode="numeric" value={lomake.taxNumber} onChange={(e) => onKentta('taxNumber', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="12 numeroa" />
        </div>
      </div>
    </div>

    {/* Osa 4: Työsuhdetiedot */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
        <Briefcase size={18} className="text-slate-400"/>
        4. Työsuhdetiedot
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Työsuhteen alkamispäivä</label>
          <div className="flex gap-2">
            <input type="date" value={lomake.employmentStart} onChange={(e) => onKentta('employmentStart', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" />
            <button
              type="button"
              onClick={() => onKentta('employmentStart', paikallinenPaiva())}
              title="Aseta tämä päivä"
              className="shrink-0 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              Tänään
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Työn suorittamispaikka</label>
          <input type="text" value={lomake.workLocation} onChange={(e) => onKentta('workLocation', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Tampere ja lähikunnat" />
        </div>
      </div>

      {/* Työsuhteen voimassaolo */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-bold text-slate-800">Työsuhde voimassa</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            ['permanent', 'Toistaiseksi'],
            ['fixed', 'Määräajan'],
          ].map(([arvo, label]) => (
            <label key={arvo} className="flex items-center gap-2.5 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={lomake.employmentType === arvo}
                onChange={(e) => onKentta('employmentType', e.target.checked ? arvo : '')}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0"
              />
              <span className="text-sm font-medium text-slate-700">{label}</span>
            </label>
          ))}
        </div>
        {lomake.employmentType === 'fixed' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Määräaika alkaa</label>
              <input type="date" value={lomake.employmentFixedFrom} onChange={(e) => onKentta('employmentFixedFrom', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Määräaika päättyy</label>
              <input type="date" value={lomake.employmentFixedTo} onChange={(e) => onKentta('employmentFixedTo', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        )}
      </div>

      {/* Työaika ja palkkausmuoto */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-bold text-slate-800">Työaika ja palkkausmuoto</p>
        <div className="space-y-2">
          {[
            ['monthly', 'Kuukausipalkka', '120 h / 3 viikkoa'],
            ['parttime', 'Tuntipalkka (osa-aikainen)', 'alle 112 h 30 min / 3 viikkoa'],
            ['oncall', 'Erikseen työhön kutsuttava tuntipalkkainen', 'työvoimareservi'],
          ].map(([arvo, label, tarkenne]) => (
            <label key={arvo} className="flex items-start gap-2.5 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={lomake.workTimeType === arvo}
                onChange={(e) => onKentta('workTimeType', e.target.checked ? arvo : '')}
                className="w-4 h-4 mt-0.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0"
              />
              <span className="text-sm text-slate-700">
                <span className="font-medium">{label}</span>
                <span className="text-slate-500"> — {tarkenne}</span>
              </span>
            </label>
          ))}
        </div>
        {(lomake.workTimeType === 'parttime' || lomake.workTimeType === 'oncall') && (
          <div className="sm:w-72">
            <label className="block text-xs text-slate-500 mb-1">Vähimmäistyöaika (tuntia / 3 viikkoa)</label>
            <input type="number" min="0" step="0.5" value={lomake.minHoursPer3Weeks} onChange={(e) => onKentta('minHoursPer3Weeks', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. 60" />
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <Info size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-900 leading-relaxed">
          Työtehtävissä noudatetaan voimassa olevia lakeja sekä työehtosopimusta.
        </p>
      </div>

      {/* Palkkaus */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
        <p className="text-sm font-bold text-slate-800">Palkkaus</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Tasopalkka</label>
            <select value={lomake.payLevel} onChange={(e) => onKentta('payLevel', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500">
              <option value="">Ei valittu</option>
              {['I', 'II', 'III', 'IIIA', 'IV', 'IVA', 'V'].map((taso) => (
                <option key={taso} value={taso}>{taso}-taso</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Paikkakuntaluokka</label>
            <select value={lomake.municipalityClass} onChange={(e) => onKentta('municipalityClass', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500">
              <option value="">Ei valittu</option>
              <option value="A">A = pääkaupunkiseutu</option>
              <option value="B">B = muu Suomi</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Tasopalkka (€/kk)</label>
            <input type="text" inputMode="decimal" value={lomake.basePay} onChange={(e) => onKentta('basePay', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="TES-taulukon mukaan" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Henkilökohtainen palkan osa (€/kk)</label>
            <input type="text" inputMode="decimal" value={lomake.personalPayPart} onChange={(e) => onKentta('personalPayPart', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="0,00" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Perusteet</label>
            <input type="text" value={lomake.personalPayBasis} onChange={(e) => onKentta('personalPayBasis', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Millä perusteella osa on sovittu" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Henkilökohtainen palkka, jos sovittu (€/kk)</label>
            <input type="text" inputMode="decimal" value={lomake.personalPay} onChange={(e) => onKentta('personalPay', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Korvaa tasopalkan" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Muu palkka (€/kk)</label>
            <input type="text" inputMode="decimal" value={lomake.otherPay} onChange={(e) => onKentta('otherPay', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="0,00" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Muun palkan perusteet</label>
            <input type="text" value={lomake.otherPayBasis} onChange={(e) => onKentta('otherPayBasis', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. olosuhdelisä" />
          </div>
        </div>

        {/* Kokonaispalkka lasketaan yllä olevista riveistä */}
        {(() => {
          const summa = laskeKokonaispalkka(lomake);
          return (
            <div className="bg-white border-2 border-indigo-200 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Kokonaispalkka</p>
                  <p className="text-2xl font-bold text-indigo-700 mt-1">
                    {muotoileEuro(summa.kuukaudessa)} €/kk
                  </p>
                  <p className="text-sm font-semibold text-slate-600">
                    {muotoileEuro(summa.tunnissa)} €/tunti
                  </p>
                </div>
                <div className="sm:w-44">
                  <label className="block text-xs text-slate-500 mb-1">Tuntijakaja (h/kk)</label>
                  <input type="text" inputMode="decimal" value={lomake.hourDivisor} onChange={(e) => onKentta('hourDivisor', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                {summa.korvaava
                  ? 'Laskettu: henkilökohtainen palkka + muu palkka. Erikseen sovittu henkilökohtainen palkka korvaa tasopalkan ja henkilökohtaisen palkan osan.'
                  : 'Laskettu: tasopalkka + henkilökohtainen palkan osa + muu palkka.'}
                {' '}Tuntipalkka = kuukausipalkka / tuntijakaja. Oletusjakaja 173,33 vastaa 120 h / 3 viikkoa; tarkista se sopimuksesta.
              </p>
            </div>
          );
        })()}
      </div>

      {/* Muut sopimuksen ehdot */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Muut sopimuksen ehdot</label>
        <textarea rows={3} value={lomake.otherTerms} onChange={(e) => onKentta('otherTerms', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. koeaika, työvälineet, muut erikseen sovitut ehdot" />
      </div>

      {/* Kiinteät sopimusehdot */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h4 className="text-sm font-bold text-slate-800 mb-2">Salassapitovelvollisuus</h4>
        <p className="text-sm text-slate-600 leading-relaxed">
          Työntekijä sitoutuu olemaan ilmaisematta tietoja vartiointikohteen turvallisuusjärjestelyistä,
          vartiointitoimeksiannon osapuolten liike- tai ammattisalaisuutta taikka yksityisen henkilön
          henkilökohtaisista asioista. Salassapitovelvollisuus ei koske tietojen antamista
          valvontaviranomaiselle, syyttäjä- tai poliisiviranomaiselle rikoksen selvittämistä varten eikä
          viranomaiselle, jolla erikoissäännöksen nojalla on oikeus saada näitä tietoja.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-bold text-slate-800">Koulutus</h4>
        <p className="text-sm text-slate-600 leading-relaxed">
          Työntekijä sitoutuu osallistumaan kaikkeen työnantajan osoittamaan ammatilliseen koulutukseen.
          Perusteeton koulutuksesta kieltäytyminen katsotaan työstä kieltäytymiseksi.
        </p>

        <h4 className="text-sm font-bold text-slate-800 pt-1">
          Vartijan peruskurssin vaikutus työsuhteeseen, työsuhteen purku, lopputilin saamisen edellytykset
        </h4>
        <p className="text-sm text-slate-600 leading-relaxed">
          Työntekijän osallistuessa yksityisistä turvallisuuspalveluista annetun lain edellyttämälle
          vartijan peruskurssille (60 tunnin osio), hän sitoutuu kurssin hyväksytysti suoritettuaan
          olemaan työnantajan palveluksessa vähintään{' '}
          <input
            type="number"
            min="0"
            max="4"
            value={lomake.trainingCommitmentMonths}
            onChange={(e) => onKentta('trainingCommitmentMonths', e.target.value)}
            className="inline-block w-16 rounded border-slate-300 border px-2 py-0.5 text-sm focus:ring-2 focus:ring-indigo-500 align-baseline"
            placeholder="0"
          />{' '}
          kuukautta (enintään 4 kuukautta) kurssin suorittamisesta lukien. Mikäli työsuhde päättyy
          työntekijästä johtuvasta syystä ennen mainittua aikaa, työnantaja voi periä työntekijältä
          työnantajalle kurssista aiheutuneet kustannukset samassa suhteessa kuin neljän kuukauden
          ajasta on kulumatta. Työnantajan suorittamat kustannukset ovat{' '}
          <input
            type="text"
            inputMode="decimal"
            value={lomake.trainingCourseCost}
            onChange={(e) => onKentta('trainingCourseCost', e.target.value)}
            className="inline-block w-24 rounded border-slate-300 border px-2 py-0.5 text-sm focus:ring-2 focus:ring-indigo-500 align-baseline"
            placeholder="0,00"
          />{' '}
          euroa.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed">
          Mikäli viranomainen peruuttaa työntekijän vartijaksi hyväksymisen, voi se olla peruste
          työsopimuksen päättämiselle.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed">
          Työsuhteen päättyessä on aina lopputilin maksamisen edellytyksenä, että työntekijä palauttaa
          työnantajan hänelle luovuttamat puvun, varusteet, laitteet ja toimikortin (TES 36 §).
        </p>
      </div>
    </div>

    {/* Osa 5: Ajokortti ja yleiset luvat.
        Tiivistetty: kortit ovat kahdessa sarakkeessa yhden sijaan, jolloin
        koko osio mahtuu näytölle ilman vieritystä. */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
        <BadgeCheck size={18} className="text-slate-400"/>
        5. Ajokortti ja yleiset luvat
      </h3>

      {/* Ajokortti: kyllä-valinta + ajo-oikeuden laatu vasta jos rastittu */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <label className="flex items-center gap-2.5 cursor-pointer sm:w-48 shrink-0">
          <input
            type="checkbox"
            checked={lomake.hasDrivingLicense}
            onChange={(e) => onKentta('hasDrivingLicense', e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0"
          />
          <span className="text-sm font-medium text-slate-700">Ajokortti</span>
        </label>
        <input
          type="text"
          disabled={!lomake.hasDrivingLicense}
          value={lomake.drivingLicense}
          onChange={(e) => onKentta('drivingLicense', e.target.value)}
          className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
          placeholder="Ajo-oikeuden laatu, esim. B, BE, C"
        />
      </div>

      {/* Pelkkä kyllä/ei, ei voimassaoloa */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          ['adrPermit', 'ADR-lupa'],
          ['alcoholPass', 'Alkoholipassi'],
          ['hygienePass', 'Hygieniapassi'],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
            <input type="checkbox" checked={lomake[key]} onChange={(e) => onKentta(key, e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0" />
            <span className="text-sm font-medium text-slate-700">{label}</span>
          </label>
        ))}
      </div>

      {/* Kyllä/ei + voimassa kuukausi/vuosi jos kyllä — kaksi per rivi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {([
          ['craneCard', 'craneCardUntil', 'Nosturikortti'],
          ['electricalWorkCard', 'electricalWorkCardUntil', 'Sähkötyökortti'],
          ['firstAidEA1', 'firstAidEA1Until', 'Ensiapukortti (EA1)'],
          ['firstAidEA2', 'firstAidEA2Until', 'Ensiapukortti (EA2)'],
          ['firstAidEA3', 'firstAidEA3Until', 'Ensiapukortti (EA3)'],
        ] as const).map(([boolKey, untilKey, label]) => (
          <div key={boolKey} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
              <input type="checkbox" checked={lomake[boolKey]} onChange={(e) => onKentta(boolKey, e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0" />
              <span className="text-sm font-medium text-slate-700 truncate">{label}</span>
            </label>
            <input
              type="month"
              disabled={!lomake[boolKey]}
              value={lomake[untilKey]}
              onChange={(e) => onKentta(untilKey, e.target.value)}
              title="Voimassa asti"
              className="w-36 shrink-0 rounded-lg border-slate-300 border p-1.5 text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>
        ))}
      </div>
    </div>

    {/* Osa 6: Turvallisuusalan kortit */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
        <IdCard size={18} className="text-slate-400"/>
        6. Turvallisuusalan kortit
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {([
          ['hasJvCard', 'jvCard', 'jvCardValidUntil', 'Järjestyksenvalvojakortti'],
          ['hasGuardCard', 'guardCard', 'guardCardValidUntil', 'Vartijakortti'],
          ['hasGasPermit', 'gasPermit', 'gasPermitValidUntil', 'Kaasusumuttimen hallussapito'],
        ] as const).map(([boolKey, numKey, untilKey, label]) => (
          <div key={numKey} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={lomake[boolKey]}
                onChange={(e) => onKentta(boolKey, e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0"
              />
              <span className="text-sm font-bold text-slate-800">{label}</span>
            </label>
            <input
              type="text"
              disabled={!lomake[boolKey]}
              value={lomake[numKey]}
              onChange={(e) => onKentta(numKey, e.target.value)}
              className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
              placeholder="Kortin numero"
            />
            <div>
              <label className="block text-xs text-slate-500 mb-1">Voimassa asti (kk/vuosi)</label>
              <input
                type="month"
                disabled={!lomake[boolKey]}
                value={lomake[untilKey]}
                onChange={(e) => onKentta(untilKey, e.target.value)}
                className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Voimankäyttövälineiden kertauskoulutus: turvallisuusalan pätevyys,
          ei yleinen työturvallisuuskortti — siirretty tänne osiosta 7. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
        <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
          <input type="checkbox" checked={lomake.trainingRefresher} onChange={(e) => onKentta('trainingRefresher', e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0" />
          <span className="text-sm font-medium text-slate-700">Voimankäyttövälineiden kertauskoulutus</span>
        </label>
        <div className="sm:w-48">
          <input
            type="date"
            disabled={!lomake.trainingRefresher}
            value={lomake.trainingRefresherUntil}
            onChange={(e) => onKentta('trainingRefresherUntil', e.target.value)}
            title="Voimassa asti"
            className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
          />
        </div>
      </div>
    </div>

    {/* Osa 7: Työturvallisuuskortit. Tiivistetty samalla tavalla kuin osio 5. */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
        <HardHat size={18} className="text-slate-400"/>
        7. Työturvallisuuskortit
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {([
          ['roadSafetyCard', 'roadSafetyCardUntil', 'Tieturvakortti'],
          ['forkliftCard', 'forkliftCardUntil', 'Trukkikortti'],
          ['hotWorkCard', 'hotWorkCardUntil', 'Tulityökortti'],
          ['safetyCard', 'safetyCardUntil', 'Työturvallisuuskortti'],
        ] as const).map(([boolKey, dateKey, label]) => (
          <div key={boolKey} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
              <input type="checkbox" checked={lomake[boolKey]} onChange={(e) => onKentta(boolKey, e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0" />
              <span className="text-sm font-medium text-slate-700 truncate">{label}</span>
            </label>
            <input
              type="date"
              disabled={!lomake[boolKey]}
              value={lomake[dateKey]}
              onChange={(e) => onKentta(dateKey, e.target.value)}
              title="Voimassa asti"
              className="w-40 shrink-0 rounded-lg border-slate-300 border p-1.5 text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>
        ))}
      </div>
    </div>

    {/* Osa 7: Erityiskoulutukset */}
    <div className="space-y-4">
      <div className="flex justify-between items-end border-b pb-2">
        <h3 className="text-md font-semibold text-slate-700 flex items-center gap-2">
          <UserCheck size={18} className="text-slate-400"/>
          8. Erityiskoulutukset
        </h3>
        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">Ruksaa vain jos suoritettu ja todistus mukana</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
        <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
          <input type="checkbox" checked={lomake.trainingForce} onChange={(e) => onKentta('trainingForce', e.target.checked)} className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
          <div>
            <span className="block text-sm font-bold text-slate-800">Järjestyksenvalvojan voimankäytön lisäkoulutus</span>
            <span className="block text-xs text-slate-500 mt-0.5">Oikeuttaa kantaa voimankäyttövälineitä (jos muut luvat kunnossa).</span>
          </div>
        </label>
        <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
          <input type="checkbox" checked={lomake.trainingGas} onChange={(e) => onKentta('trainingGas', e.target.checked)} className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
          <span className="text-sm font-bold text-slate-800">Kaasusumutinkoulutus</span>
        </label>
        <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
          <input type="checkbox" checked={lomake.trainingBaton} onChange={(e) => onKentta('trainingBaton', e.target.checked)} className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
          <span className="text-sm font-bold text-slate-800">Teleskooppipatukkakoulutus</span>
        </label>
        <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
          <input type="checkbox" checked={lomake.firearmTraining} onChange={(e) => onKentta('firearmTraining', e.target.checked)} className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
          <span className="text-sm font-bold text-slate-800">Vartijan ampuma-asekoulutus</span>
        </label>
      </div>
    </div>

    {/* Osa 8: Kielitaito */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
        <Languages size={18} className="text-slate-400"/>
        9. Kielitaito
      </h3>
      <div className="space-y-3">
        {lomake.languages.length === 0 && (
          <p className="text-sm text-slate-500">Ei lisättyjä kieliä.</p>
        )}
        {lomake.languages.map((lang, idx) => (
          <div key={idx} className="flex flex-col sm:flex-row gap-3 sm:items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
            <input
              type="text"
              value={lang.language}
              onChange={(e) => onMuutaKieli(idx, 'language', e.target.value)}
              placeholder="Esim. Englanti"
              className="flex-1 rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={lang.level}
              onChange={(e) => onMuutaKieli(idx, 'level', Number(e.target.value))}
              className="rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 sm:w-56"
            >
              <option value={5}>5 – Erinomainen</option>
              <option value={4}>4 – Kiitettävä</option>
              <option value={3}>3 – Hyvä</option>
              <option value={2}>2 – Tyydyttävä</option>
              <option value={1}>1 – Välttävä</option>
            </select>
            <button
              type="button"
              onClick={() => onPoistaKieli(idx)}
              title="Poista kieli"
              className="text-rose-500 hover:text-rose-700 p-2 rounded-lg hover:bg-rose-50 transition-colors shrink-0 self-start sm:self-center"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onLisaaKieli}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
        >
          <Plus size={16} />
          Lisää kieli
        </button>
      </div>
    </div>

    {/* Osa 10: Käyttäjätunnukset. Avaa modaalin eikä vie käyttäjähallintaan,
        jottei keskeneräinen työntekijän muokkaus katoa navigoinnin mukana. */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
        <KeyRound size={18} className="text-slate-400"/>
        10. Käyttäjätunnukset
      </h3>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm text-slate-700">
            <span className="font-medium">Käyttäjätunnus:</span>{' '}
            {kayttajatunnus
              ? <span className="font-mono text-slate-900">{kayttajatunnus}</span>
              : <span className="text-slate-400">muodostuu etu- ja sukunimestä</span>}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium">Tunnistenumero:</span>{' '}
            {lomake.displayId
              ? <span className="font-mono text-slate-900">{muotoileTunniste(lomake.displayId)}</span>
              : <span className="text-slate-400">annetaan kun työntekijä tallennetaan</span>}
          </p>
          <p className="text-xs text-slate-500 pt-1 leading-relaxed">
            Raporteissa kirjaajana näkyy tapahtumakohtainen nimimerkki ja tämä numero,
            esim. "Ensiapu 1 {muotoileTunniste(lomake.displayId || 1028)}". Nimimerkki annetaan
            kun henkilö lisätään tapahtumaan.
          </p>
        </div>
        {saaMuokata && (
          <button
            type="button"
            onClick={onAvaaTunnus}
            disabled={!kayttajatunnus}
            title={kayttajatunnus ? undefined : 'Täytä ensin etunimi ja sukunimi'}
            className="shrink-0 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <KeyRound size={16} />
            {olemassaOlevaTunnus ? 'Muokkaa käyttäjätunnusta' : 'Luo käyttäjätunnukset'}
          </button>
        )}
      </div>
    </div>

    <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
      <button
        type="button"
        onClick={() => onPeruuta()}
        className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
      >
        Peruuta
      </button>
      {saaMuokata && (
        <button
          type="button"
          onClick={onTallenna}
          className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
        >
          <CheckCircle size={18} />
          {muokattava ? 'Tallenna muutokset' : 'Tallenna työntekijä'}
        </button>
      )}
    </div>
  </form>
</div>
);
