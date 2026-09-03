// Mittaristo (erä 9). Sama näkymä molemmilla puolilla: tapahtuman ja vartiointikohteen
// luvut ovat samat luvut, vain nimi on eri.
//
// KAKSI KÄYTTÖÄ, YKSI ESITYS. `KoosteNakyma` piirtää minkä tahansa koosteen — myös
// jälkiraporttiin jäädytetyn. Jos jäädytetyillä luvuilla olisi oma esityksensä, sama
// aineisto näyttäisi kahdessa paikassa erilaiselta ja lukija joutuisi arvaamaan kumpi
// niistä on se oikea.
import { useCallback, useEffect, useState } from 'react';
import { BarChart3, RefreshCw, TriangleAlert } from 'lucide-react';

import {
  JAKSOT, HALYTYSTYYPPI, KIRJAUKSEN_TILA, VAKAVUUS,
  aikavaliTekstina, haeKooste, hetki, jakso, kesto, luku, paivistaAikavali, prosentti,
  type Aikavali, type JakaumaRivi, type Kooste, type Tunnusluvut,
} from '../analytiikka';

// --- Osaset ------------------------------------------------------------------------

// n näkyy jokaisen tunnusluvun vieressä. Kolmesta tapauksesta laskettu mediaani on eri
// asia kuin kolmestasadasta laskettu, eikä lukija voi tietää eroa ellei sitä kerrota.
const Kortti = ({ otsikko, arvo, selite, korostus }: {
  otsikko: string; arvo: string; selite?: string; korostus?: 'danger' | 'warning';
}) => (
  <div className={`rounded-xl border p-4 ${
    korostus === 'danger' ? 'border-danger/30 bg-danger-soft'
      : korostus === 'warning' ? 'border-warning/30 bg-warning-soft'
        : 'border-line bg-surface'}`}
  >
    <p className="text-xs uppercase tracking-wide text-ink-muted">{otsikko}</p>
    <p className={`text-2xl font-bold mt-1 ${korostus === 'danger' ? 'text-danger-ink' : korostus === 'warning' ? 'text-warning-ink' : 'text-ink-strong'}`}>
      {arvo}
    </p>
    {selite && <p className="text-xs text-ink-muted mt-1">{selite}</p>}
  </div>
);

