#!/bin/bash
#
# Tiilipaketin tarjoilu nginxistä (vaihe B0, toinen puolisko).
#
# SKRIPTINÄ EIKÄ KÄSIN, ja syy on sama kuin tiilet.sh:lla: etäkomennoissa lainausmerkit
# katoavat matkalla, ja nginxin konfiguraatiossa väärään server-lohkoon osunut muutos
# näkyy vasta siinä että kartta ei lataudu. Tämä skripti tekee muutoksen samaan lohkoon
# joka tarjoilee sivuston, testaa sen ennen käyttöönottoa ja peruu itsensä jos testi ei
# mene läpi.
#
# AJO:
#   scp -i <avain> asennus/tiilet-nginx.sh root@94.237.12.162:/root/tiilet-nginx.sh
#   ssh -i <avain> root@94.237.12.162 bash /root/tiilet-nginx.sh
#
# Turvallinen ajaa uudelleen: jos include on jo paikallaan, skripti kertoo sen eikä
# tee mitään.

set -euo pipefail

# Konfiguraatiotiedosto ETSITÄÄN, EI ARVATA.
#
# Ensimmäinen versio tästä skriptistä oletti polun /etc/nginx/sites-available/turvajohto-os.
# Sitä tiedostoa ei ollut olemassa, ja skripti kaatui vasta kirjoitettuaan snipetin —
# eli puolitiehen. Polku tulee nyt etsinnästä, ja jos osumia on muu kuin yksi, skripti
# kertoo ne eikä valitse puolestasi.
KONFIGURAATIO="${KONFIGURAATIO:-}"
SNIPPETTI="${SNIPPETTI:-/etc/nginx/snippets/turvajohto-tiilet.conf}"
HAKEMISTO="${HAKEMISTO:-/var/lib/turvajohto-tiilet}"
OSOITE="${OSOITE:-https://turvajohto-os.fi}"

echo "=== tiilet-nginx.sh $(date -Is) ==="

