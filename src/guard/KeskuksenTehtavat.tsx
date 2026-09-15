// Hälytyskeskuksen hälytystehtävät: keikan luonti, seuranta ja poistumisluvat (erä 22).
//
// Tiedoston nimi on KeskuksenTehtavat eikä Halytystehtavat, koska halytystehtavat.ts
// (tyypit ja kutsut) on jo olemassa: Windowsilla kaksi tiedostoa jotka eroavat vain
// kirjainkoossa kaatavat käännöksen.
//
// Oma tiedostonsa eikä lohko Halytyskeskus.tsx:ään, joka on jo 1400 riviä. GUARD-näkymät
// jaetaan tiedostoihin heti — App.tsx:n kasvutapaa ei toisteta.
//
// PÄIVYSTÄJÄN NÄKÖKULMA. Vartijan näkymä (mobiili/HalytysTehtava.tsx) vastaa kysymykseen
// "mitä minun pitää tehdä". Tämä vastaa kolmeen muuhun: kenelle hälytys lähti, kuka on
// matkalla, ja saako se joka on valmis lähteä pois. Kolmas on ainoa jossa päivystäjä
// tekee päätöksen, ja siksi se on kortin alaosassa eikä valikossa.
//
// HYLKÄYS VAATII KOMMENTIN. Palvelin ei hyväksy hylkäystä ilman sitä
// (server/halytystehtava.js), ja syy on vartijan puolella: hylkäys tarkoittaa "älä poistu
// vielä", ja ilman perustetta se on punainen palkki josta ei seuraa mitään tekemistä.
import { useState } from 'react';
import {
  Check, ChevronDown, ChevronRight, FileText, Loader2, Plus, Siren, TriangleAlert, X,
} from 'lucide-react';

import {
  LAJIN_NIMI, LAJIT, TILAN_NIMI, kellonaika, kellonaikaSek,
  haeTehtavanRaportit, lisaaHavainto, luoTehtava, peruTehtava, ratkaiseHyvaksynta,
  type HalytysLaji, type Halytystehtava, type TehtavanRaportti,
} from './halytystehtavat';
import type { Kohde } from './tyypit';

type Props = {
  tehtavat: Halytystehtava[];
  kohteet: Kohde[];
  // Muokkausoikeus hälytyskeskukseen (guard_dispatch edit). Ilman sitä näkymä on yhä
  // hyödyllinen katselunäkymänä — päivystäjän sijainen näkee tilanteen vaikkei päätä.
  saaMuokata: boolean;
  onMuutos: () => void;
};

