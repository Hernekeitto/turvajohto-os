// Karttadatan osoitteet — OMASSA TIEDOSTOSSAAN, ILMAN SIVUVAIKUTUKSIA.
//
// Nämä vakiot olivat aluksi lataa.ts:ssä kirjaston latauksen seurana. Se teki
// karttatyylistä testaamattoman: tyyli tuo osoitteet, lataa.ts tuo maplibren CSS:n ja
// työntekijätiedoston `?url`-liitteellä, ja kumpaakaan ei voi ratkaista `node --test`
// -ajossa. Tyylin tarkistaminen olisi siis vaatinut selaimen — juuri sen ympäristön
// jossa virheen huomaa vasta siitä ettei kartalla näy mitään.
//
// Tässä tiedostossa on vain merkkijonoja. Sen saa tuoda mistä tahansa.

// Tiilipaketin osoite.
//
// TIEDOSTONIMESSÄ ON PLANEETTABUILDIN PÄIVÄMÄÄRÄ, ja sen on vastattava sitä nimeä jonka
// `asennus/tiilet.sh` tuotti palvelimelle (`suomi-<pvm>.pmtiles`). Nimi on osa sopimusta
// eikä yksityiskohta: nginx tarjoilee tiedoston `immutable`-otsakkeella, koska sisältö ei
// koskaan muutu tämän nimen alla. Uusi tiilipaketti on siis uusi nimi ja tämän rivin
// muutos — ei välimuistin tyhjennystä, ei "päivitä ja toivo".
//
// Jos tämä ja palvelimen tiedostonimi erkanevat, kartta jää tyhjäksi ja verkkovälilehti
// näyttää 404:n — se on ikävä mutta äänekäs vika, ja se on tarkoituksella parempi kuin
// hiljainen vanhan paketin tarjoilu.
//
// Ympäristömuuttuja on kehitystä varten: `VITE_TIILET=http://…` osoittaa toiseen
// pakettiin ilman koodimuutosta.
//
// `?.` EI OLE VAROVAISUUTTA: `import.meta.env` on Viten lisäämä eikä sitä ole olemassa
// kun tämä moduuli ajetaan testissä suoraan Nodella. Ilman sitä testi kaatuisi tuontiin.
export const TIILET =
  (import.meta.env?.VITE_TIILET as string | undefined) || '/tiilet/suomi-20260914.pmtiles';

// Kirjasinatlasten hakemisto.
//
// Sama sopimus kuin tiilipaketilla ja samasta syystä: nimessä on satsin päivä, nginx
// tarjoilee polun `immutable`-otsakkeella, ja uusi satsi on uusi nimi. Hakemisto on
// tiilipaketin vieressä, joten nginxiin ei tarvittu omaa lohkoa — `location /tiilet/`
// kattaa alihakemistot.
//
// Tuottaa `asennus/kirjasimet.sh`, ja SE ON AJETTAVA ENNEN TÄMÄN JULKAISUA. Väärässä
// järjestyksessä kartta latautuu normaalisti mutta jokainen tekstitaso hakee 404:n:
// nimiä ei näy, ja ainoa vihje on konsolin virhevirta.
export const KIRJASIMET =
  (import.meta.env?.VITE_KIRJASIMET as string | undefined) || '/tiilet/kirjasimet-20260916';
