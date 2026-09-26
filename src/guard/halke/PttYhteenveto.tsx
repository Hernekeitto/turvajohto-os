// HÄLKEn PTT-yhteenveto: mitä kanavia on juuri nyt auki, kuka puhuu, ja mahdollisuus
// kuunnella (erä 26, vaihe 8/9, käyttäjän pyyntö 22.9.2026: "Lisätään HÄLKE oma osio
// PTT varten. Sinne yhteenveto kanavista ja kuuntelumahdollisuus. Muuten en voi tietää
// lähteekö ääni puhelimesta minnekkään.").
//
// TÄMÄ ON ENSIMMÄINEN PAIKKA JOSSA SELAIN OIKEASTI TOISTAA PTT-ÄÄNTÄ (ks.
// src/shared/aanivastaanotto.ts:n yläkommentti). TODENNETTU OIKEALLA ÄÄNELLÄ
// 23.9.2026 puhelintestissä selaimen manuaalisesta lähetyksestä (aanilahetys.ts)
// asti — ks. Obsidian "PTT-äänibugin juurisyy" yhdeksän kerrostuneen bugin
// listalle jotka piti korjata ennen kuin tämä toimi.
//
// PÄIVYSTÄJÄ SAA KUUNNELLA MITÄ TAHANSA KIINTEÄÄ (kohde/piiri) KANAVAA VAIKKA HÄNELLÄ
// EI OLE OMAA VUOROA (server/index.js: kuuluuKanavaanNyt/reqKuuluuKanavaanNyt/
// jasenetKanavalla, laajennettu tätä varten) — sama guard_dispatch NÄKY -oikeus jolla
// hätäkanavakin on jo auki. Tämä komponentti EI LÄHETÄ ääntä, vain vastaanottaa.
//
// YKSI VASTAANOTIN PER AUKI OLEVA KUUNTELU, EI JAETTU SINGLETONI — päivystäjä voi
// teoriassa kuunnella useampaa kanavaa yhtä aikaa (sama malli kuin natiivin
// AaniPuhelu.java:n kanavakohtainen `vastaanotot`-kartta).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OlmMachine } from '@matrix-org/matrix-sdk-crypto-wasm';
import { Radio, Volume2, VolumeX, RefreshCw } from 'lucide-react';

import { useKanava } from '../../shared/kanava';
import { haeJaettuOlmMachine, synkronoiPyynnot, synkronoiLaiteviestit } from '../../shared/olm';
import { vastaanotaAvain } from '../../shared/aanikutsu';
import { luoVastaanotin, type Vastaanotin } from '../../shared/aanivastaanotto';
import { soitaAanimerkki } from '../../shared/aanimerkki';

type KanavaTyyppi = 'kohde' | 'piiri' | 'hata';

type KanavaRivi = {
  id: string;
  tyyppi: KanavaTyyppi;
  nimi: string;
  jasenmaara: number;
  puhuja: string | null;
};

type KuunteluTila = 'odottaa_avainta' | 'kuuntelee' | 'virhe';

// Kanavalista vaihtuu harvemmin kuin hälytykset — ei tarvitse Hälytyskeskuksen 30 s
// varakyselyä tiheämpää, mutta guardKanavat-muutos (hätäkanava syntyi/purkautui)
// herättää haun heti kanavan kautta (ks. useKanava onMuutos alla) joka tapauksessa.
const HAKUVALI_MS = 20_000;

const TYYPIN_NIMI: Record<KanavaTyyppi, string> = { kohde: 'Kohde', piiri: 'Piiri', hata: 'Hätäkanava' };

