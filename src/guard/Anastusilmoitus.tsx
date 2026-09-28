// Anastusilmoitus (27.9.2026, käyttäjän kenttälista; täydennetty 28.9.2026 vanhan
// paperipohjan "Anastusilmoitus" kysymyksillä).
//
// Oma lomakkeensa eikä kolmas haara Raportit.tsx:ään: toimenpidekirjauksen lukumäärät ja
// voimakeinot eivät kuulu tähän, ja tämän tuotelista ja summat eivät kuulu niihin.
// Tallennus kulkee silti samaa tietä (guardReports, typeId 'guard_theft'), joten
// kirjaus saa saman tilamallin, lukituksen ja kenttäsalauksen kuin muut vartijan raportit.
//
// Osioiden järjestys seuraa paperipohjaa: asianomistaja, ajat ja paikat, anastettu
// omaisuus, selostus, kiinniotettu, muut henkilöt, vaatimukset, toimenpiteet.
//
// Tietojen sijoittelu tietueeseen (ks. tyypit.ts: GuardRaportti):
//   kiinniotetun nimi, hetu ja osoite   subjectLastName / subjectFirstNames /
//                                       subjectPersonalId / subjectAddress
//   vartijan havainnot (selostus)       description
// Nämä ovat jo salattuja kenttiä, ja anastusilmoituksen omat henkilötietokentät on
// lisätty salattaviin (server/store.js).
//
// Korvausta vaaditaan tuotteiden ALV 0 -hinnasta (ks. anastus.ts).
import { useState, type ReactNode } from 'react';
import { CheckCircle2, Plus, Printer, ShoppingBag, Trash2 } from 'lucide-react';

import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { Liitteet } from '../shared/komponentit/Liitteet';
import type { Liite } from '../shared/liitteet';
import { paikallinenPaiva } from '../shared/ajat';
import { lomakeRaportille } from '../shared/lomakerekisteri';
import { Kentta } from './Kentta';
import {
  ALV_KANNAT, OLETUS_ALV, SELVITYSKULUT, TUOTTEEN_TILAT, euroina, laskeSummat, lueHinta,
  raportinSummat, type AnastettuTuote, type MuuKulu, type TuotteenTila,
} from './anastus';
import { uusiId, type GuardRaportti, type Kohde } from './tyypit';
import { tulostaAnastusilmoitus } from './anastustuloste';

