// Kalustopankin testit.
//
// Pankin koko arvo on siinä, että se kertoo TOTUUDEN siitä missä esine on ja kenen
// päätöksellä se sinne päätyi. Testit kohdistuvat niihin siirtymiin joissa totuus voisi
// kadota: kaksi rinnakkaista pyyntöä samaan esineeseen, kadonneen tavaran siirtäminen,
// henkilökohtaisen tunnuksen jättäminen varastoon, aseen kirjaaminen ilman lupatietoja,
// ja tunnisteen uudelleenkäyttö poiston jälkeen.
//
// Ajetaan: node --test server/kalusto.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LAJIT, seuraavaNumero, muotoileTunnus, luoKalusto, paivitaTiedot, siirra,
  pyydaKalustoa, peruPyynto, ratkaisePyynto, merkitseKadonneeksi, merkitseHuoltoon,
  palautaKayttoon, poistaKaytosta, avoimetPyynnot, kadonneet, sijoitetut,
} from './kalusto.js';

const T0 = Date.parse('2026-09-14T09:00:00Z');

const luo = (yli = {}) => luoKalusto({
  id: 'k1', laji: 'asuste', alalaji: 'takki', nimi: 'Talvitakki L',
  kuvaus: '', sarjanumero: '', lisatiedot: {}, sijoitus: { laji: 'varasto' },
  numero: 1, user: 'paakayttaja', nyt: T0, ...yli,
});

const esine = (yli = {}) => luo(yli).esine;

// --- Tunniste ---------------------------------------------------------------------

test('tunniste on lajikohtainen ja juokseva', () => {
  assert.equal(muotoileTunnus('asuste', 1), 'TJ-ASU-0001');
  assert.equal(muotoileTunnus('ase', 117), 'TJ-ASE-0117');
  // Jokaisella lajilla on koodi. Ilman tätä uusi laji tuottaisi tunnuksen TJ-???-0001,
  // ja se painettaisiin kilpimerkkiin.
  for (const laji of Object.keys(LAJIT)) {
    assert.match(muotoileTunnus(laji, 1), /^TJ-[A-Z]{3}-0001$/, laji);
  }
});

test('numerointi jatkuu lajin sisalla eika sekoitu muihin lajeihin', () => {
  const pankki = [
    { tunnus: 'TJ-ASU-0001' }, { tunnus: 'TJ-ASU-0007' }, { tunnus: 'TJ-AVA-0042' },
  ];
  assert.equal(seuraavaNumero(pankki, 'asuste'), 8);
  assert.equal(seuraavaNumero(pankki, 'avain'), 43);
  assert.equal(seuraavaNumero(pankki, 'ase'), 1);
});

test('poistetun tunniste EI vapaudu uudelleenkayttoon', () => {
  // Poistettu esine on yhä rivinä pankissa, ja numerointi lukee sen. Jos numero
  // vapautuisi, kaksi eri esinettä kantaisi samaa kilpimerkkiä — ja vanhempi niistä on
  // jo jonkun taskussa.
  const poistettu = poistaKaytosta({ esine: esine(), user: 'paakayttaja', syy: 'Repesi', nyt: T0 }).esine;
  assert.equal(poistettu.tila, 'poistettu');
  assert.equal(seuraavaNumero([poistettu], 'asuste'), 2);
});

// --- Luonti -----------------------------------------------------------------------

test('esine syntyy varastoon ja historia alkaa luonnista', () => {
  const tulos = luo();
  assert.equal(tulos.ok, true);
  assert.equal(tulos.esine.tunnus, 'TJ-ASU-0001');
  assert.equal(tulos.esine.tila, 'kaytossa');
  assert.equal(tulos.esine.sijoitusLaji, 'varasto');
  assert.equal(tulos.esine.sijoitusId, null);
  assert.equal(tulos.esine.pyynto, null);
  assert.equal(tulos.esine.historia.length, 1);
  assert.equal(tulos.esine.historia[0].tapahtuma, 'luotu');
});

