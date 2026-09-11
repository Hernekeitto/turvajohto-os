# Vuorot, perehdytys ja tehtävien jako — määrittely

Päätetty 10.9.2026. Erät 16–19. Numero on tunniste eikä aikataulu: nämä tehdään ennen
natiiviputken erää 11 (`NATIIVI.md`), joka jää odottamaan.

## Mitä tämä muuttaa

Tänään vartija kirjautuu **kohteeseen** ja etsii itse mitä pitäisi tehdä. Jatkossa hän
kirjautuu **vuoroon**, ja vuoro tietää tehtävänsä.

| Asia | Nyt | Jatkossa |
|---|---|---|
| Vuoro | puhelimen `localStorage`, ei palvelimella | palvelimen tietue, alkaa ja päättyy |
| Perehdytys | nimi ja päivämäärä kohteen kentässä, ei rajaa mitään | kytketty henkilöön ja vuorotyyppeihin, **rajaa pääsyn** |
| Kohteen valinta | kaikki `eventAccess`-kohteet | kohde × vuorotyyppi joihin on perehdytys |
| Tehtävät | vartija etsii itse | tulevat vuorosta; haku on lisäksi, ei tilalle |
| Tehtävän siirto | ei ole | vartijalta vartijalle hyväksyntää vastaan |
| Pakotettu tehtävä | ei ole | pääkäyttäjä määrää, vartija kuittaa |

Lähtötilanne on poikkeuksellisen hyvä: tuotannossa on **yksi kohde, nolla perehdytystä ja
nolla tehtävää**. Mitään vanhaa dataa ei siis tarvitse migroida eikä säästää, ja
perehdytyksen kytkennän voi vaatia heti alusta.

## Päätökset (10.9.2026)

| Asia | Päätös |
|---|---|
| Vuoron malli | Vuorotyypit nyt, kalenteri myöhemmin — tietomalli ei muutu kun kalenteri tulee |
| Vuorotyyppien nimet | Kohdekohtaisesti vapaasti (kauppakeskus: aamu/ilta, tehdas: yö/viikonloppu) |
| Perehdytys puuttuu | Estetään, mutta hälytyskeskus voi myöntää kertaluvan kirjauksen kanssa |
| Tehtävänsiirto | Perehdytystä **ei** tarkisteta, saaja hyväksyy |
| Pakotus | Ei hyväksyntää, mutta vaatii kuittauksen |
| Perehdytyksen tunniste | **Käyttäjätunnus**, ei nimi eikä työntekijätietue |
| Suhde kohderajaukseen | **Perehdytys korvaa** kohderajauksen vartijoilla (ei pääkäyttäjällä eikä hälytyskeskuksella) |
| Perehdytyksen voimassaolo | Ei vanhene v1:ssä, kenttä `voimassaAsti` varattu |
| Vuoron kellonajat | **Rajoittavat**, jousto 2 h molempiin suuntiin |

## Tietomalli

### Vuorotyyppi — kohteen kenttä eikä oma kokoelma

```ts
export type Vuorotyyppi = {
  id: string;
  nimi: string;                 // "Aamuvuoro", "Yövuoro", "Lisävuoro"
  kuvaus?: string;
  alkaa?: string;               // "07:00" — rajoittaa, jousto 2 h molempiin suuntiin
  paattyy?: string;             // puuttuva aika EI rajoita: kellonajaton lisävuoro on olemassa
  tehtavaIdt?: string[];        // viittaus kohteen tehtaviin
  pohjaIdt?: string[];          // viittaus kierrospohjiin (templates, kind: 'patrol')
  arkistoitu?: boolean;
};
```

Kohteelle tulee kenttä `vuorotyypit?: Vuorotyyppi[]`.

Sama ratkaisu kuin vyöhykkeillä ja tehtävillä (päätös V5): vuorotyyppi on kohteen
ominaisuus eikä itsenäinen olio. Se ei elä ilman kohdetta, sitä ei jaeta kohteiden välillä
eikä sillä ole omaa elinkaartaan.

**Viittaus eikä kopio.** Vuorotyyppi osoittaa tehtäviin ja pohjiin id:llä. Kopio
vanhentuisi hiljaa: tehtävän tekstiä korjattaisiin kohteen hallinnassa, ja vuoro näyttäisi
yhä vanhaa. Kopio otetaan vasta vuoron alkaessa, ks. alla.

### Perehdytys — dokumentista oikeudeksi

```ts
export type Perehdytys = {
  id: string;
  nimi: string;                 // säilyy: tapahtuma joka on kirjattu tietylle henkilölle
  username?: string;            // UUSI: ilman tätä perehdytys ei myönnä pääsyä
  employeeId?: string;          // valinnainen lisätieto, ei ratkaise pääsyä
  displayId?: number | null;
  pvm: string;
  perehdyttaja?: string;
  vuorotyyppiIdt?: string[];    // UUSI: mihin vuoroihin tämä perehdytys pätee
  voimassaAsti?: string | null; // varattu, EI voimassa v1:ssä
};
```

Kaksi asiaa on syytä sanoa ääneen, koska molemmat poikkeavat talon tavasta:

**1. `username` on nyt pääsyn ehto, `nimi` ei.** Nimi jää tietueeseen sellaisenaan samasta
syystä kuin ennenkin — perehdytys on tapahtuma, jonka on säilyttävä luettavana vaikka
työntekijä poistetaan rekisteristä. Mutta nimi ei kelpaa tunnisteeksi: kaksi Virtasta on
tavallisempaa kuin yksi. Pääsy ratkeaa ketjusta

