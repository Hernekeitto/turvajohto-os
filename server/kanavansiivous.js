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
// KIINTEÄT (kohde/piiri) JA VAPAA RYHMÄ EIVÄT KUULU TÄMÄN PIIRIIN, tarkoituksella:
//   - Kiinteällä kanavalla ei ole persistoitua kanavatietuetta ollenkaan — jäsenyys
//     lasketaan aina uudelleen kesken olevasta vuorosta (kanavat.js:n yläkommentti),
//     joten sillä ei ole "purkautumishetkeä" johon siivous voisi kiinnittyä. Sama
//     kohdekanava palvelee jokaista vuoroa sen kohteen historiassa.
//   - Vapaa ryhmä ei ole sidottu vuoroon eikä hälytykseen — sen poisto on aina käsin
//     tehty hallinnollinen päätös (DELETE /api/kanavat/vapaa/:id), eikä mikään
//     automaattinen tapahtuma koskaan tee siitä "purkautunutta". Automaattinen
//     sisällön poisto olisi lupaus jota käyttöliittymän ephemeral-muistutus ei anna.
//
// Säännöt ovat täällä, levy-I/O (mukaan lukien liitetiedostojen poisto levyltä) on
// kutsujassa (server/index.js: siivoaKanavanSisalto) — sama jako kuin muuallakin
// (viestit.js, kuittaukset.js, salatutliitteet.js).

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
