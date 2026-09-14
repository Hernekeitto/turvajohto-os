// Käyttö:
//   node scripts/kytke-tyontekija.js listaa
//   node scripts/kytke-tyontekija.js kytke <kayttajatunnus> <tyontekijaId>
//   node scripts/kytke-tyontekija.js katkaise <kayttajatunnus>
//
// Kytkee käyttäjätunnuksen työntekijäpankin tietueeseen (users.employeeId).
//
// MIKSI TÄMÄ ON OLEMASSA. Kytkentä syntyy automaattisesti vain silloin kun tunnus
// LUODAAN työntekijäpankista ("Luo tunnus" työntekijän kortilta). Ennen erää 20c
// olemassa olevaa tunnusta ei voinut kytkeä jälkikäteen mitenkään, ja ainoa kiertotie
// oli poistaa tunnus ja luoda se uudelleen — mikä hukkaisi tunnuksen oikeudet,
// tapahtumarajauksen ja kirjautumishistorian.
//
// MIHIN KYTKENTÄ VAIKUTTAA. Se ratkaisee mitkä kalustopankin esineet tunnus näkee
// OMINAAN (server/kalusto.js: vuoronKalusto). Vartija näkee itselleen luovutetut
// varusteet vain jos tunnus on kytketty; ilman kytkentää lista on tyhjä eikä se näytä
// virheeltä. Kytkentää käytetään myös tapahtumapuolen rosterissa (src/App.tsx).
//
// EI NIMELLÄ PÄÄTTELYÄ. Skripti ei arvaa kytkentää nimen perusteella, vaikka se olisi
// helppoa: kaksi Virtasta on tavallisempaa kuin yksi, ja väärä osuma luovuttaisi toisen
// ihmisen varusteet väärälle tunnukselle. Tunniste annetaan käsin, ja `listaa` näyttää
// mistä valita.
//
// Sama tarkistus kuin palvelinreitillä (PUT /api/users): yksi työntekijätietue voi olla
// kytkettynä vain yhteen tunnukseen kerrallaan.
//
// Vaatii samat ympäristömuuttujat kuin palvelin (DATA_DIR, DATA_ENCRYPTION_KEY) —
// työntekijäpankin kentistä osa on salattu levyllä (store.js).
import { listUsers, updateUser } from '../db.js';
import { readCollection } from '../store.js';

const [, , komento, kayttaja, tyontekijaId] = process.argv;

const KAYTTO = [
  'Käyttö:',
  '  node scripts/kytke-tyontekija.js listaa',
  '  node scripts/kytke-tyontekija.js kytke <kayttajatunnus> <tyontekijaId>',
  '  node scripts/kytke-tyontekija.js katkaise <kayttajatunnus>',
].join('\n');

const tyontekijat = () => readCollection('employees') || [];
const kayttajat = () => listUsers();

const nimella = (id) => {
  const t = tyontekijat().find((x) => x?.id === id);
  return t ? `${t.name || '(nimetön)'}${t.displayId ? ` #${t.displayId}` : ''}` : '(poistettu tietue)';
};

function listaa() {
  const kaikki = kayttajat();
  const varatut = new Map(kaikki.filter((u) => u.employeeId).map((u) => [u.employeeId, u.username]));

  console.log('\nKÄYTTÄJÄT');
  console.log('-'.repeat(72));
  for (const u of kaikki) {
    const kytkos = u.employeeId ? `${nimella(u.employeeId)}  [${u.employeeId}]` : '— ei kytkentää';
    console.log(`  ${u.username.padEnd(20)} ${kytkos}`);
  }

  console.log('\nTYÖNTEKIJÄPANKKI');
  console.log('-'.repeat(72));
  const lista = tyontekijat();
  if (lista.length === 0) {
    console.log('  (tyhjä)');
  } else {
    for (const t of lista) {
      const varaus = varatut.has(t.id) ? `kytketty: ${varatut.get(t.id)}` : 'vapaa';
      console.log(`  ${String(t.id).padEnd(38)} ${String(t.name || '').padEnd(24)} ${varaus}`);
    }
  }
  console.log('');
}

function kytke() {
  if (!kayttaja || !tyontekijaId) {
    console.error(KAYTTO);
    process.exit(1);
  }
  if (!kayttajat().some((u) => u.username === kayttaja)) {
    console.error(`Käyttäjää "${kayttaja}" ei löytynyt.`);
    process.exit(1);
  }
  const tyontekija = tyontekijat().find((t) => t?.id === tyontekijaId);
  if (!tyontekija) {
    console.error(`Työntekijää "${tyontekijaId}" ei löytynyt työntekijäpankista. Aja "listaa" nähdäksesi tunnisteet.`);
    process.exit(1);
  }
  const varattu = kayttajat().find((u) => u.employeeId === tyontekijaId && u.username !== kayttaja);
  if (varattu) {
    console.error(`${tyontekija.name || 'Työntekijä'} on jo kytketty tunnukseen "${varattu.username}". Katkaise se ensin.`);
    process.exit(1);
  }

  updateUser(kayttaja, { employeeId: tyontekijaId });
  console.log(`Kytketty: ${kayttaja} -> ${tyontekija.name || tyontekijaId}`);
  console.log('Muutos tulee voimaan seuraavalla pyynnöllä; uudelleenkirjautumista ei tarvita.');
}

function katkaise() {
  if (!kayttaja) {
    console.error(KAYTTO);
    process.exit(1);
  }
  const kohde = kayttajat().find((u) => u.username === kayttaja);
  if (!kohde) {
    console.error(`Käyttäjää "${kayttaja}" ei löytynyt.`);
    process.exit(1);
  }
  if (!kohde.employeeId) {
    console.log(`Tunnuksella "${kayttaja}" ei ole kytkentää.`);
    return;
  }
  updateUser(kayttaja, { employeeId: null });
  console.log(`Katkaistu: ${kayttaja} (oli ${nimella(kohde.employeeId)})`);
  console.log('Tunnus ei enää näe henkilökohtaisia varusteitaan kalustossa.');
}

if (komento === 'listaa') listaa();
else if (komento === 'kytke') kytke();
else if (komento === 'katkaise') katkaise();
else {
  console.error(KAYTTO);
  process.exit(1);
}
