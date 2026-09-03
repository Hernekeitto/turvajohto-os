// Varustepoikkeamat: rikkinäinen tai puuttuva varuste, ja sen eskalointi.
//
// MIKSI OMA KOKOELMANSA EIKÄ KIRJAUS. Varustepoikkeama on tila eikä tapahtuma: radio on
// rikki siihen asti kunnes se on korjattu, ja se tieto on tarpeen joka vuoron alussa.
// Kirjaukset (reports) taas ovat muuttumattomia tapahtumia, eikä niiden tilaa muuteta —
// se on erän 1 koko idea. Poikkeama joka pitäisi voida sulkea ei siis kuulu sinne.
//
// ESKALOINTI ON ERÄN 7 KETJU. Kriittinen poikkeama tekee hälytyksen, joka kulkee
// tavallista tietään: valvomoon heti, tekstiviestinä viiveen jälkeen. Toinen rinnakkainen
// ilmoituskanava tarkoittaisi kahta paikkaa joita pitää seurata, ja hätätilanteessa
// seurataan sitä kumpaa on totuttu seuraamaan.
//
// KRIITTINEN ON HARVINAINEN. Rikkinäinen taskulamppu ei ole kriittinen; ainoa toimiva
// radio yksin työskentelevällä on. Ero on siinä, estääkö puute turvallisen työskentelyn
// juuri nyt — ja se on ihmisen arvio, joten se kysytään eikä pääteltäisi varusteen
// nimestä.

export const TILAT = ['avoin', 'korjattu', 'poistettu'];

export const TILAN_SELITE = {
  avoin: 'Avoin',
  korjattu: 'Korjattu',
  poistettu: 'Poistettu käytöstä',
};

export const VAKAVUUDET = ['normaali', 'kriittinen'];

export const VARUSTEEN_MAX = 80;
export const KUVAUKSEN_MAX = 1000;
export const HUOMION_MAX = 500;

const siivoa = (arvo, max) => {
  let tulos = '';
  for (const merkki of String(arvo ?? '')) {
    const koodi = merkki.codePointAt(0);
    if (koodi === 9 || koodi === 10 || koodi === 13) { tulos += ' '; continue; }
    if (koodi < 32 || koodi === 127) continue;
    tulos += merkki;
  }
  return tulos.trim().slice(0, max);
};

export function luoPoikkeama({ id, ownerId, omistaja, varuste, kuvaus, vakavuus, ilmoittaja, nyt = Date.now() }) {
  const puhdasVaruste = siivoa(varuste, VARUSTEEN_MAX);
  if (puhdasVaruste.length < 2) return { ok: false, error: 'Mikä varuste on kyseessä?' };
  const puhdasKuvaus = siivoa(kuvaus, KUVAUKSEN_MAX);
  if (puhdasKuvaus.length < 3) return { ok: false, error: 'Kerro lyhyesti mikä varusteessa on vialla.' };
  if (!ilmoittaja) return { ok: false, error: 'Ilmoittaja puuttuu.' };

  return {
    ok: true,
    poikkeama: {
      id,
      ownerId,
      omistaja: omistaja === 'kohde' ? 'kohde' : 'tapahtuma',
      varuste: puhdasVaruste,
      kuvaus: puhdasKuvaus,
      vakavuus: vakavuus === 'kriittinen' ? 'kriittinen' : 'normaali',
      tila: 'avoin',
      ilmoittaja,
      ilmoitettu: new Date(nyt).toISOString(),
      kasittelija: null,
      kasitelty: null,
      kasittelyHuomio: '',
      // Viittaus eskaloinnista syntyneeseen hälytykseen. Näin poikkeamasta näkee onko
      // siitä lähtenyt hälytys, eikä sitä tarvitse etsiä hälytyslistasta.
      halytysId: null,
    },
  };
}

export const eskaloituu = (poikkeama) => poikkeama?.vakavuus === 'kriittinen';

// Poikkeaman sulkeminen: korjattu tai varuste poistettu käytöstä. Kummassakin tapauksessa
// kirjataan kuka ja milloin — "korjattu joskus" ei kelpaa vastaukseksi kysymykseen onko
// varuste käytettävissä.
export function kasittele({ poikkeama, tila, user, huomio, nyt = Date.now() }) {
  if (!poikkeama) return { ok: false, error: 'Poikkeamaa ei löytynyt.' };
  if (poikkeama.tila !== 'avoin') return { ok: false, error: 'Poikkeama on jo käsitelty.' };
  if (tila !== 'korjattu' && tila !== 'poistettu') {
    return { ok: false, error: 'Anna käsittelyn tila.' };
  }
  return {
    ok: true,
    poikkeama: {
      ...poikkeama,
      tila,
      kasittelija: user || null,
      kasitelty: new Date(nyt).toISOString(),
      kasittelyHuomio: siivoa(huomio, HUOMION_MAX),
    },
  };
}

// Poikkeaman uudelleenavaus: sama vika ilmeni uudelleen. Uusi tietue eikä vanhan
// avaaminen — kaksi erillistä rikkoutumista on eri asia kuin yksi joka ei korjaantunut,
// ja jälkikäteen niitä ei voi erottaa jos ne ovat samassa rivissä.
export function avaaUudelleen({ poikkeama, id, ilmoittaja, kuvaus, nyt = Date.now() }) {
  if (!poikkeama) return { ok: false, error: 'Poikkeamaa ei löytynyt.' };
  return luoPoikkeama({
    id,
    ownerId: poikkeama.ownerId,
    omistaja: poikkeama.omistaja,
    varuste: poikkeama.varuste,
    kuvaus: kuvaus || poikkeama.kuvaus,
    vakavuus: poikkeama.vakavuus,
    ilmoittaja,
    nyt,
  });
}

export const avoimet = (lista) => (Array.isArray(lista) ? lista : []).filter((p) => p.tila === 'avoin');

// Hälytyksen kuvaus poikkeamasta. Lyhyt ja tylsä: se päätyy tekstiviestiin, ja siellä on
// tilaa vain sille mikä ratkaisee.
export const halytyksenKuvaus = (poikkeama) =>
  `Varuste rikki: ${poikkeama?.varuste || ''}`.trim();
