# Google Play -kaupan sisältö — Turvajohto GUARD

Kaupan tekstit, Data safety -lomakkeen vastaukset ja kuvamateriaali. Erillään
`LUEMINUT.md`:stä, joka kertoo miten sovellus kääritään — tämä kertoo mitä kauppaan
kirjoitetaan.

Kaikki alla oleva koskee **GUARDia**, joka on ensimmäinen kauppaan menevä tuote.
EVENT saa oman vastaavan sisältönsä kun sen vuoro tulee; banneri sille on jo olemassa.

## Kuvamateriaali

| Play-kenttä | Tiedosto | Tila |
|---|---|---|
| Sovelluskuvake 512×512 | `public/kuvakkeet/guard-maskable-512.png` | valmis |
| Feature graphic 1024×500 | `asennus/kauppa/guard-feature-1024x500.png` | valmis |
| Puhelinkuvakaappaukset (väh. 2) | — | **otettava laitteelta** |

Kuvakkeeksi kelpaa nimenomaan **maskable**-versio: se on reunasta reunaan maalattu
neliö, ja Play pyöristää kulmat itse. Läpinäkyvä `guard-512.png` näyttäisi kaupassa
väärältä, koska sen omat pyöristetyt kulmat jäisivät Playn pyöristyksen sisään.

Banneri syntyy samasta generaattorista kuin kuvakkeet (`npm run asennus`), joten se ei
voi erkaantua sovelluksen ilmeestä. **Siinä ei ole tekstiä**, ja se on valinta: Play
näyttää sovelluksen nimen bannerin päällä tai vieressä eri sijoitteluissa eri tavoin,
ja kuvaan poltettu nimi näkyisi jossain niistä kahteen kertaan tai rajautuisi väärin.

Kuvakaappaukset on otettava vasta kun sovellus on asennettu puhelimeen. Kaksi riittää
minimiin; hyvät valinnat ovat **kohdelista** (mistä kaikki alkaa) ja **kierrosnäkymä**
(mitä sovelluksella oikeasti tehdään). Älä käytä kuvia joissa on oikeaa henkilötietoa.

## Lyhyt kuvaus (enintään 80 merkkiä)

```
Vartijan työkalu: kierrokset, vuorot ja poikkeamakirjaukset. Toimii verkotta.
```

77 merkkiä. Verkottomuus on kärjessä tarkoituksella: se on ainoa ominaisuus jota
kilpailevat muistiinpanosovellukset eivät tee, ja kentällä se on se joka ratkaisee.

## Pitkä kuvaus

```
Turvajohto GUARD on vartiointityön kirjaamisen työkalu. Se on tehty kentällä
käytettäväksi: yhdellä kädellä, hanskat kädessä, pimeässä ja silloinkin kun
verkkoa ei ole.

MITÄ SILLÄ TEHDÄÄN

• Kohdekierrokset ja tarkistuspisteiden kuittaus QR-tarralla
• Vartiovuorot ja niiden tehtävälistat
• Poikkeamat ja havainnot kuvineen
• Vartijan ja järjestyksenvalvojan toimenpideraportit
• Kohteen tiedot, yhteystiedot ja ohjeet aina mukana
• Kalusto ja avaimet: kenellä mikäkin on
• Tiedotteet ja hälytykset kohteen väelle

TOIMII ILMAN VERKKOA

Kierroksen voi tehdä kokonaan ilman yhteyttä. Kuittaukset ja kirjaukset jäävät
jonoon laitteelle ja lähtevät itsestään kun yhteys palaa — mitään ei tarvitse
kirjoittaa uudelleen eikä muistaa lähettää. Kuluvan vuoron työtiedot ovat
luettavissa myös katvealueella.

RAPORTIT JOTKA KESTÄVÄT TARKASTELUN

Tapahtumailmoitukset ja toimenpideraportit laaditaan lomakkeille, jotka noudattavat
alan vaatimuksia. Sovellus laskee lakisääteisen kahden vuoden säilytysajan
automaattisesti ja kertoo, mitkä ilmoitukset on aika hävittää.

TIETOTURVA

Henkilötunnukset ja raporttien vapaa teksti salataan erikseen palvelimen levylle.
Kirjautuminen vaatii kaksivaiheisen tunnistautumisen. Jokainen näkymä on
käyttöoikeuksien takana, ja oikeudet voidaan rajata kohdekohtaisesti. Tiedot
säilytetään Suomessa.

Sovelluksessa ei ole mainoksia, seurantaa eikä analytiikkaa.

KÄYTTÖ EDELLYTTÄÄ TUNNUKSIA

Turvajohto GUARD on työkäyttöön tarkoitettu sovellus, eikä sitä voi käyttää ilman
työnantajan myöntämiä tunnuksia. Sovellus ei sisällä julkista sisältöä eikä
rekisteröitymistä.

Tietosuojaseloste: https://turvajohto-os.fi/tietosuoja.html
```

**Viimeinen kappale on tärkeä eikä muotoseikka.** Play-arvioija joka kohtaa
kirjautumisruudun ilman selitystä merkitsee sovelluksen rikkinäiseksi. Tämä kertoo
etukäteen mistä on kyse, ja *App access* -kohtaan annetaan tunnukset joilla pääsee
sisään.

## Data safety -lomake

