# Sijaintiseuranta — käsittelyn kuvaus ja vaikutustenarviointi

**Luonnos oikeudellista tarkastusta varten. Laatinut Claude 15.9.2026 järjestelmän
lähdekoodin perusteella. EI OIKEUDELLISTA NEUVONTAA** — tämä kuvaa mitä ohjelmisto
tekee, jotta arvioinnin voi tehdä oikeaan tietoon nojaten. Oikeudelliset johtopäätökset
kuuluvat siihen pätevälle.

**Miksi tämä on koodin mukana eikä erillisessä arkistossa:** arvioinnin on vastattava
sitä mitä järjestelmä oikeasti tekee. Repositoriossa muutos keruuseen ja muutos tähän
asiakirjaan näkyvät samassa katselmoinnissa, ja vanhentunut kohta on mahdollista
huomata. Erillisessä kansiossa se vanhenee hiljaa.

---

## 1. Mitä kerätään

| Tieto | Arvoalue | Lähde |
|---|---|---|
| Leveys- ja pituusaste | WGS84 | Laitteen paikannus |
| Tarkkuus (m) | 0–10 000 | Laitteen paikannus |
| Nopeus (m/s) | 0–100 | Vain jos laite antaa |
| Kulkusuunta (astetta) | 0–360 | Vain jos laite antaa |
| Lähde | `selain` \| `laite` | Lähettäjän ilmoittama |
| Kuvakoordinaatti | 0–1 kohteen pohjakuvalla | Laskettu, jos kohde on kalibroitu |
| Aikaleima | — | **Palvelimelta, ei laitteelta** |

Aikaleima otetaan palvelimelta tarkoituksella: laitteen kello voi olla väärässä, ja
sijainnin ikä on se tieto jonka perusteella päivystäjä päättää luottaako siihen.

Nopeus ja kulkusuunta puuttuvat kun laite ei niitä anna. Puuttuva arvo säilyy
puuttuvana eikä muutu nollaksi — "ei tiedetä" ja "seisoo paikallaan" ovat eri asioita.

## 2. Milloin ja kuinka usein

**Selaimessa** (`src/shared/sijainninLahetys.ts`): kerran minuutissa **vain kun sovellus
on näkyvissä**, lisäksi jokaisen toiminnon yhteydessä (enintään 10 s välein) ja kun
sovellus palaa näkyviin. Selain ei paikanna taustalla lukitulla näytöllä — tämä on
selaimen rajoitus, ei valinta.

**Puhelinsovelluksessa** (`twa-guard/natiivi/.../Sijainti.java`): kerran minuutissa,
liikkeessä (yli 4 m/s) kerran 15 sekunnissa. **Vain vuoron ajan.** Palvelu on Androidin
etualan palvelu, jolloin **pysyvä ilmoitus näkyy ilmoituspalkissa koko seurannan ajan**
eikä sitä voi piilottaa. Taustasijaintilupaa (`ACCESS_BACKGROUND_LOCATION`) ei pyydetä
eikä käytetä.

**Keruu edellyttää aktiivista kohdetta.** Ilman kesken olevaa vuoroa selain ei lähetä
mitään.

## 3. Säilytys ja poistaminen

Sijaintitietoa on **kolmessa paikassa**, ja niillä on eri elinkaari. Tämä on
käyttöönoton kannalta se kohta joka on ymmärrettävä kokonaan.

### 3.1 Viimeksi tiedetty sijainti (muisti)

Palvelimen muistissa (`server/sijainti.js`), avaimena käyttäjätunnus, yksi tietue per
henkilö — uusi korvaa vanhan. Tämä on se mitä hälytyskeskus näkee kartalla ja listassa.

Poistuu:

- **30 minuutin kuluttua** viimeisestä päivityksestä, automaattisesti
- **uloskirjautuessa**
- **vuoron päättyessä** (korjattu 15.9.2026; tätä ennen sijainti jäi muistiin
  vanhenemiseen asti, vaikka koodi lupasi toisin)
- **palvelimen uudelleenkäynnistyksessä**

### 3.2 Sijaintihistoria — 45 vuorokautta

**Käyttäjän päätös 15.9.2026: historiaa säilytetään.** Jokainen hyväksytty
sijaintipäivitys kirjataan `server/sijaintiloki.js`:ään päiväkohtaisiin JSONL-tiedostoihin
(`DATA_DIR/sijaintiloki/YYYY-MM-DD.jsonl`).

**Käyttötarkoitus on rajattu: hälytysten ja kierrosten jälkikäteinen selvitys ja
varmentaminen. Ei työsuorituksen seuranta.** Rajaus ei ole tekninen — mikään koodissa ei
estä katsomasta jälkeä muusta syystä — mutta se on se peruste jolla keruu on arvioitu,
ja sen laajentaminen on uusi arviointi eikä uusi ominaisuus.

