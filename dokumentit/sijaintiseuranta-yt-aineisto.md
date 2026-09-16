# Sijaintiseurannan käyttöönotto — aineisto henkilöstön kanssa käytävään käsittelyyn

**MALLIPOHJA, EI OIKEUDELLISTA NEUVONTAA.** Laadittu järjestelmän lähdekoodista
16.9.2026. Sisältö kuvaa mitä ohjelmisto tekee; menettelyn oikeellisuudesta vastaa
työnantaja, ja teksti on syytä tarkastuttaa ennen käyttöä.

Tämä on **se aineisto joka annetaan henkilöstölle ennen päätöstä.** Sen jälkeen
laaditaan tiedote (`sijaintiseuranta-informointi.md`) ja vasta sitten otetaan käyttöön.
Järjestys on osa velvollisuutta eikä makuasia.

---

## 0. Miksi tämä menettely on pakollinen

Laki yksityisyyden suojasta työelämässä (759/2004) **21 §:n 1 momentti** (sellaisena kuin
se on laissa 945/2025):

> Työntekijöihin kohdistuvan kameravalvonnan, kulunvalvonnan ja muun teknisin menetelmin
> toteutetun valvonnan tarkoitus, käyttöönotto ja valvonnassa käytettävät menetelmät […]
> kuuluvat yhteistoimintalaissa […] tarkoitetun vuoropuhelun […] piiriin. Muissa kuin
> yhteistoimintalainsäädännön piiriin kuuluvissa yrityksissä […] työnantajan on ennen
> päätöksentekoa varattava työntekijöille tai heidän edustajilleen tilaisuus tulla
> kuulluiksi edellä mainituista asioista.

**Sijaintiseuranta on teknisin menetelmin toteutettua valvontaa.** Se ei ole tulkinnan
varassa: järjestelmä kerää työntekijän sijainnin automaattisesti laitteesta.

Saman pykälän **2 momentti** kertoo mitä menettelyn jälkeen on tehtävä:

> Edellä 1 momentissa tarkoitetun menettelyn jälkeen työnantajan on määriteltävä
> työntekijöihin kohdistuvan teknisin menetelmin toteutetun valvonnan käyttötarkoitus ja
> siinä käytettävät menetelmät sekä tiedotettava työntekijöille valvonnan tarkoituksesta,
> käyttöönotosta ja siinä käytettävistä menetelmistä […]

Määrittely ja tiedottaminen ovat siis pakollisia **riippumatta yrityksen koosta** — myös
silloin kun yhteistoimintalakia ei sovelleta lainkaan.

### Mikä menettely koskee juuri tätä yritystä

| Työntekijöitä säännöllisesti | Menettely |
|---|---|
| Vähintään 50 | Yhteistoimintalain (1333/2021) mukainen **vuoropuhelu**. Asia kuuluu vuoropuhelun kohteeseen 12 §:n kautta, joka luettelee muusta lainsäädännöstä johtuvat käsiteltävät asiat ja viittaa nimenomaisesti 759/2004:n 21 §:n 1 momenttiin. |
| 20–49 | Yhteistoimintalakia sovelletaan rajoitetusti (2 § 2 mom.), ja vuoropuhelun toteuttamisesta säädetään erikseen 7 a §:ssä. **Tarkista voimassa olevasta lain tekstistä mitkä säännökset tähän kokoluokkaan sovelletaan** — luettelo on 2 §:n 2 momentissa, ja sitä on muutettu viimeksi vuonna 2025. |
| Alle 20 | Yhteistoimintalaki ei sovellu. Tilalle tulee 759/2004 21 §:n 1 momentin viimeinen virke: **työntekijöille tai heidän edustajilleen on ennen päätöksentekoa varattava tilaisuus tulla kuulluiksi.** |

Kaikissa kolmessa tapauksessa lopputulos on sama: asia käsitellään henkilöstön kanssa
**ennen** päätöstä, päätöksen jälkeen valvonta määritellään, ja siitä tiedotetaan.

---

## 1. Mitä esitetään käsiteltäväksi

**Työntekijän sijainnin automaattinen kerääminen työvuoron ajalta ja sen näyttäminen
hälytyskeskukselle, sekä sijaintihistorian säilyttäminen määräajan.**

Käyttöönotto koskee: [kuka — koko henkilöstö, vartiointipuoli, tietyt kohteet]

Aikataulu: [pvm]

### Mitä ei esitetä

Rajaus kuuluu esitykseen yhtä lailla kuin sisältö, koska käsittely koskee sitä mistä
päätetään — ei sitä mitä myöhemmin voitaisiin tehdä.

