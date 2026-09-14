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

import type { ReactNode } from 'react';

import { muotoileEuro, laskeKokonaispalkka } from '../../shared/muotoilu';
import { paikallinenPaiva } from '../../shared/ajat';
import { muotoileTunniste } from '../../shared/tunnisteet';
import type { Tyontekija, TyontekijaLomake } from '../tyontekijat';

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
  // Onko tälle työntekijälle jo luotu käyttäjätunnus. Kapea muoto eikä koko
  // KayttajaRivi: komponentti lukee tästä vain onko tunnus olemassa, ja EVENT-puolen
  // käyttäjätyypin tuonti jaettuun komponenttiin olisi kerrosrike ilman hyötyä.
  olemassaOlevaTunnus: { username: string } | null;
  // Näytetäänkö käyttäjätunnuksen luontipainike. GUARD-puolella ei: /api/users vaatii
  // pääkäyttäjän, ja tunnuksen luonti on hallintaa eikä henkilöstötietojen ylläpitoa.
  // Oletus true, jotta tapahtumapuolen kutsu ei muutu.
  saaLuodaTunnuksen?: boolean;
  // Mihin tunnistenumeroa käytetään. TULEE KUTSUJALTA, koska vastaus on eri puolilla eri:
  // EVENTissä numero liitetään raportin kirjaajaan tapahtumakohtaisen nimimerkin perään
  // (App.tsx: kirjaajanTunniste), GUARDissa kirjaajana on tunnuksen oma nimimerkki eikä
  // numeroa liitetä lainkaan — siellä numero yksilöi henkilön perehdytysmerkinnöissä ja
  // kaluston luovutustositteissa. Yksi yhteinen lause olisi väärin toisella puolella.
  tunnisteVihje?: ReactNode;
  onAvaaTunnus: () => void;
  // Kielitaitorivien muokkaus; rivit ovat lomake.languages-taulukossa.
  onLisaaKieli: () => void;
  onPoistaKieli: (idx: number) => void;
  onMuutaKieli: (idx: number, avain: string, arvo: any) => void;
};