export const KeskuksenTehtavat = ({ tehtavat, kohteet, saaMuokata, onMuutos }: Props) => {
  const [lomakeAuki, setLomakeAuki] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tyoskentelee, setTyoskentelee] = useState(false);

  const aja = async (kutsu: () => Promise<{ ok: boolean; error?: string }>) => {
    setVirhe(null);
    setTyoskentelee(true);
    try {
      const tulos = await kutsu();
      if (tulos.ok) onMuutos();
      else setVirhe(tulos.error || 'Toiminto epäonnistui.');
      return tulos.ok;
    } finally {
      setTyoskentelee(false);
    }
  };

  // Hyväksyntää odottavat ensin. Ne ovat ainoa kohta jossa joku odottaa päivystäjää:
  // vartija seisoo kohteessa eikä saa lähteä ennen kuin tämä ruutu käsitellään.
  const jarjestetyt = [...tehtavat].sort((a, b) => (
    (Number(b.tila === 'odottaa') - Number(a.tila === 'odottaa'))
    || String(b.luotu).localeCompare(String(a.luotu))
  ));

  return (
    <section className="bg-surface border border-line rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink-strong">
          <Siren size={18} className="text-danger" />
          Hälytystehtävät
          {tehtavat.length > 0 && (
            <span className="text-sm font-normal text-ink-muted">({tehtavat.length})</span>
          )}
        </h2>
        {saaMuokata && (
          <button
            type="button"
            onClick={() => setLomakeAuki((auki) => !auki)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
          >
            {lomakeAuki ? <X size={14} /> : <Plus size={14} />}
            {lomakeAuki ? 'Peruuta' : 'Uusi hälytys'}
          </button>
        )}
      </div>

      {virhe && (
        <p className="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          {virhe}
        </p>
      )}

      {lomakeAuki && (
        <UusiTehtava
          kohteet={kohteet}
          tyoskentelee={tyoskentelee}
          onLuo={async (args) => {
            const ok = await aja(() => luoTehtava(args));
            if (ok) setLomakeAuki(false);
          }}
        />
      )}

      {jarjestetyt.length === 0 ? (
        <p className="text-sm text-ink-muted">Ei avoimia hälytystehtäviä.</p>
      ) : (
        <div className="space-y-3">
          {jarjestetyt.map((t) => (
            <TehtavaKortti
              key={t.id}
              tehtava={t}
              saaMuokata={saaMuokata}
              tyoskentelee={tyoskentelee}
              onHavainto={(teksti) => aja(() => lisaaHavainto(t.id, teksti))}
              onRatkaise={(hyvaksy, kommentti) => aja(() => ratkaiseHyvaksynta(t.id, hyvaksy, kommentti))}
              onPeru={(syy) => aja(() => peruTehtava(t.id, syy))}
            />
          ))}
        </div>
      )}
    </section>
  );
};

// --- Uusi tehtävä --------------------------------------------------------------------