test('tuntematon laji ja nimeton esine eivat synny', () => {
  assert.equal(luo({ laji: 'lentokone' }).ok, false);
  assert.equal(luo({ nimi: ' ' }).ok, false);
});

test('SAANTO 3: ase ei synny ilman sarjanumeroa eika lupanumeroa', () => {
  const ilmanMitaan = luo({ laji: 'ase', nimi: 'Glock 17', sarjanumero: '', lisatiedot: {} });
  assert.equal(ilmanMitaan.ok, false);
  assert.match(ilmanMitaan.error, /sarjanumero/i);

  const ilmanLupaa = luo({ laji: 'ase', nimi: 'Glock 17', sarjanumero: 'ABC123', lisatiedot: {} });
  assert.equal(ilmanLupaa.ok, false);
  assert.match(ilmanLupaa.error, /luvan numero/i);

  const kelpaa = luo({
    laji: 'ase', nimi: 'Glock 17', sarjanumero: 'ABC123',
    lisatiedot: { lupanumero: 'L-2026-77', kaliiperi: '9x19', sailytyspaikka: 'Asekaappi 1' },
  });
  assert.equal(kelpaa.ok, true);
  assert.equal(kelpaa.esine.lisatiedot.lupanumero, 'L-2026-77');
});

test('tuntemattomat lisatiedot pudotetaan ja lajin omat sailyvat', () => {
  const auto = esine({
    laji: 'ajoneuvo', nimi: 'Hiace',
    lisatiedot: { rekisteri: 'ABC-123', merkki: 'Toyota', roskaa: 'x', lupanumero: 'huijaus' },
  });
  assert.equal(auto.lisatiedot.rekisteri, 'ABC-123');
  assert.equal(auto.lisatiedot.roskaa, undefined);
  // Toisen lajin kenttä ei saa livahtaa sisään: ase tunnistetaan lajista eikä kentistä.
  assert.equal(auto.lisatiedot.lupanumero, undefined);
});

// --- Siirto -----------------------------------------------------------------------

test('SAANTO 1: siirto vaihtaa sijoituksen ja jattaa historiarivin', () => {
  const tulos = siirra({
    esine: esine(),
    sijoitus: { laji: 'kohde', id: 'kohde-1', nimi: 'Kauppakeskus' },
    user: 'paakayttaja', huomio: 'Vuoron tarpeisiin', nyt: T0,
  });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.esine.sijoitusLaji, 'kohde');
  assert.equal(tulos.esine.sijoitusId, 'kohde-1');
  assert.equal(tulos.esine.sijoitusNimi, 'Kauppakeskus');
  const viimeisin = tulos.esine.historia.at(-1);
  assert.equal(viimeisin.tapahtuma, 'siirto');
  // Historiarivi kantaa sijoituksen sellaisena kuin se oli. Ilman sitä menneisyys
  // katoaisi kun kohde poistetaan.
  assert.equal(viimeisin.sijoitusNimi, 'Kauppakeskus');
});

test('siirto samaan paikkaan ja itseensa estyy', () => {
  const kohteella = siirra({
    esine: esine(), sijoitus: { laji: 'kohde', id: 'kohde-1', nimi: 'Kauppakeskus' },
    user: 'a', nyt: T0,
  }).esine;
  assert.equal(siirra({
    esine: kohteella, sijoitus: { laji: 'kohde', id: 'kohde-1', nimi: 'Kauppakeskus' },
    user: 'a', nyt: T0,
  }).ok, false);
  assert.equal(siirra({
    esine: kohteella, sijoitus: { laji: 'avainkaappi', id: kohteella.id, nimi: 'Itse' },
    user: 'a', nyt: T0,
  }).ok, false);
});

test('kohdesijoitus ilman kohdetta estyy', () => {
  assert.equal(siirra({
    esine: esine(), sijoitus: { laji: 'kohde', id: '', nimi: 'Kauppakeskus' }, user: 'a', nyt: T0,
  }).ok, false);
});