export const PttYhteenveto = ({ kayttaja }: { kayttaja: string }) => {
  const [kanavat, setKanavat] = useState<KanavaRivi[]>([]);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [machine, setMachine] = useState<OlmMachine | null>(null);
  // Salauksen alustuksen virhe ERI TILASSA kuin yhteenvedon virhe — kaksi eri asiaa
  // jotka voivat epäonnistua toisistaan riippumatta, ja päivystäjän on nähtävä KUMPI.
  // Aiemmin tämä nieltiin hiljaa (`.catch(() => {})`), mikä näkyi vartijalle pysyvänä
  // "Valmistellaan salausta…" -tekstinä ilman mitään vihjettä miksi — löytyi 22.9.2026
  // ensimmäisessä oikeassa puhelintestissä.
  const [koneVirhe, setKoneVirhe] = useState<string | null>(null);
  const [tilat, setTilat] = useState<Record<string, KuunteluTila>>({});
  // Vastaanottimet REFISSÄ eikä tilassa: se ei ole näytettävää dataa vaan ajonaikaisia
  // WebCodecs/Web Audio -olioita, ja niiden vaihtuminen ei itsessään saa laukaista
  // uudelleenrenderöintiä — vain `tilat`-tilan muutos näytetään.
  const vastaanottimet = useRef<Map<string, Vastaanotin>>(new Map());

  const haeYhteenveto = useCallback(() => {
    fetch('/api/kanavat/yhteenveto', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) {
          setKanavat(d.kanavat || []);
        } else if (d) {
          setVirhe(d.error || 'PTT-yhteenveto ei latautunut.');
        }
      })
      .catch(() => setVirhe('PTT-yhteenveto ei latautunut: ei yhteyttä palvelimeen.'));
  }, []);

  useEffect(() => {
    haeYhteenveto();
    const ajastin = window.setInterval(haeYhteenveto, HAKUVALI_MS);
    return () => window.clearInterval(ajastin);
  }, [haeYhteenveto]);

  // OlmMachine: sama jaettu instanssi kuin mobiili-GUARDin PTT-palkilla
  // (kayttoPttPalkkia.ts) — YKSI per käyttäjätunnus koko selainvälilehteä kohden,
  // haeJaettuOlmMachine huolehtii siitä ettei kahta instanssia synny samaa
  // IndexedDB-varastoa vasten (ks. sen oma kommentti).
  useEffect(() => {
    let peruttu = false;
    setKoneVirhe(null);
    haeJaettuOlmMachine(kayttaja).then(async (kone) => {
      await synkronoiPyynnot(kone);
      await synkronoiLaiteviestit(kone);
      if (!peruttu) setMachine(kone);
    }).catch((e: unknown) => {
      if (peruttu) return;
      // NÄKYVÄ virhe eikä hiljainen nielaisu — konsoliin täysi olio (stack mukaan)
      // devtoolsia varten, ruudulle lyhyt teksti jonka päivystäjä voi lukea ääneen
      // tukipyynnössä ilman devtoolseja.
      // eslint-disable-next-line no-console
      console.error('PTT-salauksen alustus epäonnistui', e);
      const viesti = e instanceof Error ? e.message : String(e);
      setKoneVirhe(`Salauksen alustus epäonnistui: ${viesti}`);
    });
    return () => { peruttu = true; };
  }, [kayttaja]);

  // Viimeisin saapunut aani_avain-tapahtuma per kanava, RAAKANA (vielä purkamattomana).
  // aani_avain ON HETKELLINEN EIKÄ PERSISTOITU (ks. aanikutsu.ts:n yläkommentti) — jos
  // huoneavain ei ole vielä ehtinyt koneelle kun tapahtuma saapuu, purku epäonnistuu eikä
  // tapahtumaa voi hakea uudelleen palvelimelta (toisin kuin tekstiviesteillä, joilla on
  // historia). Tallennetaan siis raaka sisältö tänne, jotta onLaiteviestiSaapui voi
  // yrittää purkua UUDELLEEN samasta tapahtumasta sen sijaan että jäätäisiin odottamaan
  // seuraavaa PTT-painallusta.
  const viimeisinAaniAvain = useRef<Map<string, string>>(new Map());

  const kasitteleAaniAvain = useCallback((kanavaId: string, tapahtuma: string) => {
    viimeisinAaniAvain.current.set(kanavaId, tapahtuma);
    // Vain jos TÄMÄ selain on juuri pyytänyt tätä kanavaa kuunneltavaksi — ks.
    // aloitaKuuntelu, joka luo vastaanottimen ennen kuin ilmoittaa palvelimelle.
    const vastaanotin = vastaanottimet.current.get(kanavaId);
    if (!vastaanotin || !machine) return;
    vastaanotaAvain(machine, kanavaId, tapahtuma).then(async (tulos) => {
      if (!tulos) {
        // Huoneavain ei ole vielä saapunut (to-device-relenssi kesken) tai sisältö ei
        // jäsentynyt — jää odottamaan, samaan tapaan kuin KanavaViestit.tsx:n
        // "Odottaa avainta…" tekstiviesteille. onLaiteviestiSaapui yrittää tätä samaa
        // tapahtumaa uudelleen kun huoneavain lopulta saapuu.
        setTilat((e) => ({ ...e, [kanavaId]: 'odottaa_avainta' }));
        return;
      }
      const onnistui = await vastaanotin.aloita(tulos.lahetysAvain, tulos.koodekki);
      setTilat((e) => ({ ...e, [kanavaId]: onnistui ? 'kuuntelee' : 'virhe' }));
      if (onnistui) soitaAanimerkki('alkoi');
    });
  }, [machine]);

  // VÄLIAIKAINEN DIAGNOSTIIKKA (26.9.2026, ääni ei kuulu vieläkään vaikka huoneavain
  // ja aani_avain purkautuvat nyt onnistuneesti ja AudioContext on "running") — jos
  // kehyksiä ei edes saavu tänne asti, vika on kuljetuksessa (palvelin/WS); jos ne
  // saapuvat mutta vastaanotinta ei löydy, `aloita()` ei ole vielä ehtinyt asettaa
  // sitä. Laskuri per kanava, ei jokainen kehys erikseen (kehyksiä voi tulla kymmeniä
  // sekunnissa) — vain ensimmäinen ja 50. jokaista alkavaa erää kohden.
  const aaniKehysLaskuri = useRef<Map<string, number>>(new Map());
  const kasitteleAaniKehys = useCallback((kanavaId: string, data: string) => {
    const n = (aaniKehysLaskuri.current.get(kanavaId) ?? 0) + 1;
    aaniKehysLaskuri.current.set(kanavaId, n);
    const vastaanotin = vastaanottimet.current.get(kanavaId);
    if (n === 1 || n % 50 === 0) {
      // eslint-disable-next-line no-console
      console.log(`PTT-äänikehys kanava=${kanavaId} n=${n} vastaanotin=${Boolean(vastaanotin)} tavuja=${data.length}`);
    }
    vastaanotin?.vastaanotaKehys(data);
  }, []);

  const { yhdistetty, laheta } = useKanava({
    onMuutos: (kokoelma) => { if (kokoelma === 'guardKanavat') haeYhteenveto(); },
    onAaniAvain: kasitteleAaniAvain,
    onAaniKehys: kasitteleAaniKehys,
    // Huoneavain saapui to-device-relenssin kautta (sama periaate kuin
    // kayttoPttPalkkia.ts:llä tekstiviesteille) — synkronoitava koneelle ENNEN kuin
    // viimeisintä aani_avain-tapahtumaa kannattaa yrittää purkaa uudelleen. Puuttuva
    // käsittelijä oli aiemmin tässä tiedostossa — juuri se syy miksi kuuntelu jäi
    // pysyvästi "Odottaa avainta…" -tilaan vaikka puheenvuoro ja siis lähetys toimivat
    // (löytyi 22.9.2026 käyttäjän puhelintestissä CSP-korjauksen jälkeen).
    onLaiteviestiSaapui: () => {
      if (!machine) return;
      synkronoiLaiteviestit(machine).then(() => {
        for (const [kanavaId, tapahtuma] of viimeisinAaniAvain.current) {
          kasitteleAaniAvain(kanavaId, tapahtuma);
        }
      });
    },
    // Puhuja päästi napin irti — äänimerkki VAIN jos tätä kanavaa oikeasti kuunneltiin
    // (tila 'kuuntelee'), ei kaikille kanaville joita palvelin sattuu ilmoittamaan.
    onPuheenvuoroVapautui: (kanavaId: string) => {
      if (tilat[kanavaId] === 'kuuntelee') soitaAanimerkki('loppui');
    },
  });

  // Kuunneltavat kanavat palvelimelle aina kun joukko tai yhteys itse muuttuu — sama
  // periaate kuin kayttoPttPalkkia.ts:ssä: palvelimen istuntokohtainen kuuntelutila on
  // tyhjä joka uudella yhteydellä.
  useEffect(() => {
    if (!yhdistetty) return;
    laheta({ tyyppi: 'aseta_kuunneltavat_kanavat', kanavat: Object.keys(tilat) });
  }, [yhdistetty, tilat, laheta]);

  const aloitaKuuntelu = (kanavaId: string) => {
    if (!vastaanottimet.current.has(kanavaId)) {
      vastaanottimet.current.set(kanavaId, luoVastaanotin());
    }
    // Merkitään kuunneltavaksi HETI — tämä on se mikä laukaisee yllä olevan efektin
    // ilmoittamaan palvelimelle, ja vasta sen jälkeen seuraava aani_avain voi tulla
    // perille. Tila 'odottaa_avainta' kunnes joko avain saapuu tai painallus ohi.
    setTilat((e) => ({ ...e, [kanavaId]: 'odottaa_avainta' }));
  };

  const lopetaKuuntelu = (kanavaId: string) => {
    vastaanottimet.current.get(kanavaId)?.lopeta();
    vastaanottimet.current.delete(kanavaId);
    setTilat((e) => {
      const uusi = { ...e };
      delete uusi[kanavaId];
      return uusi;
    });
  };

  // Siivous kun koko paneeli poistuu näkymästä (irrotettu ikkuna suljetaan tms.) —
  // AudioContextit eivät saa jäädä auki taustalle.
  useEffect(() => () => {
    for (const vastaanotin of vastaanottimet.current.values()) vastaanotin.lopeta();
  }, []);

  if (virhe) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-strong mb-2">
          <Radio size={16} /> PTT
        </h2>
        <p className="text-sm text-danger-ink">{virhe}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-strong">
          <Radio size={16} /> PTT — aktiiviset kanavat
        </h2>
        <button
          type="button"
          onClick={haeYhteenveto}
          aria-label="Päivitä kanavalista"
          className="rounded-lg p-1.5 text-ink-subtle hover:text-ink-strong hover:bg-sunken"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {kanavat.length === 0 && (
        <p className="text-sm text-ink-muted">Ei aktiivisia PTT-kanavia juuri nyt.</p>
      )}

      {koneVirhe && (
        <p className="text-xs text-danger-ink mb-2">
          {koneVirhe} — kuuntelu ei ole käytettävissä. Yritä ladata sivu uudelleen.
        </p>
      )}
      {!machine && !koneVirhe && (
        <p className="text-xs text-ink-muted mb-2">Valmistellaan salausta…</p>
      )}

      <ul className="flex flex-col gap-1.5">
        {kanavat.map((k) => {
          const tila = tilat[k.id];
          const kuunnellaan = tila !== undefined;
          return (
            <li
              key={k.id}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
                k.puhuja ? 'border-danger/40 bg-danger-soft' : 'border-line bg-sunken'
              }`}
            >
              {k.puhuja && <span className="w-2 h-2 shrink-0 rounded-full bg-danger animate-pulse" aria-hidden="true" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-body truncate">
                  {TYYPIN_NIMI[k.tyyppi]} · {k.nimi}
                </p>
                <p className="text-xs text-ink-muted">
                  {k.puhuja ? `Puhuu: ${k.puhuja}` : `${k.jasenmaara} vartija${k.jasenmaara === 1 ? '' : 'a'} kanavalla`}
                  {kuunnellaan && tila === 'odottaa_avainta' && ' · Odottaa avainta…'}
                  {kuunnellaan && tila === 'virhe' && ' · Kuuntelu epäonnistui (selain ei tue koodekkia?)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => (kuunnellaan ? lopetaKuuntelu(k.id) : aloitaKuuntelu(k.id))}
                disabled={!machine}
                aria-pressed={kuunnellaan}
                aria-label={kuunnellaan ? `Lopeta kuuntelu: ${k.nimi}` : `Kuuntele: ${k.nimi}`}
                className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
                  tila === 'kuuntelee'
                    ? 'bg-success text-white'
                    : kuunnellaan
                      ? 'bg-warning-soft text-warning-ink border border-warning/40'
                      : 'bg-surface border border-line text-ink-body hover:bg-sunken'
                }`}
              >
                {kuunnellaan ? <Volume2 size={14} /> : <VolumeX size={14} />}
                {kuunnellaan ? 'Lopeta' : 'Kuuntele'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
