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
  palautaKayttoon, poistaKaytosta, avoimetPyynnot, kadonneet, sijoitetut, vuoronKalusto,
  HOLVIPAIKKA_ALKU, seuraavaHolviPaikka, holviPaikkaVarattu, normalisoiSijoitusLaji,
  normalisoiRivit, luoAvaintyyppi, paivitaAvaintyyppi,
  TUNNUKSEN_ALKU, tunnuksenNumero, migroiTunnukset,
  SAILOT, onSailo, oletusSailo,
} from './kalusto.js';

const T0 = Date.parse('2026-09-14T09:00:00Z');

const luo = (yli = {}) => luoKalusto({
  id: 'k1', laji: 'asuste', alalaji: 'takki', nimi: 'Talvitakki L',
  kuvaus: '', sarjanumero: '', lisatiedot: {}, sijoitus: { laji: 'holvi' },
  numero: 1, user: 'paakayttaja', nyt: T0, ...yli,
});

// Avain tarvitsee holvipaikan; muut lajit eivät saa sitä. Oma apurinsa, jottei jokaiseen
// avaintestiin tarvitse muistaa lisätä numeroa.
const avain = (yli = {}) => luo({
  laji: 'avain', alalaji: 'Yleisavain', nimi: 'Hansa pääovi', holviPaikka: 1000, ...yli,
});

// Sama valmiina tietueena: luo() palauttaa { ok, esine }, ja useimmat testit tarvitsevat
// vain tietueen.
const avainEsine = (yli = {}) => avain(yli).esine;

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
    { tunnus: 'TJ-ASU-1001', laji: 'asuste' },
    { tunnus: 'TJ-ASU-1007', laji: 'asuste' },
    { tunnus: 'TJ-AVA-1042', laji: 'avain' },
  ];
  assert.equal(seuraavaNumero(pankki, 'asuste'), 1008);
  assert.equal(seuraavaNumero(pankki, 'avain'), 1043);
  // Laji jolle ei ole kirjattu mitaan alkaa sarjan alusta eika ykkosesta.
  assert.equal(seuraavaNumero(pankki, 'ase'), TUNNUKSEN_ALKU);
  assert.equal(seuraavaNumero([], 'asuste'), TUNNUKSEN_ALKU);
});

test('vanha alle tuhannen numero ei pudota sarjaa takaisin alkuun', () => {
  // Siirtymavaiheessa pankissa voi olla seka vanhoja etta uusia numeroita. Seuraava
  // on suurin + 1, mutta ei koskaan alle sarjan alun — muuten uusi esine saisi
  // numeron joka on jo painettu johonkin kilpeen.
  assert.equal(seuraavaNumero([{ tunnus: 'TJ-ASU-0007', laji: 'asuste' }], 'asuste'), TUNNUKSEN_ALKU);
  assert.equal(
    seuraavaNumero([{ tunnus: 'TJ-ASU-0007' }, { tunnus: 'TJ-ASU-1003' }], 'asuste'),
    1004
  );
});

test('tunnuksenNumero lukee vain oman lajin tunnuksia', () => {
  assert.equal(tunnuksenNumero('TJ-ASU-1005', 'asuste'), 1005);
  assert.equal(tunnuksenNumero('TJ-ASU-1005', 'avain'), null);
  assert.equal(tunnuksenNumero('roskaa', 'asuste'), null);
  assert.equal(tunnuksenNumero('', 'asuste'), null);
});

test('poistetun tunniste EI vapaudu uudelleenkayttoon', () => {
  // Poistettu esine on yhä rivinä pankissa, ja numerointi lukee sen. Jos numero
  // vapautuisi, kaksi eri esinettä kantaisi samaa kilpimerkkiä — ja vanhempi niistä on
  // jo jonkun taskussa.
  const kaytossa = luo({ numero: 1005 }).esine;
  const poistettu = poistaKaytosta({ esine: kaytossa, user: 'paakayttaja', syy: 'Repesi', nyt: T0 }).esine;
  assert.equal(poistettu.tila, 'poistettu');
  assert.equal(poistettu.tunnus, 'TJ-ASU-1005');
  assert.equal(seuraavaNumero([poistettu], 'asuste'), 1006);
});

