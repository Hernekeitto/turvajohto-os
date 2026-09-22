// PTT-kanavan sisällön siivous kun kanava purkautuu (erä 26, vaihe 8: kovennus —
// Obsidian "vaihe 8 -suunnitelma" kohta 4, "vaihe 3 -suunnitelma" kohta 7, joka oli
// toteuttamatta: kanavan sisältö näytettiin käyttäjälle ephemeraalina
// ("Tämä keskustelu poistuu vuoron päätyttyä" — KanavaViestit.tsx) mutta mikään ei
// koskaan poistanut sitä).
//
// KUTSUTAAN TÄSMÄLLEEN SILLÄ HETKELLÄ KUN guardKanavat-TIETUE ITSE POISTETAAN
// (hätäkanavan ratkaisu: server/kanavat.js: hataKanavaPurkautunut; DM:n purkautuminen:
// dmPurkautunut) — EI erillisellä ajastimella. Molemmilla on jo yksikäsitteinen,
// koskaan-uudelleenkäyttämätön kanava-id (hata:<halytysId>, DM:n crypto.randomUUID()),
// joten siivous ei voi koskaan osua väärään, yhä voimassa olevaan kanavaan.
//
// KIINTEÄ (kohde/piiri) KANAVA EI KUULU TÄMÄN — poistaKanavanSisalto-FUNKTION —
// PIIRIIN: sillä ei ole persistoitua kanavatietuetta ollenkaan (jäsenyys lasketaan aina
// uudelleen kesken olevasta vuorosta, kanavat.js:n yläkommentti), joten sillä ei ole
// "purkautumishetkeä" johon TÄMÄNTAPAINEN välitön siivous voisi kiinnittyä — sama
// kohdekanava palvelee jokaista vuoroa sen kohteen historiassa. Sillä ON silti oma
// siivousmekanisminsa, katso {@link poistaVanhaKiinteanKanavanSisalto} alempana:
// AIKAPERUSTEINEN eikä tapahtumapohjainen, käyttäjän päätös 22.9.2026.
//
// VAPAA RYHMÄ EI KUULU KUMPAANKAAN funktioon, tarkoituksella: se ei ole sidottu vuoroon
// eikä hälytykseen — sen poisto on aina käsin tehty hallinnollinen päätös
// (DELETE /api/kanavat/vapaa/:id), eikä mikään automaattinen tapahtuma eikä ikä koskaan
// tee siitä "purkautunutta". Automaattinen sisällön poisto olisi lupaus jota
// käyttöliittymän ephemeral-muistutus ei anna.
//
// Säännöt ovat täällä, levy-I/O (mukaan lukien liitetiedostojen poisto levyltä) on
// kutsujassa (server/index.js: siivoaKanavanSisalto, siivoaKiinteidenKanavienSisalto)
// — sama jako kuin muuallakin (viestit.js, kuittaukset.js, salatutliitteet.js).

/**
 * Palauttaa kolme kokoelmaa ilman annetun kanavan sisältöä, plus poistettujen
 * liitteiden id:t (kutsuja poistaa niiden tiedostot levyltä — tämä funktio ei koske
 * levyä eikä siis tiedä onnistuiko poisto, vain MITÄ pitää poistaa).
 */
export function poistaKanavanSisalto({ viestit, kuittaukset, liitteet }, kanavaId) {
  const poistettavatViestit = (viestit || []).filter((v) => v?.kanavaId === kanavaId);
  const poistettavatLiitteet = (liitteet || []).filter((l) => l?.kanavaId === kanavaId);
  return {
    viestit: (viestit || []).filter((v) => v?.kanavaId !== kanavaId),
    // Kuittaukset kantavat kanavaId:n suoraan (server/index.js: luoKuittaus) — ei
    // tarvitse päätellä viestiId:n kautta.
    kuittaukset: (kuittaukset || []).filter((k) => k?.kanavaId !== kanavaId),
    liitteet: (liitteet || []).filter((l) => l?.kanavaId !== kanavaId),
    poistettuja: {
      viestit: poistettavatViestit.length,
      liitteet: poistettavatLiitteet.length,
    },
    liiteIdt: poistettavatLiitteet.map((l) => l.id),
  };
}

/**
 * Kiinteiden kanavien (kohde/piiri) sisällön ikäraja (erä 26, vaihe 8, käyttäjän
 * päätös 22.9.2026: "aikaperusteinen 24h jos vuoroa ei ole lopetettu ennen sitä").
 * Näillä ei ole persistoitua kanavatietuetta eikä siis purkautumishetkeä (ks. tiedoston
 * yläkommentti) — tämä on niiden AINOA siivousmekanismi, kutsutaan ajastimesta
 * (server/index.js) eikä jonkin yksittäisen tapahtuman yhteydestä.
 *
 * `raja` on aikaleima (ms, Date.now()-muodossa): kaikki tätä VANHEMMAT poistetaan.
 * Kutsuja laskee sen (nyt - ikäraja) — tämä funktio ei tiedä kellonaikaa eikä
 * ikärajan pituutta, sama jako kuin muuallakin (esim. sijaintiloki.js: harvenna).
 *
 * Kuittaukset poistetaan VIESTI-ID:N KAUTTA eikä oman ikänsä perusteella — orpo
 * kuittaus (viesti jo poistettu mutta kuittaus ei) olisi tarpeetonta dataa
 * riippumatta kuittauksen omasta iästä.
 */
export function poistaVanhaKiinteanKanavanSisalto({ viestit, kuittaukset, liitteet }, raja) {
  const onKiintea = (kanavaId) => typeof kanavaId === 'string'
    && (kanavaId.startsWith('kohde:') || kanavaId.startsWith('piiri:'));
  const vanha = (luotu) => new Date(luotu).getTime() < raja;

  const poistettavatViestit = (viestit || []).filter((v) => onKiintea(v?.kanavaId) && vanha(v?.luotu));
  const poistettavatViestiIdt = new Set(poistettavatViestit.map((v) => v.id));
  const poistettavatLiitteet = (liitteet || []).filter((l) => onKiintea(l?.kanavaId) && vanha(l?.luotu));
  const poistettavatLiiteIdt = new Set(poistettavatLiitteet.map((l) => l.id));

  return {
    viestit: (viestit || []).filter((v) => !poistettavatViestiIdt.has(v.id)),
    kuittaukset: (kuittaukset || []).filter((k) => !poistettavatViestiIdt.has(k?.viestiId)),
    liitteet: (liitteet || []).filter((l) => !poistettavatLiiteIdt.has(l.id)),
    poistettuja: {
      viestit: poistettavatViestit.length,
      liitteet: poistettavatLiitteet.length,
    },
    liiteIdt: poistettavatLiitteet.map((l) => l.id),
  };
}
