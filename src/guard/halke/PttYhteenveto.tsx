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
import { Radio, Volume2, VolumeX, RefreshCw, MessageSquare, Mic, Square, Users } from 'lucide-react';

import { useKanava } from '../../shared/kanava';
import { haeJaettuOlmMachine, synkronoiPyynnot, synkronoiLaiteviestit } from '../../shared/olm';
import { vastaanotaAvain, aloitaLahetys, kehysLahetettavaksi } from '../../shared/aanikutsu';
import { luoVastaanotin, type Vastaanotin } from '../../shared/aanivastaanotto';
import { luoLahetin, paatettavaKoodekki, type Lahetin } from '../../shared/aanilahetys';
import { soitaAanimerkki } from '../../shared/aanimerkki';
import { paivitaPuheTila, type PuheTilat } from '../mobiili/puheenvuorotila';
import { KohdeKeskustelu } from './KohdeKeskustelu';
import { KanavanJasenet } from './KanavanJasenet';

type KanavaTyyppi = 'kohde' | 'piiri' | 'alue' | 'hata';

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

const TYYPIN_NIMI: Record<KanavaTyyppi, string> = {
  kohde: 'Kohde', piiri: 'Piiri', alue: 'Alue', hata: 'Hätäkanava',
};

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
  // Avoinna oleva viestiketju (erä 26, käyttäjän pyyntö 26.9.2026: "Lisätään myös
  // HÄLKE näkymään soveltuvin osin") — KohdeKeskustelu on jo olemassa ja täysin
  // kanavatyyppiriippumaton (ottaa vain {id, tyyppi, nimi}), joten sama komponentti
  // toimii sellaisenaan kohde-, piiri- ja alue-kanaville, ei vain kohteen omalle.
  const [avattuViesti, setAvattuViesti] = useState<KanavaRivi | null>(null);
  // Kanavan jäsenten hallintanäkymä (erä 26, jatko 26.9.2026, käyttäjän pyyntö:
  // "Lisätään HÄLKE mahdollisuus lisätä ja poistaa vartijoita tietyltä kanavalta").
  const [hallintaAuki, setHallintaAuki] = useState<KanavaRivi | null>(null);
  // Vastaanottimet REFISSÄ eikä tilassa: se ei ole näytettävää dataa vaan ajonaikaisia
  // WebCodecs/Web Audio -olioita, ja niiden vaihtuminen ei itsessään saa laukaista
  // uudelleenrenderöintiä — vain `tilat`-tilan muutos näytetään.
  const vastaanottimet = useRef<Map<string, Vastaanotin>>(new Map());

  // --- Puhekyky (erä 26, jatko 26.9.2026, käyttäjän pyyntö: "Lisätään HÄLKE
  // mahdollisuus puhua tietylle kanavalle, nyt HÄLKE voi vain kuunnella") ----------
  //
  // ERI TILA kuin `tilat` yllä, joka on KUUNTELUTILA (per-kanava vastaanotin) —
  // `puheTilat` on PUHEENVUOROTILA (kuka pitää mikrofonia juuri nyt milläkin
  // kanavalla, ks. ../mobiili/puheenvuorotila.ts). `omaLahetys` on VAIN YKSI kanava
  // kerrallaan: yksi mikrofoni, samoin kuin vartijan omalla PTT-palkilla.
  const [puheTilat, setPuheTilat] = useState<PuheTilat>({});
  const [omaLahetys, setOmaLahetys] = useState<string | null>(null);
  const [aaniVirhe, setAaniVirhe] = useState<string | null>(null);
  const [puheVirhe, setPuheVirhe] = useState<string | null>(null);
  // Käynnissä oleva lähetin ja sen kanava REFISSÄ, sama perustelu kuin
  // kayttoPttPalkkia.ts:llä: ajonaikainen WebCodecs/getUserMedia-olio eikä
  // näytettävää tilaa.
  const lahetinRef = useRef<Lahetin | null>(null);
  const lahettavaKanavaRef = useRef<string | null>(null);

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
    // Päivittää myös oman puheTilan (Osa 2) — VAPAUTUS koskee ketä tahansa kanavan
    // haltijaa, ei vain omaa mahdollista lähetystä.
    onPuheenvuoroVapautui: (kanavaId: string) => {
      if (tilat[kanavaId] === 'kuuntelee') soitaAanimerkki('loppui');
      setPuheTilat((e) => paivitaPuheTila(e, { tyyppi: 'vapautui', kanavaId }, kayttaja));
    },
    // Puhekyky (Osa 2): puheenvuoro_tila on tilannekuva NIISTÄ kanavista jotka juuri
    // ilmoitettiin kuunneltaviksi (aseta_kuunneltavat_kanavat alla) — sama muoto kuin
    // kayttoPttPalkkia.ts:llä.
    onPuheenvuoroTila: (serverTilat) => {
      setPuheTilat((edelliset) => paivitaPuheTila(
        edelliset, { tyyppi: 'tila', kanavaIdt: Object.keys(tilat), tilat: serverTilat }, kayttaja,
      ));
    },
    onPuheenvuoroMyonnetty: (kanavaId, k) => {
      setPuheTilat((e) => paivitaPuheTila(e, { tyyppi: 'myonnetty', kanavaId, kayttaja: k }, kayttaja));
    },
    onPuheenvuoroHylatty: (kanavaId, _syy, k) => {
      setOmaLahetys((nykyinen) => (nykyinen === kanavaId ? null : nykyinen));
      setPuheVirhe(`Kanava varattu${k ? ` — puhuu ${k}` : ''}.`);
    },
  });

  useEffect(() => {
    if (!puheVirhe) return undefined;
    const ajastin = setTimeout(() => setPuheVirhe(null), 4000);
    return () => clearTimeout(ajastin);
  }, [puheVirhe]);

  const pyydaPuheenvuoro = useCallback((kanavaId: string) => {
    laheta({ tyyppi: 'pyyda_puheenvuoro', kanavaId });
  }, [laheta]);

  const vapautaPuheenvuoro = useCallback((kanavaId: string) => {
    laheta({ tyyppi: 'vapauta_puheenvuoro', kanavaId });
  }, [laheta]);

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

  // Puhu-painike (Osa 2). TÄRKEÄÄ: puheenvuoro_myonnetty-ilmoitus suodattuu
  // palvelimella saaKuullaKanavaa:lla, joka vaatii että kanava on JO merkitty
  // kuunneltavaksi (server/index.js: kasitteleKuunneltavatKanavat) — ilman sitä
  // myöntö ei ikinä saavu eikä lähetys käynnistyisi. Siksi kuuntelu käynnistetään
  // TÄSSÄ SYNKRONISESTI (laheta kutsutaan heti, ei jätetä ylläolevan reaktiivisen
  // efektin varaan, koska sen laukaisu tulisi vasta seuraavalla renderöinnillä).
  const puhu = (kanavaId: string) => {
    if (!(kanavaId in tilat)) {
      if (!vastaanottimet.current.has(kanavaId)) vastaanottimet.current.set(kanavaId, luoVastaanotin());
      const seuraavat = { ...tilat, [kanavaId]: 'odottaa_avainta' as KuunteluTila };
      laheta({ tyyppi: 'aseta_kuunneltavat_kanavat', kanavat: Object.keys(seuraavat) });
      setTilat(seuraavat);
    }
    setPuheVirhe(null);
    setOmaLahetys(kanavaId);
    pyydaPuheenvuoro(kanavaId);
  };

  const lopetaPuhe = (kanavaId: string) => {
    vapautaPuheenvuoro(kanavaId);
    setOmaLahetys(null);
  };

  // Todellinen äänen kaappaus ja lähetys, reaktiivisesti puheenvuoron MYÖNTYMISEEN —
  // sama kaksivaiheinen malli kuin kayttoPttPalkkia.ts:llä (portattu tähän UUTENA,
  // ERILLISENÄ koodina, ei jaettu/refaktoroitu — ks. tiedoston yläkommentti Osasta 2
  // sille miksi kayttoPttPalkkia.ts:ää ei kannata koskea).
  useEffect(() => {
    const kanavaId = omaLahetys;
    const lahetetaanNyt = Boolean(kanavaId && puheTilat[kanavaId]?.mina);

    if (lahetetaanNyt && kanavaId && lahettavaKanavaRef.current !== kanavaId) {
      lahettavaKanavaRef.current = kanavaId;
      setAaniVirhe(null);
      if (!machine) {
        setAaniVirhe('Salaus ei ole vielä valmis — yritä hetken kuluttua uudelleen.');
        vapautaPuheenvuoro(kanavaId);
        setOmaLahetys(null);
        return;
      }
      const omaKone = machine;
      (async () => {
        const koodekki = await paatettavaKoodekki();
        if (!koodekki) {
          setAaniVirhe('Tämä selain ei tue äänen lähetystä.');
          vapautaPuheenvuoro(kanavaId);
          setOmaLahetys(null);
          return;
        }
        const { lahetysAvain, tapahtuma } = await aloitaLahetys(omaKone, kayttaja, kanavaId, koodekki);
        // aani_avain ENNEN ensimmäistä kehystä, muuten vastaanottajalla ei ole millä
        // purkaa sitä.
        laheta({ tyyppi: 'aani_avain', kanavaId, tapahtuma });
        // Kanava on voinut vaihtua (uusi Puhu-painallus toiselle kanavalle) sen aikana
        // kun avaimen jako oli kesken.
        if (lahettavaKanavaRef.current !== kanavaId) return;
        const lahetin = luoLahetin();
        lahetinRef.current = lahetin;
        const onnistui = await lahetin.aloita(
          lahetysAvain, koodekki,
          (paketti) => laheta({ tyyppi: 'aani_kehys', kanavaId, data: kehysLahetettavaksi(paketti) }),
          (viesti) => { if (lahettavaKanavaRef.current === kanavaId) setAaniVirhe(viesti); },
        );
        if (onnistui) {
          soitaAanimerkki('alkoi');
        } else {
          setAaniVirhe('Mikrofonia ei saatu käyttöön.');
          lahetinRef.current = null;
          if (lahettavaKanavaRef.current === kanavaId) {
            vapautaPuheenvuoro(kanavaId);
            setOmaLahetys(null);
          }
        }
      })();
    } else if (!lahetetaanNyt && lahettavaKanavaRef.current) {
      lahettavaKanavaRef.current = null;
      lahetinRef.current?.lopeta();
      lahetinRef.current = null;
      soitaAanimerkki('loppui');
    }
  }, [omaLahetys, puheTilat, machine, kayttaja, laheta, vapautaPuheenvuoro]);

  // Siivous kun koko paneeli poistuu näkymästä (irrotettu ikkuna suljetaan tms.) —
  // AudioContextit EIVÄTKÄ mikrofoni saa jäädä auki taustalle.
  useEffect(() => () => {
    for (const vastaanotin of vastaanottimet.current.values()) vastaanotin.lopeta();
    lahetinRef.current?.lopeta();
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

  // Järjestys (Osa 3, käyttäjän pyyntö: "kaikki PTT-kanavat, vaikka niillä ei olisi
  // ketään" — nyt kun tyhjätkin kanavat näkyvät, tärkeimmät on pidettävä ylhäällä):
  // puhuva ensin, sitten joilla on jäseniä, sitten tyhjät — aakkosjärjestys kunkin
  // ryhmän sisällä.
  const jarjestetytKanavat = [...kanavat].sort((a, b) => {
    const pisteet = (k: KanavaRivi) => (k.puhuja ? 0 : k.jasenmaara > 0 ? 1 : 2);
    const ero = pisteet(a) - pisteet(b);
    return ero !== 0 ? ero : a.nimi.localeCompare(b.nimi, 'fi');
  });

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
      {puheVirhe && <p className="text-xs text-danger-ink mb-2">{puheVirhe}</p>}
      {aaniVirhe && <p className="text-xs text-danger-ink mb-2">{aaniVirhe}</p>}

      <ul className="flex flex-col gap-1.5">
        {jarjestetytKanavat.map((k) => {
          const tila = tilat[k.id];
          const kuunnellaan = tila !== undefined;
          const puheTila = puheTilat[k.id];
          const puhunTata = omaLahetys === k.id;
          const muuPuhuu = omaLahetys !== null && !puhunTata;
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
                  {puheTila?.mina
                    ? 'SINÄ PUHUT'
                    : k.puhuja
                      ? `Puhuu: ${k.puhuja}`
                      : k.jasenmaara > 0
                        ? `${k.jasenmaara} vartija${k.jasenmaara === 1 ? '' : 'a'} kanavalla`
                        : 'Ei ketään juuri nyt'}
                  {kuunnellaan && tila === 'odottaa_avainta' && ' · Odottaa avainta…'}
                  {kuunnellaan && tila === 'virhe' && ' · Kuuntelu epäonnistui (selain ei tue koodekkia?)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => (puhunTata ? lopetaPuhe(k.id) : puhu(k.id))}
                disabled={!machine || muuPuhuu}
                aria-pressed={puhunTata}
                aria-label={puhunTata ? `Lopeta puhe: ${k.nimi}` : `Puhu: ${k.nimi}`}
                title={muuPuhuu ? 'Puhut jo toisella kanavalla.' : undefined}
                className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
                  puhunTata ? 'bg-danger text-white' : 'bg-surface border border-line text-ink-body hover:bg-sunken'
                }`}
              >
                {puhunTata ? <Square size={14} /> : <Mic size={14} />}
                {puhunTata ? 'Lopeta' : 'Puhu'}
              </button>
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
              <button
                type="button"
                onClick={() => setAvattuViesti(k)}
                aria-label={`Viestit: ${k.nimi}`}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-ink-subtle hover:bg-sunken"
              >
                <MessageSquare size={14} />
              </button>
              {/* Jäsenten hallinta (Osa 4) — vain kiinteille kanaville, ei hätäkanavalle:
                  hätäkanavan osallistujuus ratkeaa hälytyksen tilasta ja guard_dispatch
                  -oikeudesta, ei käsin hallitusta poikkeuslistasta. */}
              {k.tyyppi !== 'hata' && (
                <button
                  type="button"
                  onClick={() => setHallintaAuki(k)}
                  aria-label={`Jäsenet: ${k.nimi}`}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-ink-subtle hover:bg-sunken"
                >
                  <Users size={14} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {avattuViesti && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Viestit: ${avattuViesti.nimi}`}>
          <KohdeKeskustelu
            kayttaja={kayttaja}
            kanava={{ id: avattuViesti.id, tyyppi: avattuViesti.tyyppi, nimi: avattuViesti.nimi }}
            onSulje={() => setAvattuViesti(null)}
          />
        </div>
      )}

      {hallintaAuki && (
        <KanavanJasenet
          kanava={{ id: hallintaAuki.id, nimi: hallintaAuki.nimi }}
          onSulje={() => setHallintaAuki(null)}
        />
      )}
    </div>
  );
};