Säilytysaika on **45 vuorokautta**. Toteutus poistaa säilytysajan ylittäneet
päivätiedostot kerran vuorokaudessa ja jokaisessa palvelimen käynnistyksessä, ja poistot
kirjataan auditlokiin (`sijaintiloki_siivous`). Päiväkohtainen tiedostojako on valittu
juuri tämän takia: poisto on tiedoston poisto, ja `ls` kertoo yhdellä silmäyksellä onko
säilytysaikaa noudatettu.

Lokiin kirjataan aika, käyttäjätunnus, kohde, koordinaatti, tarkkuus, nopeus, suunta ja
lähde. **Nimimerkkiä ei kirjata** — pitkäikäiseen lokiin ei toisteta henkilötietoa jota
saa muualta.

### 3.3 Hälytystehtävän jälki — LYTP:n tapahtumailmoitusaika

**Käyttäjän päätös 15.9.2026.** Kun hälytyskeskus hyväksyy poistumisen, kunkin yksikön
sijaintijälki **siitä hetkestä kun tehtävä otettiin vastaan siihen kun lupa poistua
annettiin** kopioidaan tehtävän tietueeseen (`guardDispatch`). Siihen sovelletaan
LYTP:n tapahtumailmoitusaikaa: kaksi vuotta laatimisvuoden päättymisestä, hävitys
viipymättä ja viimeistään kuukauden kuluessa.

Kopio eikä viittaus: viittaus lokiin näyttäisi jäljeltä mutta katoaisi 45
vuorokaudessa, jolloin kahden vuoden päästä tehtävässä olisi linkki tyhjään.

Jälkeen tallennetaan **vain aika, koordinaatti ja tarkkuus**. Nopeutta ja suuntaa ei
tarvita sen todentamiseen missä yksikkö oli. Yli 2000 pisteen jälki harvennetaan, ja
harvennus merkitään tietueeseen — kahden vuoden päästä lukijan on tiedettävä katsooko
hän täyttä jälkeä vai otosta siitä.

Kieltäytyneelle yksikölle ei jälkeä: hän ei ollut tehtävällä.

### 3.4 Hälytykseen liitetty piste

Kun vartija laukaisee hälytyksen (hätäpainike, man-down, ajastin, vyöhykepoikkeama), sen
hetken sijainti tallentuu `alerts`-kokoelmaan. **Sijaintia ei salata levylle**:
kenttäsalaus toimii vain merkkijonoille ja koordinaatti on numeroita
(`server/store.js`). Hälytyksen vapaat tekstit salataan, sijainti ei.

## 4. Kuka näkee

Näkyvyys on sivukarttaoikeuden takana: `guard_locations` (vartiointipuoli) tai
`locations` (tapahtumapuoli). Oikeus on **erillinen tilannekuvan oikeudesta** —
hälytystehtävien näkeminen ja henkilöstön sijainnin näkeminen ovat eri asioita.

Rivit rajautuvat lisäksi `eventAccess`-listalla: päivystäjä näkee vain ne kohteet joihin
hänelle on annettu pääsy. Piirivuorossa oleva yksikkö, jolla ei ole kohdetta, vaatii
`guard_locations`-oikeuden — tapahtumapuolen oikeus ei avaa vartiointiliikkeen partioita.

Pääkäyttäjä näkee kaiken.

**Sijainnin katsomista ei kirjata auditlokiin.** Järjestelmä kirjaa esimerkiksi
master-koodin katsomisen ja kohdehenkilötietojen lukemisen, mutta ei sitä kuka katsoi
kenen sijaintia. Ks. kohta 8.

## 5. Mihin tietoa käytetään

1. **Hälytystehtävän kohdentaminen** — kohteen säteellä olevat yksiköt näkevät keikan
2. **Lähimmän yksikön haku** — "kuka ehtii tähän osoitteeseen"
3. **Vyöhykepoikkeamat** — hälytys kun kohteen rajaa ylitetään
4. **Tilannekuva** — missä yksiköt ovat kartalla ja listassa
5. **Hälytyksen sijainti** — mistä hätäpainiketta painettiin

Kohdat 1–4 toimivat muistinvaraisella tiedolla. Kohta 5 on se joka tuottaa pysyvän
merkinnän.

## 6. Tekniset minimoinnit jotka on jo tehty

Nämä ovat toteutettuja, eivät suunniteltuja:

- Keruu vain vuoron aikana; vapaa-ajalta tietoa ei synny
- Ei taustasijaintilupaa; etualan palvelu ja pysyvä ilmoitus
- Ei historiaa seurantakerroksessa — uusi sijainti korvaa vanhan
- 30 minuutin vanheneminen: vanhentunut sijainti poistetaan, ei näytetä vanhana
- Ikä näytetään aina sijainnin rinnalla, jotta vanhaa ei luulla nykyiseksi
- Erillinen oikeussolmu, joka ei tule tilannekuvan mukana
- Vartija näkee mobiilivalikosta onko hänen sijaintinsa seurannassa
- Paikannuksen tarkkuus näytetään; epätarkkaa ei esitetä tarkkana

## 7. Riskit työntekijälle

| Riski | Nykyinen suoja | Jäännösriski |
|---|---|---|
| Seuranta vapaa-ajalla | Keruu vain vuorossa; poisto uloskirjautuessa ja vuoron päättyessä | Vuoro joka unohtuu päättää — hälytyskeskus voi päättää sen, mutta siihen asti keruu jatkuu |
| Liikkeiden jälkikäteinen tarkastelu | Historia 45 vrk; käyttötarkoitus rajattu määrittelyssä | **Jälki on olemassa.** 45 vuorokautta kattaa kokonaisen liikehistorian, ja hälytystehtävien osalta se säilyy kaksi vuotta |
| Tiedon katsominen ilman syytä | Katselu kirjataan auditlokiin (15 min jaksoina), kohdelista mukana | Jäljen lukemiselle ei ole vielä käyttöliittymää eikä omaa oikeutta — kun se tehdään, se on kirjattava erikseen |
| Työsuorituksen arviointi sijainnin perusteella | Käyttötarkoitus rajattu määrittelyssä; ei työkaluja siihen | **Ei teknistä estettä.** Rajaus on organisatorinen, ja se on sanottava sellaisena eikä teeskenneltävä tekniseksi |
| Epätarkka sijainti johtaa väärään päätelmään | Tarkkuus näkyy lukuna ja kehänä kartalla | — |

## 8. Päätökset 15.9.2026 ja niiden tila

| Päätös | Tila |
|---|---|
| Hälytystehtävän jälki → LYTP:n tapahtumailmoitusaika | Toteutettu |
| Muu sijaintidata → 45 vrk | Toteutettu |
| Sijainnin katsominen auditlokiin | Toteutettu |
| Historian käyttötarkoitus: hälytysten ja kierrosten jälkikäteinen selvitys ja varmentaminen | Kirjattu määrittelyyn |
| Vuoron päättäminen hälytyskeskuksesta | Oli jo olemassa |
| Ilmoitus unohtuneesta vuorosta 15 min päättymisajan jälkeen | **Tekemättä** |

### Yhä avoinna

1. **`alerts`-kokoelman säilytysaika.** Päätös 1 koski hälytys*tehtävän* jälkeä. Erillisen
   turvahälytyksen (hätäpainike, man-down) mukana tallentuva yksittäinen piste on eri
   tietue eri kokoelmassa, eikä sille ole yhä määriteltyä säilytysaikaa.
2. **Ilmoitus unohtuneesta vuorosta** ja se mitä ilmoitus tekee: rivi hälytyskeskuksen
   listaan, kuittausta vaativa hälytys, vai viesti vartijalle itselleen.
3. **Kuka saa katsoa jälkeä ja mistä?** Historian lukemiselle ei ole vielä
   käyttöliittymää eikä omaa oikeussolmuaan. Kun se tehdään, se on oma pääsypäätöksensä
   — jäljen katsominen on eri asia kuin nykyisen sijainnin näkeminen.

## 9. Tarkistuslista käyttöönotolle

- [ ] Yhteistoimintalain (1333/2021) mukainen käsittely teknisestä valvonnasta
- [ ] Työntekijöiden informointi (mitä kerätään, milloin, kuka näkee, kuinka kauan)
- [ ] Käsittelyperuste kirjattuna
- [ ] Tarpeellisuusvaatimuksen (759/2004) arviointi kirjattuna
- [ ] Vaikutustenarviointi viimeisteltynä ja hyväksyttynä
- [ ] Säilytysaika `alerts`-kokoelmalle päätetty ja toteutettu
- [ ] Rekisteröidyn oikeudet: miten työntekijä pyytää omat tietonsa
- [ ] Päätös siitä kirjataanko katsominen

**Huomio ajoituksesta:** ympäristömuuttuja `SIJAINTISEURANTA=1` on ollut palvelimella
päällä, ja 15.9.2026 julkaisun jälkeen kirjautuneiden vartijoiden laitteet lähettävät
sijaintiaan. Keruu on siis alkanut riippumatta siitä missä vaiheessa tämä lista on.
Jos käsittely ja informointi ovat tekemättä, vaihtoehtoja on kaksi: viedä ne läpi, tai
poistaa muuttuja yksikkötiedostosta ja käynnistää backend uudelleen — jälkimmäinen
pysäyttää keruun välittömästi, koska mitään ei ole levyllä.