```
istunnon käyttäjätunnus  →  perehdytys.username  →  vuorotyyppiIdt
```

Tunnus eikä työntekijätietue, ja syy on mitattavissa: **henkilöstöpankissa on nolla
työntekijää**. Jos pääsy ratkeaisi `employeeId`:stä, koko rekisteri ja tunnusten kytkennät
olisi rakennettava ennen kuin kukaan pääsee yhteenkään vuoroon. Tunnus on se tieto jolla
vartija oikeasti kirjautuu, joten se on myös se jolla pääsy ratkeaa. `employeeId` jää
tietueeseen valinnaisena lisätietona, ja jos henkilöstöpankista tulee myöhemmin totuus,
ketjun voi vaihtaa muuttamatta mallin muotoa.

Perehdytys **valitaan listasta** eikä kirjoiteta käsin. Ilman tunnusta tietue on yhä pätevä
dokumentti mutta ei myönnä mitään, ja kohteen hallinnassa se näytetään erikseen
merkittynä — muuten se näyttäisi toimivalta.

**2. Tyhjä `vuorotyyppiIdt` tarkoittaa EI YHTÄÄN, ei kaikkia.** Tämä on tarkoituksellinen
poikkeus `eventAccess`-käytännöstä, jossa tyhjä lista tarkoittaa "ei rajausta". Sama
sopimus tässä olisi vaarallinen: puolivalmis perehdytysmerkintä myöntäisi hiljaa pääsyn
jokaiseen vuoroon, ja virhe näyttäisi täsmälleen samalta kuin harkittu päätös. Sääntö
kirjoitetaan testiin.

### Vuoro — palvelimen kokoelma `guardShifts`

```ts
export type Vuoro = {
  id: string;
  siteId: string;
  siteNimi: string;             // kopio: kohteen nimen muutos ei saa muuttaa mennyttä vuoroa
  vuorotyyppiId: string;
  vuorotyyppiNimi: string;
  vartija: string;              // username
  alkoi: string;
  paattyi: string | null;
  tila: 'kesken' | 'paattynyt';
  // Kopio vuorotyypistä sen alkaessa
  tehtavat: { id: string; nimi: string; lahde: Lahde }[];
  pohjat: { id: string; nimi: string; lahde: Lahde }[];
  perehdytysPoikkeus?: { myontaja: string; aika: string; syy: string } | null;
};

type Lahde = 'vuoro' | 'itse_lisatty' | 'siirto' | 'pakotus';
```

**Kopio otetaan vuoron alkaessa**, täsmälleen kuten kierros kopioi pisteensä pohjasta
(`server/kierros.js`). Kesken vuoron tehty vuorotyypin muokkaus ei saa muuttaa sitä mitä
tältä vuorolta vaadittiin — muuten jälkikäteen ei voi sanoa mitä vartijan piti tehdä.

`lahde` kertoo miksi tehtävä on listalla. Se on raportoinnin kannalta se kiinnostavin
kenttä: se erottaa suunnitellun työn siitä mitä vuoron aikana siirrettiin tai määrättiin.

**Palvelimen ylläpitämä kokoelma** kuten `patrolRuns`: kaikki muutokset omien reittien
kautta, ei `/api/data/:name` PUT:lla. Vuoron säännöt ovat sen ainoa sisältö.

**Puhelimen `localStorage` jää välimuistiksi.** `mobiili/vuoro.ts` säilyy, mutta se ei ole
enää totuus vaan kopio palvelimen tietueesta. Seuraus on kerrottava: **vuoron ALOITUS
vaatii yhteyden**, koska perehdytystä ei voi tarkistaa offline. Päättäminen ja tehtävien
kuittaus menevät jonoon kuten ennenkin — työn tekeminen ei saa pysähtyä katvealueeseen,
mutta työn aloittaminen ilman oikeustarkistusta olisi eri asia.

### Tehtävänanto — kokoelma `guardAssignments`

```ts
export type Tehtavananto = {
  id: string;
  siteId: string;
  vuoroId?: string | null;      // saajan vuoro jos hän on vuorossa
  laji: 'tehtava' | 'kierros';
  kohdeId: string;              // tehtavaId tai pohjaId
  nimi: string;
  antaja: string;
  saaja: string;
  tapa: 'siirto' | 'pakotus';
  tila: 'odottaa' | 'hyvaksytty' | 'hylatty' | 'peruttu' | 'kuitattu';
  viesti?: string;
  luotu: string;
  ratkaistu?: string | null;
};
```

Yksi kokoelma kahdelle asialle, koska ne ovat sama tapahtuma eri oikeudella: joku antaa
jollekin tehtävän. Ero on `tapa`-kentässä ja siinä mitä saaja voi tehdä.

## Ominaisuus 1: kirjautuminen vuoroon

Kirjautumisen jälkeen näkyy lista **kohde × vuorotyyppi**, ei pelkkiä kohteita:

```
Kauppakeskus Hansa
  Aamuvuoro     07–15    3 tehtävää · 2 kierrosta
  Iltavuoro     15–23    2 tehtävää · 2 kierrosta
                         (Yövuoro — ei perehdytystä)

Tehdas Pohjola
  Lisävuoro     vapaa    1 kierros
```

