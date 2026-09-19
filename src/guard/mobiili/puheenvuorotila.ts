// PTT-puheenvuorotilan puhdas reducer (erä 26, vaihe 5, viipale 5a).
//
// Palvelin kertoo puheenvuoron haltijan käyttäjätunnuksella, ei sillä onko se "minä" —
// käyttöliittymän on itse päätettävä näyttääkö "LÄHETÄT" vai "KUUNTELET: <nimi>", joten
// reducer ottaa oman käyttäjätunnuksen mukaan eikä jätä vertailua jokaisen näyttöpaikan
// omaksi vastuuksi.
//
// 'tila'-tapahtuma on TILANNEKUVA pyydetystä kanavajoukosta (server/index.js:
// kasitteleKuunneltavatKanavat lähettää sen heti `aseta_kuunneltavat_kanavat`-vastauksena)
// eikä lisäys: kanavat jotka ovat `kanavaIdt`-listalla mutta puuttuvat `tilat`-kentästä
// ovat vapaita NYT. Kanaviin joita pyyntö ei koskenut ei kosketa.

export type KanavaPuheTila = { kayttaja: string; mina: boolean };
export type PuheTilat = Record<string, KanavaPuheTila>;

export type PuheTapahtuma =
  | { tyyppi: 'tila'; kanavaIdt: string[]; tilat: { kanavaId: string; kayttaja: string }[] }
  | { tyyppi: 'myonnetty'; kanavaId: string; kayttaja: string }
  | { tyyppi: 'vapautui'; kanavaId: string };

export function paivitaPuheTila(
  tilat: PuheTilat, tapahtuma: PuheTapahtuma, omaKayttaja: string | null,
): PuheTilat {
  if (tapahtuma.tyyppi === 'tila') {
    const seuraava = { ...tilat };
    for (const kanavaId of tapahtuma.kanavaIdt) delete seuraava[kanavaId];
    for (const t of tapahtuma.tilat) {
      seuraava[t.kanavaId] = { kayttaja: t.kayttaja, mina: t.kayttaja === omaKayttaja };
    }
    return seuraava;
  }

  if (tapahtuma.tyyppi === 'myonnetty') {
    return {
      ...tilat,
      [tapahtuma.kanavaId]: { kayttaja: tapahtuma.kayttaja, mina: tapahtuma.kayttaja === omaKayttaja },
    };
  }

  // 'vapautui'
  if (!(tapahtuma.kanavaId in tilat)) return tilat;
  const seuraava = { ...tilat };
  delete seuraava[tapahtuma.kanavaId];
  return seuraava;
}