// --- Luonti -----------------------------------------------------------------------

test('esine syntyy varastoon ja historia alkaa luonnista', () => {
  const tulos = luo();
  assert.equal(tulos.ok, true);
  assert.equal(tulos.esine.tunnus, 'TJ-ASU-0001');
  assert.equal(tulos.esine.tila, 'kaytossa');
  assert.equal(tulos.esine.sijoitusLaji, 'holvi');
  assert.equal(tulos.esine.sijoitusId, null);
  assert.equal(tulos.esine.pyynto, null);
  // Holvipaikka on VAIN avaimilla: takkia ei säilytetä numeroidulla koukulla.
  assert.equal(tulos.esine.holviPaikka, undefined);
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
    esine: henkilokohtainen, sijoitus: { laji: 'holvi' }, user: 'a', nyt: T0,
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
  assert.equal(tulos.esine.sijoitusLaji, 'holvi');
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

// --- Vartijan näkymä: vain vuoron kohde, ilman luovutusketjua ----------------------

test('ilman vuoroa ei nay mitaan', () => {
  // Tyhjä lista on oikea vastaus eikä puute: ilman vuoroa ei ole kohdetta jonka
  // kalustoa katsottaisiin. Jos tämä palauttaisi koko pankin, vartija näkisi kaiken
  // heti kun vuoro päättyy.
  assert.deepEqual(vuoronKalusto([esine()], { siteId: null }), []);
  assert.deepEqual(vuoronKalusto([esine()], {}), []);
  assert.deepEqual(vuoronKalusto([esine()]), []);
});

test('vartija nakee vain oman vuoronsa kohteen kaluston', () => {
  const kohteella = (id, siteId) => siirra({
    esine: esine({ id }), sijoitus: { laji: 'kohde', id: siteId, nimi: `Kohde ${siteId}` },
    user: 'a', nyt: T0,
  }).esine;

  const pankki = [
    kohteella('k1', 'kohde-1'),
    kohteella('k2', 'kohde-2'),
    // Varastossa oleva ei ole kenenkään kohteella.
    esine({ id: 'k3' }),
    // Toiselle vartijalle luovutettu ei näy vaikka hän olisi samassa kohteessa.
    siirra({ esine: esine({ id: 'k4' }), sijoitus: { laji: 'henkilo', id: 'emp-9', nimi: 'Korhonen' }, user: 'a', nyt: T0 }).esine,
  ];

  const nakyvat = vuoronKalusto(pankki, { siteId: 'kohde-1' });
  assert.deepEqual(nakyvat.map((e) => e.id), ['k1']);
});

test('poistettu ei nay vartijalle vaikka se olisi kirjattu kohteelle', () => {
  const kohteella = siirra({
    esine: esine(), sijoitus: { laji: 'kohde', id: 'kohde-1', nimi: 'Kohde 1' }, user: 'a', nyt: T0,
  }).esine;
  const poistettu = poistaKaytosta({ esine: kohteella, user: 'a', syy: 'Repesi', nyt: T0 }).esine;
  assert.deepEqual(vuoronKalusto([poistettu], { siteId: 'kohde-1' }), []);
});

test('luovutusketju karsitaan: ei historiaa, pyyntoa eika luojaa', () => {
  const kohteella = siirra({
    esine: esine(), sijoitus: { laji: 'kohde', id: 'kohde-1', nimi: 'Kohde 1' },
    user: 'paakayttaja', huomio: 'Sopimuksen mukaan', nyt: T0,
  }).esine;
  const pyydetty = pyydaKalustoa({
    esine: kohteella, id: 'p1', pyytaja: 'esimies',
    kohde: { id: 'kohde-2', nimi: 'Kohde 2' }, perustelu: 'Tarvitaan muualla', nyt: T0,
  }).esine;

  // Lähtötilanteessa kaikki kolme ovat olemassa — muuten testi ei todistaisi mitään.
  assert.ok(pyydetty.historia.length > 0);
  assert.ok(pyydetty.pyynto);
  assert.equal(pyydetty.luoja, 'paakayttaja');

  const [nakyva] = vuoronKalusto([pyydetty], { siteId: 'kohde-1' });
  assert.equal(nakyva.historia, undefined);
  assert.equal(nakyva.pyynto, undefined);
  assert.equal(nakyva.luoja, undefined);
  // Esineen omat tiedot säilyvät: ilman niitä näkymä ei kerro mitä kohteessa on.
  assert.equal(nakyva.tunnus, 'TJ-ASU-0001');
  assert.equal(nakyva.nimi, 'Talvitakki L');
  assert.equal(nakyva.sijoitusNimi, 'Kohde 1');
  assert.equal(nakyva.tila, 'kaytossa');
});

// --- Säilöt ------------------------------------------------------------------------
//
// Holvi ja varusvarasto ovat eri tila ja eri lukko. Rekisterin ainoa tehtävä on kertoa
// kummasta ovesta tavara haetaan, joten oletuksen menemisellä väärin ei ole mitään
// näkyvää oiretta — esine vain on kirjanpidossa väärässä huoneessa.

test('laji valitsee sailon: avaimet holviin, muu kalusto varusvarastoon', () => {
  assert.deepEqual(SAILOT, ['holvi', 'varusvarasto']);
  assert.equal(onSailo('holvi'), true);
  assert.equal(onSailo('kohde'), false);
  assert.equal(oletusSailo('asuste'), 'varusvarasto');
  assert.equal(oletusSailo('avain'), 'holvi');
  assert.equal(oletusSailo('avainkaappi'), 'holvi');

  // Sijoitusta EI anneta: juuri silloin oletus ratkaisee, ja eräkirjaus kulkee tätä
  // polkua kymmenillä riveillä kerrallaan.
  assert.equal(luo({ sijoitus: undefined }).esine.sijoitusLaji, 'varusvarasto');
  assert.equal(luo({ sijoitus: undefined, laji: 'tietotekniikka' }).esine.sijoitusLaji, 'varusvarasto');
  assert.equal(avain({ sijoitus: undefined }).esine.sijoitusLaji, 'holvi');
  assert.equal(
    luo({ sijoitus: undefined, laji: 'avainkaappi', nimi: 'Piiriauto 1' }).esine.sijoitusLaji,
    'holvi'
  );
});

test('sailon nimi on vakio eika kutsujan annettavissa', () => {
  const esine = luo({ sijoitus: { laji: 'varusvarasto', nimi: 'Jonkun oma nurkka', id: 'x' } }).esine;
  // Paikan nimi on sama kaikille siellä oleville. Vapaa nimi tekisi yhdestä huoneesta
  // monta, eikä listalta enää näkisi mikä on sama paikka.
  assert.equal(esine.sijoitusNimi, 'Varusvarasto');
  // Säilöllä ei ole tietuetta johon viitata: id pudotetaan, ettei rekisteriin jää
  // osoitinta johonkin jota ei ole.
  assert.equal(esine.sijoitusId, null);
});

test('siirto holvista varusvarastoon on siirto eika sama paikka', () => {
  const holvissa = luo({ sijoitus: { laji: 'holvi' } }).esine;
  const tulos = siirra({ esine: holvissa, sijoitus: { laji: 'varusvarasto' }, user: 'a', nyt: T0 });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.esine.sijoitusLaji, 'varusvarasto');
  assert.equal(tulos.esine.sijoitusNimi, 'Varusvarasto');
  assert.equal(tulos.esine.sijoitusId, null);

  // Historiarivi kantaa UUDEN sijoituksen: ilman sitä ei jälkikäteen näe mihin esine
  // meni, ja juuri se on ainoa syy kirjata siirto.
  const viimeinen = tulos.esine.historia.at(-1);
  assert.equal(viimeinen.tapahtuma, 'siirto');
  assert.equal(viimeinen.sijoitusLaji, 'varusvarasto');

  // Sama siirto uudelleen ei kelpaa — säilöt erottuvat toisistaan eivätkä sulaudu.
  const uudelleen = siirra({
    esine: tulos.esine, sijoitus: { laji: 'varusvarasto' }, user: 'a', nyt: T0,
  });
  assert.equal(uudelleen.ok, false);
  assert.match(uudelleen.error, /jo täällä/i);
});

test('henkilokohtaista ei jateta varusvarastoonkaan', () => {
  // Sääntö 4 koskee molempia säilöjä. Tunnus on henkilökohtainen juuri siksi, että se
  // yksilöi kantajansa — varastossa se ei yksilöi ketään.
  const tunnus = luo({ lisatiedot: { henkilokohtainen: true }, sijoitus: { laji: 'henkilo', id: 'emp-1', nimi: 'Virtanen' } }).esine;
  const tulos = siirra({ esine: tunnus, sijoitus: { laji: 'varusvarasto' }, user: 'a', nyt: T0 });
  assert.equal(tulos.ok, false);
  assert.match(tulos.error, /henkilökohtaise/i);
});

// --- Holvipaikka -------------------------------------------------------------------

test('vanha varasto-sijoitus luetaan holviksi', () => {
  // Ennen nimenmuutosta kirjatut rivit eivät saa jäädä näkymättömiin, eikä niitä varten
  // ajeta migraatiota: nimi on esitystapa eikä tietueen merkitys muuttunut.
  assert.equal(normalisoiSijoitusLaji('varasto'), 'holvi');
  assert.equal(normalisoiSijoitusLaji('kohde'), 'kohde');
  const vanhalla = siirra({
    esine: avainEsine({ id: 'k1' }), sijoitus: { laji: 'varasto' }, user: 'a', nyt: T0,
  });
  // Siirto holvista holviin on sama paikka, eli se estyy — juuri se todistaa että
  // 'varasto' tulkittiin holviksi eikä tuntemattomaksi lajiksi.
  assert.equal(vanhalla.ok, false);
  assert.match(vanhalla.error, /jo täällä/i);
});

test('luettaessa vanha varasto-rivi muuttuu holviksi', () => {
  // Levyllä olevaa dataa ei migratoida, joten normalisointi on tehtävä LUKUPOLULLA.
  // Ilman tätä selain saisi lajin jota sen tyyppi ei tunne ja selite jäisi tyhjäksi.
  const vanhat = [{ id: 'k1', sijoitusLaji: 'varasto', sijoitusNimi: 'Varasto' }, { id: 'k2', sijoitusLaji: 'kohde' }];
  const luetut = normalisoiRivit(vanhat);
  assert.equal(luetut[0].sijoitusLaji, 'holvi');
  assert.equal(luetut[1].sijoitusLaji, 'kohde');
  // Alkuperäistä ei muuteta paikallaan: sama taulukko on luettu levyltä ja se
  // kirjoitetaan takaisin sellaisenaan muissa poluissa.
  assert.equal(vanhat[0].sijoitusLaji, 'varasto');
});

test('avain ei synny ilman holvipaikkaa, muut lajit eivat saa sita', () => {
  const ilman = luo({ laji: 'avain', nimi: 'Pääovi' });
  assert.equal(ilman.ok, false);
  assert.match(ilman.error, /holvipaikka/i);

  assert.equal(avain().ok, true);
  assert.equal(avain().esine.holviPaikka, 1000);
  // Muu laji: holviPaikka jätetään pois vaikka se annettaisiin.
  assert.equal(luo({ holviPaikka: 1234 }).esine.holviPaikka, undefined);
});

test('numerointi alkaa 1000:sta ja jatkuu suurimmasta', () => {
  assert.equal(seuraavaHolviPaikka([]), HOLVIPAIKKA_ALKU);
  assert.equal(seuraavaHolviPaikka([{ holviPaikka: 1000 }, { holviPaikka: 1007 }]), 1008);
  // Muut lajit eivät häiritse laskentaa: niillä ei ole kenttää lainkaan.
  assert.equal(seuraavaHolviPaikka([{ tunnus: 'TJ-ASU-0001' }]), HOLVIPAIKKA_ALKU);
});

test('paikka EI vapaudu poistetulta avaimelta', () => {
  // Sama sääntö kuin kilpimerkin tunnuksella: vanhat luovutusmerkinnät viittaavat
  // numeroon, ja uudelleenkäyttö tekisi kahdesta avaimesta saman jälkikäteen luettuna.
  const poistettu = poistaKaytosta({ esine: avainEsine(), user: 'a', syy: 'Lukitus vaihdettu', nyt: T0 }).esine;
  assert.equal(seuraavaHolviPaikka([poistettu]), 1001);
});

test('paikka pysyy avaimella myos kohteella ja avainkaapissa', () => {
  // Varattu koukku ei vapaudu kun avain lähtee liikkeelle — tyhjä koukku on tieto siitä
  // että avain on jossain muualla, ei siitä että paikka olisi vapaa.
  const kohteella = siirra({
    esine: avainEsine(), sijoitus: { laji: 'kohde', id: 'kohde-1', nimi: 'Hansa' }, user: 'a', nyt: T0,
  }).esine;
  assert.equal(kohteella.holviPaikka, 1000);
  assert.equal(seuraavaHolviPaikka([kohteella]), 1001);
});

test('varattu paikka tunnistetaan, oma paikka ei nayta varatulta', () => {
  const pankki = [avainEsine({ id: 'k1' }), avainEsine({ id: 'k2', holviPaikka: 1001 })];
  assert.equal(holviPaikkaVarattu(pankki, 1001), true);
  assert.equal(holviPaikkaVarattu(pankki, 1009), false);
  // Esinettä muokattaessa sen oma paikka ei saa näyttää varatulta.
  assert.equal(holviPaikkaVarattu(pankki, 1001, 'k2'), false);
});

// --- Omat varusteet ----------------------------------------------------------------

const henkilolle = (id, empId, nimi = 'Virtanen') => siirra({
  esine: esine({ id }), sijoitus: { laji: 'henkilo', id: empId, nimi }, user: 'a', nyt: T0,
}).esine;

test('omat varusteet nakyvat ILMAN vuoroa', () => {
  // Takki ja tunnus ovat vartijan hallussa myös vapaapäivänä. Jos tämä vaatisi vuoron,
  // kysymykseen "mitä minulle on luovutettu" ei voisi vastata silloin kun se useimmiten
  // kysytään — varusteita palautettaessa.
  const omat = vuoronKalusto([henkilolle('k1', 'emp-1')], { siteId: null, employeeId: 'emp-1' });
  assert.deepEqual(omat.map((e) => e.id), ['k1']);
});

test('toiselle luovutettu ei nay', () => {
  const pankki = [henkilolle('k1', 'emp-1'), henkilolle('k2', 'emp-2', 'Korhonen')];
  assert.deepEqual(vuoronKalusto(pankki, { employeeId: 'emp-1' }).map((e) => e.id), ['k1']);
});

test('kohteen kalusto ja omat varusteet nakyvat yhdessa', () => {
  const kohteella = siirra({
    esine: esine({ id: 'k1' }), sijoitus: { laji: 'kohde', id: 'kohde-1', nimi: 'Kohde 1' },
    user: 'a', nyt: T0,
  }).esine;
  const pankki = [
    kohteella,
    henkilolle('k2', 'emp-1'),
    henkilolle('k3', 'emp-2', 'Korhonen'),
    esine({ id: 'k4' }), // varastossa
  ];
  const nakyvat = vuoronKalusto(pankki, { siteId: 'kohde-1', employeeId: 'emp-1' });
  assert.deepEqual(nakyvat.map((e) => e.id).sort(), ['k1', 'k2']);
});

test('tyhja employeeId ei osu sijoittamattomaan esineeseen', () => {
  // Varastossa olevan esineen sijoitusId on null. Jos kytkemättömän tunnuksen null
  // vertautuisi siihen, jokainen varastossa oleva esine olisi kaikkien omaisuutta —
  // ja tämä on se rivi joka sen estää.
  const varastossa = esine({ id: 'k1' });
  assert.equal(varastossa.sijoitusId, null);
  assert.deepEqual(vuoronKalusto([varastossa], { siteId: 'kohde-1', employeeId: null }), []);
});

test('omista varusteista karsitaan ketju samoin kuin kohteen kalustosta', () => {
  const [nakyva] = vuoronKalusto([henkilolle('k1', 'emp-1')], { employeeId: 'emp-1' });
  assert.equal(nakyva.historia, undefined);
  assert.equal(nakyva.luoja, undefined);
  assert.equal(nakyva.sijoitusNimi, 'Virtanen');
});

test('poistettu ei nay omissa varusteissa', () => {
  const poistettu = poistaKaytosta({ esine: henkilolle('k1', 'emp-1'), user: 'a', syy: 'Repesi', nyt: T0 }).esine;
  assert.deepEqual(vuoronKalusto([poistettu], { employeeId: 'emp-1' }), []);
});

test('karsinta on sallittujen kenttien lista: tuntematon kentta ei paase lapi', () => {
  // Tämä on koko karsinnan turvaverkko. Jos tietueeseen lisätään myöhemmin kenttä eikä
  // sitä lisätä NAKYVAT_KENTAT-listaan, sen on jäätävä POIS vartijan näkymästä — ei
  // mennä läpi hiljaa. Poissulkulistalla tämä testi menisi rikki juuri väärään suuntaan.
  const kohteella = siirra({
    esine: esine(), sijoitus: { laji: 'kohde', id: 'kohde-1', nimi: 'Kohde 1' }, user: 'a', nyt: T0,
  }).esine;
  const laajennettu = { ...kohteella, salainenUusiKentta: 'vartijan henkilotunnus' };

  const [nakyva] = vuoronKalusto([laajennettu], { siteId: 'kohde-1' });
  assert.equal(nakyva.salainenUusiKentta, undefined);
});

test('karsinta ei muuta alkuperaista tietuetta', () => {
  // Karsinta ajetaan juuri ennen vastausta samalle taulukolle joka on luettu levyltä.
  // Jos se muokkaisi paikallaan, seuraava pääkäyttäjän haku palauttaisi historiattoman
  // tietueen — ja tallennus kirjoittaisi sen takaisin levylle.
  const kohteella = siirra({
    esine: esine(), sijoitus: { laji: 'kohde', id: 'kohde-1', nimi: 'Kohde 1' }, user: 'a', nyt: T0,
  }).esine;
  vuoronKalusto([kohteella], { siteId: 'kohde-1' });
  assert.ok(Array.isArray(kohteella.historia));
  assert.equal(kohteella.historia.length, 2);
});

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
  assert.equal(sijoitetut([kohteella, muualla], 'holvi', null).length, 0);
});

