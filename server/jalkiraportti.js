// Jälkiraportti eli debrief (erä 9).
//
// Tapahtuman jälkeen pidetään purku: mitä tapahtui, mikä toimi, mikä ei, ja mitä
// tehdään toisin ensi kerralla. Ilman työkalua se on palaveri jonka muistiinpanot ovat
// jonkun vihossa — ja ensi vuonna sama tapahtuma suunnitellaan alusta samoilla virheillä.
//
// LUVUT JÄÄDYTETÄÄN LUONTIHETKELLÄ. Jos jälkiraportti laskisi lukunsa joka avauksella
// uudelleen, sama raportti näyttäisi ensi kuussa eri luvut: kirjauksia suljetaan
// jälkikäteen, korjausmerkintöjä lisätään ja säilytysajan päättyessä tietueita
// poistetaan. Debrief on dokumentti tietystä hetkestä, ei näkymä elävään dataan.
//
// Sama moduuli palvelee molempia puolia. GUARD-puolella "tapahtuman jälkeen" ei ole
// olemassa — vartiointi jatkuu — joten siellä sama rakenne on jaksoraportti
// toimeksiantajalle. Ero on vain ikkunassa, ei rakenteessa.

// Luonnosta muokataan vapaasti, valmis on lukittu. Ilman lukitusta "valmis" ei
// tarkoittaisi mitään: raportti jonka sisältö voi vaihtua jaon jälkeen ei ole
// dokumentti vaan luonnos jolla on leima.
export const TILAT = ['luonnos', 'valmis'];

// Vapaan tekstin osiot. Neljä kysymystä eikä yksi tyhjä kenttä: tyhjään ruutuun
// kirjoitetaan "meni hyvin", ja juuri se osa jota debrief on varten — mikä ei toiminut —
// jää kysymättä.
export const OSIOT = [
  { id: 'yhteenveto', nimi: 'Yhteenveto', ohje: 'Mitä tapahtui, kuinka monta ja mitä poikkeuksellista.' },
  { id: 'onnistui', nimi: 'Mikä toimi', ohje: 'Mitkä ratkaisut kannattaa tehdä samoin ensi kerralla.' },
  { id: 'kehitettavaa', nimi: 'Mikä ei toiminut', ohje: 'Missä meni pieleen ja miksi. Ilman tätä osiota debrief on kiitospuhe.' },
  { id: 'oppi', nimi: 'Opit ja suositukset', ohje: 'Mitä seuraavan tapahtuman suunnittelijan on tiedettävä.' },
];

const OSIO_IDT = OSIOT.map((o) => o.id);

const teksti = (arvo, max = 20000) => String(arvo ?? '').slice(0, max);

const merkinta = (tapahtuma, user, tekstiSisalto, nyt) => ({
  ts: nyt.toISOString(),
  tapahtuma,
  user: user || null,
  teksti: teksti(tekstiSisalto, 500),
});

export function luoJalkiraportti({
  id, ownerId, omistaja, nimi, ikkuna, kooste, user, nyt = new Date(),
}) {
  const puhdasNimi = teksti(nimi, 200).trim();
  if (!puhdasNimi) return { ok: false, error: 'Jälkiraportilla on oltava nimi.' };
  if (!kooste || typeof kooste !== 'object') return { ok: false, error: 'Jälkiraporttia ei voi luoda ilman laskettuja lukuja.' };

  const pohja = {
    id,
    ownerId,
    omistaja: omistaja === 'kohde' ? 'kohde' : 'tapahtuma',
    nimi: puhdasNimi,
    // Ikkuna talletetaan erikseen vaikka se on myös koosteessa: raportti on löydettävä
    // ja lajiteltava jaksonsa perusteella ilman että koko kooste luetaan auki.
    ikkuna: { alku: ikkuna?.alku ?? null, loppu: ikkuna?.loppu ?? null },
    kooste,
    tila: 'luonnos',
    luotu: nyt.toISOString(),
    laatija: user || null,
    valmis: null,
    toimenpiteet: [],
    historia: [merkinta('luotu', user, 'Jälkiraportti luotu ja luvut jäädytetty.', nyt)],
  };
  for (const osio of OSIO_IDT) pohja[osio] = '';
  return { ok: true, raportti: pohja };
}

export const onLukittu = (raportti) => raportti?.tila === 'valmis';

