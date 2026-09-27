// Kohteen raportit (27.9.2026, käyttäjän pyyntö): kaikki kohteelta palautettu työ yhdessä
// paikassa — vartijan raportit (toimenpide, tapahtumailmoitus, anastusilmoitus),
// tehtäväsuoritukset ja kierrokset yhteenvetoineen ja liitteineen.
//
// Ylläpidon näkymä. Vartija ei näe tätä: aiemmat suoritukset eivät kuulu yksittäiselle
// vartijalle (ks. Tehtavat.tsx: naytaHistoria).
//
// Yksi aikajana eikä kolme listaa, koska kysymys on aina sama: mitä kohteessa on tehty ja
// milloin. Laji- ja aikasuodatin rajaavat, ja jokaisen rivin saa auki yksityiskohtiin.
// Data on jo GuardAppissa ladattuna (samat kokoelmat kuin tilannekuvassa), joten näkymä
// ei hae mitään itse — palvelin on jo rajannut mitä käyttäjä saa nähdä.
import { useMemo, useState, type ReactNode } from 'react';
import {
  Check, ChevronDown, ChevronRight, ClipboardCheck, FileText, Paperclip, Route, ShieldAlert,
  ShoppingBag, X,
} from 'lucide-react';

import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { AnastuksenYhteenveto } from './Anastusilmoitus';
import { Peitetty } from './KohteenTiedot';
import type { GuardRaportti, Kierros, Kohde, TehtavaSuoritus } from './tyypit';

type Laji = 'toimenpide' | 'ilmoitus' | 'anastus' | 'tehtava' | 'kierros';

const LAJIT: Record<Laji, { nimi: string; Ikoni: typeof FileText }> = {
  toimenpide: { nimi: 'Toimenpiteet', Ikoni: FileText },
  ilmoitus: { nimi: 'Tapahtumailmoitukset', Ikoni: ShieldAlert },
  anastus: { nimi: 'Anastusilmoitukset', Ikoni: ShoppingBag },
  tehtava: { nimi: 'Tehtävät', Ikoni: ClipboardCheck },
  kierros: { nimi: 'Kierrokset', Ikoni: Route },
};

const JAKSOT = [
  { id: '7', nimi: '7 vrk', paivia: 7 },
  { id: '30', nimi: '30 vrk', paivia: 30 },
  { id: 'kaikki', nimi: 'Kaikki', paivia: null },
] as const;

type Liite = { id: string; name?: string };

type Rivi = {
  id: string;
  laji: Laji;
  aika: string;
  otsikko: string;
  kuka: string;
  yhteenveto: string;
  // Näkyvä merkki rivillä: esim. "Ei suoritettu" tai "Keskeytetty".
  poikkeama?: string;
  liitteet: Liite[];
  sisalto: ReactNode;
};

const aikaTeksti = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
};

const kello = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
};

const raportinLaji = (r: GuardRaportti): Laji =>
  r.typeId === 'guard_jvreport' ? 'ilmoitus' : r.typeId === 'guard_theft' ? 'anastus' : 'toimenpide';

// Raportin aika: tallennushetki jos se on, muuten lomakkeen päivä ja kellonaika.
const raportinAika = (r: GuardRaportti) => r.luotu || `${r.date}T${r.time || '00:00'}`;

const raportinLiitteet = (r: GuardRaportti & { attachment?: Liite | null }): Liite[] => [
  ...(r.attachment?.id ? [r.attachment] : []),
  ...(r.attachments || []),
];

const KUVAPAATTEET = /\.(jpe?g|png|gif|webp|heic|heif)$/i;

