import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { TURVAOTSAKKEET } from './csp.ts'

// Palvelutyöntekijän kokoaminen (erä 6, perusta P7).
//
// Vite antaa nipuille sisällön mukaiset nimet, joten välimuistiin tallennettavien
// tiedostojen lista tiedetään vasta buildissa. Tämä lisäosa kirjoittaa listan ja
// version sw-pohja.js:ään ja tuottaa dist/sw.js.
//
// VERSIO on tiedostonimien tiiviste eikä aikaleima. Se tarkoittaa, että kaksi peräkkäistä
// buildia ilman koodimuutoksia tuottavat saman version — käyttäjälle ei siis näytetä
// päivityskehotusta silloin kun mikään ei oikeasti muuttunut.
function palvelutyontekija(): Plugin {
  return {
    name: 'turvajohto-palvelutyontekija',
    // Vain tuotantobuildiin: kehityksessä palvelutyöntekijä tarjoilisi vanhaa nippua ja
    // rikkoisi Viten kuumavaihdon.
    apply: 'build',
    generateBundle(_asetukset, nippu) {
      const tiedostot = ['/index.html', ...Object.keys(nippu).map((nimi) => `/${nimi}`)]
        // jako.html ja ilmoitus.html ovat julkisia sivuja jotka avataan linkistä tai
        // QR-koodista, eivätkä ne kuulu sovellusrunkoon. Kuvakkeet kuuluvat.
        .filter((polku) => !polku.endsWith('jako.html') && !polku.endsWith('ilmoitus.html'))
        .sort()

      const versio = createHash('sha256').update(tiedostot.join('|')).digest('hex').slice(0, 12)
      const pohja = readFileSync(new URL('./sw-pohja.js', import.meta.url), 'utf8')

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: pohja
          .replace('__VERSIO__', versio)
          .replace('__TIEDOSTOT__', JSON.stringify(tiedostot, null, 2)),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Juuripolku. Oli aiemmin '/turvajohto-os/' GitHub Pages -esikatselua varten, ja
  // palvelimen deploy-hook korjasi arvon '/':ksi joka julkaisussa erikseen. Nyt kun
  // sovellus jakautuu polkuihin /event ja /guard, etuliitteen on oltava sama sekä
  // repossa että palvelimella — muuten tuotepolut osuvat väärään paikkaan.
  base: '/',
  plugins: [react(), palvelutyontekija()],
  // Samat turvaotsakkeet kuin tuotannon nginxissä (ks. csp.js). Ilman näitä CSP-rikkomus
  // — estetty tyyli, skripti tai yhteys — näkyisi vasta tuotannossa, ja siellä se näkyy
  // hiljaisena: mitään ei kaadu, jokin vain jää tekemättä.
  server: { headers: TURVAOTSAKKEET },
  preview: { headers: TURVAOTSAKKEET },
})