# --- 1. Onko mitään tarjoiltavaa ----------------------------------------------------
#
# Tarkistus ENNEN konfiguraatiomuutosta: nginx-lohko joka osoittaa tyhjään hakemistoon
# vastaa 404:llä, ja se näyttää täsmälleen samalta kuin väärin kirjoitettu polku.
if ! ls "$HAKEMISTO"/*.pmtiles >/dev/null 2>&1; then
  echo "KESKEYTETTY: hakemistossa $HAKEMISTO ei ole yhtään .pmtiles-tiedostoa."
  echo "Aja ensin tiilet.sh."
  exit 1
fi
echo "Tiilipaketit:"
ls -lh "$HAKEMISTO"/*.pmtiles

# --- 1b. Konfiguraatiotiedoston etsintä ---------------------------------------------
#
# Etsitään se tiedosto jossa on ssl_certificate: se on portin 443 lohko eli varsinainen
# sivusto. Symlinkit puretaan (sites-enabled osoittaa yleensä sites-availableen), koska
# muokkaus on tehtävä kohteeseen eikä linkkiin — muuten muutos katoaisi seuraavassa
# symlinkin uudelleenluonnissa.
if [ -z "$KONFIGURAATIO" ]; then
  # VAIN SE MITÄ NGINX OIKEASTI LATAA: sites-enabled ja conf.d.
  #
  # Ensimmäinen versio haki myös sites-availablesta, ja sieltä löytyi kahdeksan osumaa
  # joista seitsemän oli varmuuskopioita (sivusto.bak-20260813181947 ja vastaavat).
  # Varmuuskopio sites-availablessa ei ole käytössä eikä siihen saa kirjoittaa — mutta
  # nimen perusteella suodattaminen olisi arvausta, koska seuraava varmuuskopio voi
  # yhtä hyvin olla nimeltään "sivusto-vanha". sites-enabled sen sijaan kertoo
  # yksiselitteisesti mikä on käytössä.
  # -R EIKÄ -r. Ero on juuri tässä ratkaiseva: `grep -r` EI seuraa hakemistopuussa
  # vastaan tulevia symlinkkejä, ja sites-enabledin sisältö on käytännössä pelkkiä
  # symlinkkejä sites-availableen. Väärällä lipulla haku löysi nolla osumaa ja skripti
  # väitti ettei ssl_certificate-riviä ole missään — vaikka se on.
  osumat=$(grep -Rl "ssl_certificate " /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null \
    | xargs -r -n1 readlink -f | sort -u || true)
  maara=$(printf '%s\n' "$osumat" | grep -c . || true)
  if [ "$maara" -eq 0 ]; then
    echo "KESKEYTETTY: ssl_certificate-riviä ei löytynyt mistään nginx-konfiguraatiosta."
    echo "Anna polku itse: KONFIGURAATIO=/polku/tiedostoon bash /root/tiilet-nginx.sh"
    exit 1
  fi
  if [ "$maara" -gt 1 ]; then
    echo "KESKEYTETTY: useampi kuin yksi ehdokas. Valitse itse:"
    printf '%s\n' "$osumat"
    echo "KONFIGURAATIO=<valittu> bash /root/tiilet-nginx.sh"
    exit 1
  fi
  KONFIGURAATIO="$osumat"
fi
echo "Konfiguraatio: $KONFIGURAATIO"

# --- 2. Snippetti -------------------------------------------------------------------

mkdir -p "$(dirname "$SNIPPETTI")"
cat > "$SNIPPETTI" <<OHJE
# Turvajohto GUARD: karttatiilet (erä 24). Tuotettu asennus/tiilet-nginx.sh:lla.
#
# alias eikä root, koska tiedostot ovat web-juuren ULKOPUOLELLA: deploy kirjoittaa
# web-juuren uusiksi, ja siellä oleva gigatavun tiilipaketti joko katoaisi tai
# kaksinkertaistuisi jokaisessa julkaisussa.
location /tiilet/ {
    alias $HAKEMISTO/;

    # Tiedostonimessä on planeettabuildin päivämäärä, joten sisältö ei muutu nimen
    # alla. Uusi paketti on uusi nimi (ks. src/guard/kartta/lataa.ts: TIILET).
    add_header Cache-Control "public, max-age=31536000, immutable" always;

    # PMTiles on jo sisäisesti pakattu. gzip tekisi turhaa työtä gigatavuille eikä
    # voittaisi tavuakaan.
    gzip off;

    # Keskeneräinen poiminta on .suomi-kesken.pmtiles eli pisteellä alkava. Sitä ei saa
    # tarjoilla: puolivalmis PMTiles ei näytä rikkinäiseltä vaan kartalta josta puuttuu
    # puolet Suomesta. Hakemistolistausta ei myöskään anneta.
    location ~ /\\. {
        deny all;
    }
    autoindex off;
}
OHJE
echo "Kirjoitettu $SNIPPETTI"

# --- 3. Include oikeaan server-lohkoon ----------------------------------------------

varmuuskopio="${KONFIGURAATIO}.ennen-tiilia-$(date +%Y%m%d%H%M%S)"
cp "$KONFIGURAATIO" "$varmuuskopio"
echo "Varmuuskopio: $varmuuskopio"

# VANHA INCLUDE POIS ENSIN, aina. Skripti oli aiemmin idempotentti sillä tavalla että
# se OHITTI koko muutoksen jos include löytyi mistä tahansa — ja juuri niin se jätti
# väärään server-lohkoon osuneen rivin paikalleen ja raportoi "on jo paikallaan".
# Poisto ja uudelleenlisäys korjaa myös väärin menneen ajon.
sed -i "/include snippets\/turvajohto-tiilet.conf;/d" "$KONFIGURAATIO"

# INCLUDE MENEE ssl_certificate-RIVIN ETEEN, EI SERVER-LOHKON ALKUUN.
#
# Aiempi versio etsi lähintä `server {` -riviä ennen ssl_certificate-riviä ja lisäsi
# includen sen jälkeen. Se osui väärään lohkoon: tiedostossa ssl on rivillä 103 mutta
# haku palautti server-lohkon riviltä 1, eli portin 80 uudelleenohjauksen. Seuraus oli
# hiljainen — /tiilet/ päätyi SPA-varakäsittelyyn ja palautti index.html:n 206-koodilla,
# jolloin tarkistus näytti vihreältä ja kartta olisi saanut 4,5 kilotavua HTML:ää
# tiilten sijasta.
#
# ssl_certificate on server-lohkon oma direktiivi, joten sen viereen lisätty rivi on
# määritelmän mukaan oikeassa lohkossa. nginx ei välitä direktiivien järjestyksestä
# lohkon sisällä, joten "ennen" on yhtä hyvä kuin "jälkeen" — ja se ei vaadi lohkon
# rajojen päättelyä lainkaan.
ssl_rivi=$(grep -n "ssl_certificate " "$KONFIGURAATIO" | head -1 | cut -d: -f1 || true)
if [ -z "$ssl_rivi" ]; then
  echo "KESKEYTETTY: ssl_certificate-riviä ei löytynyt tiedostosta $KONFIGURAATIO."
  exit 1
fi
echo "Lisätään include riville $ssl_rivi (ssl_certificate-rivin eteen)."
sed -i "${ssl_rivi}i\\    include snippets/turvajohto-tiilet.conf;" "$KONFIGURAATIO"

# --- 4. Testi ennen käyttöönottoa ---------------------------------------------------
#
# Rikkinäinen konfiguraatio ei kaada käynnissä olevaa nginxiä, mutta se estää seuraavan
# uudelleenkäynnistyksen — ja se tapahtuisi seuraavan deployn yhteydessä, jolloin koko
# sivusto katoaisi syystä joka ei liity siihen julkaisuun mitenkään.
if ! nginx -t; then
  echo "nginx -t EPÄONNISTUI. Palautetaan varmuuskopio."
  cp "$varmuuskopio" "$KONFIGURAATIO"
  exit 1
fi
systemctl reload nginx
echo "nginx ladattu uudelleen."

# --- 5. Todennus --------------------------------------------------------------------
#
# RANGE-PYYNTÖ ON SE JOKA RATKAISEE. MapLibre lukee PMTiles-tiedostoa paloittain eikä
# lataa sitä kokonaan; jos nginx vastaa 200:lla, jokainen tiilipyyntö vetäisi gigatavuja
# eikä kartta latautuisi koskaan. Ero 206:n ja 200:n välillä ei näy mistään muusta.

polku=$(ls -1 "$HAKEMISTO"/*.pmtiles | head -1)
tiedosto=$(basename "$polku")
levylla=$(stat -c %s "$polku")
url="$OSOITE/tiilet/$tiedosto"
echo "Testataan: $url"
echo "Levyllä: $levylla tavua"
otsakkeet=$(curl -sI -r 0-99 "$url" || true)
koodi=$(printf '%s' "$otsakkeet" | head -1)
echo "$koodi"
printf '%s' "$otsakkeet" | grep -i -e content-range -e cache-control || true

# KOKO ON TARKISTETTAVA, EI PELKKÄ KOODI.
#
# Tämä skripti raportoi kerran "OK" tilanteessa jossa /tiilet/ osui SPA-varakäsittelyyn
# ja palautti index.html:n. Vastaus oli 206 ja Content-Range oli mukana, koska nginx
# tukee range-pyyntöjä myös HTML-tiedostolle — tarkistus siis läpäisi täysin rikkinäisen
# asetuksen. Ainoa asia joka olisi paljastanut sen oli Content-Rangen kokonaiskoko:
# 4584 tavua siinä missä tiilipaketti on 2,6 gigatavua.
#
# Nyt verrataan sitä lukua levyllä olevan tiedoston kokoon. Se on ainoa tarkistus joka
# todella vastaa kysymykseen "tarjoillaanko juuri tätä tiedostoa".
kokonaiskoko=$(printf '%s' "$otsakkeet" | grep -i content-range | sed -n 's|.*/\([0-9][0-9]*\).*|\1|p' | head -1)

if ! printf '%s' "$koodi" | grep -q "206"; then
  echo "=== VIRHE: vastaus ei ollut 206. Range-pyynnöt eivät toimi. ==="
  exit 1
fi
if [ -z "$kokonaiskoko" ]; then
  echo "=== VIRHE: Content-Range puuttuu, kokonaiskokoa ei voi tarkistaa. ==="
  exit 1
fi
if [ "$kokonaiskoko" != "$levylla" ]; then
  echo "=== VIRHE: tarjoiltu tiedosto on $kokonaiskoko tavua, levyllä oleva $levylla tavua."
  echo "Osoite /tiilet/ ei osu tiilihakemistoon vaan johonkin muuhun — todennäköisesti"
  echo "sovelluksen SPA-varakäsittelyyn. Tarkista että include meni oikeaan"
  echo "server-lohkoon: grep -n turvajohto-tiilet $KONFIGURAATIO ==="
  exit 1
fi

echo "=== OK: tarjoiltu $kokonaiskoko tavua vastaa levyllä olevaa tiedostoa."
echo "Tiilet ovat tarjolla osoitteessa /tiilet/$tiedosto ==="