// --- Avaintyyppikartta ---------------------------------------------------------------
//
// Kartan arvo on siinä että sama avainmalli on siellä kerran. Kaksi riviä samalle
// mallille tarkoittaa kahta identtiseltä näyttävää kuvaa valittavana, ja kirjaaja
// valitsee kumman tahansa — jolloin pankkiin syntyy kaksi kirjoitusasua samasta asiasta
// eikä haku löydä molempia.

test('avaintyyppi tarvitsee nimen ja kuvan', () => {
  assert.equal(luoAvaintyyppi({ id: 't1', nimi: '  ', uploadId: 'a.png' }).ok, false);
  assert.equal(luoAvaintyyppi({ id: 't1', nimi: 'Abloy Exec', uploadId: '' }).ok, false);
  assert.equal(luoAvaintyyppi({ id: 't1', nimi: 'Abloy Exec', uploadId: 'a.png' }).ok, true);
});

test('sama avaintyyppi ei mene karttaan kahdesti kirjoitusasusta riippumatta', () => {
  const kartta = [{ id: 't1', nimi: 'Abloy Exec', uploadId: 'a.png' }];
  for (const nimi of ['Abloy Exec', 'ABLOY EXEC', '  abloy   exec  ']) {
    const tulos = luoAvaintyyppi({ id: 't2', nimi, uploadId: 'b.png', kartta });
    assert.equal(tulos.ok, false, `"${nimi}" paasi lapi`);
    assert.match(tulos.error, /on jo kartassa/);
  }
  assert.equal(luoAvaintyyppi({ id: 't2', nimi: 'Abloy Sento', uploadId: 'b.png', kartta }).ok, true);
});