Perehdyttämätön vuoro **näytetään harmaana** eikä piiloteta. Piilotettu rivi tuottaa
kysymyksen "miksi en näe tätä kohdetta", johon vartija ei löydä vastausta; harmaa rivi
vastaa siihen itse ja kertoo mitä pitää pyytää.

Reitti `GET /api/vuorot/omat` palauttaa **vain kysyjän omat vaihtoehdot**. Tämä on
tietosuojaraja eikä optimointi: kohteen perehdytyslista on henkilötietoa, eikä sitä
lähetetä laitteelle. `src/shared/vuorodata.test.ts` valvoo jo tätä (`perehdytykset` ei saa
päätyä laitteelle), ja sama testi ulotetaan uuteen reittiin.

### Perehdytyksen poikkeus

Hälytyskeskus (`guard_dispatch`) voi myöntää kertaluvan vuoroon johon vartijalla ei ole
perehdytystä. Lupa koskee **yhtä vuoroa**, ei henkilöä eikä kohdetta, ja se vaatii syyn.
Audit: `vuoro_poikkeuslupa` myöntäjineen ja syineen.

Perustelu on sama kuin laitesidonnan nollauksella: yöllä sairastapauksessa joku on
paikalla, ja jos järjestelmä ei taivu, se kierretään sen ulkopuolelta — jolloin lokiin ei
jää mitään. Poikkeus jonka voi myöntää on parempi kuin sääntö jonka voi ohittaa.

## Ominaisuus 2: vuoron tehtävät ja tehtävähakemisto

Vuoron alettua etusivu näyttää sen mitä vuoroon kuuluu. Vartijan **ei tarvitse tietää**
mitä kierroksia kohteessa ajetaan.

Lisäksi kohteen **tehtävähakemisto**: kaikki kohteelle määritellyt tehtävät ja pohjat
haettavissa, ja vartija voi lisätä niistä itselleen. Lisätty merkitään
`lahde: 'itse_lisatty'`.

Miksi molemmat: vuorolista vastaa kysymykseen "mitä minun pitää tehdä", hakemisto
kysymykseen "saanko tehdä myös tämän". Jos vain jälkimmäinen olisi olemassa, oltaisiin
nykytilassa. Jos vain edellinen, kukaan ei voisi tehdä ylimääräistä ilman esimiestä.

## Ominaisuus 3: tehtävän siirto vartijalta vartijalle

Vartija X antaa oman tehtävänsä vartija Y:lle. Käyttötapaus on piirivartija, joka tulee
ajamaan kauppakeskusvartijan kierroksen.

- **Perehdytystä ei tarkisteta.** Tämä on tietoinen päätös ja sillä on hinta: piirivartija
  voi ajaa kierroksen kohteessa johon häntä ei ole perehdytetty. Perustelu on että
  vastuun ottaa siirron **antaja**, joka on perehdytetty ja tuntee kohteen. Siksi audit
  nimeää molemmat, ja siksi `lahde: 'siirto'` säilyy vuoron tietueessa: jälkikäteen on
  voitava nähdä että tämä kierros ei ollut perehdytetyn henkilön ajama.
- **Saaja hyväksyy tai hylkää.** Ilmoitus vartijan ilmoituksiin. Hylkäys ei vaadi syytä —
  vaadittu syy tuottaa keksittyjä syitä.
- Siirto **ei poista tehtävää antajalta automaattisesti**, vaan vasta kun saaja hyväksyy.
  Muuten hylätty siirto jättäisi tehtävän ei-kenenkään tehtäväksi.

## Ominaisuus 4: pääkäyttäjän näkymä ja pakotus

Pääkäyttäjä näkee **kaikkien kohteiden kaikki tehtävät ja kierrokset yhtenä listana**,
suodatettavissa kohteen ja lajin mukaan. Tänään sellaista näkymää ei ole: tehtävät ovat
kohteen sisällä, ja niiden vertailu vaatii kohteen vaihtamista.

Listalta voi **pakottaa** tehtävän vartijalle. Ero siirtoon:

| | Siirto | Pakotus |
|---|---|---|
| Kuka | vartija omalle tehtävälleen | pääkäyttäjä / `guard_dispatch` |
| Saaja voi kieltäytyä | kyllä | ei |
| Saajan toimi | Hyväksy / Hylkää | **OK** |
| Näkyy | ilmoituksissa | **estävänä ilmoituksena ruudulla** |

Pakotettu ilmoitus on modaali, joka on kuitattava ennen kuin muuta voi tehdä. Se ei ole
kysymys vaan tiedoksianto: *"Pääkäyttäjä {nimi} on määrännyt sinulle lisätehtävän:
{tehtävä}. OK"*. Kuittaus tallennetaan (`tila: 'kuitattu'`), koska määräys jonka
vastaanotosta ei ole merkintää ei ole määräys.

**Estävä ilmoitus on selaimen modaali, ei natiivin täysruutuhälytys.** Ne ovat eri asia:
täysruutu herättää lukitusnäytön läpi ja kuuluu erään 12 (`NATIIVI.md`, ominaisuus 3).
Tämä toimii vain kun sovellus on auki. Jos pakotuksen pitää tavoittaa nukkuva puhelin,
se odottaa erää 12 — sitä ei luvata tässä.

## Palvelinmuutokset

