// Lakisääteinen säilytysaika (LYTP) ja siihen perustuva poistoaikataulu. Jaettu:
// järjestyksenvalvojan ja vartijan toimenpideilmoituksia koskee sama laki riippumatta
// siitä kummalla puolella ne on kirjattu.

// Lakisääteinen säilytysaika: tapahtumailmoitukset on säilytettävä kaksi vuotta
// niiden laatimispäivän kalenterivuoden päättymisen jälkeen, minkä jälkeen
// henkilötietoja sisältävät ilmoitukset on hävitettävä viipymättä ja viimeistään
// kuukauden kuluessa. Vuonna 2026 laadittu ilmoitus on siis säilytettävä
// 31.12.2028 asti ja hävitettävä tammikuun 2029 aikana.
export const SAILYTYSVUOSIA = 2;

export const sailytysaikaPaattyy = (createdAt: any) => {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear() + SAILYTYSVUOSIA, 11, 31, 23, 59, 59);
};

// Jakaa raportit säilytysajan mukaan. "paivamaaraPuuttuu" on olennainen ryhmä eikä
// virhe: createdAt lisättiin vasta 18.8.2026, joten sitä aiemmat raportit eivät
// kerro laatimispäiväänsä. Niiden säilytysaikaa ei voi laskea, joten niitä ei myöskään
// poisteta automaattisesti — ne näytetään erikseen jotta ne voi käydä läpi käsin.
export const jaotteleSailytysajan = (raportit: any[], nyt = new Date()) => {
  const vanhentuneet: any[] = [];
  const voimassa: any[] = [];
  const paivamaaraPuuttuu: any[] = [];
  for (const r of raportit || []) {
    const paattyy = sailytysaikaPaattyy(r?.createdAt);
    if (!paattyy) paivamaaraPuuttuu.push(r);
    else if (nyt > paattyy) vanhentuneet.push(r);
    else voimassa.push(r);
  }
  return { vanhentuneet, voimassa, paivamaaraPuuttuu };
};

// Arkistoidun tapahtuman poistoaikataulu. Tapahtuman tiedot voi hävittää vasta kun
// sen VIIMEISENKIN ilmoituksen säilytysaika on umpeutunut — siksi maksimi eikä
// minimi. Hävitys on tehtävä viipymättä ja viimeistään kuukauden kuluessa, joten
// takaraja on kuukausi myöhemmin. Säilytysaika päättyy aina 31.12., joten kuukauden
// lisäys osuu 31.1. eikä kalenterilaskenta voi yllättää (esim. 31.1. + 1 kk
// venyisi maaliskuulle).
export const tapahtumanPoistoaikataulu = (tapahtuma: any, raportit: any[], nyt = new Date()) => {
  const omat = (raportit || []).filter((r) => (r?.eventId || 'fesx') === tapahtuma?.id);
  const paattymiset = omat.map((r) => sailytysaikaPaattyy(r?.createdAt));
  const tiedossa = paattymiset.filter((p) => p !== null) as Date[];
  const puuttuvia = paattymiset.length - tiedossa.length;
  const voiPoistaa = tiedossa.length > 0 ? new Date(Math.max(...tiedossa.map((d) => d.getTime()))) : null;
  const pitaaPoistaa = voiPoistaa
    ? new Date(voiPoistaa.getFullYear(), voiPoistaa.getMonth() + 1, voiPoistaa.getDate())
    : null;
  return {
    ilmoituksia: omat.length,
    puuttuvia,
    voiPoistaa,
    pitaaPoistaa,
    // Tapahtuma jolla ei ole yhtään ilmoitusta on poistettavissa heti: säilytettävää
    // ei ole.
    //
    // Jos yhdenkin ilmoituksen laatimisaika puuttuu, tapahtumaa EI merkitä
    // poistettavaksi eikä myöhässä olevaksi, vaikka tiedossa olevien ilmoitusten
    // säilytysaika olisi umpeutunut: päivämäärätön ilmoitus voi olla uudempi kuin
    // mikään tiedossa oleva, jolloin todellinen säilytysaika on vielä voimassa.
    // Väärä suunta olisi kehottaa poistamaan dataa jota laki vaatii säilyttämään,
    // joten epävarmuus näytetään epävarmuutena (voiPoistaa on tällöin aikaisin
    // mahdollinen ajankohta, ei varma).
    epavarma: puuttuvia > 0,
    poistettavissa: puuttuvia > 0 ? false : voiPoistaa ? nyt > voiPoistaa : omat.length === 0,
    myohassa: puuttuvia > 0 ? false : pitaaPoistaa ? nyt > pitaaPoistaa : false,
  };
};