// Toimenpide on jälkiraportin ainoa osa jolla on jatkoelämää: havainto ilman vastuuta ja
// määräpäivää on mielipide, ja juuri niistä debrief-muistiinpanot yleensä koostuvat.
function puhdistaToimenpiteet(syote) {
  if (!Array.isArray(syote)) return { ok: false, error: 'Toimenpiteiden on oltava lista.' };
  if (syote.length > 100) return { ok: false, error: 'Toimenpiteitä voi olla enintään 100.' };
  const ulos = [];
  for (const rivi of syote) {
    const t = teksti(rivi?.teksti, 1000).trim();
    if (!t) continue;
    ulos.push({
      id: teksti(rivi?.id, 100) || `tp-${ulos.length + 1}-${Math.random().toString(36).slice(2, 8)}`,
      teksti: t,
      vastuu: teksti(rivi?.vastuu, 200).trim(),
      // Päivämäärä pelkkänä merkkijonona (YYYY-MM-DD): määräpäivä on kalenteripäivä eikä
      // hetki, ja ISO-aikaleimaksi muunnettuna se siirtyisi aikavyöhykkeen mukana.
      maarapaiva: /^\d{4}-\d{2}-\d{2}$/.test(String(rivi?.maarapaiva || '')) ? rivi.maarapaiva : '',
      tehty: rivi?.tehty === true,
    });
  }
  return { ok: true, toimenpiteet: ulos };
}

export function paivita({ raportti, muutokset, user, nyt = new Date() }) {
  if (!raportti) return { ok: false, error: 'Jälkiraporttia ei löytynyt.' };
  if (onLukittu(raportti)) {
    return { ok: false, error: 'Valmis jälkiraportti on lukittu. Avaa se ensin uudelleen muokattavaksi.' };
  }

  const paivitetty = { ...raportti };
  for (const osio of OSIO_IDT) {
    if (typeof muutokset?.[osio] === 'string') paivitetty[osio] = teksti(muutokset[osio]);
  }
  if (typeof muutokset?.nimi === 'string') {
    const uusi = teksti(muutokset.nimi, 200).trim();
    if (!uusi) return { ok: false, error: 'Jälkiraportilla on oltava nimi.' };
    paivitetty.nimi = uusi;
  }
  if (muutokset?.toimenpiteet !== undefined) {
    const tulos = puhdistaToimenpiteet(muutokset.toimenpiteet);
    if (!tulos.ok) return tulos;
    paivitetty.toimenpiteet = tulos.toimenpiteet;
  }
  // Muokkausta ei kirjata historiaan rivi riviltä: luonnosta kirjoitetaan kymmeniä
  // kertoja, ja historia täyttyisi merkinnöistä jotka eivät kerro mitään. Historia on
  // olemassa tilamuutoksia varten.
  paivitetty.muokattu = nyt.toISOString();
  paivitetty.muokkaaja = user || null;
  return { ok: true, raportti: paivitetty };
}

export function merkitseValmiiksi({ raportti, user, nyt = new Date() }) {
  if (!raportti) return { ok: false, error: 'Jälkiraporttia ei löytynyt.' };
  if (onLukittu(raportti)) return { ok: false, error: 'Jälkiraportti on jo merkitty valmiiksi.' };
  // Tyhjää raporttia ei merkitä valmiiksi. Pelkät luvut ilman yhtäkään havaintoa eivät
  // ole debrief — ne olisi saanut mittaristosta ilman palaveria.
  const onSisaltoa = OSIO_IDT.some((o) => String(raportti[o] || '').trim()) || (raportti.toimenpiteet || []).length > 0;
  if (!onSisaltoa) return { ok: false, error: 'Kirjaa vähintään yksi havainto tai toimenpide ennen valmiiksi merkitsemistä.' };

  return {
    ok: true,
    raportti: {
      ...raportti,
      tila: 'valmis',
      valmis: { ts: nyt.toISOString(), user: user || null },
      historia: [...(raportti.historia || []), merkinta('valmis', user, 'Merkitty valmiiksi.', nyt)],
    },
  };
}

// Avaaminen vaatii syyn ja jää historiaan. Jaettuun dokumenttiin voi jäädä virhe joka on
// korjattava, mutta jos avaamisesta ei jää jälkeä, valmiiksi merkitty raportti voi
// muuttua huomaamatta toiseksi — ja silloin lukitus oli näennäinen.
export function avaaUudelleen({ raportti, user, syy, nyt = new Date() }) {
  if (!raportti) return { ok: false, error: 'Jälkiraporttia ei löytynyt.' };
  if (!onLukittu(raportti)) return { ok: false, error: 'Jälkiraportti on jo luonnos.' };
  const puhdasSyy = teksti(syy, 500).trim();
  if (!puhdasSyy) return { ok: false, error: 'Kerro miksi valmis jälkiraportti avataan uudelleen.' };

  return {
    ok: true,
    raportti: {
      ...raportti,
      tila: 'luonnos',
      valmis: null,
      historia: [...(raportti.historia || []), merkinta('avattu', user, puhdasSyy, nyt)],
    },
  };
}

// Yhteenvetorivi listaa varten. Kooste on iso, eikä listanäkymän tarvitse lukea sitä.
export function kooste(raportti) {
  return {
    id: raportti?.id,
    nimi: raportti?.nimi,
    tila: raportti?.tila,
    ikkuna: raportti?.ikkuna,
    luotu: raportti?.luotu,
    laatija: raportti?.laatija,
    toimenpiteita: (raportti?.toimenpiteet || []).length,
    avoimiaToimenpiteita: (raportti?.toimenpiteet || []).filter((t) => !t.tehty).length,
  };
}