| Muutos | Tiedosto |
|---|---|
| Vuoron säännöt: kelpaako perehdytys, mitä kopioidaan, saako päättää | `server/vuorot.js` (uusi) + testit |
| Kokoelmat `guardShifts` ja `guardAssignments`, palvelimen ylläpitämät | `server/store.js`, `server/permissions.js` |
| `POST /api/vuoro` · `POST /api/vuoro/:id/paata` · `GET /api/vuorot/omat` | `server/index.js` |
| `POST /api/vuoro/:id/tehtava` (itse lisätty hakemistosta) | `server/index.js` |
| `POST /api/siirto` · `POST /api/siirto/:id/vastaa` · `POST /api/siirto/:id/kuittaa` | `server/index.js` |
| `POST /api/vuoro/poikkeus` (hälytyskeskuksen kertalupa) | `server/index.js` |
| Oikeussolmu `guard_shifts` (vuorotyyppien hallinta) | `server/permissions.js`, `src/guard/sivukartta.ts` |
| Audit: `vuoro_alkoi`, `vuoro_paattyi`, `vuoro_poikkeuslupa`, `tehtava_siirretty`, `tehtava_pakotettu`, `tehtava_kuitattu` | `server/index.js` |
| Kanavaviesti vuoron ja tehtävänannon muutoksista | `server/kanava.js`-kutsut |

Hälytys-, sijainti- ja kierrospolut **eivät muutu**.

## Mitä tämä ei sisällä

- **Kalenteria eikä työvuorosuunnittelua.** Vuorotyyppi on malli, ei suunniteltu vuoro
  tietylle päivälle ja henkilölle. Tietomalli on tehty niin että kalenteri voidaan lisätä
  päälle: suunniteltu vuoro viittaisi `vuorotyyppiId`:hen ja lisäisi päivämäärän ja
  vartijan, eikä mikään tässä erässä tehty muuttuisi.
- **Työaikakirjanpitoa.** Vuoro kirjaa alkamisen ja päättymisen, mutta ne ovat
  toiminnallisia aikaleimoja eivätkä palkanlaskennan tosite. Sen sanominen ääneen on
  tärkeää, koska kenttä näyttää samalta.
- **Poissaoloja, lomia eikä sijaisuuksia.**
- **Automaattista vuoron päättämistä kellonajan perusteella.** `paattyy` rajoittaa
  kirjautumista mutta ei lopeta vuoroa. Vuoro päättyy kun vartija päättää sen — tai kun se
  vanhenee vuorokaudessa kuten nyt.

## Erät

Numero on tunniste eikä järjestysnumero suhteessa natiiviputkeen.

### Erä 16 — Vuorotyypit ja perehdytyksen kytkentä ✅ VALMIS 10.9.2026

Kohteen hallintaan uusi Vuorot-välilehti. Perehdytykseen valitaan käyttäjätunnus ja
rastitetaan vuorot. Vartijan puoli ei vielä muutu.

Toteutettu:

| Osa | Tiedosto |
|---|---|
| `Vuorotyyppi`-tyyppi ja `Perehdytys`-laajennus | `src/guard/tyypit.ts` |
| Säännöt: perehdytys, vuoroikkuna, vaihtoehdot, aloituksen portti | `server/vuorot.js` (+ 23 testiä) |
| `GET /api/vuorot/omat` ja `GET /api/kohde/:id/perehdytettavat` | `server/index.js` |
| Vuorot-välilehti ja perehdytyksen kytkentä | `src/guard/KohteenHallinta.tsx` |
| Rajapintakutsut ja tyypit | `src/guard/vuorot.ts` |
| Vuorotyypit laitteelle, perehdytykset eivät | `src/shared/vuorodata.ts` |
| Päästä päähän -todennus | `server/e2e-vuorot.mjs` |

**Vuoroikkuna on vuorokausiympyrä eikä jana.** Yövuoro 23–07 on se tapaus jossa lukujen
vertailu menee väärin, ja `paattyy === alkaa` tarkoittaa vuorokautta eikä nollaa — nollan
mittainen vuoro ei ole mikään vuoro, joten se tulkinta ei voi olla oikea. Molemmat testissä.

**Päästä päähän -todennus kannatti.** Reitit oli kirjoitettu kohtaan jossa `guardPortti` oli
vielä ajallisessa kuolleessa vyöhykkeessä (`const`), eli **palvelin ei käynnistynyt
lainkaan**. Tyyppitarkistus, yksikkötestit ja käännös menivät kaikki läpi — vain oikeasti
käynnistetty palvelin paljasti sen. Siksi `server/e2e-vuorot.mjs` jätettiin repoon:

```
node server/e2e-vuorot.mjs
```

Se nostaa oikean palvelimen väliaikaiseen `DATA_DIR`:iin, ei koske tuotantoon, ja siivoaa
jälkensä. Tämä vikaluokka toistuu joka kerta kun 3 900 rivin `index.js`:ään lisätään reitti.

**Mitä erä 16 EI vielä tee:** perehdytys ei vielä rajaa kohdenäkyvyyttä. Päätös oli että se
korvaa kohderajauksen, mutta kytkin kuuluu erään 17 uuden kirjautumisnäkymän kanssa —
sillä hetkellä kun se käännetään, jokainen vartijatunnus jolla ei ole yhtään perehdytystä
menettää näkyvyyden kaikkiin kohteisiin. Erä 16 on juuri se työkalu jolla perehdytykset
syötetään ensin.

### Erä 17 — Vuoron aloitus ja päättäminen 🟢 VALMIS 10.9.2026

Vartija kirjautuu nyt **vuoroon** eikä kohteeseen, ja vuoro on palvelimen tietue.

