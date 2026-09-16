# Sijaintiseuranta työvuoron aikana — tiedote työntekijöille

**MALLIPOHJA, EI VALMIS ASIAKIRJA.** Hakasulkeissa olevat kohdat täyttää se yritys joka
ottaa järjestelmän käyttöön. Turvajohto OS on ohjelmisto; rekisterinpitäjä on
työnantaja, ja informointivelvollisuus on työnantajalla.

Tämä pohja on laadittu järjestelmän lähdekoodista 16.9.2026 ja kuvaa mitä ohjelmisto
oikeasti tekee. **Se ei ole oikeudellista neuvontaa.** Tarkastuta teksti ennen jakelua.

Perusta velvollisuudelle: laki yksityisyyden suojasta työelämässä (759/2004) 21 §:n
2 momentti — yhteistoiminta- tai kuulemismenettelyn jälkeen työnantajan on määriteltävä
valvonnan käyttötarkoitus ja siinä käytettävät menetelmät **sekä tiedotettava niistä
työntekijöille**. Menettely käydään ensin; ks. `sijaintiseuranta-yt-aineisto.md`.

---

## Lyhyesti

Työvuoron aikana puhelimesi kertoo hälytyskeskukselle missä olet. Tarkoitus on, että apu
löytää sinut ja että lähin yksikkö saa hälytystehtävän. **Vuoron ulkopuolella sijaintiasi
ei kerätä lainkaan.**

| | |
|---|---|
| Mitä | Sijaintisi kartalla, tarkkuus metreinä, nopeus ja kulkusuunta |
| Milloin | Vain kun sinulla on vuoro kesken |
| Kuka näkee | Hälytyskeskuksen päivystäjät, joilla on siihen erikseen annettu oikeus |
| Kuinka kauan | Tavallinen sijaintitieto 45 vuorokautta, hälytystehtävän jälki kaksi vuotta |
| Mihin | Avun kohdentaminen ja tapahtumien jälkiselvitys |
| Mihin ei | Työsuorituksen, tauon tai reitin valinnan arviointiin |

---

## 1. Mitä tietoa kerätään

- Sijaintisi (leveys- ja pituusaste)
- Paikannuksen tarkkuus metreinä
- Nopeus ja kulkusuunta, **jos** laitteesi ne kertoo
- Kohteessa jonka pohjakuva on kalibroitu: sijaintisi kohta pohjakuvalla
- Aikaleima

Aikaleima otetaan palvelimelta eikä puhelimestasi. Syy on käytännöllinen: puhelimen kello
voi olla väärässä, ja päivystäjän on tiedettävä kuinka vanhaa tieto on.

**Mitään muuta puhelimestasi ei lueta.** Ei yhteystietoja, ei viestejä, ei sovelluslistaa,
ei selaushistoriaa.

## 2. Milloin sijaintia kerätään

**Vain kun vuorosi on kesken.** Ilman kesken olevaa vuoroa järjestelmä ei kerää mitään.

**Puhelinsovelluksella:** kerran minuutissa. Jos liikut ajoneuvon nopeudella, kerran
15 sekunnissa.

**Selaimella:** kerran minuutissa ja aina kun teet jonkin kirjauksen — mutta **vain kun
sovellus on näkyvissä ruudulla**. Selain ei paikanna taskussa lukitulla näytöllä.

### Näet aina itse, onko seuranta päällä

Kun puhelinsovellus seuraa sijaintia, **ilmoituspalkissa on pysyvä ilmoitus koko ajan.**
Sitä ei voi piilottaa niin kauan kuin vuoro on kesken. Tämä on Androidin pakottama
ominaisuus etualan palveluille, ja se on tässä tarkoituksella: **et voi olla seurannassa
tietämättäsi.**

Sovellus **ei pyydä taustasijaintilupaa** (`ACCESS_BACKGROUND_LOCATION`) eikä käytä
sellaista. Sovelluksen valikosta näet myös suoraan, onko sijaintisi juuri nyt seurannassa.

### Vuoron päättäminen

Sijaintisi lakkaa siirtymästä kun päätät vuoron, ja viimeisin tietokin poistetaan
välittömästi. Vuoron päättäminen kuuluu työvelvollisuuteesi.