test('avaintyypin kuvauksen voi muokata ilman etta oma nimi tormaa itseensa', () => {
  // Ilman "muut"-rajausta päällekkäisyystarkistus osuisi aina omaan riviin, eikä
  // kuvausta voisi korjata muuttamatta nimeä.
  const tyyppi = { id: 't1', nimi: 'Abloy Exec', kuvaus: '', uploadId: 'a.png' };
  const tulos = paivitaAvaintyyppi({ tyyppi, muutokset: { kuvaus: 'Punainen nappi kahvassa' }, kartta: [tyyppi] });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.tyyppi.nimi, 'Abloy Exec');
  assert.equal(tulos.tyyppi.kuvaus, 'Punainen nappi kahvassa');
});

test('avaintyypin kuva sailyy jos sita ei vaihdeta', () => {
  // Nimen korjaus ei saa vaatia kuvan lähettämistä uudelleen.
  const tyyppi = { id: 't1', nimi: 'Abloy Exek', kuvaus: '', uploadId: 'a.png' };
  const tulos = paivitaAvaintyyppi({ tyyppi, muutokset: { nimi: 'Abloy Exec' }, kartta: [tyyppi] });
  assert.equal(tulos.tyyppi.uploadId, 'a.png');
  assert.equal(tulos.tyyppi.nimi, 'Abloy Exec');
});

