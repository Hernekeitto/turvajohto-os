// PTT-kanavapalkin tila ja yhteydet (erä 26, vaihe 5).
//
// TÄMÄ KUTSUU useKanava:aa (src/shared/kanava.ts) KUTEN GuardApp.tsx:KIN, EIKÄ SE OLE
// KAKSI ERILLISTÄ YHTEYTTÄ: kanava.ts jakaa yhden soketin kaikkien tilaajien kesken
// (viipale 5a avasi tähän aluksi oman rinnakkaisen yhteytensä väliaikaisena
// kompromissina, koska GuardApp.tsx:ssä oli käyttäjän oma kesken oleva muutos jota ei
// haluttu koskea — se korjattiin lopullisesti tekemällä kanava.ts:stä moniliittyjäinen
// sen sijaan että tätä tiedostoa tai GuardApp.tsx:ää olisi pitänyt sovittaa toisiinsa).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { OlmMachine } from '@matrix-org/matrix-sdk-crypto-wasm';

import { useKanava } from '../../shared/kanava.ts';
import { useSessionUsername } from '../../SessionContext.ts';
import { haeJaettuOlmMachine, synkronoiPyynnot, synkronoiLaiteviestit } from '../../shared/olm.ts';
import { kasitteleJono } from '../../shared/viestijono.ts';
import { aloitaLahetys, kehysLahetettavaksi } from '../../shared/aanikutsu.ts';
import { luoLahetin, paatettavaKoodekki, type Lahetin } from '../../shared/aanilahetys.ts';
import {
  type Kanava, kuunneltavatIdt, oletusLahetyskohde,
} from './kanavapalkki.ts';
import { type PuheTilat, paivitaPuheTila } from './puheenvuorotila.ts';

const MYKISTYS_AVAIN = 'ptt-mykistetyt-kanavat';
const HYLKAYS_NAKYVISSA_MS = 4_000;
// Varasilmukka lähetysjonolle (src/shared/viestijono.ts) — normaalisti jono tyhjenee heti
// yhteyden avautuessa tai heti jonotuksen jälkeen (kutsuja laukaisee sen itse), tämä on
// vain turva sille että katkennut kone joskus toipuu ilman käyttäjän toimia.
const JONO_YRITYSVALI_MS = 15_000;

// Viesti- ja kuittausherätteet kootaan yhdeksi kasvavaksi laskuriksi kanava-id:n kanssa,
// jotta viestinäkymä (KanavaViestit.tsx) voi reagoida `useEffect`-riippuvuutena myös
// silloin kun sama kanava saa uuden herätteen peräkkäin. kanavaId null = laiteviesti
// (huoneavain) synkronoitiin — voi koskea mitä tahansa avointa kanavaa.
export type ViestiHerate = { kanavaId: string | null; n: number };