- Ei seurantaa vapaa-ajalla
- Ei jatkuvaa seurantaa vuoron ulkopuolella, ei taustasijaintilupaa
- Ei työsuorituksen, reitin, tauon tai tehokkuuden arviointia sijainnin perusteella
- Ei sijaintitietojen luovutusta asiakkaalle tai kolmannelle osapuolelle
- Ei automaattista päätöksentekoa sijainnin perusteella

## 2. Valvonnan tarkoitus

Esitetty käyttötarkoitus, jonka 21 §:n 2 momentti edellyttää määriteltäväksi:

1. **Työntekijän turvallisuus.** Hätäpainike, man-down ja umpeutunut valvonta-ajastin
   kertovat myös missä työntekijä on. Ilman sijaintia hälytys kertoo että joku on
   pulassa, mutta ei missä.
2. **Avun kohdentaminen.** Hälytystehtävä ohjataan lähimmälle vapaalle yksikölle.
3. **Kohdeturvallisuus.** Vyöhykepoikkeama havaitaan kun kohteen raja ylitetään.
4. **Tilannekuva hälytyskeskukselle.** Missä yksiköt ovat juuri nyt.
5. **Jälkiselvitys ja varmentaminen.** Hälytysten ja kierrosten selvittäminen
   jälkikäteen — myös työntekijän oikeusturvan vuoksi: jälki on se aineisto jolla
   osoitetaan missä yksikkö oli.

Tarkoituksesta seuraa tarpeellisuusarvio, jota 759/2004 **3 §** edellyttää: kerättävän
tiedon on oltava **välittömästi tarpeellista** työsuhteen kannalta, eikä tästä voi
poiketa edes työntekijän suostumuksella.

[Työnantaja: kirjaa tähän oma perustelusi sille, miksi sijainti on välittömästi
tarpeellinen — ja mikä olisi vaihtoehto jos sitä ei kerättäisi. Jos vaihtoehtoa ei
arvioida, tarpeellisuusvaatimusta ei ole arvioitu.]

## 3. Käytettävät menetelmät

Tämä kohta on se jonka 21 § nimenomaan vaatii esitettäväksi: **millä menetelmillä**
valvontaa tehdään.

### 3.1 Kerättävät tiedot

| Tieto | Huomio |
|---|---|
| Leveys- ja pituusaste | Laitteen paikannuksesta |
| Tarkkuus metreinä | Näytetään aina sijainnin rinnalla |
| Nopeus | Vain jos laite antaa; puuttuva arvo säilyy puuttuvana |
| Kulkusuunta | Sama |
| Kuvakoordinaatti | Vain kohteissa joiden pohjakuva on kalibroitu |
| Aikaleima | **Palvelimelta, ei laitteelta** |

Puhelimesta ei lueta mitään muuta.

### 3.2 Keruuväli

| Laite | Väli |
|---|---|
| Puhelinsovellus | Kerran minuutissa; liikkeessä (yli 4 m/s) kerran 15 sekunnissa |
| Selain | Kerran minuutissa **vain sovelluksen ollessa näkyvissä**, lisäksi kirjausten yhteydessä (enintään 10 s välein) |

**Keruu edellyttää kesken olevaa vuoroa.** Ilman sitä mitään ei lähetetä.

### 3.3 Miten työntekijä näkee että seuranta on päällä

Tämä on menettelyn kannalta olennainen kohta, koska se erottaa avoimen valvonnan
salaisesta:

- Puhelinsovelluksen seuranta on Androidin **etualan palvelu**, jolloin ilmoituspalkissa
  on pysyvä ilmoitus koko seurannan ajan eikä sitä voi piilottaa
- Taustasijaintilupaa (`ACCESS_BACKGROUND_LOCATION`) ei pyydetä eikä käytetä
- Sovelluksen valikosta näkee suoraan onko sijainti seurannassa

### 3.4 Kuka pääsee tietoon

- Näkyminen vaatii **oman erillisen käyttöoikeuden**, joka ei tule tilannekuvan tai
  tehtävänäkymän oikeuksien mukana
- Päivystäjä näkee vain ne kohteet joihin hänelle on annettu pääsy
- Pääkäyttäjä näkee kaiken
- **Sijaintinäkymän katsominen kirjataan lokiin** noin 15 minuutin jaksoina

### 3.5 Säilytysajat