test('avaintyypin nimi ei voi tormata TOISEN rivin nimeen muokattaessa', () => {
  const a = { id: 't1', nimi: 'Abloy Exec', uploadId: 'a.png' };
  const b = { id: 't2', nimi: 'Abloy Sento', uploadId: 'b.png' };
  const tulos = paivitaAvaintyyppi({ tyyppi: b, muutokset: { nimi: 'abloy exec' }, kartta: [a, b] });
  assert.equal(tulos.ok, false);
});

// --- Voimankäyttövälineen määräpäivä -------------------------------------------------
//
// Sama kenttä tarkoittaa kahta asiaa: kaasusumuttimella viimeistä käyttöpäivää,
// käsiraudoilla ja patukalla tarkastuspäivää. Palvelimelle se on yksi päivämäärä, ja
// ainoa sääntö on että se on VERTAILUKELPOINEN. Vapaana tekstinä kenttä olisi
// muistiinpano jota mikään ei tarkista — ja vanhentunut sumutin on turvallisuusasia.

const vkv = (lisatiedot) => luo({ laji: 'voimankayttovaline', alalaji: 'Kaasusumutin', lisatiedot });

test('maarapaiva tallentuu ISO-muodossa', () => {
  const tulos = vkv({ maarapaiva: '2027-05-01' });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.esine.lisatiedot.maarapaiva, '2027-05-01');
});