test('SAANTO 4: henkilokohtainen esine menee vain henkilolle', () => {
  const tunnus = siirra({
    esine: esine({ alalaji: 'tunnus', nimi: 'Vartijan tunnus #1041' }),
    sijoitus: { laji: 'henkilo', id: 'emp-1', nimi: 'Virtanen' }, user: 'a', nyt: T0,
  }).esine;
  const henkilokohtainen = paivitaTiedot({
    esine: tunnus, muutokset: { nimi: tunnus.nimi, lisatiedot: { henkilokohtainen: true } },
    user: 'a', nyt: T0,
  }).esine;
  assert.equal(henkilokohtainen.lisatiedot.henkilokohtainen, true);

  const varastoon = siirra({
    esine: henkilokohtainen, sijoitus: { laji: 'varasto' }, user: 'a', nyt: T0,
  });
  assert.equal(varastoon.ok, false);
  assert.match(varastoon.error, /henkilökohtaise/i);

  const toiselle = siirra({
    esine: henkilokohtainen, sijoitus: { laji: 'henkilo', id: 'emp-2', nimi: 'Korhonen' },
    user: 'a', nyt: T0,
  });
  assert.equal(toiselle.ok, true);
});

test('henkilokohtaiseksi ei voi merkita varastossa olevaa esinetta', () => {
  const tulos = paivitaTiedot({
    esine: esine(), muutokset: { nimi: 'Takki', lisatiedot: { henkilokohtainen: true } },
    user: 'a', nyt: T0,
  });
  assert.equal(tulos.ok, false);
});

// --- Pyyntö ja ratkaisu -----------------------------------------------------------

const pyydetty = (yli = {}) => pyydaKalustoa({
  esine: esine(), id: 'p1', pyytaja: 'esimies',
  kohde: { id: 'kohde-1', nimi: 'Kauppakeskus' }, perustelu: 'Yovuoroon tarvitaan takki',
  nyt: T0, ...yli,
}).esine;

test('pyynto kirjautuu esineeseen ja historiaan', () => {
  const p = pyydetty();
  assert.equal(p.pyynto.pyytaja, 'esimies');
  assert.equal(p.pyynto.kohdeId, 'kohde-1');
  assert.equal(p.historia.at(-1).tapahtuma, 'pyynto');
  assert.equal(avoimetPyynnot([p]).length, 1);
});

test('SAANTO 5: avoin pyynto estaa toisen pyynnon samaan esineeseen', () => {
  const toinen = pyydaKalustoa({
    esine: pyydetty(), id: 'p2', pyytaja: 'esimies2',
    kohde: { id: 'kohde-2', nimi: 'Toimisto' }, perustelu: 'Tarvitaan myos taalla', nyt: T0,
  });
  assert.equal(toinen.ok, false);
  assert.match(toinen.error, /avoin pyyntö/i);
});

test('pyynto vaatii perustelun ja kohteen', () => {
  assert.equal(pyydaKalustoa({
    esine: esine(), id: 'p1', pyytaja: 'esimies',
    kohde: { id: 'kohde-1', nimi: 'Kauppakeskus' }, perustelu: 'x', nyt: T0,
  }).ok, false);
  assert.equal(pyydaKalustoa({
    esine: esine(), id: 'p1', pyytaja: 'esimies',
    kohde: { id: '', nimi: '' }, perustelu: 'Tarvitaan takki', nyt: T0,
  }).ok, false);
});

test('kaytosta poistettua tai kadonnutta ei voi pyytaa', () => {
  const kadonnut = merkitseKadonneeksi({ esine: esine(), user: 'a', syy: 'Jäi bussiin', nyt: T0 }).esine;
  assert.equal(pyydaKalustoa({
    esine: kadonnut, id: 'p1', pyytaja: 'esimies',
    kohde: { id: 'kohde-1', nimi: 'Kauppakeskus' }, perustelu: 'Tarvitaan takki', nyt: T0,
  }).ok, false);
});

