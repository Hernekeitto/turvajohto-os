// PTT-kanavapalkin tila ja yhteydet (erä 26, vaihe 5).
//
// TÄMÄ KUTSUU useKanava:aa (src/shared/kanava.ts) KUTEN GuardApp.tsx:KIN, EIKÄ SE OLE
// KAKSI ERILLISTÄ YHTEYTTÄ: kanava.ts jakaa yhden soketin kaikkien tilaajien kesken
// (viipale 5a avasi tähän aluksi oman rinnakkaisen yhteytensä väliaikaisena
// kompromissina, koska GuardApp.tsx:ssä oli käyttäjän oma kesken oleva muutos jota ei
// haluttu koskea — se korjattiin lopullisesti tekemällä kanava.ts:stä moniliittyjäinen
// sen sijaan että tätä tiedostoa tai GuardApp.tsx:ää olisi pitänyt sovittaa toisiinsa).
import { useCallback, useEffect, useState } from 'react';
import type { OlmMachine } from '@matrix-org/matrix-sdk-crypto-wasm';

import { useKanava } from '../../shared/kanava.ts';
import { useSessionUsername } from '../../SessionContext.ts';
import { haeJaettuOlmMachine, synkronoiPyynnot, synkronoiLaiteviestit } from '../../shared/olm.ts';
import { kasitteleJono } from '../../shared/viestijono.ts';
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

  const asetaMykistys = useCallback((kanavaId: string, mykistetty: boolean) => {
    setMykistetyt((edelliset) => {
      const seuraavat = new Set(edelliset);
      if (mykistetty) seuraavat.add(kanavaId); else seuraavat.delete(kanavaId);
      tallennaMykistetyt(seuraavat);
      return seuraavat;
    });
  }, []);

  return {
    kanavat, omaKayttaja, mykistetyt, aktiivinenId, setAktiivinenId, tilat, hylkays,
    pyydaPuheenvuoro, vapautaPuheenvuoro, asetaMykistys,
    machine, viestiHerate, yritaLahettaaJono,
  };
}