Jos vuoro jää päättämättä, järjestelmä muistuttaa sinua [10] minuutin kuluttua merkitystä
päättymisajasta ja ilmoittaa hälytyskeskukselle [15] minuutin kuluttua. Päivystäjä voi
päättää vuoron puolestasi. Siihen asti keruu jatkuu — **päättämättä jäänyt vuoro on ainoa
tilanne, jossa sijaintia kerätään työajan jälkeen.**

## 3. Kuka näkee sijaintisi

Sijainnin näkeminen on **oma erillinen käyttöoikeus**. Se ei tule automaattisesti muiden
päivystäjän oikeuksien mukana: tehtävien näkeminen ja henkilöstön sijainnin näkeminen ovat
järjestelmässä eri asia.

Näkevät:

- Hälytyskeskuksen päivystäjä, jolle oikeus on erikseen annettu — ja hänkin vain niissä
  kohteissa joihin hänelle on annettu pääsy
- Pääkäyttäjä

Eivät näe: muut vartijat, asiakas, kohteen henkilökunta.

**Sijainnin katsominen jää lokiin.** Järjestelmä kirjaa kuka katsoi sijaintinäkymää ja
milloin. Kirjaus tehdään jaksoittain (noin 15 minuutin välein) eikä jokaisesta
ruudunpäivityksestä erikseen, jotta lokista pysyy jokin tolkku.

## 4. Kuinka kauan tietoa säilytetään

Säilytysaikoja on kolme, ja ne riippuvat siitä mistä tiedosta on kyse.

### Viimeisin sijaintisi — enintään 30 minuuttia

Se mitä päivystäjä näkee kartalla. Ei tallennu pysyvästi. Poistuu kun päivität uuden, kun
kirjaudut ulos, kun vuorosi päättyy, kun tiedosta tulee 30 minuuttia vanha, tai kun
palvelin käynnistetään uudelleen.

### Tavallinen sijaintihistoria — 45 vuorokautta

Sijaintipäivitykset tallentuvat päiväkohtaisiin tiedostoihin, ja **45 vuorokautta
vanhemmat päivät poistetaan kokonaan** kerran vuorokaudessa automaattisesti. Poistot
kirjataan lokiin.

### Hälytystehtävän jälki — kaksi vuotta

Kun otat hälytystehtävän vastaan, sijaintijälkesi **tehtävän vastaanottamisesta siihen
hetkeen kun päivystäjä antaa luvan poistua** kopioidaan tehtävän tietoihin. Siihen
sovelletaan yksityisistä turvallisuuspalveluista annetun lain tapahtumailmoituksen
säilytysaikaa: kaksi vuotta laatimisvuoden päättymisestä.

Jälkeen tallentuu vain aika, sijainti ja tarkkuus — ei nopeutta eikä suuntaa. Jos
kieltäydyt tehtävästä, jälkeä ei synny: et ollut tehtävällä.

Tarkoitus on, että kaksi vuotta myöhemminkin voidaan todentaa missä yksikkö oli. Se suojaa
myös sinua: se on sama tieto jolla osoitetaan että olit siellä missä sanoit olevasi.

### Turvahälytyksen sijainti

| Hälytys | Sijainti | Säilytys |
|---|---|---|
| Hätäpainike | Tallentuu | Kaksi vuotta (tapahtumailmoitus) |
| Man-down | Tallentuu | Kaksi vuotta (tapahtumailmoitus) |
| Ajastin umpeutui | Tallentuu | Kaksi vuotta (tapahtumailmoitus) |
| Vyöhykepoikkeama | Tallentuu | 45 vrk, sitten sijainti poistetaan ja hälytys jää |
| Kriittinen varustepoikkeama | **Ei tallennu lainkaan** | — |

Varustepoikkeamasta ei kerätä sijaintia, koska sitä ei tarvita: kysymys on siitä kuka tuo
toimivan varusteen tilalle, ei siitä missä seisot. Koordinaattia ei kirjoiteta levylle
lainkaan — poistettava tieto on aina tieto jonka poisto voi unohtua.

## 5. Mihin tietoa käytetään

1. **Hälytystehtävän kohdentaminen** — kohteen lähellä olevat yksiköt näkevät keikan
2. **Lähimmän yksikön haku** — kuka ehtii tähän osoitteeseen
3. **Vyöhykepoikkeamat** — hälytys kun kohteen raja ylitetään
4. **Tilannekuva** — missä yksiköt ovat
5. **Turvallisuutesi** — hätäpainike, man-down ja umpeutunut ajastin kertovat myös missä
   olet, jotta apu osaa oikeaan paikkaan