// Tulostuspainikkeet: sama pari tallennuksen vahvistuksessa ja kohteen tiedoissa.
export const AnastusTulosteet = ({ raportti }: { raportti: GuardRaportti }) => (
  <div className="flex flex-wrap gap-2">
    {([['poliisi', 'Tuloste poliisille'], ['kauppias', 'Tuloste kauppiaalle']] as const).map(([v, nimi]) => (
      <button
        key={v}
        type="button"
        onClick={() => tulostaAnastusilmoitus(raportti, v)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-body bg-surface border border-line hover:bg-sunken rounded-lg transition-colors"
      >
        <Printer size={16} />
        {nimi}
      </button>
    ))}
  </div>
);

const kylla = (v?: boolean | null) => (v === true ? 'kyllä' : v === false ? 'ei' : '—');

// Tallennetun anastusilmoituksen tiivistelmä kohteen tiedoissa ja raporteissa.
// Anastajan tiedot näkyvät niissä jo kohdehenkilö-lohkossa peitettyine hetuineen, joten
// tässä on vain se mikä on anastusilmoitukselle omaa.
export const AnastuksenYhteenveto = ({ raportti: r }: { raportti: GuardRaportti }) => {
  const s = raportinSummat(r);
  return (
    <div className="bg-sunken rounded-lg p-3 space-y-2 text-xs">
      <p className="font-medium text-ink-body">Anastusilmoitus</p>
      <p className="text-ink-muted">
        Asianomistaja: {r.theftClaimant || '—'}{r.theftBusinessId ? ` (${r.theftBusinessId})` : ''}
        {' · '}Kirjallinen menettely: {kylla(r.theftWrittenProcedureConsent)}
        {' · '}RV-menettely: {kylla(r.theftPenaltyOrderConsent)}
      </p>
      <ul className="text-ink-muted">
        {(r.theftItems || []).map((t) => (
          <li key={t.id}>
            {t.nimi} · {t.kpl && t.kpl > 1 ? `${t.kpl} × ` : ''}{euroina(Math.round(t.hinta * 100))}
            {t.tila ? ` · ${TUOTTEEN_TILAT.find((x) => x.id === t.tila)?.nimi}` : ''}
          </li>
        ))}
      </ul>
      <p className="text-ink-body font-medium">
        Korvausvaatimus {r.theftClaimsCompensation === false ? 'ei esitetty' : euroina(s.vaatimusSnt)}
        {' · '}Ilmoitettu poliisille: {kylla(r.theftReportedToPolice)}
        {' · '}Luovutettu poliisille: {kylla(r.theftHandedToPolice)}
      </p>
      <AnastusTulosteet raportti={r} />
    </div>
  );
};

type Props = {
  kohde: Kohde;
  vartija: string;
  onTallenna: (raportti: GuardRaportti) => Promise<boolean>;
  onTakaisin: () => void;
};

// datetime-local-kentän arvo nykyhetkestä paikallisessa ajassa.
const nytPaikallisena = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const kellonaika = (paikallinen: string) => paikallinen.slice(11, 16);

type TuoteRivi = AnastettuTuote & { hintaTeksti: string };

const uusiTuote = (): TuoteRivi => ({
  id: uusiId(), nimi: '', hinta: 0, alv: OLETUS_ALV, kpl: 1, tila: null, hintaTeksti: '',
});

const HENKILOLLISYYS: { id: NonNullable<GuardRaportti['theftIdVerified']>; nimi: string }[] = [
  { id: 'henkilokortti', nimi: 'Henkilökortti' },
  { id: 'ajokortti', nimi: 'Ajokortti' },
  { id: 'passi', nimi: 'Passi' },
  { id: 'ei', nimi: 'Ei todettu' },
];

const syote = 'w-full rounded-lg border border-line-strong p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent';

export const Anastusilmoitus = ({ kohde, vartija, onTallenna, onTakaisin }: Props) => {
  const [tallentaa, setTallentaa] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [liitteet, setLiitteet] = useState<Liite[]>([]);
  const [liitteetLataa, setLiitteetLataa] = useState(false);
  // Tallennettu ilmoitus. Lomake ei sulkeudu tallennuksessa, koska tuloste tehdään
  // yleensä heti: poliisi ja kauppias odottavat paperia paikan päällä.
  const [tallennettu, setTallennettu] = useState<GuardRaportti | null>(null);

  // Tekstikentät ja kyllä/ei-valinnat yhdessä oliossa: niitä on kolmisenkymmentä, ja
  // jokainen oma useState tekisi lomakkeesta lukukelvottoman.
  const [k, setK] = useState<Partial<GuardRaportti>>({
    theftSiteContact: [kohde.name, kohde.address, kohde.contactName, kohde.contactPhone].filter(Boolean).join('\n'),
    theftPlace: kohde.name,
    theftAt: nytPaikallisena(),
    theftReporter: vartija,
    theftDetainer: vartija,
    theftPenaltyOrderConsent: null,
    theftWrittenProcedureConsent: null,
    theftClaimsCompensation: null,
    theftViolent: null,
    theftReportedToPolice: null,
    theftHandedToPolice: null,
    theftIdVerified: null,
  });
  const aseta = (muutos: Partial<GuardRaportti>) => setK((p) => ({ ...p, ...muutos }));
  const teksti = (avain: keyof GuardRaportti) => String(k[avain] ?? '');
  const tekstiksi = (avain: keyof GuardRaportti) => (v: string) => aseta({ [avain]: v });

  // Hinnat ja summat pidetään myös tekstinä, jotta "12," ei muutu kesken kirjoittamisen "12":ksi.
  const [tuotteet, setTuotteet] = useState<TuoteRivi[]>([uusiTuote()]);
  const [muitaKuluja, setMuitaKuluja] = useState<boolean | null>(null);
  const [kulut, setKulut] = useState<(MuuKulu & { summaTeksti: string })[]>([]);
  const [tuotesuojaTeksti, setTuotesuojaTeksti] = useState('');

  const tuotesuoja = lueHinta(tuotesuojaTeksti);
  const summat = laskeSummat(tuotteet, muitaKuluja ? kulut : [], { tuotesuoja });

  const muutaTuote = (id: string, muutos: Partial<TuoteRivi>) =>
    setTuotteet((l) => l.map((t) => (t.id === id ? { ...t, ...muutos } : t)));
  const muutaKulu = (id: string, muutos: Partial<MuuKulu & { summaTeksti: string }>) =>
    setKulut((l) => l.map((x) => (x.id === id ? { ...x, ...muutos } : x)));

  const tallenna = async () => {
    const kirjatut = tuotteet.filter((t) => t.nimi.trim() || t.hinta > 0);
    const puutteet = [
      !k.theftClaimant?.trim() && 'asianomistaja',
      k.theftPenaltyOrderConsent == null && 'suostumus rangaistusvaatimusmenettelyyn',
      !k.theftAt && 'anastuksen ajankohta',
      kirjatut.length === 0 && 'vähintään yksi anastettu tuote',
      kirjatut.some((t) => !t.nimi.trim()) && 'tuotteen nimi jokaiselle riville',
      !k.description?.trim() && 'vartijan havainnot',
      k.theftClaimsCompensation == null && 'esittääkö asianomistaja korvausvaatimuksen',
      k.theftClaimsCompensation === true && muitaKuluja === null && 'tieto muista kuluista',
    ].filter(Boolean);
    if (puutteet.length > 0) {
      setVirhe(`Täytä vielä: ${puutteet.join(', ')}.`);
      return;
    }
    if (liitteetLataa) {
      setVirhe('Odota, että liitteiden lähetys valmistuu.');
      return;
    }
    setVirhe(null);
    setTallentaa(true);

    const trim = (v?: string) => (v || '').trim();
    const lomakepohja = lomakeRaportille('guard_theft');
    const tuotteita = kirjatut.reduce((n, t) => n + (t.kpl || 1), 0);
    const anastusAika = k.theftAt || '';
    const raportti: GuardRaportti = {
      // Tekstikentät siistittyinä; tyhjä kenttä tallennetaan tyhjänä merkkijonona.
      ...Object.fromEntries(Object.entries(k).map(([a, v]) => [a, typeof v === 'string' ? v.trim() : v])),
      id: uusiId(),
      siteId: kohde.id,
      typeId: 'guard_theft',
      type: 'Anastusilmoitus',
      author: vartija,
      date: anastusAika.slice(0, 10) || paikallinenPaiva(),
      time: kellonaika(anastusAika),
      place: trim(k.theftPlace) || kohde.name,
      // Yhteenvedossa ei ole nimeä eikä henkilötunnusta: se näkyy listoissa ja
      // koosteissa, joissa anastajan tietoja ei tarvita.
      summary: `Anastus: ${tuotteita === 1 ? '1 tuote' : `${tuotteita} tuotetta`}, ${
        k.theftClaimsCompensation === false ? 'ei korvausvaatimusta' : `korvausvaatimus ${euroina(summat.vaatimusSnt)}`}`,
      description: trim(k.description),
      luotu: new Date().toISOString(),
      // Kiinniotto kirjataan myös lukumääränä, jotta se näkyy toimenpidetilastoissa ja
      // lukitsee kirjauksen kuten muutkin kiinniotot (kirjaukset.ts: onLukittu).
      detained: k.theftDetainedAt ? 1 : 0,
      theftItems: kirjatut.map(({ id, nimi, hinta, alv, kpl, tila }) => ({
        id, nimi: nimi.trim(), hinta, alv, kpl: kpl && kpl > 0 ? Math.floor(kpl) : 1, tila: tila || null,
      })),
      theftOtherCosts: k.theftClaimsCompensation && muitaKuluja
        ? kulut.filter((x) => x.selite.trim() || x.summa > 0)
          .map(({ id, selite, summa }) => ({ id, selite: selite.trim(), summa }))
        : [],
      theftTagsBroken: Number(k.theftTagsBroken) || 0,
      theftTagsAmount: tuotesuoja,
      status: 'open',
      severity: null,
      zoneId: null,
      assignedTo: null,
      closedAt: null,
      closedBy: null,
      attachments: liitteet,
      location: { img: null, gps: null },
      formCode: lomakepohja?.koodi ?? null,
      formVersion: lomakepohja?.pohjaVersio ?? null,
      policeDeliveredAt: null,
      policeStation: null,
      corrections: [],
    };
    const ok = await onTallenna(raportti);
    setTallentaa(false);
    if (ok) setTallennettu(raportti);
  };

  if (tallennettu) {
    const s = raportinSummat(tallennettu);
    return (
      <div className="max-w-3xl">
        <div className="bg-surface rounded-xl shadow-sm border border-line-soft p-6 md:p-8">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle2 className="w-6 h-6 text-success-ink shrink-0 mt-0.5" strokeWidth={1.75} />
            <div>
              <h2 className="text-xl font-bold text-ink-strong">Anastusilmoitus tallennettu</h2>
              <p className="text-sm text-ink-muted mt-1 leading-relaxed">
                {tallennettu.theftClaimsCompensation === false
                  ? 'Asianomistaja ei esitä korvausvaatimusta.'
                  : `Korvausvaatimus ${euroina(s.vaatimusSnt)}.`}
                {' '}Tulosta kappale poliisille ja kauppiaalle. Tulosteen saa myöhemmin myös
                kohteen raporteista.
              </p>
            </div>
          </div>
          <AnastusTulosteet raportti={tallennettu} />
          <div className="flex justify-end pt-6 mt-6 border-t border-line-soft">
            <button
              type="button"
              onClick={onTakaisin}
              className="px-5 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
            >
              Valmis
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <TakaisinLinkki onClick={onTakaisin}>Takaisin kohteeseen</TakaisinLinkki>

      <div className="bg-surface rounded-xl shadow-sm border border-line-soft p-6 md:p-8">
        <div className="flex items-start gap-3 mb-6">
          <ShoppingBag className="w-6 h-6 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <h2 className="text-xl font-bold text-ink-strong">Anastusilmoitus</h2>
            <p className="text-sm text-ink-muted mt-1 leading-relaxed">
              Anastuksen tiedot ja korvausvaatimus. Henkilötiedot tallennetaan salattuina.
            </p>
          </div>
        </div>

        {virhe && (
          <p className="mb-6 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
            {virhe}
          </p>
        )}

        <div className="space-y-8">
          <Osio otsikko="Asianomistaja">
            <Kentta label="Kohteen yhteystiedot" arvo={teksti('theftSiteContact')} onChange={tekstiksi('theftSiteContact')} monirivinen />
            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <Kentta
                label="Asianomistaja (liikkeen toiminimi ja katuosoite)"
                arvo={teksti('theftClaimant')}
                onChange={tekstiksi('theftClaimant')}
              />
              <Kentta label="Y-tunnus" arvo={teksti('theftBusinessId')} onChange={tekstiksi('theftBusinessId')} />
            </div>
            <Kentta
              label="Rangaistusta vaatii (nimi ja puhelin)"
              arvo={teksti('theftPenaltyClaimant')}
              onChange={tekstiksi('theftPenaltyClaimant')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Valinta
                label="Kirjallinen menettely"
                vaihtoehdot={[{ v: true, nimi: 'Suostuu' }, { v: false, nimi: 'Ei' }]}
                arvo={k.theftWrittenProcedureConsent ?? null}
                onChange={(v) => aseta({ theftWrittenProcedureConsent: v })}
              />
              <Valinta
                label="Rangaistusvaatimusmenettely"
                vaihtoehdot={[{ v: true, nimi: 'Suostuu' }, { v: false, nimi: 'Ei' }]}
                arvo={k.theftPenaltyOrderConsent ?? null}
                onChange={(v) => aseta({ theftPenaltyOrderConsent: v })}
              />
            </div>
          </Osio>

          <Osio otsikko="Ajat ja paikat">
            <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
              <Kentta label="Tapahtumapaikka" arvo={teksti('theftPlace')} onChange={tekstiksi('theftPlace')} />
              <Kentta label="Anastus tapahtui" arvo={teksti('theftAt')} onChange={tekstiksi('theftAt')} tyyppi="datetime-local" />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
              <span className="hidden sm:block" />
              <Kentta label="Kassalinja ylitettiin" arvo={teksti('theftCheckoutAt')} onChange={tekstiksi('theftCheckoutAt')} tyyppi="datetime-local" />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
              <Kentta label="Kiinniottopaikka" arvo={teksti('theftDetentionPlace')} onChange={tekstiksi('theftDetentionPlace')} />
              <Kentta label="Kiinniotto" arvo={teksti('theftDetainedAt')} onChange={tekstiksi('theftDetainedAt')} tyyppi="datetime-local" />
            </div>
          </Osio>

          <Osio otsikko="Anastettu omaisuus" vinkki="Kappalehinta sisältää ALV:n. Korvausta vaaditaan ALV 0 -hinnasta; jo korvattua tuotetta ei vaadita uudelleen.">
            <div className="space-y-3">
              {tuotteet.map((t) => (
                <div key={t.id} className="rounded-lg border border-line p-3 space-y-2">
                  <div className="grid gap-2 grid-cols-[1fr_auto] items-end">
                    <label className="block">
                      <span className="block text-xs text-ink-muted mb-1">Tavaran nimike</span>
                      <input value={t.nimi} onChange={(e) => muutaTuote(t.id, { nimi: e.target.value })} className={syote} />
                    </label>
                    <button
                      type="button"
                      aria-label="Poista tuote"
                      disabled={tuotteet.length === 1}
                      onClick={() => setTuotteet((l) => l.filter((x) => x.id !== t.id))}
                      className="p-2.5 rounded-lg text-ink-muted hover:bg-sunken disabled:opacity-30"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid gap-2 grid-cols-[4.5rem_1fr_5.5rem] sm:grid-cols-[5rem_8rem_6rem_1fr]">
                    <label className="block">
                      <span className="block text-xs text-ink-muted mb-1">Kpl</span>
                      <input
                        type="number"
                        min={1}
                        value={t.kpl ?? 1}
                        onChange={(e) => muutaTuote(t.id, { kpl: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                        className={`${syote} text-right`}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-xs text-ink-muted mb-1">Kpl-hinta €</span>
                      <input
                        inputMode="decimal"
                        value={t.hintaTeksti}
                        onChange={(e) => muutaTuote(t.id, { hintaTeksti: e.target.value, hinta: lueHinta(e.target.value) })}
                        className={`${syote} text-right`}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-xs text-ink-muted mb-1">ALV %</span>
                      <select value={t.alv} onChange={(e) => muutaTuote(t.id, { alv: Number(e.target.value) })} className={`${syote} bg-surface`}>
                        {ALV_KANNAT.map((a) => <option key={a} value={a}>{String(a).replace('.', ',')}</option>)}
                      </select>
                    </label>
                    <label className="block col-span-3 sm:col-span-1">
                      <span className="block text-xs text-ink-muted mb-1">Tila</span>
                      <select
                        value={t.tila || ''}
                        onChange={(e) => muutaTuote(t.id, { tila: (e.target.value || null) as TuotteenTila | null })}
                        className={`${syote} bg-surface`}
                      >
                        <option value="">Palautettu / ei merkintää</option>
                        {TUOTTEEN_TILAT.map((x) => <option key={x.id} value={x.id}>{x.nimi}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setTuotteet((l) => [...l, uusiTuote()])}
              className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover"
            >
              <Plus size={16} />
              Lisää tuote
            </button>

            <dl className="rounded-lg bg-sunken border border-line p-4 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
              <dt className="text-ink-muted">Anastetun omaisuuden arvo (sis. ALV)</dt>
              <dd className="text-right tabular-nums">{euroina(summat.verollinenSnt)}</dd>
              <dt className="text-ink-muted">Turmeltuneen omaisuuden arvo</dt>
              <dd className="text-right tabular-nums">{euroina(summat.turmeltunutSnt)}</dd>
              <dt className="text-ink-muted">Korvatun omaisuuden arvo</dt>
              <dd className="text-right tabular-nums">{euroina(summat.korvattuSnt)}</dd>
              <dt className="text-ink-muted">ALV</dt>
              <dd className="text-right tabular-nums">{euroina(summat.alvSnt)}</dd>
              <dt className="font-medium text-ink-strong">Yhteensä ALV 0</dt>
              <dd className="text-right tabular-nums font-medium text-ink-strong">{euroina(summat.alv0Snt)}</dd>
            </dl>
          </Osio>

          <Osio otsikko="Selostus asiasta">
            <Kentta
              label="Anastustapa"
              arvo={teksti('theftMethod')}
              onChange={tekstiksi('theftMethod')}
              placeholder="Mistä otettu, miten, mihin laitettu jne."
              monirivinen
            />
            <Kentta
              label="Vartijan havainnot tilanteesta"
              arvo={teksti('description')}
              onChange={tekstiksi('description')}
              placeholder="Mitä havaitsit, missä järjestyksessä ja miten tilanne eteni"
              monirivinen
            />
            <Kentta label="Kiinniotetun ajoneuvo" arvo={teksti('theftVehicle')} onChange={tekstiksi('theftVehicle')} placeholder="Merkki, malli, rekisterinumero" />
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-[1fr_1fr_2fr]">
              <label className="block">
                <span className="block text-sm font-medium text-ink-body mb-1">Rikottuja tuotesuojahälyttimiä, kpl</span>
                <input
                  type="number"
                  min={0}
                  value={String(k.theftTagsBroken ?? '')}
                  onChange={(e) => aseta({ theftTagsBroken: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  className={`${syote} text-right`}
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-ink-body mb-1">Korvattava summa €</span>
                <input inputMode="decimal" value={tuotesuojaTeksti} onChange={(e) => setTuotesuojaTeksti(e.target.value)} className={`${syote} text-right`} />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Valinta
                label="Kiinniotettu käyttäytyi väkivaltaisesti"
                vaihtoehdot={[{ v: true, nimi: 'Kyllä' }, { v: false, nimi: 'Ei' }]}
                arvo={k.theftViolent ?? null}
                onChange={(v) => aseta({ theftViolent: v })}
              />
              <Rasti
                label="Järjestystä ylläpitävän henkilön vastustaminen"
                arvo={!!k.theftResistedGuard}
                onChange={(v) => aseta({ theftResistedGuard: v })}
              />
            </div>
          </Osio>

          <Osio otsikko="Tietoja kiinniotetusta" vinkki="Tallennetaan salattuina.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Kentta label="Sukunimi" arvo={teksti('subjectLastName')} onChange={tekstiksi('subjectLastName')} />
              <Kentta label="Etunimet" arvo={teksti('subjectFirstNames')} onChange={tekstiksi('subjectFirstNames')} />
              <Kentta label="Henkilötunnus" arvo={teksti('subjectPersonalId')} onChange={tekstiksi('subjectPersonalId')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-[2fr_8rem_1fr]">
              <Kentta label="Osoite (katuosoite)" arvo={teksti('subjectAddress')} onChange={tekstiksi('subjectAddress')} />
              <Kentta label="Postinumero" arvo={teksti('theftSubjectPostalCode')} onChange={tekstiksi('theftSubjectPostalCode')} />
              <Kentta label="Postitoimipaikka" arvo={teksti('theftSubjectPostOffice')} onChange={tekstiksi('theftSubjectPostOffice')} />
            </div>
            <Valinta
              label="Henkilöllisyys todettu"
              vaihtoehdot={HENKILOLLISYYS.map((h) => ({ v: h.id, nimi: h.nimi }))}
              arvo={k.theftIdVerified ?? null}
              onChange={(v) => aseta({ theftIdVerified: v })}
            />
            <Kentta
              label="Holhooja, osoite ja puhelinnumero"
              arvo={teksti('theftGuardian')}
              onChange={tekstiksi('theftGuardian')}
              placeholder="Jos kiinniotettu on alaikäinen"
            />
            <Kentta label="Muita tietoja" arvo={teksti('theftOtherInfo')} onChange={tekstiksi('theftOtherInfo')} monirivinen />
          </Osio>

          <Osio otsikko="Muut henkilöt">
            <Kentta
              label="Mukana olleet"
              arvo={teksti('theftAccompanying')}
              onChange={tekstiksi('theftAccompanying')}
              placeholder="Nimi, syntymäaika, osoite, puhelinnumero ja holhoojan nimi"
              monirivinen
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Kentta
                label="Ilmoittaja"
                arvo={teksti('theftReporter')}
                onChange={tekstiksi('theftReporter')}
                placeholder="Suku- ja etunimet, työpaikka ja puhelin"
              />
              <Kentta
                label="Kiinniottaja"
                arvo={teksti('theftDetainer')}
                onChange={tekstiksi('theftDetainer')}
                placeholder="Suku- ja etunimet, työpaikka ja puhelin"
              />
            </div>
            <Kentta
              label="Todistajat"
              arvo={teksti('theftWitnesses')}
              onChange={tekstiksi('theftWitnesses')}
              placeholder="Suku- ja etunimet, työpaikka ja puhelin"
              monirivinen
            />
            <Rasti label="Tapahtumasta on videotallenne" arvo={!!k.theftVideo} onChange={(v) => aseta({ theftVideo: v })} />
          </Osio>

          <Osio otsikko="Vaatimukset">
            <Valinta
              label="Asianomistaja esittää korvausvaatimuksen"
              vaihtoehdot={[{ v: true, nimi: 'Kyllä' }, { v: false, nimi: 'Ei' }]}
              arvo={k.theftClaimsCompensation ?? null}
              onChange={(v) => aseta({ theftClaimsCompensation: v })}
            />
            {k.theftClaimsCompensation && (
              <>
                <Valinta
                  label="Vaatiiko asianomistaja muita kuluja?"
                  vaihtoehdot={[{ v: true, nimi: 'Kyllä' }, { v: false, nimi: 'Ei' }]}
                  arvo={muitaKuluja}
                  onChange={(v) => {
                    setMuitaKuluja(v);
                    // Ensimmäisellä kyllä-valinnalla valmiiksi yleisin kulu: se kirjataan
                    // lähes aina, ja tyhjä lista pakottaisi kirjoittamaan sen joka kerta.
                    if (v && kulut.length === 0) {
                      setKulut([{ id: uusiId(), ...SELVITYSKULUT, summaTeksti: String(SELVITYSKULUT.summa) }]);
                    }
                  }}
                />
                {muitaKuluja && (
                  <>
                    <div className="space-y-2">
                      {kulut.map((x) => (
                        <div key={x.id} className="grid gap-2 grid-cols-[1fr_7rem_auto] items-end">
                          <label className="block">
                            <span className="block text-xs text-ink-muted mb-1">Selite</span>
                            <input value={x.selite} onChange={(e) => muutaKulu(x.id, { selite: e.target.value })} className={syote} />
                          </label>
                          <label className="block">
                            <span className="block text-xs text-ink-muted mb-1">Summa €</span>
                            <input
                              inputMode="decimal"
                              value={x.summaTeksti}
                              onChange={(e) => muutaKulu(x.id, { summaTeksti: e.target.value, summa: lueHinta(e.target.value) })}
                              className={`${syote} text-right`}
                            />
                          </label>
                          <button
                            type="button"
                            aria-label="Poista kulu"
                            onClick={() => setKulut((l) => l.filter((y) => y.id !== x.id))}
                            className="p-2.5 rounded-lg text-ink-muted hover:bg-sunken"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setKulut((l) => [...l, { id: uusiId(), selite: '', summa: 0, summaTeksti: '' }])}
                      className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover"
                    >
                      <Plus size={16} />
                      Lisää kulu
                    </button>
                  </>
                )}
                <dl className="rounded-lg border-2 border-accent/40 p-4 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
                  <dt className="text-ink-muted">Korvaamattomat tuotteet ALV 0</dt>
                  <dd className="text-right tabular-nums">{euroina(summat.vaatimusSnt - summat.muutKulutSnt - summat.tuotesuojaSnt)}</dd>
                  <dt className="text-ink-muted">Tuotesuojahälyttimet</dt>
                  <dd className="text-right tabular-nums">{euroina(summat.tuotesuojaSnt)}</dd>
                  <dt className="text-ink-muted">Muut kulut</dt>
                  <dd className="text-right tabular-nums">{euroina(summat.muutKulutSnt)}</dd>
                  <dt className="font-bold text-ink-strong">Korvaussumma yhteensä</dt>
                  <dd className="text-right tabular-nums font-bold text-ink-strong">{euroina(summat.vaatimusSnt)}</dd>
                </dl>
              </>
            )}
          </Osio>

          <Osio otsikko="Toimenpiteet">
            <div className="grid gap-4 sm:grid-cols-2">
              <Valinta
                label="Ilmoitettu poliisille"
                vaihtoehdot={[{ v: true, nimi: 'Kyllä' }, { v: false, nimi: 'Ei' }]}
                arvo={k.theftReportedToPolice ?? null}
                onChange={(v) => aseta({ theftReportedToPolice: v })}
              />
              <Valinta
                label="Luovutettu poliisille"
                vaihtoehdot={[{ v: true, nimi: 'Kyllä' }, { v: false, nimi: 'Ei' }]}
                arvo={k.theftHandedToPolice ?? null}
                onChange={(v) => aseta({ theftHandedToPolice: v })}
              />
            </div>
            <Kentta label="Muut toimenpiteet" arvo={teksti('theftOtherActions')} onChange={tekstiksi('theftOtherActions')} monirivinen />
            <div className="rounded-lg bg-sunken border border-line p-4 space-y-3">
              <p className="text-xs text-ink-muted">Täytä jos kiinniotettu vapautettiin poliisin luvalla.</p>
              <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
                <Kentta label="Vapautettu" arvo={teksti('theftReleasedAt')} onChange={tekstiksi('theftReleasedAt')} tyyppi="datetime-local" />
                <Kentta label="Poliisimies, jonka luvalla vapautettu" arvo={teksti('theftReleasedBy')} onChange={tekstiksi('theftReleasedBy')} />
              </div>
            </div>
          </Osio>

          <div>
            <p className="text-sm font-medium text-ink-strong mb-2">Liitteet</p>
            <Liitteet liitteet={liitteet} onMuutos={setLiitteet} onLatausTila={setLiitteetLataa} />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-line-soft">
          <button
            type="button"
            onClick={onTakaisin}
            className="px-5 py-2.5 text-sm font-medium text-ink-body bg-sunken hover:bg-line rounded-lg transition-colors"
          >
            Peruuta
          </button>
          <button
            type="button"
            disabled={tallentaa}
            onClick={tallenna}
            className="px-5 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors disabled:opacity-60"
          >
            {tallentaa ? 'Tallennetaan…' : 'Tallenna anastusilmoitus'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Osio = ({ otsikko, vinkki, children }: { otsikko: string; vinkki?: string; children: ReactNode }) => (
  <section className="space-y-3">
    <div className="border-b border-line-soft pb-1">
      <h3 className="font-bold text-ink-strong">{otsikko}</h3>
      {vinkki && <p className="text-xs text-ink-muted mt-0.5">{vinkki}</p>}
    </div>
    {children}
  </section>
);

// Painikevalinta (kyllä/ei, suostuu/ei, henkilöllisyystodistus). null = ei vastattu:
// vastaamaton kysymys erottuu näin "ei"-vastauksesta myös tallennetussa tietueessa.
function Valinta<T extends string | boolean>({ label, vaihtoehdot, arvo, onChange }: {
  label: string; vaihtoehdot: { v: T; nimi: string }[]; arvo: T | null; onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-ink-body mb-2">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {vaihtoehdot.map(({ v, nimi }) => (
          <button
            key={nimi}
            type="button"
            aria-pressed={arvo === v}
            onClick={() => onChange(v)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              arvo === v
                ? 'bg-accent-soft border-accent text-accent-ink'
                : 'bg-surface border-line text-ink-body hover:bg-sunken'
            }`}
          >
            {nimi}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const Rasti = ({ label, arvo, onChange }: { label: string; arvo: boolean; onChange: (v: boolean) => void }) => (
  <label
    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm cursor-pointer transition-colors self-end ${
      arvo ? 'bg-accent-soft border-accent text-accent-ink' : 'bg-surface border-line text-ink-body hover:bg-sunken'
    }`}
  >
    <input
      type="checkbox"
      checked={arvo}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 text-accent rounded border-line-strong focus:ring-accent"
    />
    {label}
  </label>
);