const UusiTehtava = ({
  kohteet, tyoskentelee, onLuo,
}: {
  kohteet: Kohde[];
  tyoskentelee: boolean;
  onLuo: (args: { laji: HalytysLaji; siteId: string; silmukka: string; havainnot: string[] }) => void;
}) => {
  const [laji, setLaji] = useState<HalytysLaji>('murto');
  const [siteId, setSiteId] = useState('');
  const [silmukka, setSilmukka] = useState('');
  const [havainto, setHavainto] = useState('');

  const valittavat = kohteet.filter((k) => !k.archived);

  return (
    <div className="mb-4 rounded-lg border border-line bg-sunken p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {LAJIT.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLaji(l)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              laji === l
                ? 'bg-action text-white'
                : 'border border-line-strong bg-surface text-ink-body hover:bg-line-soft'
            }`}
          >
            {LAJIN_NIMI[l]}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-body">Kohde</span>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="w-full rounded-lg border border-line-soft bg-surface p-2 text-sm"
          >
            <option value="">Valitse kohde…</option>
            {valittavat.map((k) => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-body">Silmukka</span>
          <input
            type="text"
            value={silmukka}
            onChange={(e) => setSilmukka(e.target.value)}
            placeholder="esim. Etuovi mg"
            className="w-full rounded-lg border border-line-soft bg-surface p-2 text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-body">
          Ensimmäinen havainto (valinnainen)
        </span>
        <textarea
          value={havainto}
          onChange={(e) => setHavainto(e.target.value)}
          rows={2}
          placeholder="Mitä kamerassa tai ilmoituksessa näkyy"
          className="w-full rounded-lg border border-line-soft bg-surface p-2 text-sm"
        />
      </label>

      {/* Kohdennusta ei valita: se lasketaan palvelimella (vuoro, piirivuoro, säde).
          Sanotaan se ääneen, koska päivystäjä etsisi muuten vastaanottajalistaa. */}
      <p className="text-xs text-ink-muted">
        Hälytys menee kohteen vuorossa oleville, piirivuorossa oleville ja kohteen
        säteellä oleville. Vastaanottajia ei valita erikseen.
      </p>

      <button
        type="button"
        disabled={!siteId || tyoskentelee}
        onClick={() => onLuo({
          laji,
          siteId,
          silmukka,
          havainnot: havainto.trim() ? [havainto.trim()] : [],
        })}
        className="rounded-lg bg-danger px-4 py-2.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50 transition-all"
      >
        {tyoskentelee ? 'Lähetetään…' : 'Lähetä hälytys kentälle'}
      </button>
    </div>
  );
};

// --- Tehtävään liitetty tapahtumailmoitus --------------------------------------------

// Toimenpidelaskurit ja voimakeinot yhtenä rivinä. Nollat jätetään pois: "Pääsy estetty 0"
// ei ole tieto vaan täytettä, ja päivystäjä lukee tämän ruudulta sekunneissa.
const TOIMENPITEET: { avain: keyof TehtavanRaportti; label: string }[] = [
  { avain: 'denied', label: 'pääsy estetty' },
  { avain: 'removed', label: 'poistettu' },
  { avain: 'detained', label: 'kiinniotettu' },
];

const VOIMAKEINOT: { avain: keyof TehtavanRaportti; label: string }[] = [
  { avain: 'force', label: 'voimakeinoja' },
  { avain: 'tools', label: 'voimankäyttövälineitä' },
  { avain: 'firearm', label: 'ampuma-ase' },
  { avain: 'firstAid', label: 'ensiapua annettu' },
];

const Ilmoitus = ({
  tehtavaId, avattu, onAvattu,
}: {
  tehtavaId: string;
  avattu: 'ei' | 'luettu' | 'virhe';
  onAvattu: (tila: 'ei' | 'luettu' | 'virhe') => void;
}) => {
  const [raportit, setRaportit] = useState<TehtavanRaportti[] | null>(null);
  const [rajattu, setRajattu] = useState(false);
  const [haetaan, setHaetaan] = useState(false);

  const lue = async () => {
    setHaetaan(true);
    try {
      const tulos = await haeTehtavanRaportit(tehtavaId);
      if (!tulos) {
        onAvattu('virhe');
        return;
      }
      setRaportit(tulos.raportit);
      setRajattu(tulos.rajattu);
      onAvattu('luettu');
    } finally {
      setHaetaan(false);
    }
  };

  if (avattu === 'ei' || avattu === 'virhe') {
    return (
      <div className="mt-2">
        <button
          type="button"
          disabled={haetaan}
          onClick={lue}
          className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3 py-2 text-sm font-medium text-white hover:bg-action-hover disabled:opacity-50 transition-colors"
        >
          <FileText size={14} />
          {haetaan ? 'Haetaan…' : avattu === 'virhe' ? 'Yritä uudelleen' : 'Lue ilmoitus'}
        </button>
        {avattu === 'virhe' && (
          <p className="mt-1.5 text-xs text-danger-ink">
            Ilmoitusta ei saatu haettua. Voit silti ratkaista pyynnön — vartija ei saa jäädä
            odottamaan lupaa verkkovirheen takia.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      {rajattu && (
        <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning-ink">
          Kohdehenkilön tiedot on karsittu: tunnuksellasi ei ole lukuoikeutta tämän kohteen
          raportteihin. Ne EIVÄT ole täyttämättä — ne eivät vain näy sinulle. Koko ilmoituksen
          näkee tunnus jolle on myönnetty kohteen raporttioikeus.
        </p>
      )}
      {raportit && raportit.length === 0 && (
        <p className="text-xs text-ink-muted">Tehtävälle ei löytynyt ilmoitusta.</p>
      )}
      {(raportit || []).map((r) => {
        const maarat = TOIMENPITEET
          .filter((t) => Number(r[t.avain]) > 0)
          .map((t) => `${r[t.avain]} ${t.label}`);
        const keinot = VOIMAKEINOT.filter((v) => r[v.avain] === true).map((v) => v.label);
        return (
          <article key={r.id} className="rounded-lg border border-line bg-sunken p-3">
            <p className="text-sm font-bold text-ink-strong">{r.type}</p>
            <p className="text-xs text-ink-muted">
              {r.author} · {r.date} klo {r.time}
              {r.place ? ` · ${r.place}` : ''}
            </p>

            {r.summary && <p className="mt-2 text-sm font-medium text-ink">{r.summary}</p>}
            {r.description && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-body leading-relaxed">
                {r.description}
              </p>
            )}

            {(maarat.length > 0 || keinot.length > 0) && (
              <p className="mt-2 text-xs text-ink-body">
                {[...maarat, ...keinot].join(' · ')}
              </p>
            )}

            {/* Kohdehenkilön tiedot vain täydellä lukuoikeudella. Karsitussa muodossa
                kentät puuttuvat kokonaan, joten tämä lohko ei renderöidy lainkaan. */}
            {(r.subjectLastName || r.subjectPersonalId || r.subjectAddress) && (
              <div className="mt-2 border-t border-line-soft pt-2 text-xs text-ink-body">
                <p className="font-bold text-ink-muted">Kohdehenkilö</p>
                <p>
                  {[r.subjectLastName, r.subjectFirstNames].filter(Boolean).join(', ')}
                  {r.subjectPersonalId ? ` · ${r.subjectPersonalId}` : ''}
                </p>
                {r.subjectAddress && <p>{r.subjectAddress}</p>}
                {r.subjectFeatures && <p>{r.subjectFeatures}</p>}
                {r.subjectObservations && <p className="mt-1">{r.subjectObservations}</p>}
              </div>
            )}

            {(r.liitteita || (r.attachments || []).length > 0) && (
              <p className="mt-2 text-xs text-ink-muted">
                {r.liitteita ?? (r.attachments || []).length} liitettä
                {rajattu ? ' (ei avattavissa ilman raporttioikeutta)' : ''}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
};

// --- Yksi tehtävä --------------------------------------------------------------------

const TehtavaKortti = ({
  tehtava, saaMuokata, tyoskentelee, onHavainto, onRatkaise, onPeru,
}: {
  tehtava: Halytystehtava;
  saaMuokata: boolean;
  tyoskentelee: boolean;
  onHavainto: (teksti: string) => void;
  onRatkaise: (hyvaksy: boolean, kommentti: string) => void;
  onPeru: (syy: string) => void;
}) => {
  const [auki, setAuki] = useState(tehtava.tila === 'odottaa');
  const [havainto, setHavainto] = useState('');
  const [kommentti, setKommentti] = useState('');
  const [perumassa, setPerumassa] = useState(false);
  const [peruSyy, setPeruSyy] = useState('');
  // Onko ilmoitus luettu tässä istunnossa. 'virhe' = haku epäonnistui, jolloin ratkaisu
  // sallitaan silti (ks. perustelu nappien kohdalla).
  const [ilmoitusAvattu, setIlmoitusAvattu] = useState<'ei' | 'luettu' | 'virhe'>('ei');

  const odottaa = tehtava.tila === 'odottaa';
  const mukana = (tehtava.yksikot || []).filter((y) => !y.kieltaytyi);
  const kieltaytyneet = (tehtava.yksikot || []).filter((y) => y.kieltaytyi);

  return (
    <div
      className={`rounded-xl border p-4 ${
        odottaa ? 'border-info/40 bg-info-soft' : 'border-line bg-surface'
      }`}
    >
      <button
        type="button"
        onClick={() => setAuki((a) => !a)}
        className="flex w-full items-start gap-2 text-left"
      >
        {auki ? <ChevronDown size={16} className="mt-1 shrink-0 text-ink-muted" />
          : <ChevronRight size={16} className="mt-1 shrink-0 text-ink-muted" />}
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-ink-strong">
            {LAJIN_NIMI[tehtava.laji]}
            <span className="font-normal text-ink-body"> · {tehtava.siteNimi}</span>
            {tehtava.silmukka && (
              <span className="font-normal text-ink-muted"> · {tehtava.silmukka}</span>
            )}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {kellonaika(tehtava.luotu)} · {TILAN_NIMI[tehtava.tila]}
            {' · '}
            {mukana.length === 0
              ? 'ei vastaanottajia'
              : mukana.map((y) => y.nimi).join(', ')}
          </p>
        </div>
        {odottaa && <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-info-ink" />}
      </button>

      {/* Odottava poistumispyyntö näkyy MYÖS suljettuna: se on ainoa kohta jossa joku
          odottaa päivystäjää, eikä sitä saa joutua etsimään kortin sisältä. */}
      {odottaa && (
        <div className="mt-3 rounded-lg border border-info/30 bg-surface p-3">
          <p className="text-sm font-bold text-info-ink">
            {(tehtava.yksikot || []).find((y) => y.vartija === tehtava.hyvaksynta?.pyytaja)?.nimi
              || tehtava.hyvaksynta?.pyytaja}
            {' '}pyytää lupaa poistua
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Ilmoitus on kirjattu {kellonaika(tehtava.hyvaksynta?.pyydetty)}.
          </p>

          {/* Ilmoitus luetaan TÄSSÄ eikä erillisellä raporttisivulla. Hyväksyntänappi
              jonka vieressä ei ole sitä tekstiä jota hyväksytään ei ole hyväksyntä vaan
              kuittaus (käyttäjän havainto 14.9.2026).

              Luku on painikkeen takana eikä automaattinen, koska jokainen luku jää
              auditlokiin: automaattinen haku tuottaisi merkinnän joka kerta kun
              hälytyskeskus päivittyy, ja loki lakkaisi kertomasta kuka ilmoituksen
              oikeasti luki. */}
          <Ilmoitus
            tehtavaId={tehtava.id}
            avattu={ilmoitusAvattu}
            onAvattu={setIlmoitusAvattu}
          />

          {saaMuokata ? (
            <>
              <textarea
                value={kommentti}
                onChange={(e) => setKommentti(e.target.value)}
                rows={2}
                placeholder="Jos et hyväksy poistumista: mitä toimenpiteitä puuttuu?"
                className="mt-2 w-full rounded-lg border border-line-soft p-2 text-sm"
              />
              {/* Ratkaisu on lukemisen takana. Ei siksi että päivystäjää epäiltäisiin,
                  vaan siksi että kumpikin nappi on päätös ilmoituksen sisällöstä —
                  hyväksyntä sanoo "toimenpiteet on tehty" ja hylkäys "jokin puuttuu".

                  POIKKEUS: jos ilmoituksen haku epäonnistui, napit avautuvat silti.
                  Muuten verkkovirhe hälytyskeskuksen päässä jättäisi vartijan seisomaan
                  kohteeseen odottamaan lupaa jota kukaan ei voi antaa. */}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={tyoskentelee || ilmoitusAvattu === 'ei'}
                  title={ilmoitusAvattu === 'ei' ? 'Lue ilmoitus ensin.' : undefined}
                  onClick={() => onRatkaise(true, kommentti)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
                >
                  <Check size={14} />
                  Hyväksy raportti ja poistuminen
                </button>
                <button
                  type="button"
                  disabled={tyoskentelee || ilmoitusAvattu === 'ei' || !kommentti.trim()}
                  title={ilmoitusAvattu === 'ei'
                    ? 'Lue ilmoitus ensin.'
                    : kommentti.trim() ? undefined : 'Kirjoita ensin mitä toimenpiteitä puuttuu.'}
                  onClick={() => onRatkaise(false, kommentti)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm font-medium text-danger-ink hover:brightness-95 disabled:opacity-50"
                >
                  <TriangleAlert size={14} />
                  Älä hyväksy poistumista
                </button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">
              Tunnuksellasi ei ole oikeutta ratkaista poistumispyyntöä.
            </p>
          )}
        </div>
      )}

      {auki && (
        <div className="mt-4 space-y-4 border-t border-line-soft pt-3">
          {/* Yksiköt aikoineen. Tämä on se taulukko josta vasteaika luetaan. */}
          {mukana.length > 0 && (
            <div>
              <p className="text-xs font-bold text-ink-muted">Yksiköt</p>
              <ul className="mt-1 space-y-1">
                {mukana.map((y) => (
                  <li key={y.vartija} className="text-sm text-ink-body">
                    <span className="font-medium text-ink">{y.nimi}</span>
                    {' · vastaanotti '}{kellonaika(y.vastaanotti)}
                    {y.ajoon ? ` · ajoon ${kellonaika(y.ajoon)}` : ''}
                    {y.paikalla ? ` · paikalla ${kellonaika(y.paikalla)}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {kieltaytyneet.length > 0 && (
            <div>
              <p className="text-xs font-bold text-ink-muted">Kieltäytyneet</p>
              <ul className="mt-1 space-y-1">
                {kieltaytyneet.map((y) => (
                  <li key={y.vartija} className="text-sm text-ink-body">
                    {y.nimi}{y.syy ? ` — ${y.syy}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-ink-muted">Havainnot</p>
            {tehtava.havainnot.length === 0 ? (
              <p className="mt-1 text-sm text-ink-muted">Ei havaintoja.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {[...tehtava.havainnot].reverse().map((h) => (
                  <li key={h.id} className="text-sm text-ink-body">
                    <span className="tabular-nums text-ink-muted">{kellonaikaSek(h.ts)} </span>
                    {h.teksti}
                  </li>
                ))}
              </ul>
            )}
            {saaMuokata && tehtava.tila !== 'suljettu' && tehtava.tila !== 'peruttu' && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={havainto}
                  onChange={(e) => setHavainto(e.target.value)}
                  placeholder="Uusi havainto kentälle"
                  className="flex-1 rounded-lg border border-line-soft p-2 text-sm"
                />
                <button
                  type="button"
                  disabled={tyoskentelee || !havainto.trim()}
                  onClick={() => { onHavainto(havainto.trim()); setHavainto(''); }}
                  className="rounded-lg bg-action px-3 py-2 text-sm font-medium text-white hover:bg-action-hover disabled:opacity-50"
                >
                  Lisää
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-bold text-ink-muted">Tapahtumat</p>
            <ul className="mt-1 space-y-1">
              {[...(tehtava.loki || [])].reverse().map((r, i) => (
                <li key={`${r.ts}-${i}`} className="text-sm text-ink-body">
                  <span className="tabular-nums text-ink-muted">{kellonaikaSek(r.ts)} </span>
                  {r.teksti}
                </li>
              ))}
            </ul>
          </div>

          {/* Peruminen on eri asia kuin hyväksyntä: peruttu tehtävä on tehtävä jota ei
              ollutkaan (väärä hälytys, asiakas kuittasi itse). Sama tila molemmille
              tekisi vasteaikatilastosta valheellisen. */}
          {saaMuokata && tehtava.tila !== 'suljettu' && tehtava.tila !== 'peruttu' && (
            perumassa ? (
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={peruSyy}
                  onChange={(e) => setPeruSyy(e.target.value)}
                  placeholder="Miksi tehtävä perutaan?"
                  className="flex-1 min-w-[180px] rounded-lg border border-line-soft p-2 text-sm"
                />
                <button
                  type="button"
                  disabled={tyoskentelee}
                  onClick={() => { onPeru(peruSyy); setPerumassa(false); setPeruSyy(''); }}
                  className="rounded-lg bg-danger px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
                >
                  Peru tehtävä
                </button>
                <button
                  type="button"
                  onClick={() => setPerumassa(false)}
                  className="rounded-lg bg-sunken px-3 py-2 text-sm font-medium text-ink-body hover:bg-line"
                >
                  Peruuta
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPerumassa(true)}
                className="text-sm font-medium text-danger-ink hover:underline"
              >
                Peru tehtävä
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};
