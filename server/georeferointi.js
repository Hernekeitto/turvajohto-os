// Pohjakartan georeferointi palvelimella: GPS-sijainnista kohta kuvalla.
//
// --- MIKSI TÄMÄ ON KAKSOISKAPPALE ---------------------------------------------------
//
// Sama laskenta on `src/shared/georeferointi.ts`:ssä, ja se on siellä siksi että selain
// piirtää vartijan kartalle. Tämä on kolmas tietoinen kaksoiskappale samassa perheessä
// (`geofence.js`:n `pisteVyohykkeessa` on toinen), ja syy on joka kerta sama: palvelin on
// JS ja front TypeScript-käännöksen takana, eikä niillä ole yhteistä moduulia.
//
// Kaksoiskappale on paras huono vaihtoehto, ja kolme muuta punnittiin:
//
//   Natiivi laskisi itse — kolmas toteutus, ja kalibrointi olisi vietävä laitteelle.
//   Natiivi lähettäisi vain GPS:n ja web täydentäisi — silloin vyöhykesääntö vaatisi
//     sovelluksen olevan auki, mikä on täsmälleen se asia jota erä 11 poistaa.
//   Vyöhykkeet GPS-muotoon — oikeampi pitkällä tähtäimellä, mutta se muuttaa
//     vyöhykkeiden tietomallin ja käyttöliittymän, eikä se ole tämän erän kokoinen työ.
//
// --- MIKSI PALVELIN LASKEE TÄMÄN ----------------------------------------------------
//
// Natiivisovellus lähettää pelkän GPS:n. `geofence.js`:n arviointi vaatii KUVAkoordinaatin,
// koska vyöhykkeet on piirretty pohjakuvalle — ilman tätä moduulia natiivin lähettämä
// sijainti ei laukaisisi vyöhykepoikkeamaa koskaan, tarkkuudesta riippumatta. Mitattu
// 11.9.2026: vartija näkyi kartalla mutta vyöhykesäännöt eivät heränneet.
//
// Muutos on portti eikä uudelleenkirjoitus: kentät, rajatapaukset ja kommenttien
// perustelut on pidetty samoina, jotta kaksi toteutusta on verrattavissa rivi riviltä.

// Metriä per aste. Leveyspiirillä vakio; pituuspiirillä kapenee navoille päin, joten se
// kerrotaan kalibrointialueen leveysasteen kosinilla. Kohde on korkeintaan kilometrejä,
// joten tasokarttana käsittely riittää — karttaprojektiota ei tarvita.
const METRIA_PER_ASTE_LAT = 110540;
const METRIA_PER_ASTE_LON = 111320;

// GPS metreiksi suhteessa origoon. x kasvaa itään, y POHJOISEEN.
const metreiksi = (gps, origo) => ({
  x: (gps.lon - origo.lon) * METRIA_PER_ASTE_LON * Math.cos((origo.lat * Math.PI) / 180),
  y: (gps.lat - origo.lat) * METRIA_PER_ASTE_LAT,
});

// Kolmen pisteen affiini sovitus. Ratkaistaan kertoimet a–f yhtälöistä
//   ix = a·mx + b·my + c
//   iy = d·mx + e·my + f
// jossa mx,my ovat metrejä origosta. Kaksi 3×3-yhtälöryhmää, sama determinantti.
function affiini(pisteet) {
  const origo = pisteet[0].gps;
  const m = pisteet.map((p) => metreiksi(p.gps, origo));

  const det =
    m[0].x * (m[1].y - m[2].y) - m[0].y * (m[1].x - m[2].x) + (m[1].x * m[2].y - m[2].x * m[1].y);

  // Determinantti on kaksi kertaa kolmion pinta-ala, ja koordinaatit ovat METREJÄ —
  // joten kiinteä raja olisi väärä: sadan metrin kolmiolla determinantti on
  // kymmenintuhansia, senttimetrien kolmiolla murto-osia. Raja suhteutetaan kolmion
  // kokoon.
  //
  // Tämä hylkää kaksi virhettä kerralla: pisteet samalla suoralla (ei kerro mitään
  // poikittaisesta suunnasta) ja pisteet liian lähellä toisiaan (pieni mittausvirhe
  // kertautuisi kartan toisessa laidassa metreiksi).
  const sivu1 = Math.hypot(m[1].x - m[0].x, m[1].y - m[0].y);
  const sivu2 = Math.hypot(m[2].x - m[0].x, m[2].y - m[0].y);
  const mittakaava = Math.max(sivu1, sivu2);
  if (mittakaava < 1 || Math.abs(det) < 1e-6 * mittakaava * mittakaava) return null;

  const ratkaise = (arvot) => {
    const da =
      arvot[0] * (m[1].y - m[2].y) - m[0].y * (arvot[1] - arvot[2]) + (arvot[1] * m[2].y - arvot[2] * m[1].y);
    const db =
      m[0].x * (arvot[1] - arvot[2]) - arvot[0] * (m[1].x - m[2].x) + (m[1].x * arvot[2] - m[2].x * arvot[1]);
    const dc =
      m[0].x * (m[1].y * arvot[2] - m[2].y * arvot[1]) -
      m[0].y * (m[1].x * arvot[2] - m[2].x * arvot[1]) +
      arvot[0] * (m[1].x * m[2].y - m[2].x * m[1].y);
    return [da / det, db / det, dc / det];
  };

  const [a, b, c] = ratkaise(pisteet.map((p) => p.img.x));
  const [d, e, f] = ratkaise(pisteet.map((p) => p.img.y));

  return (gps) => {
    const p = metreiksi(gps, origo);
    return { x: a * p.x + b * p.y + c, y: d * p.x + e * p.y + f };
  };
}