| Osa | Tila |
|---|---|
| Elinkaaren säännöt (`aloitaVuoro`, `paataVuoro`, `lisaaVuoroon`) | valmis, 16 testiä |
| `guardShifts`-kokoelma, palvelimen ylläpitämä | valmis |
| `GET /api/vuoro/oma` | valmis |
| `POST /api/vuoro` · `/:id/paata` · `/:id/lisaa` | valmis |
| Hälytyskeskuksen kertalupa | valmis |
| Kanavaviesti vuoron muutoksista | valmis |
| Kirjautumisnäkymä (kohde × vuoro) kolmella tilalla | valmis |
| Vuoron kierrokset ensin ja merkittyinä etusivulla | valmis |
| Tehtävähakemisto etusivulla | valmis |
| Kohdenäkyvyys perehdytyksen mukaan | valmis |
| Natiivisilta saa vuoron tunnisteen ja vuorotyypin | valmis |

**Palvelin on totuus, laite on kopio.** Laitteen `localStorage` luetaan ensin, jotta
näkymä on oikea heti eikä vilku tyhjänä verkon ajan, mutta palvelin voittaa
ristiriidassa. Todennettu selaimessa pyyhkimällä laitteen tallenne kesken vuoron: vuoro
palautui silti, ja kopio kirjoitettiin takaisin.

**Verkkovirhe ja "ei vuoroa" ovat eri asioita.** `haeOmaVuoro` palauttaa `undefined`in kun
palvelinta ei tavoiteta ja `null`in kun vuoroa ei ole. Jos ne olisivat sama arvo,
katvealue päättäisi vartijan vuoron hänen puolestaan.

**Aloitus vaatii yhteyden, päättäminen ei.** Perehdytystä ei voi tarkistaa offline, joten
aloitus on ainoa kohta koko mobiilipuolella joka vaatii verkon. Päättäminen lähtee
palvelimelle mutta ei jää sen varaan — katvealueelle jäänyt pyyntö tarkoittaisi muuten,
ettei vartija pääse ulos vuorosta ennen kuin verkko palaa.

**"Vaihda kohdetta" on nyt "Vaihda vuoroa (päättää nykyisen)".** Sama painike kutsui
ennenkin `paataVuoro`a, mutta silloin se päätti vain laitteen tilan. Nyt se päättää vuoron
myös palvelimella, ja se on kirjaus — painike joka aliarvioi tekonsa on pahempi kuin
pitkä nimi.

#### Kohdenäkyvyys: mitä rajaus koskee ja mitä ei

Perehdytys korvaa kohderajauksen **kohdelistassa** (`GET /api/data/guardSites`). Se ei ole
täydellinen tietoraja vaan täsmälleen se mitä päätöksessä tarkoitettiin: vartija ei näe
kohteita joihin häntä ei ole perehdytetty. Muut kohdesidonnaiset kokoelmat — raportit,
kierrokset, hälytykset — noudattavat yhä `eventAccess`-rajausta ja omia solmujaan. Tämä on
sanottava, koska "perehdytys korvaa kohderajauksen" kuulostaa laajemmalta kuin se on.

Rajaus **ohitetaan kolmella ehdolla**, ja jokaisella on oma syynsä:

| Ohitus | Miksi |
|---|---|
| Pääkäyttäjä | hallinnoi järjestelmää, ei tee vuoroja perehdytyksen nojalla |
| `guard_sites` muokkaus | ylläpitää kohteita joihin häntä ei ole perehdytetty |
| `guard_dispatch` | valvoo kaikkia kohteita olematta kentällä |

Ilman näitä rajaus tekisi kohteiden hallinnasta mahdotonta juuri niille joiden tehtävä se
on. Molemmat solmut ovat globaaleja (`permissions.js`: GLOBAL_NODES), joten tarkistus ei
ole kohdekohtainen.

**Kesken oleva vuoro ohittaa perehdytyksen.** Hälytyskeskus voi avata vuoron kertaluvalla
ilman perehdytystä; ilman tätä poikkeusta vartija saisi vuoron muttei näkisi kohteen
ohjeita, yhteystietoja eikä vyöhykkeitä — lupa antaisi työn muttei sen tekemiseen
tarvittavaa tietoa. Todennettu päästä päähän: lupa avaa kohteen, ja vuoron päätyttyä se
katoaa taas.

#### Natiivisilta

`turvajohto-guard://vuoro?id=…&nimi=…&vuoro=…`. Kaksi muutosta:

- `nimi` sisältää nyt vuorotyypin (`"Kauppakeskus Hansa · Yövuoro"`). Pysyvä ilmoitus
  erottaa siis aamu- ja yövuoron, ja se on juuri se mitä vartija ilmoituksesta tarkistaa
  kun epäilee kirjautuneensa väärään vuoroon. **Toimii nykyisellä APK:lla** — se näyttää
  merkkijonon sellaisenaan.
- `vuoro` on palvelimen vuorotietueen tunniste. **Nykyinen APK ei lue sitä**
  (`SiltaActivity` poimii vain `id`:n ja `nimi`:n, ja tuntematon kyselyparametri jää
  huomiotta). Se lähetetään silti nyt, jotta kun sijainnin lähetys erässä 11 ripustetaan
  vuoroon, tieto on jo sillassa — kaksi muutosta yhdellä kertaa on kaksi kertaa vaikeampi
  todeta oikeaksi.

