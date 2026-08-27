import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Juuripolku. Oli aiemmin '/turvajohto-os/' GitHub Pages -esikatselua varten, ja
  // palvelimen deploy-hook korjasi arvon '/':ksi joka julkaisussa erikseen. Nyt kun
  // sovellus jakautuu polkuihin /event ja /guard, etuliitteen on oltava sama sekä
  // repossa että palvelimella — muuten tuotepolut osuvat väärään paikkaan.
  base: '/',
  plugins: [react()],
})