// Kahden pisteen akselinsuuntainen sovitus. Oletus: kartta on pohjoinen ylöspäin.
function akselinsuuntainen(pisteet) {
  const [p1, p2] = pisteet;
  const dLon = p2.gps.lon - p1.gps.lon;
  const dLat = p2.gps.lat - p1.gps.lat;
  // Pisteet eivät saa olla samalla pituus- tai leveyspiirillä: silloin toiselle akselille
  // ei saada mittakaavaa lainkaan.
  if (Math.abs(dLon) < 1e-9 || Math.abs(dLat) < 1e-9) return null;

  const kx = (p2.img.x - p1.img.x) / dLon;
  const ky = (p2.img.y - p1.img.y) / dLat;

  return (gps) => ({
    x: p1.img.x + (gps.lon - p1.gps.lon) * kx,
    y: p1.img.y + (gps.lat - p1.gps.lat) * ky,
  });
}

/**
 * Rakentaa muunnoksen kalibrointipisteistä. Palauttaa nullin jos pisteitä on liian vähän
 * tai ne ovat sellaisessa asennossa ettei muunnosta voi määrittää.
 *
 * Kaksi pistettä riittää kun kartta on pohjoinen ylöspäin; kierretty kartta vaatii kolme.
 * Kahdella saa joko kierron tai akselikohtaiset mittakaavat, ei kumpaakin — ja arvaus
 * näkyisi siinä että vartija on kartalla väärässä kohdassa mutta uskottavalta näyttäen.
 */
export function luoMuunnos(pisteet) {
  const kelvolliset = (Array.isArray(pisteet) ? pisteet : []).filter(
    (p) =>
      p && p.img && p.gps &&
      Number.isFinite(p.img.x) && Number.isFinite(p.img.y) &&
      Number.isFinite(p.gps.lat) && Number.isFinite(p.gps.lon)
  );
  if (kelvolliset.length >= 3) return affiini(kelvolliset.slice(0, 3));
  if (kelvolliset.length === 2) return akselinsuuntainen(kelvolliset);
  return null;
}

/**
 * Täydentää sijaintiviestiin kuvakoordinaatin, jos se puuttuu ja kalibrointi sallii sen.
 *
 * <p>Palauttaa viestin sellaisenaan kun mitään ei ole tehtävissä: selaimen lähettämässä
 * viestissä `img` on jo mukana, kalibroimattomalla kohteella muunnosta ei ole, eikä
 * puuttuva GPS voi tuottaa mitään. Yksikään näistä ei ole virhe.
 *
 * <p>Kuvan ULKOPUOLELLE osuvaa pistettä ei suodateta täällä. Vartija voi olla kohteen
 * ulkopuolella, ja `geofence.js` päättää itse mitä sellaisesta seuraa — suodatus tässä
 * olisi toinen sääntö toisessa paikassa, ja juuri sitä tämä perhe välttää.
 */
export function taydennaKuvakoordinaatti(viesti, kalibrointi) {
  if (!viesti || viesti.img || !viesti.gps) return viesti;
  const muunna = luoMuunnos(kalibrointi);
  if (!muunna) return viesti;
  const img = muunna(viesti.gps);
  if (!img || !Number.isFinite(img.x) || !Number.isFinite(img.y)) return viesti;
  return { ...viesti, img };
}