**Kertalupa toteutui yksinkertaisemmin kuin määrittelyssä.** Alkuperäinen ajatus oli
hyväksyntäjono: vartija pyytää, päivystäjä myöntää, vartija aloittaa. Toteutus on sen
sijaan että **päivystäjä aloittaa vuoron vartijan puolesta** (`vartija`-kenttä rungossa,
vaatii `guard_dispatch`). Se vastaa sitä miten asia oikeasti tapahtuu — vartija soittaa
hälytyskeskukseen — eikä vaadi omaa kokoelmaa, jonoa eikä odotustilaa. Syy on pakollinen
ja jää sekä vuoron tietueeseen (`perehdytysPoikkeus`) että auditlokiin.

Lupa avaa **vain** perehdytyksen ja kellon. Olematonta tai arkistoitua vuoroa se ei avaa:
lupa vuoroon jota ei ole ei ole lupa vaan tietue joka näyttää luvalta.

**Sama TDZ-ansa toistui.** Reitit kirjoitettiin taas kohtaan jossa `guardPortti` oli vielä
ajallisessa kuolleessa vyöhykkeessä, ja palvelin kieltäytyi käynnistymästä. `node --check`,
typecheck ja 405 yksikkötestiä menivät kaikki läpi. `server/e2e-vuorot.mjs` nappasi sen
toisen kerran peräkkäin — se on nyt 54 väitettä.

#### Alkuperäinen suunnitelma

`server/vuorot.js` sääntöineen ja testeineen, `guardShifts`-kokoelma, uusi
kirjautumisnäkymä, tehtävien kopiointi vuorosta, tehtävähakemisto, hälytyskeskuksen
kertalupa. Natiivisilta saa vuoron tunnisteen kohteen lisäksi.

**Valmis kun:** vartija valitsee vuoron, tehtävät ilmestyvät ilman että hän tietää mitä
pyytää, palvelimella on tietue alku- ja loppuaikoineen, perehdyttämätön vuoro on estetty,
kertalupa avaa sen ja jää lokiin — ja sovelluksen valvonta käynnistyy samalla
(`valvontaElossa: true`, ks. `NATIIVI.md` päivätesti 10.9.).

### Erä 18 — Tehtävän siirto vartijalta vartijalle 🟢 VALMIS 10.9.2026

**Määrittely muuttui toteutettaessa, ja muutos oli käyttäjän eikä minun.** Alkuperäinen
suunnitelma lisäsi siirretyn tehtävän saajan vuoroon. Se ei toimi: piirivartija on omassa
vuorossaan **toisessa kohteessa**, eikä siirretty kierros mahdu sinne ilman että vuoron
tietue lakkaa vastaamasta kysymykseen missä vartija oli töissä.

Päätös 10.9.2026: **työlista on VARTIJAN, ei vuoron.** Vuoro vain kylvää sen. Listaan
yhdistetään kolme lähdettä, ja niillä on prioriteettijärjestys:

1. Hälytystehtävät
2. Kohteen kierrokset ja tehtävät suoritusaikojensa mukaan
3. Suoritetut tehtävät

Siirto on siksi **oma tietueensa** (`guardAssignments`) eikä rivi saajan vuorossa.

**Avoin kohta: tehtävillä ei ole suoritusaikoja.** Vuorotyypillä on kellonajat, mutta
yksittäisellä kierroksella tai tehtävällä ei. Kohta 2 järjestetään toistaiseksi vuoron
määrittelemään järjestykseen. Aikakenttä on lisättävä ennen kuin järjestys voi vastata
sitä mitä se lupaa.

| Osa | Tila |
|---|---|
| Siirron säännöt (`server/siirto.js`) | valmis, 18 testiä |
| `guardAssignments`-kokoelma, palvelimen ylläpitämä | valmis |
| `GET /api/siirrot/omat` (saapuvat, hyväksytyt, lähtevät) | valmis |
| `POST /api/siirto` · `/:id/vastaa` · `/:id/peru` | valmis |
| Hyväksytty siirto avaa kohteen saajalle | valmis |
| Siirtopainike antajalle + vastaanottajan valinta | valmis |
| Hyväksy/hylkää saajan etusivulla | valmis |
| Yhdistetty prioriteettilista etusivulla | valmis |
| `GET /api/siirrot/vastaanottajat` (ketkä ovat vuorossa) | valmis |

#### Listan järjestys

```
1. Lauenneet hälytykset
2. Käynnissä olevat hälytykset
3. Saapuvat siirrot (odottavat vastausta)
4. Hyväksytyt siirrot ja vuoron oma työ
5. Tehdyt kierrokset
```

Käynnissä oleva hälytys oli aiemmin listan **pohjalla**, kierrosten alla. Se on
hälytystehtävä siinä missä lauennutkin, ja sen paikka on muun työn yläpuolella.

Saapuva siirto on hälytysten jälkeen mutta ennen omaa työtä: vastaaminen kestää sekunnin
ja vapauttaa toisen vartijan suunnittelemaan vuoronsa.

**Siirtopainike ei ole kortin sisällä.** Kortti itse on `<button>`, ja sisäkkäinen painike
ei ole kelvollista HTML:ää eikä avautuisi näppäimistöltä. Siirto on sisarelementti kortin
alla. Sitä ei näytetä kesken olevalle kierrokselle: puolikkaan kierroksen luovuttaminen
jättäisi kuittaukset kahden vartijan nimiin.

#### Selaintesti paljasti valheellisen koeasetelman

