// PTT-kanavan viestinäkymän puhdas logiikka (erä 26, vaihe 5, viipale 5b).
//
// Yhdistää palvelimelta haetut (ja jo puretut) viestit paikallisessa lähetysjonossa
// (src/shared/viestijono.ts) vielä odottaviin — käyttöliittymän on näytettävä molemmat
// samassa aikajärjestyksessä ("lähetetään…" -rivit oikealla kohdallaan), muuten
// keskustelu näyttäisi hyppivän kun jonorivi vaihtuu lähetetyksi viestiksi.

import type { Kuittaus, Viesti } from '../../shared/viestit.ts';
import type { JonoRivi } from '../../shared/viestijono.ts';
import type { Liiteosoitin } from '../../shared/salatutliitteet.ts';
import type { KanavaTyyppi } from './kanavapalkki.ts';

export type NaytettavaViesti =
  | { tila: 'lahetetty'; viesti: Viesti }
  | { tila: 'jonossa'; jonoId: string; teksti: string; luotu: number };

/** Palvelimelta haetut viestit ja tämän kanavan jonossa olevat, aikajärjestyksessä. */
export function yhdistaViestit(viestit: Viesti[], jono: JonoRivi[], kanavaId: string): NaytettavaViesti[] {
  const lahetetyt: NaytettavaViesti[] = viestit.map((viesti) => ({ tila: 'lahetetty', viesti }));
  const jonossa: NaytettavaViesti[] = jono
    .filter((r) => r.kanavaId === kanavaId)
    .map((r) => ({ tila: 'jonossa', jonoId: r.id, teksti: r.teksti, luotu: r.luotu }));
  return [...lahetetyt, ...jonossa].sort((a, b) => aikaleima(a) - aikaleima(b));
}

function aikaleima(n: NaytettavaViesti): number {
  return n.tila === 'lahetetty' ? new Date(n.viesti.luotu).getTime() : n.luotu;
}

export type Kuittaustiivistelma = { toimitettu: number; luettu: number | null };

/**
 * Kuittausten yhteenveto näyttöä varten. `luettu` on null tyypeille joilla lukukuittaus
 * ei ole edes mahdollinen (server/kuittaukset.js: sallitutKuittaustyypit) — käyttöliittymän
 * on eroteltava "ei vielä luettu" ja "lukukuittausta ei ole tällä kanavalla lainkaan".
 */
export function kuittaustiivistelma(kuittaukset: Kuittaus[], kanavaTyyppi: KanavaTyyppi): Kuittaustiivistelma {
  return {
    toimitettu: kuittaukset.filter((k) => k.tyyppi === 'toimitus').length,
    luettu: kanavaTyyppi === 'hata' ? kuittaukset.filter((k) => k.tyyppi === 'luku').length : null,
  };
}

/** Tiedoston MIME-tyypistä liiteosoittimen msgtype — kuva ja video omina, muu tiedostona. */
export function paattelePaattyyppi(mimetype: string): Liiteosoitin['msgtype'] {
  if (mimetype.startsWith('image/')) return 'm.image';
  if (mimetype.startsWith('video/')) return 'm.video';
  return 'm.file';
}

/**
 * Onko sisältö liiteosoitin eikä tekstiviesti — kutsuja käyttää tätä päättämään
 * näytetäänkö kuva/video/tiedosto vai pelkkä teksti. Ei luota sisällön tyyppiin
 * sokeasti (sisalto on `unknown`, puretusta salauksesta), tarkistaa oikean kentän.
 */
export function onLiite(sisalto: unknown): sisalto is Liiteosoitin {
  return typeof sisalto === 'object' && sisalto !== null && 'liiteId' in sisalto;
}