const Palkit = ({ otsikko, rivit, nimeaja, tyhjaTeksti }: {
  otsikko: string; rivit: JakaumaRivi[]; nimeaja?: (rivi: JakaumaRivi) => string; tyhjaTeksti: string;
}) => {
  const suurin = Math.max(1, ...rivit.map((r) => r.kpl));
  return (
    <div className="bg-surface border border-line rounded-xl p-4">
      <h4 className="text-sm font-bold text-ink-strong mb-3">{otsikko}</h4>
      {rivit.length === 0 ? (
        <p className="text-sm text-ink-muted">{tyhjaTeksti}</p>
      ) : (
        <ul className="space-y-2">
          {rivit.map((r) => (
            <li key={String(r.id)} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
              <div className="min-w-0">
                <p className="text-sm text-ink-body truncate">{nimeaja ? nimeaja(r) : r.nimi}</p>
                <div className="h-1.5 bg-sunken rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${(r.kpl / suurin) * 100}%` }} />
                </div>
              </div>
              <span className="text-sm font-bold text-ink-strong tabular-nums">{r.kpl}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Tuntijakauma kertoo milloin kuormitus on, ja se on mitoituksen kannalta se tärkein
// yksittäinen kuva: jos puolet kirjauksista syntyy kahden tunnin sisällä, henkilöstön
// tasajako koko illalle on väärä ratkaisu riippumatta kokonaismäärästä.
const Tuntijakauma = ({ tunnit }: { tunnit: number[] }) => {
  const suurin = Math.max(1, ...tunnit);
  const yhteensa = tunnit.reduce((a, b) => a + b, 0);
  return (
    <div className="bg-surface border border-line rounded-xl p-4">
      <h4 className="text-sm font-bold text-ink-strong mb-1">Kirjaukset vuorokauden tunneittain</h4>
      <p className="text-xs text-ink-muted mb-3">Suomen aikaa.</p>
      {yhteensa === 0 ? (
        <p className="text-sm text-ink-muted">Ei kirjauksia valitulla aikavälillä.</p>
      ) : (
        <div className="flex items-end gap-[2px] h-24" role="img" aria-label="Kirjausten tuntijakauma">
          {tunnit.map((kpl, tunti) => (
            <div key={tunti} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div
                className={`w-full rounded-t ${kpl === 0 ? 'bg-sunken' : 'bg-accent'}`}
                style={{ height: `${Math.max(kpl === 0 ? 2 : 8, (kpl / suurin) * 100)}%` }}
                title={`Klo ${String(tunti).padStart(2, '0')}: ${kpl} kirjausta`}
              />
              {tunti % 6 === 0 && <span className="text-[10px] text-ink-subtle leading-none">{tunti}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const vasteTeksti = (t: Tunnusluvut | null) => (t ? kesto(t.mediaani) : '—');
const vasteSelite = (t: Tunnusluvut | null) => (t ? `n = ${t.n} · p90 ${kesto(t.p90)}` : 'Ei mitattavia tapauksia');

// --- Koosteen esitys ---------------------------------------------------------------

export const KoosteNakyma = ({ kooste, onKohde }: { kooste: Kooste; onKohde: boolean }) => {
  const { kirjaukset, vasteajat, kierrokset, halytykset } = kooste;
  // Kierroskortti näkyy vain siellä missä kierroksia voi ajaa. Tyhjä "0 kierrosta"
  // tapahtumapuolella olisi väite laiminlyönnistä toiminnossa jota siellä ei ole.
  const naytaKierrokset = onKohde || kierrokset.ajoja > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kortti
          otsikko="Kirjauksia"
          arvo={luku(kirjaukset.yhteensa)}
          selite={`${kirjaukset.poikkeamia} poikkeamaa${kirjaukset.vilkkainTunti ? ` · vilkkain klo ${String(kirjaukset.vilkkainTunti.tunti).padStart(2, '0')}` : ''}`}
        />
        <Kortti
          otsikko="Vasteaika (mediaani)"
          arvo={vasteTeksti(vasteajat.sulkeminen)}
          selite={vasteSelite(vasteajat.sulkeminen)}
        />
        <Kortti
          otsikko="Avoimia poikkeamia"
          arvo={luku(vasteajat.avoimia)}
          selite={vasteajat.vanhinAvoinMs ? `Vanhin ${kesto(vasteajat.vanhinAvoinMs)} sitten` : 'Ei avoimia'}
          korostus={vasteajat.avoimia > 0 ? 'warning' : undefined}
        />
        <Kortti
          otsikko="Hälytysten kuittausvaste"
          arvo={vasteTeksti(halytykset.kuittausvaste)}
          selite={vasteSelite(halytykset.kuittausvaste)}
        />
      </div>

      <Tuntijakauma tunnit={kirjaukset.tunneittain} />

      <div className="grid gap-3 lg:grid-cols-2">
        <Palkit
          otsikko="Kirjaukset tyypeittäin"
          rivit={kirjaukset.tyypeittain}
          tyhjaTeksti="Ei kirjauksia valitulla aikavälillä."
        />
        <Palkit
          otsikko="Kirjaukset vyöhykkeittäin"
          rivit={kirjaukset.vyohykkeittain}
          tyhjaTeksti="Ei kirjauksia valitulla aikavälillä."
        />
        <Palkit
          otsikko="Poikkeamien käsittelytilat"
          rivit={kirjaukset.tiloittain}
          nimeaja={(r) => KIRJAUKSEN_TILA[String(r.id)] || String(r.id)}
          tyhjaTeksti="Ei poikkeamia valitulla aikavälillä."
        />
        <Palkit
          otsikko="Vakavuus"
          rivit={kirjaukset.vakavuuksittain}
          nimeaja={(r) => `${r.id} — ${VAKAVUUS[String(r.id)] || 'Tuntematon'}`}
          tyhjaTeksti="Vakavuutta ei ole arvioitu yhdessäkään kirjauksessa."
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="bg-surface border border-line rounded-xl p-4">
          <h4 className="text-sm font-bold text-ink-strong mb-3">Hälytykset</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-muted">Yhteensä</dt><dd className="text-ink-strong font-bold text-right">{halytykset.yhteensa}</dd>
            <dt className="text-ink-muted">Kuitattu</dt><dd className="text-ink-strong font-bold text-right">{halytykset.kuitattuja}</dd>
            <dt className="text-ink-muted">Avoinna</dt>
            <dd className={`font-bold text-right ${halytykset.avoimia > 0 ? 'text-danger-ink' : 'text-ink-strong'}`}>{halytykset.avoimia}</dd>
            <dt className="text-ink-muted">Peruttu ennen laukeamista</dt><dd className="text-ink-strong font-bold text-right">{halytykset.perutut}</dd>
            <dt className="text-ink-muted">Eskaloitui tekstiviestiin</dt><dd className="text-ink-strong font-bold text-right">{halytykset.eskaloituja}</dd>
          </dl>
          {halytykset.tyypeittain.length > 0 && (
            <ul className="mt-3 pt-3 border-t border-line-soft space-y-1 text-sm">
              {halytykset.tyypeittain.map((r) => (
                <li key={String(r.id)} className="flex justify-between gap-3">
                  <span className="text-ink-body">{HALYTYSTYYPPI[String(r.id)] || String(r.id)}</span>
                  <span className="text-ink-strong font-medium tabular-nums">{r.kpl}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {naytaKierrokset && (
          <div className="bg-surface border border-line rounded-xl p-4">
            <h4 className="text-sm font-bold text-ink-strong mb-3">Kierrokset</h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-ink-muted">Kattavuus</dt>
              <dd className="text-ink-strong font-bold text-right">{prosentti(kierrokset.kattavuus)}</dd>
              <dt className="text-ink-muted">Kuitattuja pisteitä</dt>
              <dd className="text-ink-strong font-bold text-right">{kierrokset.kuitattuja} / {kierrokset.pisteita}</dd>
              <dt className="text-ink-muted">Ajoja</dt><dd className="text-ink-strong font-bold text-right">{kierrokset.ajoja}</dd>
              <dt className="text-ink-muted">Valmiit</dt><dd className="text-ink-strong font-bold text-right">{kierrokset.valmiit}</dd>
              <dt className="text-ink-muted">Keskeytetyt</dt>
              <dd className={`font-bold text-right ${kierrokset.keskeytetyt > 0 ? 'text-warning-ink' : 'text-ink-strong'}`}>{kierrokset.keskeytetyt}</dd>
              <dt className="text-ink-muted">Kesto (mediaani)</dt>
              <dd className="text-ink-strong font-bold text-right">{vasteTeksti(kierrokset.kestot)}</dd>
            </dl>
            <p className="text-xs text-ink-muted mt-3 pt-3 border-t border-line-soft">
              Kattavuus lasketaan kuitatuista tarkistuspisteistä, ei kierrosten lukumäärästä.
            </p>
          </div>
        )}
      </div>

      {/* Aineiston rajoitteet kerrotaan aina, eikä vain silloin kun ne ovat pieniä.
          Luku jonka lukija ei tiedä olevan vajaa on huonompi kuin puuttuva luku. */}
      {(kirjaukset.ajattomia > 0 || vasteajat.virheellisia > 0) && (
        <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-warning-ink">
          <p className="font-bold flex items-center gap-2"><TriangleAlert size={16} /> Aineistossa on puutteita</p>
          <ul className="mt-2 space-y-1 list-disc pl-5">
            {kirjaukset.ajattomia > 0 && (
              <li>
                {kirjaukset.ajattomia} kirjauksella ei ole luontiaikaa. Ne eivät ole mukana yhdessäkään
                aikaan perustuvassa luvussa. Kyse on erän 1 migraatiota vanhemmista kirjauksista.
              </li>
            )}
            {vasteajat.virheellisia > 0 && (
              <li>
                {vasteajat.virheellisia} kirjauksessa sulkemisaika on ennen kirjaamista. Ne on jätetty
                vasteajan laskennasta pois.
              </li>
            )}
          </ul>
        </div>
      )}

      <p className="text-xs text-ink-subtle">
        Aikaväli: {aikavaliTekstina(kooste.ikkuna)} · laskettu {hetki(kooste.laskettu)} ·
        {' '}luvut sisältävät vain ne tietueet joihin sinulla on lukuoikeus.
      </p>
    </div>
  );
};

// --- Mittaristosivu ----------------------------------------------------------------

type Props = { ownerId: string; ownerNimi: string; onKohde: boolean };

export const Mittaristo = ({ ownerId, ownerNimi, onKohde }: Props) => {
  const [jaksoId, setJaksoId] = useState('7vrk');
  const [omaAlku, setOmaAlku] = useState('');
  const [omaLoppu, setOmaLoppu] = useState('');
  const [kooste, setKooste] = useState<Kooste | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [lataa, setLataa] = useState(false);

  const vali: Aikavali = jaksoId === 'oma' ? paivistaAikavali(omaAlku, omaLoppu) : jakso(jaksoId);

  const hae = useCallback(async (haettava: Aikavali) => {
    setLataa(true);
    setVirhe(null);
    const tulos = await haeKooste(ownerId, haettava);
    if (tulos.ok && tulos.kooste) setKooste(tulos.kooste);
    else { setKooste(null); setVirhe(tulos.error || 'Lukuja ei voitu hakea.'); }
    setLataa(false);
  }, [ownerId]);

  // Haku ajetaan kun kohde tai aikaväli vaihtuu. Riippuvuutena ovat aikavälin PÄÄT
  // eikä olio: uusi olio joka renderillä käynnistäisi haun loputtomasti.
  useEffect(() => {
    if (!ownerId) return;
    if (jaksoId === 'oma' && !(omaAlku && omaLoppu)) return;
    hae(vali);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, jaksoId, omaAlku, omaLoppu, hae]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-ink-strong flex items-center gap-2">
            <BarChart3 size={26} className="text-accent" /> Mittaristo
          </h2>
          <p className="text-sm text-ink-muted mt-1">{ownerNimi}</p>
        </div>
        <button
          type="button"
          onClick={() => hae(vali)}
          disabled={lataa}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-line bg-surface text-sm font-medium text-ink-body hover:bg-sunken disabled:opacity-50"
        >
          <RefreshCw size={16} className={lataa ? 'animate-spin' : ''} /> Päivitä
        </button>
      </div>

      <div className="bg-surface border border-line rounded-xl p-4">
        <div className="flex flex-wrap gap-2">
          {JAKSOT.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => setJaksoId(j.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                jaksoId === j.id ? 'bg-accent text-white border-transparent' : 'bg-surface text-ink-body border-line hover:bg-sunken'
              }`}
            >
              {j.nimi}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setJaksoId('oma')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              jaksoId === 'oma' ? 'bg-accent text-white border-transparent' : 'bg-surface text-ink-body border-line hover:bg-sunken'
            }`}
          >
            Oma aikaväli
          </button>
        </div>
        {jaksoId === 'oma' && (
          <div className="flex flex-wrap gap-3 mt-3">
            <label className="text-sm text-ink-body">
              <span className="block text-xs text-ink-muted mb-1">Alkaa</span>
              <input type="date" value={omaAlku} onChange={(e) => setOmaAlku(e.target.value)}
                className="px-3 py-2 rounded-lg border border-line bg-surface text-ink-body" />
            </label>
            <label className="text-sm text-ink-body">
              <span className="block text-xs text-ink-muted mb-1">Päättyy (mukaan luettuna)</span>
              <input type="date" value={omaLoppu} onChange={(e) => setOmaLoppu(e.target.value)}
                className="px-3 py-2 rounded-lg border border-line bg-surface text-ink-body" />
            </label>
          </div>
        )}
      </div>

      {virhe && <div className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger-ink">{virhe}</div>}
      {!kooste && !virhe && <p className="text-sm text-ink-muted">{lataa ? 'Lasketaan…' : 'Valitse aikaväli.'}</p>}
      {kooste && <KoosteNakyma kooste={kooste} onKohde={onKohde} />}
    </div>
  );
};
