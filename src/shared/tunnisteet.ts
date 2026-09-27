// Henkilön pysyvä tunnistenumero (#1000 →). Jaettu EVENT- ja GUARD-puolen kesken, koska
// molemmat käyttävät samaa työntekijäpankkia: sama henkilö on sama #-numero kummallakin
// puolella, eikä numeroa saa antaa kahdesti.

// Tunnistenumerot alkavat #1000:sta. Numero on henkilön PYSYVÄ tunniste: se annetaan
// työntekijäpankissa kerran eikä sitä muuteta, koska tallennetut raportit viittaavat
// siihen kirjaajatiedossaan ("Ensiapu 1 #1028").
export const TUNNISTE_ALKU = 1000;

// Seuraava vapaa tunnistenumero. Otetaan suurin käytössä oleva + 1 sekä työntekijöistä
// ETTÄ käyttäjätunnuksista: pelkkä työntekijälista ei riitä, koska työntekijän poisto
// vapauttaisi hänen numeronsa uudelleenkäyttöön ja kaksi eri henkilöä päätyisi samaan
// numeroon jo tallennetuissa raporteissa.
export const seuraavaTunnisteNumero = (tyontekijat: any[] = [], kayttajat: any[] = []) => {
  const numerot = [
    ...tyontekijat.map((e) => e?.displayId),
    ...kayttajat.map((u) => u?.displayId),
  ]
    .map((n) => parseInt(String(n ?? ''), 10))
    .filter((n) => Number.isFinite(n));
  return (numerot.length ? Math.max(...numerot) : TUNNISTE_ALKU - 1) + 1;
};

export const muotoileTunniste = (numero?: number | null) => (numero ? `#${numero}` : '');

// Täydentää puuttuvat tunnistenumerot juoksevasti. Ennen tätä ominaisuutta tallennetuilla
// työntekijöillä ei ole numeroa lainkaan, ja numero on pakollinen jotta kirjaaja voidaan
// yksilöidä raporteissa. Jo annettuun numeroon ei kosketa koskaan.
export const taydennaTunnisteet = (tyontekijat: any) => {
  if (!Array.isArray(tyontekijat)) return tyontekijat;
  let seuraava = seuraavaTunnisteNumero(tyontekijat);
  return tyontekijat.map((e) => {
    const nykyinen = parseInt(String(e?.displayId ?? ''), 10);
    if (Number.isFinite(nykyinen)) return e;
    return { ...e, displayId: seuraava++ };
  });
};

// Palvelin on numeroiden omistaja (server/tunnistenumerot.js) ja palauttaa tallennuksen
// vastauksessa korjaamansa numerot muodossa { tietueenId: numero }. Selaimen oma arvaus
// voi olla väärä, koska se ei näe poistettujen henkilöiden numeroita.
export const kaytaKorjatutTunnisteet = <T extends { id?: string; displayId?: any }>(
  lista: T[],
  korjatut: Record<string, number> | null | undefined,
): T[] => {
  if (!korjatut || Object.keys(korjatut).length === 0) return lista;
  return lista.map((t) => (t.id && korjatut[t.id] !== undefined ? { ...t, displayId: korjatut[t.id] } : t));
};