6. **Jälkiselvitys** — hälytysten ja kierrosten selvittäminen ja varmentaminen jälkikäteen

### Mihin sitä EI käytetä

**Sijaintitietoa ei käytetä työsuorituksen seurantaan, arviointiin eikä työnjohdollisiin
toimenpiteisiin** — ei siihen kuinka nopeasti liikut, minkä reitin valitset, milloin pidät
tauon tai kuinka kauan viivyt kohteessa.

Tämä rajaus on **organisatorinen, ei tekninen.** Järjestelmässä ei ole estettä joka
mekaanisesti pysäyttäisi jäljen katsomisen muusta syystä. Rajaus on se peruste jolla keruu
on arvioitu, ja sen laajentaminen edellyttäisi uutta käsittelyä henkilöstön kanssa ja uutta
tiedotetta. Sitä ei tehdä muun muutoksen mukana.

[Työnantaja: kirjaa tähän kuka yrityksessä valvoo rajauksen noudattamista ja miten sen
rikkomiseen puututaan. Ilman sitä lupaus jää lauseeksi.]

## 6. Käsittelyn peruste

[Täytä: käsittelyperuste ja sen perustelu. Huomaa, että työsuhteessa suostumus ei yleensä
kelpaa perusteeksi, koska sitä ei voi antaa vapaasti — perusteen on löydyttävä muualta.
Perusteen on oltava kirjattuna ennen kuin tämä tiedote jaetaan.]

Lisäksi: laki yksityisyyden suojasta työelämässä 3 § edellyttää, että kerättävä tieto on
**välittömästi tarpeellista** työsuhteen kannalta. Tästä vaatimuksesta ei voi poiketa edes
työntekijän suostumuksella.

## 7. Oikeutesi

Sinulla on oikeus:

- **Saada tietää** mitä sinusta on tallennettu, ja saada siitä kopio
- **Oikaista** virheellinen tieto
- **Pyytää poistoa** — huomaa, että hälytystehtävien sijaintijälkeä ei voi poistaa
  pyynnöstä ennen säilytysajan päättymistä, koska sen säilyttäminen on lakisääteinen
  velvoite
- **Vastustaa käsittelyä** ja pyytää sen rajoittamista
- **Tehdä valitus** tietosuojavaltuutetun toimistolle (tietosuoja.fi)

Pyynnöt: [nimi / rooli / sähköposti / puhelin]

**Huom.** Sijaintihistorian lukemiselle ei ole vielä käyttöliittymää järjestelmässä.
Tarkastuspyyntö hoidetaan toistaiseksi käsin: [kuvaa miten ja kuinka nopeasti].

## 8. Kun paikannus ei toimi

Sisätiloissa, kellarissa ja metallirakenteisissa kohteissa paikannus on epätarkka tai
puuttuu kokonaan. **Se ei ole rikkomus eikä siitä seuraa mitään.** Järjestelmä näyttää
päivystäjälle paikannuksen tarkkuuden ja sijainnin iän, jottei epätarkkaa tietoa luulla
tarkaksi.

Jos kieltäydyt sijaintiseurannasta tai kytket paikannuksen pois: [täytä, mitä siitä seuraa
käytännössä — onko työtehtäviä joita ei silloin voi antaa, ja kenen kanssa asiasta
puhutaan. Älä jätä tätä kohtaa tyhjäksi: tyhjä kohta luetaan uhkaukseksi.]

## 9. Kenelle tieto siirtyy

[Täytä: palvelimen sijainti ja ylläpitäjä, mahdolliset käsittelijät ja niiden kanssa tehdyt
sopimukset.]

Nykyisessä toteutuksessa sijaintitieto ei siirry kolmansille osapuolille. Myös kartta-
aineisto tarjoillaan omalta palvelimelta: **vartijan tai päivystäjän selain ei karttaa
katsoessaan ota yhteyttä yhteenkään ulkopuoliseen palveluun**, joten sijainnista ei jää
jälkeä karttapalvelun tarjoajalle.

---

**Voimassa:** [pvm] alkaen
**Käsitelty henkilöstön kanssa:** [pvm, menettely]
**Laatinut ja vastaa:** [nimi, rooli]
**Seuraava tarkistus:** [pvm]

Tämän tiedotteen muutokset käsitellään samalla tavalla kuin sen käyttöönotto.