| Tieto | Säilytys | Poisto |
|---|---|---|
| Viimeisin sijainti (tilannekuva) | Enintään 30 min | Automaattinen; lisäksi uloskirjautuessa ja vuoron päättyessä |
| Sijaintihistoria | 45 vrk | Automaattinen päivittäin, poistot lokiin |
| Hälytystehtävän jälki | LYTP:n tapahtumailmoitusaika: 2 v laatimisvuoden päättymisestä | **Käsin** — ks. kohta 6 |
| Hätäpainike / man-down / ajastin | Sama kuin edellä | **Käsin** |
| Vyöhykepoikkeama | 45 vrk, minkä jälkeen sijainti poistetaan ja hälytys jää | Automaattinen |
| Kriittinen varustepoikkeama | Sijaintia **ei kerätä lainkaan** | — |

## 4. Vaikutukset työntekijään

Tämä kohta on aineistossa siksi, että käsittely ilman haittojen esittämistä ei ole
käsittely vaan tiedote. Alla on sama arvio joka on tehty vaikutustenarvioinnissa
(`sijaintiseuranta-vaikutustenarviointi.md`), ilman pehmennyksiä.

| Vaikutus | Suoja | Mitä jää jäljelle |
|---|---|---|
| Liikkeet työvuoron aikana tallentuvat | 45 vrk, käyttötarkoitus rajattu | **Jälki on olemassa.** 45 vrk kattaa kokonaisen liikehistorian vuoroista |
| Hälytystehtävien jälki säilyy kaksi vuotta | Vain tehtävän ajalta, vain aika/sijainti/tarkkuus | Pitkä säilytys, ja poisto on käsin tehtävä |
| Sijaintia voidaan katsoa ilman syytä | Erillinen oikeus, katselu lokiin | Loki on jälkikäteinen: se ei estä katsomista, vaan tekee sen näkyväksi |
| Sijaintia voitaisiin käyttää työsuorituksen arviointiin | Käyttötarkoitus rajattu määrittelyssä | **Ei teknistä estettä.** Rajaus on organisatorinen, ja se on sanottava sellaisena |
| Vuoro unohtuu päättää | Muistutus työntekijälle, ilmoitus hälytyskeskukselle, päivystäjä voi päättää | Keruu jatkuu siihen asti |
| Epätarkka sijainti johtaa väärään päätelmään | Tarkkuus ja ikä näkyvät päivystäjälle aina | — |

**Rajauksen luonne kannattaa sanoa ääneen käsittelyssä.** "Järjestelmä ei salli" olisi
vahvempi lupaus kuin "emme tee niin", ja tässä pätee jälkimmäinen. Jos henkilöstö haluaa
vahvemman takeen, se on erillinen kehitystehtävä eikä lupaus.

## 5. Kysymykset joihin käsittelyssä on vastattava

Nämä ovat asioita joihin lähdekoodi ei voi vastata, koska ne ovat työnantajan päätöksiä.
Jos jokin jää auki, se jää auki myös työntekijälle.

1. **Käsittelyperuste.** Mikä se on ja miten se perustellaan? (Työsuhteessa suostumus ei
   yleensä kelpaa, koska sitä ei voi antaa vapaasti.)
2. **Kuka saa katsoa sijaintihistoriaa, ja millä perusteella?** Nykyisessä
   järjestelmässä historian lukemiselle ei ole käyttöliittymää eikä omaa oikeutta — se
   on tehtävä ennen kuin historiaa käytetään.
3. **Kuka valvoo käyttötarkoituksen rajausta**, ja mitä sen rikkomisesta seuraa?
4. **Kuka huolehtii LYTP-säilytysajan päättymisestä ja poistosta?** Ks. kohta 6.
5. **Mitä tapahtuu jos työntekijä kieltäytyy?** Onko työtehtäviä joita ei voi antaa?
6. **Miten työntekijä saa omat tietonsa nähtäväksi**, ja missä ajassa?
7. **Miten toimitaan kun paikannus ei toimi** sisätiloissa — varmistetaanko että
   puuttuvasta sijainnista ei tehdä päätelmiä?
8. **Kuinka usein käytäntö tarkistetaan** ja miten muutokset käsitellään?

## 6. Se mikä on kerrottava, vaikka se ei ole mukavaa

Kaksi asiaa on esitettävä käsittelyssä sellaisina kuin ne ovat, koska molemmat vaikuttavat
siihen mitä henkilöstölle luvataan.

### LYTP-säilytysajalle ei ole automaattista poistoa

Hälytystehtäviin ja turvahälytyksiin liittyvät sijainnit noudattavat yksityisistä
turvallisuuspalveluista annetun lain tapahtumailmoituksen säilytysaikaa, mutta
järjestelmässä ei ole automatiikkaa joka poistaisi ne ajallaan. **Poisto on vastaavan
hoitajan vastuulla ja tehdään käsin.** Tämä koskee koko LYTP-säilytystä eikä vain
sijaintia.