Vastaukset on johdettu tietosuojaselosteesta (`public/tietosuoja.html`). **Niiden on
täsmättävä selosteeseen**, koska Google vertaa lomaketta ja selostetta keskenään ja
ristiriita on hylkäysperuste.

### Yleiset kysymykset

| Kysymys | Vastaus |
|---|---|
| Kerätäänkö tai jaetaanko käyttäjän tietoja? | Kyllä |
| Salataanko kaikki tiedot siirrossa? | **Kyllä** (HTTPS) |
| Voiko käyttäjä pyytää tietojensa poistamista? | **Kyllä** (selosteen yhteysosoite) |
| Onko sovellus tarkoitettu lapsille? | Ei |
| Onko sovellus riippumattoman tietoturva-arvioinnin läpikäynyt? | Ei |

### Kerättävät tiedot

Kaikki alla oleva on **kerättävää** (siirtyy palvelimelle) mutta **ei jaettavaa**.
Play tarkoittaa jakamisella siirtoa kolmannelle osapuolelle; palvelinalusta ja
tekstiviestien välittäjä toimivat toimeksiannosta, eikä sitä lasketa jakamiseksi.

| Play-tietotyyppi | Mitä se on tässä sovelluksessa | Pakollinen | Tarkoitus |
|---|---|---|---|
| Personal info → Name | Työntekijän nimi, nimimerkki | Kyllä | Sovelluksen toiminta |
| Personal info → Email address | Työntekijän sähköposti | Kyllä | Sovelluksen toiminta |
| Personal info → Phone number | Työntekijän puhelin, hätäviestien vastaanottajat | Kyllä | Sovelluksen toiminta |
| Personal info → Address | Työntekijän osoite | Kyllä | Sovelluksen toiminta |
| Personal info → User IDs | Käyttäjätunnus, tunnistenumero | Kyllä | Sovelluksen toiminta, tilinhallinta |
| Personal info → Other info | **Henkilötunnus, veronumero, kansalaisuus, syntymäaika** | Kyllä | Sovelluksen toiminta, lakisääteinen velvoite |
| Financial info → Other financial info | Työntekijän pankkiyhteys (IBAN, BIC), palkkatiedot | Kyllä | Sovelluksen toiminta |
| Photos and videos → Photos | Kirjauksiin liitetyt valokuvat | Ei | Sovelluksen toiminta |
| Files and docs | Kirjauksiin liitetyt tiedostot | Ei | Sovelluksen toiminta |
| App activity → Other actions | Kirjaukset, kierrokset, kuittaukset, käytön loki | Kyllä | Sovelluksen toiminta, tietoturva |

### Mitä EI ilmoiteta kerättäväksi

| Asia | Miksi ei |
|---|---|
| **Location** | Sijaintiseuranta on kytketty pois eikä sijaintitietoja käsitellä. **Jos se otetaan käyttöön, tämä lomake ja seloste on päivitettävä samalla.** |
| Contacts, Calendar, SMS-viestit | Sovellus ei lue laitteen tietoja |
| Device or other IDs | Ei mainostunnisteita eikä laitetunnisteita |
| Crash logs, diagnostics | Ei kaatumisraportointia eikä analytiikkaa |
| Purchase history, payment info | Ei ostoja |

### Kaksi kohtaa jotka on tarkistettava lomakkeen omasta sanamuodosta

1. **Audit-lokin IP-osoite.** Loki tallentaa kirjautumisyrityksen IP-osoitteen
   tietoturvatarkoituksessa. Playn lomakkeessa ei ole omaa kohtaa IP-osoitteelle, ja
   sen ilmoittaminen riippuu siitä miten lomake sen kysyy — katso lomakkeen oma
   ohjeteksti "Device or other IDs" -kohdassa ennen kuin vastaat.
2. **"Other info" -kohdan kuvauskenttä.** Henkilötunnus on lomakkeen kannalta
   epätavallinen tieto, ja siihen liittyvä vapaa kuvaus kannattaa kirjoittaa
   täsmällisesti: *"Henkilötunnus ja veronumero, jotka kerätään työsuhteen ja
   lakisääteisen ilmoitusvelvollisuuden hoitamiseksi."*

## Muut Play Consolen kohdat

| Kohta | Vastaus |
|---|---|
| Sovelluksen tyyppi | Sovellus (ei peli) |
| Luokka | Business tai Productivity |
| Hinta | Ilmainen |
| Sisältää mainoksia | Ei |
| Kohdeyleisö | 18+ (työkäyttö) |
| Tietosuojaseloste | `https://turvajohto-os.fi/tietosuoja.html` |
| App access | **Tunnukset arvioijalle, ks. alla** |

### App access — tässä on ansa

Sovellukseen kirjaudutaan, joten arvioijalle on annettava toimivat tunnukset. Mutta
palvelin vaatii kaksivaiheisen tunnistautumisen kaikilta paitsi pääkäyttäjältä
(`server/index.js`: `user.totp_required !== false`), eikä arvioija voi syöttää
Authenticator-koodia.

**Luo arvioijalle oma tunnus, jolla `totp_required: false`** ja mahdollisimman suppeat
oikeudet — mieluiten kohde jossa on vain esimerkkidataa. Ilman tätä sovellus hylätään
sillä perusteella ettei siihen päästy sisään, eikä syy näy mistään.