Ensimmäinen kahden vartijan selainajo näytti onnistuvan, mutta **antaja ajoi
pääkäyttäjänä**: `server/db.js` ylentää taulukon ensimmäisen tilin adminiksi jos yhtään
adminia ei ole, eikä koedatassa ollut. Testi mittasi siis pääkäyttäjän oikeuksia vaikka
väitti mittaavansa vartijan. Lisäksi koetasolta puuttui `guard_sites`-katseluoikeus, joka
sisäänrakennetulla Vartija-tasolla on (`roles.js`: VARTIJA_KATSELU) — ilman sitä
mobiilinäkymä näyttää "Ei näkyvyysoikeutta".

Molemmat korjattiin ja ajo toistettiin oikeilla vartijatunnuksilla. Lopputulos:

- Antaja näki "Siirrä toiselle vartijalle" vain vuoron omilla kierroksilla
- Vastaanottajalistalla näkyi toinen vartija ja hänen kohteensa
- Saaja näki pyynnön ylimpänä viesteineen, hyväksy/hylkää-painikkeineen
- **Ennen hyväksyntää saaja näki yhden kohteen, hyväksynnän jälkeen kaksi**

**Siirtää voi vain vuorossa olevalle** (päätös 10.9.2026). Perustelu on ihmisen eikä
koneen: vapaapäivää viettävälle vartijalle ei kuulu lähettää hyväksymispyyntöä keskellä
yötä. Pakotus (erä 19) ei tunne tätä ehtoa — määräys ei ole pyyntö, eikä sen ehtona voi
olla että saaja on sattumalta kirjautunut vuoroon.

**Hyväksytty siirto avaa kohteen saajalle**, samoin kuin kesken oleva vuoro. Ilman tätä
siirto olisi lupaus jota ei voi lunastaa: työ ilman kohteen ohjeita, yhteystietoja ja
vyöhykkeitä ei ole tehtävissä — ja juuri siirron käyttötapaus on vartija jolla EI ole
perehdytystä siihen kohteeseen. Todennettu päästä päähän: saaja ei näe kohdetta ennen
siirtoa ja näkee sen hyväksynnän jälkeen.

**Hylkäys jättää tehtävän antajalle** ja hyväksyntä siirtää sen. Hyväksyttyä ei voi perua:
se on jo toisen työtä, ja pois ottaminen ilman että saaja tietää olisi juuri se tilanne
jossa kierros jää ajamatta kummaltakin.

#### Alkuperäinen suunnitelma

`guardAssignments`, hyväksyntäilmoitus, `lahde`-kentän kulku vuoron tietueeseen.

**Valmis kun:** X antaa tehtävän Y:lle, Y näkee sen ilmoituksissaan, hyväksyntä siirtää
tehtävän ja hylkäys palauttaa sen X:lle, ja auditlokista näkee molemmat nimet.

### Erä 18b — Suoritusajat ja vuoron kooste 🟢 VALMIS 10.9.2026

Erän 18 listajärjestys lupasi "kohteen kierrokset ja tehtävät **suoritusaikojensa
mukaan**", mutta suoritusaikoja ei ollut olemassa. Tämä erä lisää ne.

**Suoritusaika on työkalu eikä sääntö** (päätös 10.9.2026). Se ei estä eikä salli mitään:
tehtävän voi tehdä milloin tahansa, ennen aikaa tai jälkeen. Se tekee kaksi asiaa —
kertoo vartijalle milloin työ on suunniteltu tehtäväksi, ja järjestää työlistan.

Ero vuorotyypin kellonaikoihin on olennainen ja se on syytä pitää mielessä koodia
lukiessa: **ne rajoittavat kirjautumista, tämä ei rajoita mitään.**

| Asia | Ratkaisu |
|---|---|
| Missä aika elää | Tehtävässä ja kierrospohjassa itsessään (`suoritusaika: "22:00"`) |
| Miksi siellä | Jokaiselle vuorolle tehdään omat kierroksensa ja tehtävänsä, joten sekaannusta ei synny |
| Liukuma | ±5 min. Klo 19 tarkoittaa 18:55–19:05 |
| Pakotettu tehtävä | **Ei poikkeamaa.** Yövuoron tehtävän aika ei voi olla oikein aamuvuorossa |
| Kierroksen vertailuhetki | **Aloitus**, ei päättyminen |

**Kierroksen vertailuhetki on aloitus.** "Sulkukierros klo 19" tarkoittaa että kierros
aloitetaan seitsemältä; neljäkymmentä minuuttia kestänyt kierros ei ole myöhässä siksi
että se päättyi 19:40.

#### Vuoron kooste — näkymä jota ei ollut lainkaan

Vuorotietue on ollut palvelimella erästä 17 asti, mutta **yksikään näkymä ei lukenut
sitä**: `src/`-puolella ei ollut ainuttakaan viittausta `guardShifts`iin. Keltainen
merkintä tarvitsi paikan, ja paikka piti rakentaa.

Kooste näytetään kun vartija päättää vuoron: mitä kuului vuoroon, mitä tehtiin, mitä jäi
tekemättä, ja keltaisella ne jotka tehtiin liukuman ulkopuolella. Se näytetään
**vartijalle** eikä vain päivystäjälle: unohtunut kierros selviää muuten vasta seuraavana
päivänä jonkun toisen katsoessa listaa, eikä sille voi silloin tehdä mitään. Koosteen
paikka on se hetki jolloin vartija on vielä kohteessa.