function lueMykistetyt(): Set<string> {
  try {
    const raaka = localStorage.getItem(MYKISTYS_AVAIN);
    const lista = raaka ? JSON.parse(raaka) : [];
    return new Set(Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function tallennaMykistetyt(mykistetyt: Set<string>) {
  try {
    localStorage.setItem(MYKISTYS_AVAIN, JSON.stringify([...mykistetyt]));
  } catch {
    // Yksityinen ikkuna tms. voi kieltää tallennuksen — mykistys toimii silti istunnon
    // ajan muistissa, se ei vain säily uudelleenlataukseen.
  }
}

export type PuheenvuoroHylkays = { kanavaId: string; kayttaja: string | null };

export function usePttPalkkia() {
  const omaKayttaja = useSessionUsername();
  const [kanavat, setKanavat] = useState<Kanava[]>([]);
  const [mykistetyt, setMykistetyt] = useState<Set<string>>(() => lueMykistetyt());
  const [aktiivinenId, setAktiivinenId] = useState<string | null>(null);
  const [tilat, setTilat] = useState<PuheTilat>({});
  const [hylkays, setHylkays] = useState<PuheenvuoroHylkays | null>(null);
  // Äänen lähetyksen virhe (mikrofoni evätty, tai selain ei tue WebCodecsia) — eri tila
  // kuin hylkays, joka koskee PUHEENVUORON epäämistä. Tässä puheenvuoro voi olla
  // myönnetty mutta ääni ei silti lähde mihinkään, mikä on kertakaikkisen eri vika ja
  // vartijan on nähtävä KUMPI (sama periaate kuin HÄLKEn PttYhteenveto.tsx:n koneVirhe).
  const [aaniVirhe, setAaniVirhe] = useState<string | null>(null);
  // TILAPÄINEN DIAGNOSTIIKKA (23.9.2026, ensimmäinen puhelintesti: mic pyysi luvan
  // mutta ääntä ei kuulunut) — näkyy ruudulla, ei vain konsolissa, koska vartija testaa
  // puhelimella eikä devtoolsia yleensä ole auki. Poistettavissa kun syy on löytynyt.
  const [aaniDiag, setAaniDiag] = useState('');
  // Käynnissä oleva lähetin ja sen kanava REFISSÄ: ajonaikainen WebCodecs/getUserMedia-
  // olio eikä näytettävää tilaa, sama perustelu kuin PttYhteenveto.tsx:n vastaanottimet.
  const lahetinRef = useRef<Lahetin | null>(null);
  const lahettavaKanavaRef = useRef<string | null>(null);
  const [machine, setMachine] = useState<OlmMachine | null>(null);
  const [viestiHerate, setViestiHerate] = useState<ViestiHerate>({ kanavaId: null, n: 0 });

  // OlmMachine-elinkaari: YKSI instanssi koko selainvälilehteä kohden (haeJaettuOlmMachine,
  // src/shared/olm.ts). Ensimmäinen synkronoiPyynnot julkaisee tämän laitteen omat avaimet
  // heti, ennen kuin kukaan voi jakaa huoneavainta tälle laitteelle.
  useEffect(() => {
    if (!omaKayttaja) return undefined;
    let peruttu = false;
    haeJaettuOlmMachine(omaKayttaja).then(async (kone) => {
      await synkronoiPyynnot(kone);
      if (!peruttu) setMachine(kone);
    }).catch(() => { /* virhe näkyy siten että viestinäkymä pysyy "alustetaan"-tilassa */ });
    return () => { peruttu = true; };
  }, [omaKayttaja]);

  // Jäljellä olevat to-device-viestit (huoneavaimet) heti kun kone on valmis — ne ovat
  // voineet kertyä ennen kuin tämä sivu ehti avautua.
  useEffect(() => {
    if (!machine) return;
    synkronoiLaiteviestit(machine).then(() => setViestiHerate((e) => ({ kanavaId: null, n: e.n + 1 })));
  }, [machine]);

  const yritaLahettaaJono = useCallback(() => {
    if (!machine || !omaKayttaja) return;
    kasitteleJono(machine, omaKayttaja).catch(() => { /* jää jonoon, yritetään uudelleen */ });
  }, [machine, omaKayttaja]);

  useEffect(() => {
    if (!machine) return undefined;
    const ajastin = setInterval(yritaLahettaaJono, JONO_YRITYSVALI_MS);
    return () => clearInterval(ajastin);
  }, [machine, yritaLahettaaJono]);

  const haeKanavat = useCallback(() => {
    fetch('/api/kanavat/omat', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const lista: Kanava[] = Array.isArray(d?.kanavat) ? d.kanavat : [];
        setKanavat(lista);
        setAktiivinenId((edellinen) => oletusLahetyskohde(lista, edellinen));
      })
      .catch(() => { /* virhe näkyy tyhjänä kanavapalkkina */ });
  }, []);

  useEffect(() => { haeKanavat(); }, [haeKanavat]);

  const { yhdistetty, laheta } = useKanava({
    onMuutos: (kokoelma) => { if (kokoelma === 'guardKanavat') haeKanavat(); },
    onPuheenvuoroTila: (serverTilat) => {
      setTilat((edelliset) => paivitaPuheTila(
        edelliset,
        { tyyppi: 'tila', kanavaIdt: kanavat.map((k) => k.id), tilat: serverTilat },
        omaKayttaja,
      ));
    },
    onPuheenvuoroMyonnetty: (kanavaId, kayttaja) => {
      setTilat((edelliset) => paivitaPuheTila(edelliset, { tyyppi: 'myonnetty', kanavaId, kayttaja }, omaKayttaja));
      setHylkays(null);
    },
    onPuheenvuoroHylatty: (kanavaId, _syy, kayttaja) => setHylkays({ kanavaId, kayttaja }),
    onPuheenvuoroVapautui: (kanavaId) => {
      setTilat((edelliset) => paivitaPuheTila(edelliset, { tyyppi: 'vapautui', kanavaId }, omaKayttaja));
    },
    onUusiViesti: (kanavaId) => setViestiHerate((e) => ({ kanavaId, n: e.n + 1 })),
    onViestiKuitattu: (kanavaId) => setViestiHerate((e) => ({ kanavaId, n: e.n + 1 })),
    // Huoneavain saapui to-device-relenssin kautta — synkronoitava koneelle ENNEN kuin
    // sitä käyttävä viesti kannattaa yrittää purkaa uudelleen.
    onLaiteviestiSaapui: () => {
      if (!machine) return;
      synkronoiLaiteviestit(machine).then(() => setViestiHerate((e) => ({ kanavaId: null, n: e.n + 1 })));
    },
  });

  // Kuunneltavat kanavat palvelimelle aina kun lista, mykistys tai yhteys itse muuttuu —
  // yhteyden uudelleenavautuessa palvelimen istuntokohtainen tila on tyhjä ja pitää
  // ilmoittaa uudelleen. Sama hetki on hyvä myös lähetysjonon uudelleenyritykselle:
  // katkos joka juuri korjaantui on tyypillisin syy sille että jonoon on kertynyt viestejä.
  useEffect(() => {
    if (!yhdistetty) return;
    laheta({ tyyppi: 'aseta_kuunneltavat_kanavat', kanavat: kuunneltavatIdt(kanavat, mykistetyt) });
    yritaLahettaaJono();
  }, [yhdistetty, kanavat, mykistetyt, laheta, yritaLahettaaJono]);

  useEffect(() => {
    if (!hylkays) return undefined;
    const ajastin = setTimeout(() => setHylkays(null), HYLKAYS_NAKYVISSA_MS);
    return () => clearTimeout(ajastin);
  }, [hylkays]);

  const pyydaPuheenvuoro = useCallback((kanavaId: string) => {
    laheta({ tyyppi: 'pyyda_puheenvuoro', kanavaId });
  }, [laheta]);

  const vapautaPuheenvuoro = useCallback((kanavaId: string) => {
    laheta({ tyyppi: 'vapauta_puheenvuoro', kanavaId });
  }, [laheta]);

  // Todellinen äänen kaappaus ja lähetys, reaktiivisesti puheenvuoron MYÖNTYMISEEN —
  // EI painallukseen itseensä, samalla periaatteella kuin natiivin
  // AaniPuhelu.aloitaLahetysMyonnytyksenJalkeen: painallus vain PYYTÄÄ kanavan
  // (pyydaPuheenvuoro yllä), ja vasta palvelimen myöntymä käynnistää mikrofonin.
  // Ilman tätä eroa kaksi samanaikaista painallusta samalle kanavalle voisivat
  // molemmat aloittaa lähetyksen ennen kuin kumpikaan tietää hävisikö kilpa-ajon.
  //
  // TARKOITUKSELLA VAIN aktiivinenId (chip-valittu kohde/piiri/dm/vapaa) — EI
  // hätäkanavaa. Hätäkanavan ääni tulee natiivin automaattisesta man-down-polusta
  // (AaniPuhelu.java, "hätäkanava-rajaus v1"); jos tämäkin selain alkaisi lähettää
  // samalle hätäkanavan puheenvuorolle jonka natiivi jo täyttää, kuuntelija saisi kaksi
  // riippumatonta Opus-virtaa saman haltijan nimissä yhtä aikaa.
  useEffect(() => {
    const kanavaId = aktiivinenId;
    const lahetetaanNyt = Boolean(kanavaId && tilat[kanavaId]?.mina);

    if (lahetetaanNyt && lahettavaKanavaRef.current !== kanavaId && kanavaId) {
      lahettavaKanavaRef.current = kanavaId;
      setAaniVirhe(null);
      // Salauskone ei ehkä ole vielä valmis (mic-nappi ei odota sitä, koska puheenvuoron
      // PYYTÄMINEN ei tarvitse sitä) — vapautetaan kanava heti sen sijaan että
      // lähettavaKanavaRef jäisi jumiin "hoidossa" ilman että mitään oikeasti tapahtuu,
      // mikä pitäisi kanavan turhaan varattuna 60 sekunnin aikakatkaisuun asti.
      if (!machine || !omaKayttaja) {
        setAaniVirhe('Salaus ei ole vielä valmis — yritä hetken kuluttua uudelleen.');
        vapautaPuheenvuoro(kanavaId);
        return;
      }
      const kohdeKanava = kanavaId;
      const omaKone = machine;
      const oma = omaKayttaja;
      setAaniDiag('valitaan koodekkia…');
      (async () => {
        const koodekki = await paatettavaKoodekki();
        if (!koodekki) {
          setAaniVirhe('Tämä selain ei tue äänen lähetystä.');
          vapautaPuheenvuoro(kohdeKanava);
          return;
        }
        setAaniDiag(`koodekki=${koodekki}, jaetaan huoneavainta…`);
        const { lahetysAvain, tapahtuma } = await aloitaLahetys(omaKone, oma, kohdeKanava, koodekki);
        // aani_avain ENNEN ensimmäistä kehystä, muuten vastaanottajalla ei ole millä
        // purkaa sitä (sama järjestys kuin aanikutsu.ts:n oma yläkommentti vaatii).
        const avainLahti = laheta({ tyyppi: 'aani_avain', kanavaId: kohdeKanava, tapahtuma });
        setAaniDiag(`koodekki=${koodekki}, aani_avain lähti=${avainLahti}, pyydetään mikrofonia…`);
        // Kanava on voinut vaihtua (painettu toista chippiä) sen aikana kun avaimen
        // jako oli kesken — ei käynnistetä mikrofonia enää vanhalle kanavalle.
        if (lahettavaKanavaRef.current !== kohdeKanava) return;
        const lahetin = luoLahetin();
        lahetinRef.current = lahetin;
        let kehyksia = 0;
        let viimeisinLahetysOnnistui: boolean | null = null;
        const onnistui = await lahetin.aloita(
          lahetysAvain, koodekki,
          (paketti) => {
            kehyksia += 1;
            viimeisinLahetysOnnistui = laheta({
              tyyppi: 'aani_kehys', kanavaId: kohdeKanava, data: kehysLahetettavaksi(paketti),
            });
            if (lahettavaKanavaRef.current === kohdeKanava) {
              setAaniDiag(`koodekki=${koodekki}, kehyksiä lähetetty=${kehyksia}, viimeisin onnistui=${viimeisinLahetysOnnistui}`);
            }
          },
          (viesti) => { if (lahettavaKanavaRef.current === kohdeKanava) setAaniVirhe(viesti); },
        );
        if (!onnistui) {
          setAaniVirhe('Mikrofonia ei saatu käyttöön.');
          lahetinRef.current = null;
          if (lahettavaKanavaRef.current === kohdeKanava) vapautaPuheenvuoro(kohdeKanava);
        }
      })();
    } else if (!lahetetaanNyt && lahettavaKanavaRef.current) {
      lahettavaKanavaRef.current = null;
      lahetinRef.current?.lopeta();
      lahetinRef.current = null;
      setAaniDiag('');
    }
  }, [aktiivinenId, tilat, machine, omaKayttaja, laheta, vapautaPuheenvuoro]);

  // Mikrofoni ei saa jäädä auki taustalle jos koko palkki puretaan kesken lähetyksen.
  useEffect(() => () => { lahetinRef.current?.lopeta(); }, []);

  const asetaMykistys = useCallback((kanavaId: string, mykistetty: boolean) => {
    setMykistetyt((edelliset) => {
      const seuraavat = new Set(edelliset);
      if (mykistetty) seuraavat.add(kanavaId); else seuraavat.delete(kanavaId);
      tallennaMykistetyt(seuraavat);
      return seuraavat;
    });
  }, []);

  return {
    kanavat, omaKayttaja, mykistetyt, aktiivinenId, setAktiivinenId, tilat, hylkays, aaniVirhe, aaniDiag,
    pyydaPuheenvuoro, vapautaPuheenvuoro, asetaMykistys,
    machine, viestiHerate, yritaLahettaaJono,
  };
}