test('hyvaksynta SIIRTAA esineen eika jata lupausta', () => {
  const tulos = ratkaisePyynto({ esine: pyydetty(), hyvaksy: true, user: 'paakayttaja', nyt: T0 });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.esine.sijoitusLaji, 'kohde');
  assert.equal(tulos.esine.sijoitusId, 'kohde-1');
  assert.equal(tulos.esine.pyynto, null);
  assert.equal(tulos.esine.historia.at(-1).tapahtuma, 'pyynto_hyvaksytty');
});

test('hylkays vaatii syyn ja jattaa esineen paikalleen', () => {
  const ilmanSyyta = ratkaisePyynto({ esine: pyydetty(), hyvaksy: false, user: 'paakayttaja', nyt: T0 });
  assert.equal(ilmanSyyta.ok, false);

  const tulos = ratkaisePyynto({
    esine: pyydetty(), hyvaksy: false, user: 'paakayttaja',
    perustelu: 'Viimeinen takki, pidetaan varastossa', nyt: T0,
  });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.esine.sijoitusLaji, 'varasto');
  assert.equal(tulos.esine.pyynto, null);
  assert.equal(tulos.esine.historia.at(-1).tapahtuma, 'pyynto_hylatty');
});

test('ratkaisu ja peruminen ilman avointa pyyntoa estyvat', () => {
  assert.equal(ratkaisePyynto({ esine: esine(), hyvaksy: true, user: 'a', nyt: T0 }).ok, false);
  assert.equal(peruPyynto({ esine: esine(), user: 'a', nyt: T0 }).ok, false);
});

test('siirto nollaa avoimen pyynnon', () => {
  // Pääkäyttäjä voi jyvittää esineen muualle vaikka siitä on pyyntö. Avoin pyyntö ei saa
  // jäädä odottamaan tehtyä asiaa — se hyväksyttäisiin myöhemmin tyhjään.
  const siirretty = siirra({
    esine: pyydetty(), sijoitus: { laji: 'kohde', id: 'kohde-9', nimi: 'Varikko' },
    user: 'paakayttaja', nyt: T0,
  }).esine;
  assert.equal(siirretty.pyynto, null);
});

// --- Tilamuutokset ----------------------------------------------------------------

test('SAANTO 6: katoaminen vaatii syyn ja jattaa sijoituksen nakyviin', () => {
  const vartijalla = siirra({
    esine: esine(), sijoitus: { laji: 'henkilo', id: 'emp-1', nimi: 'Virtanen' },
    user: 'a', nyt: T0,
  }).esine;

  assert.equal(merkitseKadonneeksi({ esine: vartijalla, user: 'a', syy: '', nyt: T0 }).ok, false);

  const tulos = merkitseKadonneeksi({ esine: vartijalla, user: 'a', syy: 'Jäi bussiin', nyt: T0 });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.esine.tila, 'kadonnut');
  // Sijoitus JÄÄ: ilman tietoa siitä kenen hallussa esine oli, katoaminen ei kerro mitä
  // pitäisi tehdä seuraavaksi.
  assert.equal(tulos.esine.sijoitusNimi, 'Virtanen');
  assert.equal(kadonneet([tulos.esine]).length, 1);
});

test('kadonnutta ja poistettua ei siirreta', () => {
  const kadonnut = merkitseKadonneeksi({ esine: esine(), user: 'a', syy: 'Jäi bussiin', nyt: T0 }).esine;
  assert.equal(siirra({
    esine: kadonnut, sijoitus: { laji: 'kohde', id: 'k1', nimi: 'Kohde' }, user: 'a', nyt: T0,
  }).ok, false);

  const poistettu = poistaKaytosta({ esine: esine(), user: 'a', syy: 'Repesi', nyt: T0 }).esine;
  assert.equal(siirra({
    esine: poistettu, sijoitus: { laji: 'kohde', id: 'k1', nimi: 'Kohde' }, user: 'a', nyt: T0,
  }).ok, false);
});

