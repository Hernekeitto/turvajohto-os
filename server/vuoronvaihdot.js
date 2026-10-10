// Vuoronvaihdot (erä 6, 10.10.2026).
//
// Vartija tarjoaa omaa julkaistua vuoroaan kollegalle. Vaihto etenee kolmessa vaiheessa,
// koska kolme eri ihmistä vastaa eri asiasta:
//
//   1. antaja pyytää      "minä en pääse, Virtanen voisi tehdä"
//   2. saaja hyväksyy     ilman tätä vuoro siirtyisi ihmiselle joka ei tiedä siitä
//   3. suunnittelija      tarkistaa ja vahvistaa: vaihto on listan muutos, ja listasta
//      vahvistaa         vastaa työnantaja (TES 10 §)
//
// Vahvistuksessa sijoitus tehdään samalla tarkistuksella kuin mikä tahansa listan muutos
// (tyovuorolistat.js: sijoita). Jos saajalle syntyy TES-poikkeama, suunnittelija kirjaa
// sille syyn vahvistaessaan — saaja ei voi kuitata poikkeamaa itselleen.
//
// Vaihto on yksisuuntainen luovutus. Kahden vuoron vaihto tehdään kahtena pyyntönä:
// kumpikin on oma muutoksensa ja tarkistetaan erikseen.
//
// Samaan tapaan kuin muut sääntömoduulit: ei levyä, ei Expressiä.

export const TILAT = {
  odottaa_saajaa: 'Odottaa kollegan vastausta',
  odottaa_suunnittelijaa: 'Odottaa vuorosuunnittelijaa',
  hyvaksytty: 'Hyväksytty',
  hylatty: 'Hylätty',
  peruttu: 'Peruttu',
};

const AVOIMET = new Set(['odottaa_saajaa', 'odottaa_suunnittelijaa']);
const VIESTIN_MAX = 300;

export const onAvoin = (v) => AVOIMET.has(v?.tila);

const tapahtuma = (nyt, kuka, mita, viesti) => ({ aika: nyt.toISOString(), kuka, mita, ...(viesti ? { viesti } : {}) });

/**
 * Uusi pyyntö. `vuoro` on antajan julkaistu sijoitus ({ vuoroId, listanAlku, alkaa }).
 * Palauttaa { ok, vaihto } tai { ok: false, error }.
 */
export function pyydaVaihto({ vaihdot, vuoro, antaja, saaja, viesti, nytPaikallinen, nyt = new Date(), id }) {
  if (!vuoro) return { ok: false, error: 'Vuoroa ei löytynyt omista julkaistuista vuoroistasi.' };
  if (!saaja || saaja === antaja) return { ok: false, error: 'Valitse kollega jolle vuoro siirtyy.' };
  if (vuoro.alkaa <= nytPaikallinen) return { ok: false, error: 'Alkanutta vuoroa ei voi vaihtaa.' };
  if ((vaihdot || []).some((v) => v.vuoroId === vuoro.vuoroId && onAvoin(v))) {
    return { ok: false, error: 'Vuorolle on jo avoin vaihtopyyntö.' };
  }
  const teksti = typeof viesti === 'string' ? viesti.trim() : '';
  if (teksti.length > VIESTIN_MAX) return { ok: false, error: `Viesti on liian pitkä (enintään ${VIESTIN_MAX} merkkiä).` };
  return {
    ok: true,
    vaihto: {
      id,
      vuoroId: vuoro.vuoroId,
      listanAlku: vuoro.listanAlku,
      alkaa: vuoro.alkaa,
      antaja,
      saaja,
      ...(teksti ? { viesti: teksti } : {}),
      tila: 'odottaa_saajaa',
      historia: [tapahtuma(nyt, antaja, 'pyydetty', teksti)],
    },
  };
}

/** Saajan vastaus. */
export function vastaaVaihtoon({ vaihto, kuka, hyvaksy, nytPaikallinen, nyt = new Date() }) {
  if (vaihto?.saaja !== kuka) return { ok: false, status: 403, error: 'Pyyntö ei ole sinulle.' };
  if (vaihto.tila !== 'odottaa_saajaa') return { ok: false, status: 409, error: 'Pyyntöön on jo vastattu.' };
  if (vaihto.alkaa <= nytPaikallinen) return { ok: false, status: 409, error: 'Vuoro on jo alkanut.' };
  return {
    ok: true,
    vaihto: {
      ...vaihto,
      tila: hyvaksy ? 'odottaa_suunnittelijaa' : 'hylatty',
      historia: [...vaihto.historia, tapahtuma(nyt, kuka, hyvaksy ? 'saaja_hyvaksyi' : 'saaja_hylkasi')],
    },
  };
}

/** Antaja perii pyynnön, kunhan sitä ei ole vielä ratkaistu. */
export function peruVaihto({ vaihto, kuka, nyt = new Date() }) {
  if (vaihto?.antaja !== kuka) return { ok: false, status: 403, error: 'Vain pyytäjä voi perua pyynnön.' };
  if (!onAvoin(vaihto)) return { ok: false, status: 409, error: 'Pyyntö on jo ratkaistu.' };
  return { ok: true, vaihto: { ...vaihto, tila: 'peruttu', historia: [...vaihto.historia, tapahtuma(nyt, kuka, 'peruttu')] } };
}

/**
 * Suunnittelijan ratkaisu. Hyväksyntä merkitään vasta kun sijoitus on onnistunut —
 * kutsuja tekee sijoituksen ja kutsuu tätä tuloksen kanssa. Siksi `hyvaksy` tarkoittaa
 * "sijoitus tehtiin", eikä tämä funktio itse koske listaan.
 */
export function ratkaiseVaihto({ vaihto, kuka, hyvaksy, perustelu, nyt = new Date() }) {
  if (vaihto?.tila !== 'odottaa_suunnittelijaa') return { ok: false, status: 409, error: 'Pyyntö ei odota vahvistusta.' };
  const teksti = typeof perustelu === 'string' ? perustelu.trim() : '';
  return {
    ok: true,
    vaihto: {
      ...vaihto,
      tila: hyvaksy ? 'hyvaksytty' : 'hylatty',
      historia: [...vaihto.historia, tapahtuma(nyt, kuka, hyvaksy ? 'vahvistettu' : 'suunnittelija_hylkasi', teksti)],
    },
  };
}

/**
 * Vanhentuneet pyynnöt: avoin pyyntö jonka vuoro on jo alkanut, tai jonka vuoro ei enää
 * ole antajalla (suunnittelija muutti listaa välissä). Ne suljetaan, jottei kenellekään
 * jää kuittaamatonta pyyntöä vuorosta jota ei voi enää vaihtaa.
 */
export function suljeVanhentuneet(vaihdot, { nytPaikallinen, omistaja, nyt = new Date() }) {
  let muuttui = false;
  const tulos = (vaihdot || []).map((v) => {
    if (!onAvoin(v)) return v;
    const syy = v.alkaa <= nytPaikallinen ? 'vuoro_alkoi'
      : omistaja(v.vuoroId) !== v.antaja ? 'lista_muuttui' : null;
    if (!syy) return v;
    muuttui = true;
    return { ...v, tila: 'peruttu', historia: [...v.historia, tapahtuma(nyt, 'järjestelmä', syy)] };
  });
  return { muuttui, vaihdot: tulos };
}
