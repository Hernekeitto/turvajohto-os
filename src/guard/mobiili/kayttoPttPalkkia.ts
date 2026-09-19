// PTT-kanavapalkin tila ja yhteydet (erä 26, vaihe 5, viipale 5a).
//
// OMA WEBSOCKET-YHTEYS, EI JAETTU GuardAppin YHTEYDEN KANSSA. src/shared/kanava.ts:n
// oma kommentti sanoo ettei kahta rinnakkaista yhteyttä samaan istuntoon kannata avata,
// ja se pitää paikkansa lopullisessa tilassa. Tässä vaiheessa GuardApp.tsx:ssä on
// käyttäjän oma, kesken oleva ja committoimaton muutos (tilatietopaneelin päivitys-
// bugikorjaus) jota ei tule sotkea PTT-työhön koskematta tiedostoon lainkaan — ks. vaihe
// 5 -suunnitelman toteutusmerkintä Obsidiania varten. Floor control on joka tapauksessa
// SIDOTTU YHTEYTEEN eikä käyttäjätunnukseen (server/puheenvuoro.js), joten oma yhteys
// toimii oikein sellaisenaan; ainoa haitta on ylimääräinen avoin soketti selainta kohden,
// joka poistuu kun tämä yhdistetään GuardAppin yhteyteen erillisenä siivousaskeleena.
import { useCallback, useEffect, useState } from 'react';

import { useKanava } from '../../shared/kanava.ts';
import { useSessionUsername } from '../../SessionContext.ts';
import {
  type Kanava, kuunneltavatIdt, oletusLahetyskohde,
} from './kanavapalkki.ts';
import { type PuheTilat, paivitaPuheTila } from './puheenvuorotila.ts';

const MYKISTYS_AVAIN = 'ptt-mykistetyt-kanavat';
const HYLKAYS_NAKYVISSA_MS = 4_000;

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
  });

  // Kuunneltavat kanavat palvelimelle aina kun lista, mykistys tai yhteys itse muuttuu —
  // yhteyden uudelleenavautuessa palvelimen istuntokohtainen tila on tyhjä ja pitää
  // ilmoittaa uudelleen.
  useEffect(() => {
    if (!yhdistetty) return;
    laheta({ tyyppi: 'aseta_kuunneltavat_kanavat', kanavat: kuunneltavatIdt(kanavat, mykistetyt) });
  }, [yhdistetty, kanavat, mykistetyt, laheta]);

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
  };
}
