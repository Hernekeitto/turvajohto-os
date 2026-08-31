// Lomakerekisteri: yksi paikka, jossa jokaisen lomakkeen tunnus, pohjan versio ja
// varianttivalikoima määritellään. Sama periaate kuin server/store.js:n
// KNOWN_COLLECTIONS-listalla: lomaketta koskevat merkkijonot eivät saa olla hajallaan
// näkymissä. Nyt ne ovat, ja siitä on jo seurannut kaksoiskirjanpito — "Täytettävät
// lomakkeet" -näkymässä on erikseen "Ensiapukaavake" ja "Löytötavarailmoitus", vaikka
// ne ovat sama lomake kuin tike_form_firstaid ja tike_form_lostfound.
//
// Tunnus koostuu KOLMESTA erillisestä tiedosta. Niiden sekoittaminen rikkoo arkistoinnin:
//   kirjainosa    = mikä lomake                        EA
//   varianttinro  = mikä versio samasta lomakkeesta     02 = henkilöstöversio
//   pohjan versio = monesko laadittu versio pohjasta    v1.3
// Tulosteen alatunniste on siis "EA-02 v1.3".
//
// Lomaketunnusta EI viedä kirjaustunnisteeseen (26/FesX/1108/099). Kirjaustunniste
// yksilöi yhden täytetyn kirjauksen, lomaketunnus sen pohjan jolla kirjaus tehtiin.
// Siksi getDynamicId() säilyy ennallaan eikä olemassa olevia tietueita tarvitse
// migratoida: lomaketunnus tallennetaan omaksi kentäkseen (formCode).
//
// Valittu malli (päätös 31.8.2026): puhuva kirjainlyhenne + yksinumeroinen jakelutaso.
// Perustelu: lomakkeita on noin 35 eikä 350, ja kirjaintunnus luetaan ääneen radiossa ja
// kirjoitetaan käsin paperille. "EA-02" toimii siinä, "TK-04.11" ei. Ryhmäpohjaiseen
// numerointiin (SU-01, TK-04) vaihdetaan vasta jos lomakemäärä ylittää 60 tai
// kirjaintörmäyksiä syntyy — vaihto onnistuu myöhemminkin, koska rekisteri on yhdessä
// tiedostossa.

// Varianttinumero tarkoittaa samaa asiaa kaikilla lomakkeilla. Numero on jakelutaso:
// kuka lomakkeen saa ja mitä siinä näkyy — ei lomakkeen aihe.
export type Variantti = '01' | '02' | '03' | '04' | '05' | '09';

export const VARIANTIT: Record<Variantti, { nimi: string; kuvaus: string }> = {
  '01': {
    nimi: 'Täysi versio',
    kuvaus: 'Kaikki kentät, henkilötiedot selväkielisinä. Arkistoitava alkuperäinen.',
  },
  '02': {
    nimi: 'Henkilöstöversio',
    kuvaus: 'Kevennetty, työntekijöille jaettava. Ei kohdehenkilön tunnisteita.',
  },
  '03': {
    nimi: 'Tyhjä pohja',
    kuvaus: 'Käsin täytettävä paperituloste.',
  },
  '04': {
    nimi: 'Toimeksiantajaversio',
    kuvaus: 'Suorat tunnisteet peitetty, sisältö tiivistetty.',
  },
  '05': {
    nimi: 'Viranomaisversio',
    kuvaus: 'Täysi sisältö sekä lakiviite, laatija ja aikaleima.',
  },
  '09': {
    nimi: 'Arkistoversio',
    kuvaus: 'Lukittu. Muutos vain korjausmerkintänä.',
  },
};

// Ryhmä on sama jaottelu jolla lomakkeet käydään läpi käyttöliittymässä. Ei sama asia
// kuin sivukartan solmu: sama ryhmä voi hajautua usealle sivulle, ja yhden solmun
// (guard_sites) takana on useamman lomakkeen välilehdet.
export type Ryhma = 'suunnittelu' | 'tike' | 'ilmoitus' | 'henkilosto' | 'guard';