test('tyhja maarapaiva kelpaa', () => {
  // Päivämäärä on valinnainen: puuttuminen on eri asia kuin virheellinen arvo.
  assert.equal(vkv({ maarapaiva: '' }).ok, true);
  assert.equal(vkv({}).ok, true);
});

test('suomalainen paivamuoto torjutaan', () => {
  // "1.5.2027" nayttaa oikealta mutta ei ole vertailukelpoinen, ja merkkijonona se
  // jarjestyisi vaarin. Torjunta on tassa eika selaimessa, koska rajapintaan voi
  // kirjoittaa ilman lomaketta.
  const tulos = vkv({ maarapaiva: '1.5.2027' });
  assert.equal(tulos.ok, false);
  assert.match(tulos.error, /vvvv-kk-pp/);
});

test('olematon paiva torjutaan vaikka muoto olisi oikea', () => {
  assert.equal(vkv({ maarapaiva: '2027-02-31' }).ok, false);
  assert.equal(vkv({ maarapaiva: '2027-13-01' }).ok, false);
});

test('maarapaivaa ei tallenneta lajille jolla sita ei ole', () => {
  // puhdistaLisatiedot karsii vieraat kentat, joten avaimeen ei voi kirjoittaa
  // voimankayttovalineen kenttia rajapinnan kautta.
  const tulos = avainEsine({ lisatiedot: { maarapaiva: '2027-05-01' } });
  assert.equal(tulos.lisatiedot.maarapaiva, undefined);
});