export const TyontekijanMuokkaus = ({
  lomake, onKentta, muokattava, saaMuokata, onTallenna, onPeruuta, onPoista,
  kayttajatunnus, olemassaOlevaTunnus, onAvaaTunnus, saaLuodaTunnuksen = true,
  tunnisteVihje,
  onLisaaKieli, onPoistaKieli, onMuutaKieli,
}: Props) => (
<div className="bg-surface rounded-xl shadow-sm border border-line-soft p-6 md:p-8 max-w-5xl">
  <div className="mb-6 border-b border-line-soft pb-4 flex justify-between items-start">
    <div>
      <h2 className="text-xl font-bold text-ink flex items-center gap-2">
        {muokattava ? <UserCheck className="text-accent" size={24} /> : <UserPlus className="text-success" size={24} />}
        {muokattava ? 'Muokkaa työntekijää' : 'Kirjaa uusi työntekijä'}
      </h2>
      <p className="text-sm text-ink-muted mt-1">
        {muokattava ? 'Päivitä työntekijän perustiedot, luvat ja suoritetut koulutukset.' : 'Lisää työntekijän perustiedot, pätevyydet ja suoritetut koulutukset rekisteriin.'}
      </p>
    </div>
    {muokattava && saaMuokata && (
      <button
        onClick={() => onPoista(muokattava)}
        title="Poista työntekijä"
        className="text-ink-subtle hover:text-danger hover:bg-danger-soft p-2 rounded-lg transition-colors shrink-0"
      >
        <Trash2 size={20} />
      </button>
    )}
  </div>

  <form className="space-y-8 text-left" onSubmit={(e) => e.preventDefault()}>
    {/* Osa 1: Henkilötiedot */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-ink-body border-b pb-2 flex items-center gap-2">
        <Contact size={18} className="text-ink-subtle"/>
        1. Henkilötiedot
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink-body mb-1">Etunimi</label>
          <input type="text" value={lomake.firstName} onChange={(e) => onKentta('firstName', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" placeholder="Esim. Elli Marja Orvokki" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-body mb-1">Sukunimi</label>
          <input type="text" value={lomake.lastName} onChange={(e) => onKentta('lastName', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" placeholder="Esim. Korhonen" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-body mb-1">Henkilötunnus</label>
          <input type="text" value={lomake.personalId} onChange={(e) => onKentta('personalId', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" placeholder="PPKKVV-XXXX" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-body mb-1">Syntymäaika</label>
          <input type="date" value={lomake.birthDate} onChange={(e) => onKentta('birthDate', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-body mb-1">Kansalaisuus</label>
          <input type="text" value={lomake.nationality} onChange={(e) => onKentta('nationality', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" placeholder="Esim. Suomi" />
        </div>
      </div>
    </div>

    {/* Osa 2: Yhteystiedot */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-ink-body border-b pb-2 flex items-center gap-2">
        <Home size={18} className="text-ink-subtle"/>
        2. Yhteystiedot
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink-body mb-1">Katuosoite</label>
          <input type="text" value={lomake.address} onChange={(e) => onKentta('address', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" placeholder="Esimerkkikatu 1 A 2" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-body mb-1">Postinumero</label>
            <input type="text" value={lomake.postalCode} onChange={(e) => onKentta('postalCode', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" placeholder="00100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-body mb-1">Postitoimipaikka</label>
            <input type="text" value={lomake.postalCity} onChange={(e) => onKentta('postalCity', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" placeholder="Helsinki" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-body mb-1">Sähköposti</label>
          <input type="email" value={lomake.email} onChange={(e) => onKentta('email', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" placeholder="etunimi.sukunimi@esimerkki.fi" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-body mb-1">Matkapuhelin</label>
          <input type="tel" value={lomake.phone} onChange={(e) => onKentta('phone', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" placeholder="040 123 4567" />
        </div>
      </div>
    </div>

    {/* Osa 3: Pankkitiedot */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-ink-body border-b pb-2 flex items-center gap-2">
        <Landmark size={18} className="text-ink-subtle"/>
        3. Pankkitiedot
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink-body mb-1">Tilinumero (IBAN)</label>
          <input type="text" value={lomake.iban} onChange={(e) => onKentta('iban', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" placeholder="FI00 0000 0000 0000 00" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-body mb-1">BIC</label>
          <input type="text" value={lomake.bic} onChange={(e) => onKentta('bic', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" placeholder="Esim. NDEAFIHH" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-body mb-1">Pankki</label>
          <input type="text" value={lomake.bankName} onChange={(e) => onKentta('bankName', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" placeholder="Esim. Nordea" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-body mb-1">Veronumero</label>
          <input type="text" inputMode="numeric" value={lomake.taxNumber} onChange={(e) => onKentta('taxNumber', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" placeholder="12 numeroa" />
        </div>
      </div>
    </div>

    {/* Osa 4: Työsuhdetiedot */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-ink-body border-b pb-2 flex items-center gap-2">
        <Briefcase size={18} className="text-ink-subtle"/>
        4. Työsuhdetiedot
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink-body mb-1">Työsuhteen alkamispäivä</label>
          <div className="flex gap-2">
            <input type="date" value={lomake.employmentStart} onChange={(e) => onKentta('employmentStart', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" />
            <button
              type="button"
              onClick={() => onKentta('employmentStart', paikallinenPaiva())}
              title="Aseta tämä päivä"
              className="shrink-0 px-3 py-2 text-sm font-medium text-accent bg-accent-soft border border-accent/30 hover:bg-accent-soft rounded-lg transition-colors"
            >
              Tänään
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-body mb-1">Työn suorittamispaikka</label>
          <input type="text" value={lomake.workLocation} onChange={(e) => onKentta('workLocation', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" placeholder="Esim. Tampere ja lähikunnat" />
        </div>
      </div>

      {/* Työsuhteen voimassaolo */}
      <div className="bg-sunken border border-line rounded-xl p-4 space-y-3">
        <p className="text-sm font-bold text-ink">Työsuhde voimassa</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            ['permanent', 'Toistaiseksi'],
            ['fixed', 'Määräajan'],
          ].map(([arvo, label]) => (
            <label key={arvo} className="flex items-center gap-2.5 p-3 bg-surface rounded-lg border border-line cursor-pointer hover:bg-sunken transition-colors">
              <input
                type="checkbox"
                checked={lomake.employmentType === arvo}
                onChange={(e) => onKentta('employmentType', e.target.checked ? arvo : '')}
                className="w-4 h-4 text-accent rounded border-line-strong focus:ring-accent shrink-0"
              />
              <span className="text-sm font-medium text-ink-body">{label}</span>
            </label>
          ))}
        </div>
        {lomake.employmentType === 'fixed' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-muted mb-1">Määräaika alkaa</label>
              <input type="date" value={lomake.employmentFixedFrom} onChange={(e) => onKentta('employmentFixedFrom', e.target.value)} className="w-full rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent" />
            </div>
            <div>
              <label className="block text-xs text-ink-muted mb-1">Määräaika päättyy</label>
              <input type="date" value={lomake.employmentFixedTo} onChange={(e) => onKentta('employmentFixedTo', e.target.value)} className="w-full rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent" />
            </div>
          </div>
        )}
      </div>

      {/* Työaika ja palkkausmuoto */}
      <div className="bg-sunken border border-line rounded-xl p-4 space-y-3">
        <p className="text-sm font-bold text-ink">Työaika ja palkkausmuoto</p>
        <div className="space-y-2">
          {[
            ['monthly', 'Kuukausipalkka', '120 h / 3 viikkoa'],
            ['parttime', 'Tuntipalkka (osa-aikainen)', 'alle 112 h 30 min / 3 viikkoa'],
            ['oncall', 'Erikseen työhön kutsuttava tuntipalkkainen', 'työvoimareservi'],
          ].map(([arvo, label, tarkenne]) => (
            <label key={arvo} className="flex items-start gap-2.5 p-3 bg-surface rounded-lg border border-line cursor-pointer hover:bg-sunken transition-colors">
              <input
                type="checkbox"
                checked={lomake.workTimeType === arvo}
                onChange={(e) => onKentta('workTimeType', e.target.checked ? arvo : '')}
                className="w-4 h-4 mt-0.5 text-accent rounded border-line-strong focus:ring-accent shrink-0"
              />
              <span className="text-sm text-ink-body">
                <span className="font-medium">{label}</span>
                <span className="text-ink-muted"> — {tarkenne}</span>
              </span>
            </label>
          ))}
        </div>
        {(lomake.workTimeType === 'parttime' || lomake.workTimeType === 'oncall') && (
          <div className="sm:w-72">
            <label className="block text-xs text-ink-muted mb-1">Vähimmäistyöaika (tuntia / 3 viikkoa)</label>
            <input type="number" min="0" step="0.5" value={lomake.minHoursPer3Weeks} onChange={(e) => onKentta('minHoursPer3Weeks', e.target.value)} className="w-full rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent" placeholder="Esim. 60" />
          </div>
        )}
      </div>

      <div className="bg-warning-soft border border-warning/30 rounded-xl p-4 flex gap-3">
        <Info size={18} className="text-warning shrink-0 mt-0.5" />
        <p className="text-sm text-warning-ink leading-relaxed">
          Työtehtävissä noudatetaan voimassa olevia lakeja sekä työehtosopimusta.
        </p>
      </div>

      {/* Palkkaus */}
      <div className="bg-sunken border border-line rounded-xl p-4 space-y-4">
        <p className="text-sm font-bold text-ink">Palkkaus</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-ink-muted mb-1">Tasopalkka</label>
            <select value={lomake.payLevel} onChange={(e) => onKentta('payLevel', e.target.value)} className="w-full rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent">
              <option value="">Ei valittu</option>
              {['I', 'II', 'III', 'IIIA', 'IV', 'IVA', 'V'].map((taso) => (
                <option key={taso} value={taso}>{taso}-taso</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Paikkakuntaluokka</label>
            <select value={lomake.municipalityClass} onChange={(e) => onKentta('municipalityClass', e.target.value)} className="w-full rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent">
              <option value="">Ei valittu</option>
              <option value="A">A = pääkaupunkiseutu</option>
              <option value="B">B = muu Suomi</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Tasopalkka (€/kk)</label>
            <input type="text" inputMode="decimal" value={lomake.basePay} onChange={(e) => onKentta('basePay', e.target.value)} className="w-full rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent" placeholder="TES-taulukon mukaan" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-ink-muted mb-1">Henkilökohtainen palkan osa (€/kk)</label>
            <input type="text" inputMode="decimal" value={lomake.personalPayPart} onChange={(e) => onKentta('personalPayPart', e.target.value)} className="w-full rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent" placeholder="0,00" />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Perusteet</label>
            <input type="text" value={lomake.personalPayBasis} onChange={(e) => onKentta('personalPayBasis', e.target.value)} className="w-full rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent" placeholder="Millä perusteella osa on sovittu" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-ink-muted mb-1">Henkilökohtainen palkka, jos sovittu (€/kk)</label>
            <input type="text" inputMode="decimal" value={lomake.personalPay} onChange={(e) => onKentta('personalPay', e.target.value)} className="w-full rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent" placeholder="Korvaa tasopalkan" />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Muu palkka (€/kk)</label>
            <input type="text" inputMode="decimal" value={lomake.otherPay} onChange={(e) => onKentta('otherPay', e.target.value)} className="w-full rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent" placeholder="0,00" />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Muun palkan perusteet</label>
            <input type="text" value={lomake.otherPayBasis} onChange={(e) => onKentta('otherPayBasis', e.target.value)} className="w-full rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent" placeholder="Esim. olosuhdelisä" />
          </div>
        </div>

        {/* Kokonaispalkka lasketaan yllä olevista riveistä */}
        {(() => {
          const summa = laskeKokonaispalkka(lomake);
          return (
            <div className="bg-surface border-2 border-accent/30 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">Kokonaispalkka</p>
                  <p className="text-2xl font-bold text-accent-ink mt-1">
                    {muotoileEuro(summa.kuukaudessa)} €/kk
                  </p>
                  <p className="text-sm font-semibold text-ink-body">
                    {muotoileEuro(summa.tunnissa)} €/tunti
                  </p>
                </div>
                <div className="sm:w-44">
                  <label className="block text-xs text-ink-muted mb-1">Tuntijakaja (h/kk)</label>
                  <input type="text" inputMode="decimal" value={lomake.hourDivisor} onChange={(e) => onKentta('hourDivisor', e.target.value)} className="w-full rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent" />
                </div>
              </div>
              <p className="text-xs text-ink-muted mt-3 leading-relaxed">
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
        <label className="block text-sm font-medium text-ink-body mb-1">Muut sopimuksen ehdot</label>
        <textarea rows={3} value={lomake.otherTerms} onChange={(e) => onKentta('otherTerms', e.target.value)} className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent" placeholder="Esim. koeaika, työvälineet, muut erikseen sovitut ehdot" />
      </div>

      {/* Kiinteät sopimusehdot */}
      <div className="bg-surface border border-line rounded-xl p-4">
        <h4 className="text-sm font-bold text-ink mb-2">Salassapitovelvollisuus</h4>
        <p className="text-sm text-ink-body leading-relaxed">
          Työntekijä sitoutuu olemaan ilmaisematta tietoja vartiointikohteen turvallisuusjärjestelyistä,
          vartiointitoimeksiannon osapuolten liike- tai ammattisalaisuutta taikka yksityisen henkilön
          henkilökohtaisista asioista. Salassapitovelvollisuus ei koske tietojen antamista
          valvontaviranomaiselle, syyttäjä- tai poliisiviranomaiselle rikoksen selvittämistä varten eikä
          viranomaiselle, jolla erikoissäännöksen nojalla on oikeus saada näitä tietoja.
        </p>
      </div>

      <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-bold text-ink">Koulutus</h4>
        <p className="text-sm text-ink-body leading-relaxed">
          Työntekijä sitoutuu osallistumaan kaikkeen työnantajan osoittamaan ammatilliseen koulutukseen.
          Perusteeton koulutuksesta kieltäytyminen katsotaan työstä kieltäytymiseksi.
        </p>

        <h4 className="text-sm font-bold text-ink pt-1">
          Vartijan peruskurssin vaikutus työsuhteeseen, työsuhteen purku, lopputilin saamisen edellytykset
        </h4>
        <p className="text-sm text-ink-body leading-relaxed">
          Työntekijän osallistuessa yksityisistä turvallisuuspalveluista annetun lain edellyttämälle
          vartijan peruskurssille (60 tunnin osio), hän sitoutuu kurssin hyväksytysti suoritettuaan
          olemaan työnantajan palveluksessa vähintään{' '}
          <input
            type="number"
            min="0"
            max="4"
            value={lomake.trainingCommitmentMonths}
            onChange={(e) => onKentta('trainingCommitmentMonths', e.target.value)}
            className="inline-block w-16 rounded border-line-strong border px-2 py-0.5 text-sm focus:ring-2 focus:ring-accent align-baseline"
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
            className="inline-block w-24 rounded border-line-strong border px-2 py-0.5 text-sm focus:ring-2 focus:ring-accent align-baseline"
            placeholder="0,00"
          />{' '}
          euroa.
        </p>
        <p className="text-sm text-ink-body leading-relaxed">
          Mikäli viranomainen peruuttaa työntekijän vartijaksi hyväksymisen, voi se olla peruste
          työsopimuksen päättämiselle.
        </p>
        <p className="text-sm text-ink-body leading-relaxed">
          Työsuhteen päättyessä on aina lopputilin maksamisen edellytyksenä, että työntekijä palauttaa
          työnantajan hänelle luovuttamat puvun, varusteet, laitteet ja toimikortin (TES 36 §).
        </p>
      </div>
    </div>

    {/* Osa 5: Ajokortti ja yleiset luvat.
        Tiivistetty: kortit ovat kahdessa sarakkeessa yhden sijaan, jolloin
        koko osio mahtuu näytölle ilman vieritystä. */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-ink-body border-b pb-2 flex items-center gap-2">
        <BadgeCheck size={18} className="text-ink-subtle"/>
        5. Ajokortti ja yleiset luvat
      </h3>

      {/* Ajokortti: kyllä-valinta + ajo-oikeuden laatu vasta jos rastittu */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-sunken rounded-lg border border-line">
        <label className="flex items-center gap-2.5 cursor-pointer sm:w-48 shrink-0">
          <input
            type="checkbox"
            checked={lomake.hasDrivingLicense}
            onChange={(e) => onKentta('hasDrivingLicense', e.target.checked)}
            className="w-4 h-4 text-accent rounded border-line-strong focus:ring-accent shrink-0"
          />
          <span className="text-sm font-medium text-ink-body">Ajokortti</span>
        </label>
        <input
          type="text"
          disabled={!lomake.hasDrivingLicense}
          value={lomake.drivingLicense}
          onChange={(e) => onKentta('drivingLicense', e.target.value)}
          className="w-full rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent disabled:bg-sunken disabled:text-ink-subtle"
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
          <label key={key} className="flex items-center gap-2.5 p-3 bg-sunken rounded-lg border border-line cursor-pointer hover:bg-sunken transition-colors">
            <input type="checkbox" checked={lomake[key]} onChange={(e) => onKentta(key, e.target.checked)} className="w-4 h-4 text-accent rounded border-line-strong focus:ring-accent shrink-0" />
            <span className="text-sm font-medium text-ink-body">{label}</span>
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
          <div key={boolKey} className="flex items-center gap-3 p-3 bg-surface border border-line rounded-lg hover:bg-sunken transition-colors">
            <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
              <input type="checkbox" checked={lomake[boolKey]} onChange={(e) => onKentta(boolKey, e.target.checked)} className="w-4 h-4 text-accent rounded border-line-strong focus:ring-accent shrink-0" />
              <span className="text-sm font-medium text-ink-body truncate">{label}</span>
            </label>
            <input
              type="month"
              disabled={!lomake[boolKey]}
              value={lomake[untilKey]}
              onChange={(e) => onKentta(untilKey, e.target.value)}
              title="Voimassa asti"
              className="w-36 shrink-0 rounded-lg border-line-strong border p-1.5 text-sm focus:ring-2 focus:ring-accent disabled:bg-sunken disabled:text-ink-subtle"
            />
          </div>
        ))}
      </div>
    </div>

    {/* Osa 6: Turvallisuusalan kortit */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-ink-body border-b pb-2 flex items-center gap-2">
        <IdCard size={18} className="text-ink-subtle"/>
        6. Turvallisuusalan kortit
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {([
          ['hasJvCard', 'jvCard', 'jvCardValidUntil', 'Järjestyksenvalvojakortti'],
          ['hasGuardCard', 'guardCard', 'guardCardValidUntil', 'Vartijakortti'],
          ['hasGasPermit', 'gasPermit', 'gasPermitValidUntil', 'Kaasusumuttimen hallussapito'],
        ] as const).map(([boolKey, numKey, untilKey, label]) => (
          <div key={numKey} className="bg-sunken p-4 rounded-xl border border-line space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={lomake[boolKey]}
                onChange={(e) => onKentta(boolKey, e.target.checked)}
                className="w-4 h-4 text-accent rounded border-line-strong focus:ring-accent shrink-0"
              />
              <span className="text-sm font-bold text-ink">{label}</span>
            </label>
            <input
              type="text"
              disabled={!lomake[boolKey]}
              value={lomake[numKey]}
              onChange={(e) => onKentta(numKey, e.target.value)}
              className="w-full rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent disabled:bg-sunken disabled:text-ink-subtle"
              placeholder="Kortin numero"
            />
            <div>
              <label className="block text-xs text-ink-muted mb-1">Voimassa asti (kk/vuosi)</label>
              <input
                type="month"
                disabled={!lomake[boolKey]}
                value={lomake[untilKey]}
                onChange={(e) => onKentta(untilKey, e.target.value)}
                className="w-full rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent disabled:bg-sunken disabled:text-ink-subtle"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Voimankäyttövälineiden kertauskoulutus: turvallisuusalan pätevyys,
          ei yleinen työturvallisuuskortti — siirretty tänne osiosta 7. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-surface border border-line rounded-lg">
        <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
          <input type="checkbox" checked={lomake.trainingRefresher} onChange={(e) => onKentta('trainingRefresher', e.target.checked)} className="w-4 h-4 text-accent rounded border-line-strong focus:ring-accent shrink-0" />
          <span className="text-sm font-medium text-ink-body">Voimankäyttövälineiden kertauskoulutus</span>
        </label>
        <div className="sm:w-48">
          <input
            type="date"
            disabled={!lomake.trainingRefresher}
            value={lomake.trainingRefresherUntil}
            onChange={(e) => onKentta('trainingRefresherUntil', e.target.value)}
            title="Voimassa asti"
            className="w-full rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent disabled:bg-sunken disabled:text-ink-subtle"
          />
        </div>
      </div>
    </div>

    {/* Osa 7: Työturvallisuuskortit. Tiivistetty samalla tavalla kuin osio 5. */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-ink-body border-b pb-2 flex items-center gap-2">
        <HardHat size={18} className="text-ink-subtle"/>
        7. Työturvallisuuskortit
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {([
          ['roadSafetyCard', 'roadSafetyCardUntil', 'Tieturvakortti'],
          ['forkliftCard', 'forkliftCardUntil', 'Trukkikortti'],
          ['hotWorkCard', 'hotWorkCardUntil', 'Tulityökortti'],
          ['safetyCard', 'safetyCardUntil', 'Työturvallisuuskortti'],
        ] as const).map(([boolKey, dateKey, label]) => (
          <div key={boolKey} className="flex items-center gap-3 p-3 bg-surface border border-line rounded-lg hover:bg-sunken transition-colors">
            <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
              <input type="checkbox" checked={lomake[boolKey]} onChange={(e) => onKentta(boolKey, e.target.checked)} className="w-4 h-4 text-accent rounded border-line-strong focus:ring-accent shrink-0" />
              <span className="text-sm font-medium text-ink-body truncate">{label}</span>
            </label>
            <input
              type="date"
              disabled={!lomake[boolKey]}
              value={lomake[dateKey]}
              onChange={(e) => onKentta(dateKey, e.target.value)}
              title="Voimassa asti"
              className="w-40 shrink-0 rounded-lg border-line-strong border p-1.5 text-sm focus:ring-2 focus:ring-accent disabled:bg-sunken disabled:text-ink-subtle"
            />
          </div>
        ))}
      </div>
    </div>

    {/* Osa 7: Erityiskoulutukset */}
    <div className="space-y-4">
      <div className="flex justify-between items-end border-b pb-2">
        <h3 className="text-md font-semibold text-ink-body flex items-center gap-2">
          <UserCheck size={18} className="text-ink-subtle"/>
          8. Erityiskoulutukset
        </h3>
        <span className="text-xs font-medium text-warning bg-warning-soft px-2 py-1 rounded">Ruksaa vain jos suoritettu ja todistus mukana</span>
      </div>

      <div className="bg-surface border border-line rounded-xl overflow-hidden divide-y divide-line-soft">
        <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-sunken transition-colors">
          <input type="checkbox" checked={lomake.trainingForce} onChange={(e) => onKentta('trainingForce', e.target.checked)} className="w-5 h-5 text-accent rounded border-line-strong focus:ring-accent" />
          <div>
            <span className="block text-sm font-bold text-ink">Järjestyksenvalvojan voimankäytön lisäkoulutus</span>
            <span className="block text-xs text-ink-muted mt-0.5">Oikeuttaa kantaa voimankäyttövälineitä (jos muut luvat kunnossa).</span>
          </div>
        </label>
        <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-sunken transition-colors">
          <input type="checkbox" checked={lomake.trainingGas} onChange={(e) => onKentta('trainingGas', e.target.checked)} className="w-5 h-5 text-accent rounded border-line-strong focus:ring-accent" />
          <span className="text-sm font-bold text-ink">Kaasusumutinkoulutus</span>
        </label>
        <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-sunken transition-colors">
          <input type="checkbox" checked={lomake.trainingBaton} onChange={(e) => onKentta('trainingBaton', e.target.checked)} className="w-5 h-5 text-accent rounded border-line-strong focus:ring-accent" />
          <span className="text-sm font-bold text-ink">Teleskooppipatukkakoulutus</span>
        </label>
        <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-sunken transition-colors">
          <input type="checkbox" checked={lomake.firearmTraining} onChange={(e) => onKentta('firearmTraining', e.target.checked)} className="w-5 h-5 text-accent rounded border-line-strong focus:ring-accent" />
          <span className="text-sm font-bold text-ink">Vartijan ampuma-asekoulutus</span>
        </label>
      </div>
    </div>

    {/* Osa 8: Kielitaito */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-ink-body border-b pb-2 flex items-center gap-2">
        <Languages size={18} className="text-ink-subtle"/>
        9. Kielitaito
      </h3>
      <div className="space-y-3">
        {lomake.languages.length === 0 && (
          <p className="text-sm text-ink-muted">Ei lisättyjä kieliä.</p>
        )}
        {lomake.languages.map((lang, idx) => (
          <div key={idx} className="flex flex-col sm:flex-row gap-3 sm:items-center bg-sunken p-3 rounded-lg border border-line">
            <input
              type="text"
              value={lang.language}
              onChange={(e) => onMuutaKieli(idx, 'language', e.target.value)}
              placeholder="Esim. Englanti"
              className="flex-1 rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent"
            />
            <select
              value={lang.level}
              onChange={(e) => onMuutaKieli(idx, 'level', Number(e.target.value))}
              className="rounded-lg border-line-strong border p-2 text-sm focus:ring-2 focus:ring-accent sm:w-56"
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
              className="text-danger hover:text-danger-ink p-2 rounded-lg hover:bg-danger-soft transition-colors shrink-0 self-start sm:self-center"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onLisaaKieli}
          className="text-sm font-medium text-accent hover:text-accent-ink flex items-center gap-1.5"
        >
          <Plus size={16} />
          Lisää kieli
        </button>
      </div>
    </div>

    {/* Osa 10: Käyttäjätunnukset. Avaa modaalin eikä vie käyttäjähallintaan,
        jottei keskeneräinen työntekijän muokkaus katoa navigoinnin mukana. */}
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-ink-body border-b pb-2 flex items-center gap-2">
        <KeyRound size={18} className="text-ink-subtle"/>
        10. Käyttäjätunnukset
      </h3>
      <div className="bg-sunken border border-line rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm text-ink-body">
            <span className="font-medium">Käyttäjätunnus:</span>{' '}
            {kayttajatunnus
              ? <span className="font-mono text-ink-strong">{kayttajatunnus}</span>
              : <span className="text-ink-subtle">muodostuu etu- ja sukunimestä</span>}
          </p>
          <p className="text-sm text-ink-body">
            <span className="font-medium">Tunnistenumero:</span>{' '}
            {lomake.displayId
              ? <span className="font-mono text-ink-strong">{muotoileTunniste(lomake.displayId)}</span>
              : <span className="text-ink-subtle">annetaan kun työntekijä tallennetaan</span>}
          </p>
          <p className="text-xs text-ink-muted pt-1 leading-relaxed">
            {tunnisteVihje ?? 'Numero annetaan kerran tallennettaessa eikä sitä muuteta jälkikäteen: jo tallennetut merkinnät viittaavat siihen.'}
          </p>
        </div>
        {saaMuokata && saaLuodaTunnuksen && (
          <button
            type="button"
            onClick={onAvaaTunnus}
            disabled={!kayttajatunnus}
            title={kayttajatunnus ? undefined : 'Täytä ensin etunimi ja sukunimi'}
            className="shrink-0 px-4 py-2.5 text-sm font-bold text-white bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <KeyRound size={16} />
            {olemassaOlevaTunnus ? 'Muokkaa käyttäjätunnusta' : 'Luo käyttäjätunnukset'}
          </button>
        )}
      </div>
    </div>

    <div className="pt-6 flex justify-end gap-3 border-t border-line-soft">
      <button
        type="button"
        onClick={() => onPeruuta()}
        className="px-5 py-2.5 text-sm font-medium text-ink-body bg-sunken hover:bg-sunken rounded-lg transition-colors"
      >
        Peruuta
      </button>
      {saaMuokata && (
        <button
          type="button"
          onClick={onTallenna}
          className="px-5 py-2.5 text-sm font-bold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors flex items-center gap-2 shadow-sm"
        >
          <CheckCircle size={18} />
          {muokattava ? 'Tallenna muutokset' : 'Tallenna työntekijä'}
        </button>
      )}
    </div>
  </form>
</div>
);
