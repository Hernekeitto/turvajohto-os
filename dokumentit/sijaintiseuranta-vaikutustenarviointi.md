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

**Seurantakerros ei kirjoita levylle lainkaan.** Sijainnit ovat palvelimen muistissa
(`server/sijainti.js`), avaimena käyttäjätunnus, yksi tietue per henkilö — uusi korvaa
vanhan. Historiaa ei muodostu.

Tietue poistetaan:

- **30 minuutin kuluttua** viimeisestä päivityksestä, automaattisesti
- **uloskirjautuessa**
- **vuoron päättyessä** (korjattu 15.9.2026; tätä ennen sijainti jäi muistiin
  vanhenemiseen asti — ks. kohta 8)
- **palvelimen uudelleenkäynnistyksessä**, koska muistissa oleva tieto katoaa

### POIKKEUS: hälytykseen liitetty sijainti säilyy levyllä

Kun vartija laukaisee hälytyksen (hätäpainike, man-down, ajastin, vyöhykepoikkeama),
**sen hetken sijainti tallentuu `alerts`-kokoelmaan levylle**. Tämä on pysyvää
henkilötietoa, eikä se katoa 30 minuutissa.

Kaksi seurausta jotka on ratkaistava:

1. **Sijaintia ei salata levylle.** Kenttäsalaus toimii vain merkkijonoille, ja
   koordinaatti on numeroita (`server/store.js`). Hälytyksen vapaat tekstit salataan,
   sijainti ei.
2. **`alerts`-kokoelmalle ei ole määriteltyä säilytysaikaa.** Lakisääteinen kahden vuoden
   säilytys koskee tapahtumailmoituksia (`src/shared/sailytysaika.ts`), ei hälytyksiä.
   Nykytilassa hälytyksiin liittyvä sijaintihistoria säilyy **toistaiseksi**.

Väite "sijainnit elävät vain muistissa" pitää paikkansa seurantakerroksesta muttei
hälytyksistä. Arvioinnissa ja informoinnissa on puhuttava molemmista.

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
| Liikkeiden jälkikäteinen tarkastelu | Ei historiaa seurantakerroksessa | Hälytyksiin liittyvät sijainnit säilyvät toistaiseksi |
| Tiedon katsominen ilman syytä | Oikeus on erillinen ja rajattu | **Katsomista ei kirjata**, joten väärinkäyttöä ei voi jälkikäteen todeta |
| Työsuorituksen arviointi sijainnin perusteella | Ei työkaluja siihen järjestelmässä | Ei teknistä estettä sille että päivystäjä tekee sen silmämääräisesti |
| Epätarkka sijainti johtaa väärään päätelmään | Tarkkuus näkyy lukuna ja kehänä kartalla | — |

## 8. Päätettävää ennen käyttöönottoa

Nämä eivät ole teknisiä kysymyksiä eikä niitä voi ratkaista koodissa ilman päätöstä.

1. **`alerts`-kokoelman säilytysaika.** Kuinka kauan hälytykseen liitetty sijainti
   säilytetään? Nyt: toistaiseksi. Tämä on arvioinnin selvin puute.
2. **Kirjataanko sijainnin katsominen auditlokiin?** Suositus: kyllä. Se on ainoa tapa
   jolla työntekijä voi jälkikäteen tarkistaa kuka on katsonut hänen sijaintiaan, ja se
   on myös se suoja jonka olemassaolo kannattaa kertoa yt-käsittelyssä.
3. **Säilytetäänkö sijaintihistoriaa?** Tuotepäätös joka on ollut auki koko erän ajan.
   Jos vastaus on kyllä, tämä asiakirja on kirjoitettava olennaisilta osin uudelleen.
4. **Mitä tapahtuu unohtuneelle vuorolle?** Automaattinen päättäminen esimerkiksi
   vuorotyypin päättymisajan jälkeen rajaisi keruuta ilman että kukaan muistaa tehdä
   mitään.

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