test('maarapaivan korjaus tarkistetaan myos muokkauksessa', () => {
  const esine = vkv({ maarapaiva: '2027-05-01' }).esine;
  const huono = paivitaTiedot({
    esine, muutokset: { nimi: esine.nimi, alalaji: esine.alalaji, lisatiedot: { maarapaiva: 'ensi keväänä' } },
    user: 'paakayttaja', nyt: T0,
  });
  assert.equal(huono.ok, false);
  const hyva = paivitaTiedot({
    esine, muutokset: { nimi: esine.nimi, alalaji: esine.alalaji, lisatiedot: { maarapaiva: '2028-05-01' } },
    user: 'paakayttaja', nyt: T0,
  });
  assert.equal(hyva.ok, true);
  assert.equal(hyva.esine.lisatiedot.maarapaiva, '2028-05-01');
});

// --- Numeroinnin siirto --------------------------------------------------------------
//
// Kertaluontoinen ajo joka nostaa vanhat numerot samaan sarjaan uusien kanssa. Kaksi
// asiaa on pakko pitää: järjestys ei saa sekoittua, eikä ajo saa tehdä mitään toisella
// kerralla. Jälkimmäinen siksi, että ajo tapahtuu palvelimen käynnistyksessä — ja
// palvelin käynnistyy uudelleen joka julkaisussa.