const Liitteet = ({ liitteet }: { liitteet: Liite[] }) => {
  if (liitteet.length === 0) return null;
  const kuvat = liitteet.filter((l) => KUVAPAATTEET.test(l.id));
  const muut = liitteet.filter((l) => !KUVAPAATTEET.test(l.id));
  return (
    <div className="space-y-2">
      {kuvat.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {kuvat.map((l) => (
            <a
              key={l.id}
              href={`/api/uploads/${l.id}`}
              target="_blank"
              rel="noopener noreferrer"
              title={l.name || 'Kuva'}
              className="block w-24 h-24 rounded-lg overflow-hidden border border-line bg-sunken hover:opacity-90"
            >
              <img src={`/api/uploads/${l.id}`} alt={l.name || 'Liitekuva'} loading="lazy" className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      )}
      {muut.map((l) => (
        <a
          key={l.id}
          href={`/api/uploads/${l.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-ink-body hover:text-accent"
        >
          <Paperclip size={14} className="shrink-0" />
          {l.name || l.id}
        </a>
      ))}
    </div>
  );
};

const Tieto = ({ otsikko, children }: { otsikko: string; children: ReactNode }) => (
  <div>
    <p className="text-xs text-ink-muted">{otsikko}</p>
    <div className="text-sm text-ink-body whitespace-pre-line">{children}</div>
  </div>
);

const raporttiRivi = (r: GuardRaportti): Rivi => {
  const laji = raportinLaji(r);
  const maarat = [
    r.denied ? `Pääsy estetty: ${r.denied}` : '',
    r.removed ? `Poistettu: ${r.removed}` : '',
    r.detained ? `Kiinniotettu: ${r.detained}` : '',
    r.force ? 'Voimakeinoja käytetty' : '',
    r.tools ? 'Voimankäyttövälineitä käytetty' : '',
    r.firearm ? 'Ampuma-asetta käytetty' : '',
    r.firstAid ? 'Ensiapua annettu' : '',
  ].filter(Boolean);
  const henkilo = [r.subjectLastName, r.subjectFirstNames].filter(Boolean).join(' ');
  return {
    id: `r-${r.id}`,
    laji,
    aika: raportinAika(r),
    otsikko: r.type || LAJIT[laji].nimi,
    kuka: r.author,
    yhteenveto: r.summary || '',
    liitteet: raportinLiitteet(r),
    sisalto: (
      <>
        {r.description && <Tieto otsikko={laji === 'anastus' ? 'Vartijan havainnot' : 'Kuvaus'}>{r.description}</Tieto>}
        {maarat.length > 0 && <Tieto otsikko="Toimenpiteet">{maarat.join(' · ')}</Tieto>}
        {laji === 'anastus' && <AnastuksenYhteenveto raportti={r} />}
        {(henkilo || r.subjectPersonalId) && (
          <Tieto otsikko={laji === 'anastus' ? 'Anastaja' : 'Kohdehenkilö'}>
            {henkilo}
            {r.subjectPersonalId && (
              <span className="block">Henkilötunnus: <Peitetty arvo={r.subjectPersonalId} /></span>
            )}
          </Tieto>
        )}
      </>
    ),
  };
};

const tehtavaRivi = (s: TehtavaSuoritus): Rivi => ({
  id: `t-${s.id}`,
  laji: 'tehtava',
  aika: s.aika,
  otsikko: s.tehtavaNimi,
  kuka: s.vartija,
  yhteenveto: s.kuitatut
    ? `${s.kuitatut.length} kohtaa kuitattu`
    : s.suoritettu === false ? 'Ei suoritettu' : 'Suoritettu',
  poikkeama: s.suoritettu === false ? 'Ei suoritettu' : undefined,
  liitteet: s.liitteet || [],
  sisalto: (
    <>
      {s.kuitatut && s.kuitatut.length > 0 && <Tieto otsikko="Kuitatut kohdat">{s.kuitatut.join('\n')}</Tieto>}
      {s.huomiot && <Tieto otsikko="Huomiot">{s.huomiot}</Tieto>}
    </>
  ),
});

const kierrosRivi = (k: Kierros): Rivi => {
  const kuitatut = k.pisteet.filter((p) => p.kuitattu).length;
  const tila = k.tila === 'valmis' ? 'Valmis' : k.tila === 'keskeytetty' ? 'Keskeytetty' : 'Kesken';
  return {
    id: `k-${k.id}`,
    laji: 'kierros',
    aika: k.paattyi || k.alkoi,
    otsikko: k.templateNimi,
    kuka: k.vartija,
    yhteenveto: `${tila} · ${kuitatut}/${k.pisteet.length} pistettä`,
    poikkeama: k.tila === 'valmis' ? undefined : tila,
    liitteet: k.liitteet || [],
    sisalto: (
      <>
        <Tieto otsikko="Aika">{kello(k.alkoi)}{k.paattyi ? `–${kello(k.paattyi)}` : ' (kesken)'}</Tieto>
        {k.keskeytysSyy && <Tieto otsikko="Keskeytyksen syy">{k.keskeytysSyy}</Tieto>}
        {k.huomiot && <Tieto otsikko="Huomiot kierrokselta">{k.huomiot}</Tieto>}
        <Tieto otsikko="Pisteet">
          {k.pisteet.map((p) => `${p.kuitattu ? `✓ ${kello(p.kuitattu)}` : '✗ kuittaamatta'} · ${p.nimi}${p.huomio ? ` — ${p.huomio}` : ''}`).join('\n')}
        </Tieto>
      </>
    ),
  };
};

type Props = {
  kohde: Kohde;
  raportit: GuardRaportti[];
  suoritukset: TehtavaSuoritus[];
  kierrokset: Kierros[];
  onTakaisin: () => void;
};

export const KohteenRaportit = ({ kohde, raportit, suoritukset, kierrokset, onTakaisin }: Props) => {
  const [valitut, setValitut] = useState<Set<Laji>>(new Set());
  const [jakso, setJakso] = useState<(typeof JAKSOT)[number]['id']>('30');
  const [auki, setAuki] = useState<string | null>(null);

  const kaikki = useMemo(() => [
    ...raportit.filter((r) => r.siteId === kohde.id).map(raporttiRivi),
    ...suoritukset.filter((s) => s.siteId === kohde.id).map(tehtavaRivi),
    ...kierrokset.filter((k) => k.siteId === kohde.id).map(kierrosRivi),
  ].sort((a, b) => (a.aika < b.aika ? 1 : -1)), [raportit, suoritukset, kierrokset, kohde.id]);

  const paivia = JAKSOT.find((j) => j.id === jakso)?.paivia ?? null;
  const raja = paivia === null ? null : Date.now() - paivia * 24 * 60 * 60 * 1000;
  const jaksolla = kaikki.filter((r) => raja === null || new Date(r.aika).getTime() >= raja);
  const naytettavat = jaksolla.filter((r) => valitut.size === 0 || valitut.has(r.laji));
  const maara = (laji: Laji) => jaksolla.filter((r) => r.laji === laji).length;
  const liitteita = jaksolla.reduce((s, r) => s + r.liitteet.length, 0);
  const poikkeamia = jaksolla.filter((r) => r.poikkeama).length;

  const vaihdaLaji = (laji: Laji) => setValitut((v) => {
    const uusi = new Set(v);
    if (uusi.has(laji)) uusi.delete(laji); else uusi.add(laji);
    return uusi;
  });

  return (
    <div className="max-w-4xl">
      <TakaisinLinkki onClick={onTakaisin}>Takaisin kohteeseen</TakaisinLinkki>
      <h2 className="text-2xl font-bold text-ink-strong mb-1">Kohteen raportit</h2>
      <p className="text-sm text-ink-muted mb-6">
        {kohde.name} · kaikki kohteelta palautetut raportit, tehtävät ja kierrokset liitteineen.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {JAKSOT.map((j) => (
          <button
            key={j.id}
            type="button"
            aria-pressed={jakso === j.id}
            onClick={() => setJakso(j.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              jakso === j.id ? 'bg-accent text-white border-accent' : 'bg-surface text-ink-body border-line hover:bg-sunken'
            }`}
          >
            {j.nimi}
          </button>
        ))}
      </div>

      {/* Yhteenveto: lajikohtaiset määrät valitulla jaksolla. Kortti on samalla suodatin. */}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 mb-3">
        {(Object.keys(LAJIT) as Laji[]).map((laji) => {
          const { nimi, Ikoni } = LAJIT[laji];
          const valittu = valitut.has(laji);
          return (
            <button
              key={laji}
              type="button"
              aria-pressed={valittu}
              onClick={() => vaihdaLaji(laji)}
              className={`text-left rounded-xl border p-3 transition-colors ${
                valittu ? 'border-accent bg-accent/5' : 'border-line bg-surface hover:bg-sunken'
              }`}
            >
              <span className="flex items-center gap-2 text-xs text-ink-muted">
                <Ikoni size={14} className={valittu ? 'text-accent' : 'text-ink-subtle'} />
                {nimi}
              </span>
              <span className="block text-2xl font-bold text-ink-strong mt-1">{maara(laji)}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-muted mb-6">
        {jaksolla.length} kirjausta · {poikkeamia} poikkeamaa (ei suoritettu, keskeytetty tai kesken)
        · {liitteita} liitettä
        {valitut.size > 0 && (
          <button type="button" onClick={() => setValitut(new Set())} className="ml-2 text-accent hover:underline">
            Näytä kaikki lajit
          </button>
        )}
      </p>

      {naytettavat.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl p-10 text-center text-sm text-ink-muted">
          Valitulla rajauksella ei ole kirjauksia.
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl divide-y divide-line-soft">
          {naytettavat.map((r) => {
            const { Ikoni } = LAJIT[r.laji];
            const avattu = auki === r.id;
            return (
              <div key={r.id}>
                <button
                  type="button"
                  aria-expanded={avattu}
                  onClick={() => setAuki(avattu ? null : r.id)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-sunken transition-colors"
                >
                  <Ikoni size={18} className="text-accent shrink-0 mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className="font-medium text-ink-strong">{r.otsikko}</span>
                      {r.poikkeama ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-warning-ink bg-warning-soft border border-warning/30 rounded px-1.5">
                          <X size={11} />{r.poikkeama}
                        </span>
                      ) : r.laji === 'tehtava' || r.laji === 'kierros' ? (
                        <Check size={14} className="text-success-ink" />
                      ) : null}
                      {r.liitteet.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                          <Paperclip size={12} />{r.liitteet.length}
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-ink-muted mt-0.5">
                      {aikaTeksti(r.aika)} · {r.kuka}
                    </span>
                    {r.yhteenveto && <span className="block text-sm text-ink-body mt-1">{r.yhteenveto}</span>}
                  </span>
                  {avattu
                    ? <ChevronDown size={18} className="text-ink-subtle shrink-0" />
                    : <ChevronRight size={18} className="text-ink-subtle shrink-0" />}
                </button>
                {avattu && (
                  <div className="px-4 pb-4 pl-11 space-y-3">
                    {r.sisalto}
                    <Liitteet liitteet={r.liitteet} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