export const RYHMAT: Record<Ryhma, string> = {
  suunnittelu: 'Suunnittelu ja hallinto',
  tike: 'TIKE-kirjaukset',
  ilmoitus: 'Lakisääteiset ilmoitukset',
  henkilosto: 'Henkilöstö',
  guard: 'Vartiointi',
};

export type Lomake = {
  nimi: string;
  tuote: 'event' | 'guard';
  ryhma: Ryhma;
  // Sivukartan solmu, jolla lomake täytetään. null = lomakkeelle ei ole vielä omaa
  // näkymää; tunnus on varattu, jotta sitä ei anneta toiselle lomakkeelle ja jotta
  // puute näkyy rekisterissä eikä vain muistilistalla.
  tabId: string | null;
  pohjaVersio: string;
  // Ne variantit jotka sovellus osaa tuottaa TÄNÄÄN. Tyhjä lista = pelkkä varattu
  // tunnus. Näkymä saa tarjota vain tämän listan versioita, jottei painike lupaa
  // tulostetta jota ei ole.
  variantit: Variantti[];
  lakiviite: string | null;
};

// Lomakkeen kirjaintunnus on avain. Sama asiasisältö ei saa toista kirjaintunnusta, ja
// variantti ei ole uusi lomake: kevennetty perehdytyslomake on PE-02 eikä PE2. Jos ero
// ei mahdu varianttitaulukkoon, kyseessä on oikeasti uusi lomake ja se saa oman
// kirjainkoodin.
//
// Pohjan versio kasvaa aina kun kenttä muuttuu. Tämä on olennaista lakisääteisissä
// (TI, KO, VK): kun asetuksen 874/2016 kirjattavat tiedot tarkistetaan Finlexistä ja
// pohjaa muutetaan, vanhoilla kirjauksilla pitää säilyä merkintä siitä millä
// pohjaversiolla ne on tehty.
export const LOMAKKEET: Record<string, Lomake> = {
  // --- EVENT: suunnittelu ja hallinto ---------------------------------------------
  TS: {
    nimi: 'Turvallisuussuunnitelma',
    tuote: 'event', ryhma: 'suunnittelu',
    tabId: null, pohjaVersio: '1.0', variantit: [], lakiviite: null,
  },
  PS: {
    // Pelastussuunnitelmasta on nyt vain tapahtuman perustietojen valintaruutu
    // (rescuePlan, "toimitettu pelastuslaitokselle") — itse suunnitelmaa ei laadita
    // järjestelmässä. Lakiviite (pelastuslaki 379/2011) tarkistettava Finlexistä ennen
    // kuin se painetaan tulosteeseen.
    nimi: 'Pelastussuunnitelma',
    tuote: 'event', ryhma: 'suunnittelu',
    tabId: null, pohjaVersio: '1.0', variantit: [], lakiviite: null,
  },
  YTI: {
    // Kuten PS: perustiedoissa on valintaruutu policeNotification, ei lomaketta.
    // Lakiviite (kokoontumislaki 530/1999) tarkistettava Finlexistä.
    nimi: 'Yleisötilaisuusilmoitus',
    tuote: 'event', ryhma: 'suunnittelu',
    tabId: null, pohjaVersio: '1.0', variantit: [], lakiviite: null,
  },
  TPT: {
    // Tapahtuman luonti- ja muokkauslomake, 13 osiota. Asuu 'landing'-solmun takana,
    // koska tapahtumien luonti ja muokkaus ovat siinä solmussa (ks. sivukartta.ts).
    nimi: 'Tapahtuman perustiedot',
    tuote: 'event', ryhma: 'suunnittelu',
    tabId: 'landing', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  RA: {
    // Ainoa lomake jolla on jo oma kirjaintunnus tuotannossa: getRiskId() tuottaa
    // tunnisteen 26/FesX/RA/001. Mallin A valinta ei siis muuta yhtäkään olemassa
    // olevaa tunnistetta.
    nimi: 'Riskiarviointi',
    tuote: 'event', ryhma: 'suunnittelu',
    tabId: 'documents_risk_new', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  AV: {
    nimi: 'Avausvalmius',
    tuote: 'event', ryhma: 'suunnittelu',
    tabId: 'planning_readiness', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  MIT: {
    // Mitoitus on nyt tapahtuman perustietojen kenttä requiredJvCount (osio 7) ja
    // avausvalmiuden vertailuluku — laskelmaa ei tulosteta omana asiakirjanaan.
    nimi: 'JV-mitoituslaskelma',
    tuote: 'event', ryhma: 'suunnittelu',
    tabId: null, pohjaVersio: '1.0', variantit: [], lakiviite: null,
  },

  // --- EVENT: TIKE-kirjaukset ------------------------------------------------------
  SK: {
    nimi: 'Työntekijän sisäänkirjaus',
    tuote: 'event', ryhma: 'tike',
    tabId: 'tike_form_in', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  UK: {
    nimi: 'Työntekijän uloskirjaus',
    tuote: 'event', ryhma: 'tike',
    tabId: 'tike_form_out', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  AK: {
    nimi: 'Avoin kirjaus',
    tuote: 'event', ryhma: 'tike',
    tabId: 'tike_form_open', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  EA: {
    // "Täytettävät lomakkeet" -näkymän Ensiapukaavake on tämän lomakkeen variantti 03,
    // ei oma lomakkeensa.
    nimi: 'Ensiaputilanne',
    tuote: 'event', ryhma: 'tike',
    tabId: 'tike_form_firstaid', pohjaVersio: '1.0', variantit: ['01', '03'], lakiviite: null,
  },
  UT: {
    nimi: 'Uhkatilanne',
    tuote: 'event', ryhma: 'tike',
    tabId: 'tike_form_threat', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  OV: {
    // Näkymän "Vahinkoilmoitus" tulostaa tike_form_damage -kentät, eli se on tämän
    // lomakkeen variantti 03. Ks. VI:n kommentti.
    nimi: 'Omaisuusvaurio',
    tuote: 'event', ryhma: 'tike',
    tabId: 'tike_form_damage', pohjaVersio: '1.0', variantit: ['01', '03'], lakiviite: null,
  },
  LT: {
    // Näkymän Löytötavarailmoitus on tämän variantti 03, ei oma lomakkeensa.
    nimi: 'Löytötavara',
    tuote: 'event', ryhma: 'tike',
    tabId: 'tike_form_lostfound', pohjaVersio: '1.0', variantit: ['01', '03'], lakiviite: null,
  },
  JO: {
    nimi: 'Portin jonon odotusaika',
    tuote: 'event', ryhma: 'tike',
    tabId: 'tike_form_queue', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  SR: {
    nimi: 'Sääraportti',
    tuote: 'event', ryhma: 'tike',
    tabId: 'tike_form_weather', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  LS: {
    nimi: 'Aitojen ylitys / luvaton sisäänpääsy',
    tuote: 'event', ryhma: 'tike',
    tabId: 'tike_form_fence', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  KR: {
    nimi: 'Kierrosraportti',
    tuote: 'event', ryhma: 'tike',
    tabId: 'tike_form_patrol', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  BR: {
    nimi: 'Briefing',
    tuote: 'event', ryhma: 'tike',
    tabId: 'tike_form_briefing', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  JT: {
    nimi: 'Johdon tilannekatsaus',
    tuote: 'event', ryhma: 'tike',
    tabId: 'tike_form_management', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  TP: {
    // Päivittäinen toimenpidekirjaus (pääsyn estot, poistot, voimakeinot lukumäärinä).
    // Eri lomake kuin TI: tapahtumailmoitukseen kirjataan kohdehenkilön tiedot.
    nimi: 'JV:n tai vartijan toimenpide',
    tuote: 'event', ryhma: 'tike',
    tabId: 'tike_form_jvaction', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },

  // --- EVENT: lakisääteiset ilmoitukset --------------------------------------------
  TI: {
    // Variantti 05 on toistaiseksi sama PDF kuin 01 — oma viranomaistaitto tehdään
    // samalla kun variantit 02 ja 04 saavat yhteisen tulostuspohjan.
    nimi: 'Järjestyksenvalvojan tapahtumailmoitus',
    tuote: 'event', ryhma: 'ilmoitus',
    tabId: 'report_jv', pohjaVersio: '1.0', variantit: ['01', '03', '05'],
    lakiviite: 'LYTP 33 § ja VNA 874/2016 18 §',
  },
  // Kiinniottoilmoitusta EI ole omana lomakkeenaan, vaikka sellainen oli aiemmin
  // suunniteltu ja esiintyy yhä "Täytettävät lomakkeet" -näkymän listassa. Säädökset
  // tuntevat vain yhden asiakirjan: tapahtumailmoituksen. Kiinniotto on sen pakollinen
  // tieto (VNA 874/2016 18 § 1 mom 3 kohta) ja samalla se peruste, jonka takia ilmoitus
  // on ylipäätään pakko laatia. Kun kiinni otettu vapautetaan, velvollisuus on toimittaa
  // sama tapahtumailmoitus poliisilaitokselle (LYTP 8 § ja 33 § 3 mom) — eli kyse on
  // TI:n toimitusmerkinnästä, ei toisesta lomakkeesta. Älä lisää tänne uutta koodia
  // ilman uutta säädösperustetta.
  VK: {
    // Sisäinen asiakirja: voimankäyttöselvitykselle ei ole säädösperustetta, joten
    // sisältö on vapaasti päätettävissä eikä sitä johdeta asetuksesta. Voimakeinojen
    // käyttö itsessään kirjataan tapahtumailmoitukseen (TI).
    nimi: 'Voimankäyttöselvitys',
    tuote: 'event', ryhma: 'ilmoitus',
    tabId: null, pohjaVersio: '1.0', variantit: [], lakiviite: null,
  },
  VI: {
    // AVOIN: onko tämä oma lomakkeensa vai OV:n variantti? Nykyisessä "Täytettävät
    // lomakkeet" -näkymässä Vahinkoilmoitus tulostaa tike_form_damage -kentät, eli se on
    // käytännössä OV-03. Oma tunnus on perusteltu vain jos vahinkoilmoitus on
    // toimeksiantajalle tai vakuutusyhtiölle menevä vastuuasiakirja omine kenttineen —
    // muuten tämä rivi poistetaan ja OV jää ainoaksi. Ratkaistava ennen kuin näkymä
    // rakennetaan rekisterin varaan, muuten kaksoiskirjanpito jatkuu tunnusten kanssa.
    nimi: 'Vahinkoilmoitus',
    tuote: 'event', ryhma: 'ilmoitus',
    tabId: null, pohjaVersio: '1.0', variantit: [], lakiviite: null,
  },

  // --- EVENT: henkilöstö -----------------------------------------------------------
  HT: {
    nimi: 'Työntekijän henkilötietolomake',
    tuote: 'event', ryhma: 'henkilosto',
    tabId: 'global_employee_bank', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  PE: {
    // EVENT-puolen perehdytys puuttuu. GUARD-puolella perehdytysmerkintä on jo olemassa
    // kohteen hallinnassa (KPE) — eri lomake, koska se kiinnittyy kohteeseen eikä
    // tapahtumaan.
    nimi: 'Perehdytyslomake',
    tuote: 'event', ryhma: 'henkilosto',
    tabId: null, pohjaVersio: '1.0', variantit: [], lakiviite: null,
  },
  VL: {
    nimi: 'Vuoron luovutus',
    tuote: 'event', ryhma: 'henkilosto',
    tabId: null, pohjaVersio: '1.0', variantit: [], lakiviite: null,
  },

  // --- GUARD -----------------------------------------------------------------------
  // Kohteen hallinnan kolme lomaketta (KP, KPE, TT) ovat saman sivukartta-solmun
  // (guard_sites) välilehtiä. Ne ovat silti eri lomakkeita: eri kentät, eri tuloste ja
  // eri elinkaari.
  KP: {
    nimi: 'Kohteen perustiedot',
    tuote: 'guard', ryhma: 'guard',
    tabId: 'guard_sites', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  KPE: {
    nimi: 'Kohteen perehdytysmerkintä',
    tuote: 'guard', ryhma: 'guard',
    tabId: 'guard_sites', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  TT: {
    nimi: 'Työvuoron tehtäväpohja',
    tuote: 'guard', ryhma: 'guard',
    tabId: 'guard_sites', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  KK: {
    nimi: 'Tehtäväsuoritus / kierroskuittaus',
    tuote: 'guard', ryhma: 'guard',
    tabId: 'guard_tasks', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  VTP: {
    nimi: 'Vartijan toimenpide',
    tuote: 'guard', ryhma: 'guard',
    tabId: 'guard_report_action', pohjaVersio: '1.0', variantit: ['01'], lakiviite: null,
  },
  VTI: {
    // Eri pykälä kuin EVENT-puolen TI:llä: vartijan tapahtumailmoituksesta säädetään
    // LYTP 8 §:ssä ja järjestyksenvalvojan 33 §:ssä. Sisältövaatimus (VNA 874/2016 18 §)
    // on molemmille sama. Myös eri lomake, koska kirjaus kiinnittyy kohteeseen eikä
    // tapahtumaan (ks. guard/tyypit.ts).
    nimi: 'Vartijan tapahtumailmoitus',
    tuote: 'guard', ryhma: 'guard',
    tabId: 'guard_report_jv', pohjaVersio: '1.0', variantit: ['01'],
    lakiviite: 'LYTP 8 § ja VNA 874/2016 18 §',
  },
};

// Tulosteen alatunniste: "EA-02" tai "EA-02 v1.3". Varianttia ei oleteta vaan se
// annetaan aina — pelkkä "EA" paperissa jättää lukijan arvaamaan, onko käsissä täysi
// versio vai kevennetty.
export const lomakeTunnus = (koodi: string, variantti: Variantti) => `${koodi}-${variantti}`;

export const lomakeTunnusVersioineen = (koodi: string, variantti: Variantti) => {
  const lomake = LOMAKKEET[koodi];
  if (!lomake) return lomakeTunnus(koodi, variantti);
  return `${lomakeTunnus(koodi, variantti)} v${lomake.pohjaVersio}`;
};

export const lomakkeetTuotteelle = (tuote: 'event' | 'guard') =>
  Object.entries(LOMAKKEET)
    .filter(([, lomake]) => lomake.tuote === tuote)
    .map(([koodi, lomake]) => ({ koodi, ...lomake }));

// Sivukartan solmusta lomakkeiksi. Palauttaa listan eikä yhtä lomaketta, koska
// guard_sites-solmun takana on kolme lomaketta — yhden palauttaminen valitsisi niistä
// mielivaltaisesti.
export const lomakkeetTabilla = (tabId: string) =>
  Object.entries(LOMAKKEET)
    .filter(([, lomake]) => lomake.tabId === tabId)
    .map(([koodi, lomake]) => ({ koodi, ...lomake }));

// Tallennetusta raportista lomakkeeksi. Raportilla on typeId eikä tabId, ja sivukartan
// solmu johdetaan siitä samalla säännöllä kuin palvelimella (server/permissions.js:
// `tike_form_${typeId}`). Poikkeukset ovat samat kuin siellä: järjestyksenvalvojan
// tapahtumailmoituksella on oma sivunsa, eivätkä GUARD-puolen raporttityypit noudata
// tike_form-nimeämistä lainkaan.
const TYYPPI_POIKKEUKSET: Record<string, string> = {
  jvreport: 'report_jv',
  guard_action: 'guard_report_action',
  guard_jvreport: 'guard_report_jv',
};

export const lomakeRaportille = (typeId?: string | null) => {
  if (!typeId) return null;
  const tabId = TYYPPI_POIKKEUKSET[typeId] ?? `tike_form_${typeId}`;
  return lomakkeetTabilla(tabId)[0] ?? null;
};