Säilytysaika jota mikään ei valvo on dokumentaatiota eikä suojaa. Jos käsittelyssä
luvataan kahden vuoden säilytys, on samalla sovittava kuka sen käytännössä toteuttaa ja
milloin.

### Keruu on jo käynnissä

Ympäristömuuttuja `SIJAINTISEURANTA=1` on ollut palvelimella päällä 15.9.2026 julkaisusta
alkaen, ja kirjautuneiden vartijoiden laitteet lähettävät sijaintiaan. **Keruu on siis
alkanut ennen tätä käsittelyä.**

Tätä ei pidä kiertää käsittelyssä. Vaihtoehtoja on kaksi, ja ne on syytä esittää
henkilöstölle sellaisina:

1. Käsittely viedään läpi ja keruu jatkuu — tällöin on kerrottava rehellisesti että se
   alkoi ennen menettelyä, ja päätettävä mitä jo kerätylle tiedolle tehdään
2. Muuttuja poistetaan yksikkötiedostosta ja backend käynnistetään uudelleen, jolloin
   keruu pysähtyy välittömästi ja jatkuu vasta käsittelyn jälkeen

Toinen vaihtoehto on menettelyn kannalta puhtaampi. Tekninen este sille ei ole olemassa:
tilannekuvatieto on muistissa, joten pysäytys vie sekunteja.

## 7. Aineisto joka annetaan henkilöstölle

- Tämä asiakirja
- `sijaintiseuranta-vaikutustenarviointi.md` — käsittelyn kuvaus ja vaikutustenarviointi
- Luonnos tiedotteesta: `sijaintiseuranta-informointi.md`
- [Käsittelyperustetta koskeva muistio]
- [Tarpeellisuusarvio]

Yhteistoimintalain piirissä olevissa yrityksissä aineisto annetaan hyvissä ajoin ennen
käsittelyä; ks. lain 10 § vuoropuhelua varten annettavista tiedoista.

## 8. Muistion runko

Menettelystä on jäätävä kirjallinen jälki. Ilman sitä ei voi jälkikäteen osoittaa että
käsittely on käyty — eikä myöskään sitä, mitä silloin sovittiin.

```
Aika ja paikka:
Läsnä:                        (työnantajan edustajat, henkilöstön edustajat)
Menettely:                    vuoropuhelu 1333/2021 / kuuleminen 759/2004 21 § 1 mom
Aineisto annettu:             [pvm]

Käsitelty asia:               sijaintiseurannan tarkoitus, käyttöönotto ja menetelmät

Esitetty:                     [tiivistelmä]
Henkilöstön esittämät näkemykset:
Esitetyt kysymykset ja niihin annetut vastaukset:
Asiat jotka jäivät auki ja miten niitä jatketaan:

Käyttötarkoituksen rajaus, josta sovittiin:
Säilytysajat, joista sovittiin:
Kuka valvoo rajauksen noudattamista:
Kuka vastaa LYTP-säilytysajan poistosta:

Työnantajan päätös ja sen ajankohta:
Tiedote työntekijöille annetaan:  [pvm, miten]
Käytäntö tarkistetaan seuraavan kerran: [pvm]

Allekirjoitukset:
```

## 9. Käyttöönoton järjestys

Näiden järjestys on osa velvollisuutta; ne eivät ole rinnakkaisia askelia.

- [ ] 1. Käsittelyperuste ja tarpeellisuusarvio kirjattu
- [ ] 2. Vaikutustenarviointi viimeistelty
- [ ] 3. Aineisto annettu henkilöstölle
- [ ] 4. Vuoropuhelu tai kuuleminen käyty, muistio laadittu
- [ ] 5. **Työnantajan päätös** — käyttötarkoitus ja menetelmät määritelty (21 § 2 mom.)
- [ ] 6. Tiedote työntekijöille jaettu ja jakelu todennettu
- [ ] 7. Käyttöoikeudet myönnetty vain niille jotka niitä tarvitsevat
- [ ] 8. Sovittu kuka vastaa LYTP-säilytysajan poistosta ja milloin
- [ ] 9. Sovittu miten tarkastuspyyntö omista tiedoista hoidetaan
- [ ] 10. Seuraava tarkistusajankohta kalenteriin

---

**Laadittu:** 16.9.2026 lähdekoodista
**Lakiviittaukset tarkistettu Finlexistä:** 16.9.2026 (759/2004 21 §, sellaisena kuin se
on laissa 945/2025; 1333/2021 2 §, 7 a §, 12 §)
**Tarkastettava ennen käyttöä:** [kuka, pvm]
