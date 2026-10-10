// Työvuorosuunnittelu (erät 1–3): listat, julkaisumääräajat, suunniteltavat vartijat ja säännöt.
//
// Erä 1 näyttää sen kehyksen jonka sisään listat laaditaan: mitkä jaksot ovat tulossa,
// mihin mennessä kunkin lista on julkaistava ja mitä sääntöjä sitä vastaan tarkistetaan.
// Listakortti avaa suunnitteluruudukon (erä 4, Suunnitteluruudukko.tsx).

import { useEffect, useState } from 'react';
import { CalendarClock, CalendarDays, TriangleAlert, Users } from 'lucide-react';

import { TakaisinLinkki } from '../../shared/komponentit/TakaisinLinkki';
import { useTakaisinEste } from '../../shared/navigointi';
import { Suunnitteluruudukko } from './Suunnitteluruudukko';
import { TYOAIKAMUOTO, arvoTekstina, haeHenkilot, haeTyoaika, paiviaPaivaan, pvm } from './tyoaika';
import type { Henkilo, Lista, TyoaikaVastaus } from './tyoaika';

type Props = {
  isAdmin: boolean;
  onAsetukset: (() => void) | null;
  onTakaisin: () => void;
};

export const Tyovuorosuunnittelu = ({ isAdmin, onAsetukset, onTakaisin }: Props) => {
  const [tila, setTila] = useState<TyoaikaVastaus | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [henkilot, setHenkilot] = useState<Henkilo[] | null>(null);
  const [henkiloVirhe, setHenkiloVirhe] = useState<string | null>(null);
  // Avattu lista (erä 4). Takaisin-painike sulkee listan eikä poistu suunnittelusta.
  const [avoinLista, setAvoinLista] = useState<string | null>(null);
  useTakaisinEste(!!avoinLista, () => setAvoinLista(null));

  const hae = () => {
    haeTyoaika().then(setTila).catch((e: Error) => setVirhe(e.message));
    haeHenkilot().then(setHenkilot).catch((e: Error) => setHenkiloVirhe(e.message));
  };
  useEffect(hae, []);

  if (avoinLista) {
    return <Suunnitteluruudukko alku={avoinLista} onTakaisin={() => { setAvoinLista(null); hae(); }} />;
  }

  return (
    <div>
      <TakaisinLinkki onClick={onTakaisin}>Takaisin etusivulle</TakaisinLinkki>
      <h2 className="text-2xl font-bold text-ink-strong mb-1">Työvuorosuunnittelu</h2>
      <p className="text-sm text-ink-muted mb-6 leading-relaxed">
        Työvuorolistat laaditaan kolmen viikon jaksoissa. Lista on annettava vartijoille
        tiedoksi ennen jakson alkua, ja jokainen vuoro tarkistetaan alla olevia sääntöjä vastaan.
      </p>

      {virhe && <p className="text-sm text-danger">{virhe}</p>}
      {!tila && !virhe && <p className="text-sm text-ink-muted">Luetaan…</p>}

      {tila && !tila.asetukset.jaksotAlkaen && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3">
          <TriangleAlert size={18} className="text-warning-ink shrink-0 mt-0.5" />
          <div className="text-sm text-warning-ink">
            <p className="font-medium">Jaksojen alkupäivää ei ole asetettu.</p>
            <p className="mt-0.5">
              Suunnittelu alkaa, kun pääkäyttäjä asettaa jaksorytmin kohdassa
              Sovellusasetukset → Työaikasäännöt.
            </p>
            {isAdmin && onAsetukset && (
              <button type="button" onClick={onAsetukset} className="mt-2 underline font-medium">
                Avaa työaikasäännöt
              </button>
            )}
          </div>
        </div>
      )}

      {/* Erä 2: vuorot syntyvät kohteiden miehityksestä. Ilman yhtään miehitettyä vuoroa
          kortit näyttäisivät nollaa ilman selitystä. */}
      {tila && tila.listat.length > 0 && tila.listat.every((l) => l.vuoroja === 0) && (
        <p className="mb-4 text-sm text-ink-muted">
          Yhdellekään kohteelle ei ole vielä määritelty suunniteltavia vuoroja. Ne lisätään
          kohteen hallinnassa Vuorot-välilehdellä kohdasta "Suunnitellaan työvuorolistaan".
        </p>
      )}

      {tila && tila.listat.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-3">
            <CalendarDays size={18} className="text-accent" />
            Työvuorolistat
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {tila.listat.map((l, i) => (
              <ListaKortti key={l.alku} lista={l} tanaan={tila.tanaan} kuluva={i === 0} onAvaa={() => setAvoinLista(l.alku)} />
            ))}
          </div>
        </section>
      )}

      {/* Vanha miehitys joka ei täytä nykyisiä sääntöjä (erä 3). Kohteen tallennus ei
          tarkista muuttumattomia vuoroja, joten tämä on se paikka jossa ristiriita näkyy. */}
      {tila && tila.miehitysVaroitukset.length > 0 && (
        <div className="mb-8 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-ink">
          <p className="font-medium flex items-center gap-2">
            <TriangleAlert size={16} />
            Kohteiden vuorot, jotka eivät täytä voimassa olevia työaikasääntöjä
          </p>
          <ul className="mt-1.5 list-disc pl-5 space-y-0.5">
            {tila.miehitysVaroitukset.map((m, i) => <li key={i}>{m.siteNimi}: {m.viesti}</li>)}
          </ul>
          <p className="mt-1.5 text-xs">Korjaa vuoro kohteen hallinnassa, tai kirjaa sille perustelu.</p>
        </div>
      )}

      <HenkiloLista henkilot={henkilot} virhe={henkiloVirhe} tanaan={tila?.tanaan || null} varoitusPv={Number(tila?.asetukset.korttiVaroitusPv ?? 45)} />

      {tila && (
        <section className="bg-surface rounded-xl border border-line shadow-sm p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <CalendarClock size={18} className="text-accent" />
              Voimassa olevat työaikasäännöt
            </h3>
            {isAdmin && onAsetukset && (
              <button type="button" onClick={onAsetukset} className="text-sm font-medium text-accent hover:underline">
                Muokkaa
              </button>
            )}
          </div>
          <ul className="mt-3 text-sm divide-y divide-line-soft">
            <li className="py-2 flex justify-between gap-4">
              <span className="text-ink-body">Säännöllinen työaika (kuukausipalkkaiset)</span>
              <span className="text-ink-strong whitespace-nowrap">
                {tila.saannollinenH} h / {tila.jaksonPituusVk} vk, enintään {tila.jaksonEnimmaisH} h
              </span>
            </li>
            {Object.entries(tila.kuvaukset).map(([avain, a]) => (
              <li key={avain} className="py-2 flex justify-between gap-4">
                <span className="text-ink-body">{a.nimi}</span>
                <span className="text-ink-strong whitespace-nowrap">
                  {arvoTekstina(a, tila.asetukset[avain])}
                  {tila.poikkeamat.includes(avain) && (
                    <span className="ml-2 text-xs text-warning-ink">(TES {arvoTekstina(a, a.tes)})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {tila.poikkeamat.length > 0 && tila.asetukset.paikallinenSopimus && (
            <p className="mt-3 text-xs text-ink-muted leading-relaxed">
              <span className="font-medium text-ink-body">Paikallinen sopimus: </span>
              {tila.asetukset.paikallinenSopimus}
            </p>
          )}
        </section>
      )}
    </div>
  );
};

// Listan kortti. Määräajan tila on tässä vaiheessa pelkkä kalenterilaskelma: julkaisua
// ei vielä ole (erä 6), joten kortti kertoo vain kuinka paljon aikaa on jäljellä.
const ListaKortti = ({
  lista, tanaan, kuluva, onAvaa,
}: { lista: Lista; tanaan: string; kuluva: boolean; onAvaa: () => void }) => {
  const alkanut = paiviaPaivaan(tanaan, lista.alku) <= 0;
  const jaljella = paiviaPaivaan(tanaan, lista.julkaistavaViimeistaan);
  const maaraaika = alkanut ? null
    : jaljella < 0 ? { teksti: `Määräaika ohitettu ${-jaljella} pv sitten`, varoitus: true }
      : jaljella === 0 ? { teksti: 'Julkaistava tänään', varoitus: true }
        : { teksti: `Julkaistava ${jaljella} pv kuluessa`, varoitus: jaljella <= 7 };

  return (
    <button
      type="button"
      onClick={onAvaa}
      className="text-left bg-surface rounded-xl border border-line p-4 hover:border-accent transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-ink-strong">{pvm(lista.alku)} – {pvm(lista.viimeinen)}</p>
        {kuluva && alkanut && <span className="text-xs rounded-full bg-sunken px-2 py-0.5 text-ink-muted">Kuluva</span>}
      </div>
      <p className="text-xs text-ink-muted mt-0.5">
        {lista.jaksot.length === 1 ? '1 jakso' : `${lista.jaksot.length} jaksoa`}
        {' · '}julkaistava viimeistään {pvm(lista.julkaistavaViimeistaan)}
      </p>
      <p className="text-sm text-ink-body mt-2">
        {lista.vuoroja === 0
          ? 'Ei suunniteltavia vuoroja'
          : `${lista.vuoroja} ${lista.vuoroja === 1 ? 'vuoro' : 'vuoroa'} · ${String(lista.tunteja).replace('.', ',')} h`}
      </p>
      {maaraaika && (
        <p className={`text-sm mt-2 ${maaraaika.varoitus ? 'text-warning-ink font-medium' : 'text-ink-body'}`}>
          {maaraaika.teksti}
        </p>
      )}
      <p className="text-sm font-medium text-accent mt-3">Avaa lista →</p>
    </button>
  );
};

// Suunniteltavat henkilöt (erä 3): kapea ote työntekijäpankista. Kortin tila lasketaan
// tästä päivästä; listakohtainen tarkistus (vuoron päivä vs. voimassaolo) tehdään
// palvelimella sijoitusten yhteydessä.
const HenkiloLista = ({
  henkilot, virhe, tanaan, varoitusPv,
}: { henkilot: Henkilo[] | null; virhe: string | null; tanaan: string | null; varoitusPv: number }) => {
  const kortinTila = (h: Henkilo): { teksti: string; taso: 'ok' | 'varoitus' | 'este' } => {
    if (!h.kytketty) return { teksti: 'Ei kytketty työntekijäpankkiin', taso: 'varoitus' };
    if (!h.hasGuardCard) return { teksti: 'Ei vartijakorttia', taso: 'este' };
    if (!h.korttiAsti) return { teksti: 'Kortin voimassaolo puuttuu', taso: 'este' };
    if (!tanaan) return { teksti: `Kortti ${pvm(h.korttiAsti)} asti`, taso: 'ok' };
    const jaljella = paiviaPaivaan(tanaan, h.korttiAsti);
    if (jaljella < 0) return { teksti: `Kortti vanhentunut ${pvm(h.korttiAsti)}`, taso: 'este' };
    if (jaljella <= varoitusPv) return { teksti: `Kortti vanhenee ${pvm(h.korttiAsti)}`, taso: 'varoitus' };
    return { teksti: `Kortti ${pvm(h.korttiAsti)} asti`, taso: 'ok' };
  };
  const vari = { ok: 'text-ink-muted', varoitus: 'text-warning-ink font-medium', este: 'text-danger font-medium' };

  return (
    <section className="mb-8">
      <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-1">
        <Users size={18} className="text-accent" />
        Suunniteltavat vartijat
      </h3>
      <p className="text-xs text-ink-muted mb-3">
        GUARD-tunnukset joilla on oikeus tehdä työvuoroja. Työaikamuoto ja kortit tulevat
        työntekijäpankista.
      </p>
      {virhe && <p className="text-sm text-danger">{virhe}</p>}
      {!henkilot && !virhe && <p className="text-sm text-ink-muted">Luetaan…</p>}
      {henkilot && henkilot.length === 0 && (
        <p className="text-sm text-ink-muted">Yhdelläkään GUARD-tunnuksella ei ole oikeutta tehdä työvuoroja.</p>
      )}
      {henkilot && henkilot.length > 0 && (
        <div className="bg-surface rounded-xl border border-line divide-y divide-line-soft">
          {henkilot.map((h) => {
            const kortti = kortinTila(h);
            return (
              <div key={h.username} className="px-4 py-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-strong">{h.nimi}</p>
                  <p className="text-xs text-ink-muted">
                    {h.username}
                    {h.workTimeType && ` · ${TYOAIKAMUOTO[h.workTimeType] || h.workTimeType}`}
                    {h.workTimeType === 'parttime' && h.minHoursPer3Weeks && `, vähintään ${h.minHoursPer3Weeks} h / 3 vk`}
                    {h.kytketty && !h.workTimeType && ' · työaikamuoto puuttuu'}
                  </p>
                </div>
                <span className={`text-xs ${vari[kortti.taso]}`}>{kortti.teksti}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