**Kooste lasketaan pyydettäessä eikä tallenneta vuoron tietueeseen.** Se on johtopäätös
lähdeaineistosta (kierrokset, tehtäväsuoritukset), ja tallennettu johtopäätös vanhenee
hiljaa kun lähdeaineisto korjataan. Vuoron omat kentät — alkoi, päättyi, mitä siihen
kuului — ovat tietueessa, ja ne ovat tosiasioita.

Kesken oleva kierros ei ole tehty eikä tekemätön vaan **kesken**. Niputtaminen kumpaankaan
antaisi väärän luvun juuri siitä mitä luku väittää mittaavansa.

#### Testi löysi vian jota ei olisi huomannut

`new Date(null)` on kelvollinen päivämäärä (epookki). Ilman erillistä tyhjän tarkistusta
puuttuva aikaleima olisi tuottanut **tekaistun poikkeaman** sen sijaan että kertoisi ettei
suoritusta ole — keltaisia merkintöjä tyhjästä. Testi `ilman suoritusaikaa tai suoritusta
ei ole poikkeamaa` nappasi sen.

### Erä 19 — Pääkäyttäjän kaikki tehtävät ja pakotus 🟢 VALMIS 11.9.2026

| Osa | Tila |
|---|---|
| Pakotuksen säännöt (`server/siirto.js`) | valmis, 26 testiä |
| `GET /api/tehtavat/kaikki` (kaikki kohteet yhtenä listana) | valmis |
| `POST /api/pakota` · `POST /api/siirto/:id/kuittaa` | valmis |
| Tehtävien jako -näkymä pääkäyttäjälle ja päivystäjälle | valmis |
| Estävä kuittausilmoitus vartijalle | valmis |

**Pakotus eroaa siirrosta kahdessa asiassa ja vain niissä:** saaja ei voi kieltäytyä, ja
hänen on kuitattava. Kuittaus **ei ole hyväksyntä** — sitä ei voi hylätä. Se on merkintä
siitä että määräys on nähty, ja määräys jonka vastaanotosta ei ole merkintää ei ole
määräys vaan toive.

Pakotus ei vaadi saajalta vuoroa toisin kuin siirto: määräys ei ole pyyntö, eikä sen
ehtona voi olla että saaja on sattumalta kirjautunut vuoroon. Todennettu selaimessa:
ilmoitus tuli ruudulle vartijalle joka oli vasta vuoronvalintanäkymässä.

**Estävä ilmoitus on selaimen modaali, ei natiivin täysruutuhälytys.** Se toimii vain kun
sovellus on auki. Jos pakotuksen pitää herättää nukkuva puhelin, se odottaa natiiviputken
erää 12 (`NATIIVI.md`, ominaisuus 3). Sulkupainiketta ei ole: ainoa ulospääsy on kuittaus,
koska ilmoitus jonka voi pyyhkäistä pois on ilmoitus jota ei lueta.

**Suoritusaikaa ei näytetä eikä käytetä pakotetulle tehtävälle.** Se on toisen vuoron aika
eikä voi olla oikein tässä (päätös 10.9.2026), joten aikataulu kerrotaan määräyksen
viestissä. Määräysikkunassa on siitä erillinen vinkki.

#### Kaksi vikaa jotka löytyivät testaamalla

**E2E:tä kirjoittaessa:** `omatSiirrot` olisi laittanut pakotuksen myös `saapuvat`-listaan,
jolloin se olisi näkynyt sekä hyväksyttävänä korttina että estävänä modaalina — kaksi eri
lupausta samasta tietueesta, joista toinen on väärä.

**Selaintestissä:** kuitattu pakotus **katosi työlistalta** heti kun se kuitattiin, vaikka
kuittausmodaali lupasi "tehtävä on jo lisätty sinulle". `hyvaksytyt` tunnisti vain tilan
`hyvaksytty`. Hyväksytty siirto ja kuitattu pakotus ovat saajan kannalta sama asia —
molemmat tarkoittavat että työ on nyt tämän vartijan, ja ero on vain siinä saiko hän
valita. Tämä on nyt oma joukkonsa (`OMAKSI_TULLEET`) eikä kahteen paikkaan kirjoitettu
ehto.

### Erä 19 — alkuperäinen suunnitelma

Koko organisaation tehtävälista suodattimineen, pakotus ja estävä kuittausmodaali.

**Valmis kun:** pääkäyttäjä näkee kaikkien kohteiden tehtävät yhdellä sivulla, voi pakottaa
kierroksen vartijalle, vartijan ruudulle tulee estävä ilmoitus jota ei voi ohittaa
kuittaamatta, ja kuittaus tallentuu aikaleimoineen.

## Avoimet kysymykset

1. **Saako vartija olla kahdessa vuorossa yhtä aikaa?** Ehdotus: ei — sama sääntö kuin
   kierroksella (`server/index.js`: yksi kesken oleva kierros kohteessa). Kahden yhtaikaisen
   vuoron tehtävistä ei tietäisi kumpaan ne kuuluvat.
2. **Mitä tapahtuu vuoron tehtäville kun vuoro päättyy tekemättä niitä?** Ehdotus: vuoro
   päättyy silti, mutta tekemättömät jäävät tietueeseen ja näkyvät raportilla. Estäminen
   tarkoittaisi että vuoroa ei voi päättää, ja silloin se jätetään päättämättä.
3. **Kuka näkee vuorohistorian?** Ehdotus: vartija omansa, hälytyskeskus kohteen,
   pääkäyttäjä kaikki.