test('vanhat tunnukset siirtyvat tuhannen sarjaan jarjestys sailyttaen', () => {
  const pankki = [
    { tunnus: 'TJ-VKV-0005', laji: 'voimankayttovaline', historia: [] },
    { tunnus: 'TJ-AVA-0001', laji: 'avain', historia: [] },
    { tunnus: 'TJ-AVA-0004', laji: 'avain', historia: [] },
  ];
  const tulos = migroiTunnukset(pankki, { user: 'jarjestelma', nyt: T0 });
  assert.equal(tulos.muutettuja, 3);
  assert.deepEqual(
    tulos.kalusto.map((e) => e.tunnus),
    ['TJ-VKV-1005', 'TJ-AVA-1001', 'TJ-AVA-1004']
  );
});

test('toinen ajo ei tee mitaan', () => {
  // Palvelin käynnistyy uudelleen joka julkaisussa. Jos ajo lisäisi joka kerta tuhat,
  // tunnukset karkaisivat ja jokainen tulostettu kilpi vanhenisi julkaisun välein.
  const pankki = [{ tunnus: 'TJ-VKV-0005', laji: 'voimankayttovaline', historia: [] }];
  const eka = migroiTunnukset(pankki, { nyt: T0 });
  const toka = migroiTunnukset(eka.kalusto, { nyt: T0 });
  assert.equal(toka.muutettuja, 0);
  assert.equal(toka.kalusto[0].tunnus, 'TJ-VKV-1005');
  // Sama tietue takaisin, ei kopiota: turha kirjoitus levylle on turha kirjoitus.
  assert.equal(toka.kalusto, eka.kalusto);
});

test('siirto jattaa historiarivin', () => {
  // Tunnus on rekisterin yksilöivä tieto. Jos se vaihtuu jäljettömästi, vanhaa kilpeä
  // kantavaa esinettä ei voi enää yhdistää tietueeseensa.
  const pankki = [{ tunnus: 'TJ-VKV-0005', laji: 'voimankayttovaline', historia: [] }];
  const { kalusto } = migroiTunnukset(pankki, { user: 'jarjestelma', nyt: T0 });
  const rivi = kalusto[0].historia.at(-1);
  assert.equal(rivi.tapahtuma, 'tunnusmuutos');
  assert.equal(rivi.teksti, 'TJ-VKV-0005 -> TJ-VKV-1005');
  assert.equal(rivi.user, 'jarjestelma');
});

test('siirto ei koske tuntemattomaan tai rikkinaiseen tunnukseen', () => {
  const pankki = [
    { tunnus: 'TJ-XXX-0001', laji: 'eiOle', historia: [] },
    { tunnus: 'roskaa', laji: 'asuste', historia: [] },
  ];
  const tulos = migroiTunnukset(pankki, { nyt: T0 });
  assert.equal(tulos.muutettuja, 0);
});