test('loytyminen palauttaa kayttoon mutta katoaminen jaa historiaan', () => {
  const kadonnut = merkitseKadonneeksi({ esine: esine(), user: 'a', syy: 'Jäi bussiin', nyt: T0 }).esine;
  const tulos = palautaKayttoon({ esine: kadonnut, user: 'a', huomio: 'Löytyi löytötavaroista', nyt: T0 });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.esine.tila, 'kaytossa');
  assert.equal(tulos.esine.kadonnut, null);
  assert.ok(tulos.esine.historia.some((h) => h.tapahtuma === 'kadonnut'));
  assert.equal(tulos.esine.historia.at(-1).tapahtuma, 'loytyi');
});

test('huoltoon ja takaisin', () => {
  const huollossa = merkitseHuoltoon({ esine: esine(), user: 'a', huomio: 'Vetoketju', nyt: T0 }).esine;
  assert.equal(huollossa.tila, 'huollossa');
  // Huollossa olevaa ei merkitä uudestaan huoltoon eikä pyydetä kohteelle.
  assert.equal(merkitseHuoltoon({ esine: huollossa, user: 'a', nyt: T0 }).ok, false);
  assert.equal(palautaKayttoon({ esine: huollossa, user: 'a', nyt: T0 }).esine.tila, 'kaytossa');
});

test('poistettua ei oteta takaisin kayttoon', () => {
  const poistettu = poistaKaytosta({ esine: esine(), user: 'a', syy: 'Repesi', nyt: T0 }).esine;
  assert.equal(palautaKayttoon({ esine: poistettu, user: 'a', nyt: T0 }).ok, false);
  assert.equal(poistaKaytosta({ esine: poistettu, user: 'a', syy: 'x', nyt: T0 }).ok, false);
});

test('poistettua esinetta ei voi muokata', () => {
  const poistettu = poistaKaytosta({ esine: esine(), user: 'a', syy: 'Repesi', nyt: T0 }).esine;
  assert.equal(paivitaTiedot({ esine: poistettu, muutokset: { nimi: 'Uusi nimi' }, user: 'a', nyt: T0 }).ok, false);
});

test('aseen sarjanumeroa tai lupanumeroa ei voi tyhjentaa muokkaamalla', () => {
  const ase = esine({
    laji: 'ase', nimi: 'Glock 17', sarjanumero: 'ABC123',
    lisatiedot: { lupanumero: 'L-2026-77' },
  });
  assert.equal(paivitaTiedot({
    esine: ase, muutokset: { nimi: 'Glock 17', sarjanumero: '', lisatiedot: { lupanumero: 'L-2026-77' } },
    user: 'a', nyt: T0,
  }).ok, false);
  assert.equal(paivitaTiedot({
    esine: ase, muutokset: { nimi: 'Glock 17', sarjanumero: 'ABC123', lisatiedot: {} },
    user: 'a', nyt: T0,
  }).ok, false);
});

// --- Koosteet ---------------------------------------------------------------------

test('sijoitetut suodattaa paikan mukaan ja jattaa poistetut pois', () => {
  const kohteella = siirra({
    esine: esine({ id: 'k1' }), sijoitus: { laji: 'kohde', id: 'kohde-1', nimi: 'Kauppakeskus' },
    user: 'a', nyt: T0,
  }).esine;
  const muualla = siirra({
    esine: esine({ id: 'k2' }), sijoitus: { laji: 'kohde', id: 'kohde-2', nimi: 'Toimisto' },
    user: 'a', nyt: T0,
  }).esine;
  const romutettu = poistaKaytosta({ esine: kohteella, user: 'a', syy: 'Repesi', nyt: T0 }).esine;

  assert.equal(sijoitetut([kohteella, muualla], 'kohde', 'kohde-1').length, 1);
  assert.equal(sijoitetut([romutettu, muualla], 'kohde', 'kohde-1').length, 0);
  assert.equal(sijoitetut([kohteella, muualla], 'varasto', null).length, 0);
});
