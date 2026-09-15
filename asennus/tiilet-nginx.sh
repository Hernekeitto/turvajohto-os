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

KONFIGURAATIO="${KONFIGURAATIO:-/etc/nginx/sites-available/turvajohto-os}"
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

if grep -q "turvajohto-tiilet.conf" "$KONFIGURAATIO"; then
  echo "Include on jo paikallaan — konfiguraatiota ei muuteta."
else
  varmuuskopio="${KONFIGURAATIO}.ennen-tiilia-$(date +%Y%m%d%H%M%S)"
  cp "$KONFIGURAATIO" "$varmuuskopio"
  echo "Varmuuskopio: $varmuuskopio"

  # OIKEA LOHKO ETSITÄÄN ssl_certificate-RIVISTÄ. Tiedostossa on tyypillisesti kaksi
  # server-lohkoa: portin 80 uudelleenohjaus ja portin 443 varsinainen sivusto. Jos
  # include menisi ohjauslohkoon, /tiilet/ vastaisi 301:llä eikä kartta lataisi mitään
  # — ja vika näyttäisi sovelluksen vialta.
  ssl_rivi=$(grep -n "ssl_certificate " "$KONFIGURAATIO" | head -1 | cut -d: -f1 || true)
  if [ -z "$ssl_rivi" ]; then
    echo "KESKEYTETTY: ssl_certificate-riviä ei löytynyt, oikeaa server-lohkoa ei voi tunnistaa."
    exit 1
  fi
  # Lähin sitä edeltävä server-lohkon aloitus.
  server_rivi=$(head -n "$ssl_rivi" "$KONFIGURAATIO" | grep -n "server\s*{" | tail -1 | cut -d: -f1)
  echo "Lisätään include riville $((server_rivi + 1)) (server-lohko rivillä $server_rivi, ssl rivillä $ssl_rivi)."

  sed -i "${server_rivi}a\\    include snippets/turvajohto-tiilet.conf;" "$KONFIGURAATIO"

  # --- 4. Testi ennen käyttöönottoa -------------------------------------------------
  #
  # Rikkinäinen konfiguraatio ei kaada käynnissä olevaa nginxiä, mutta se estää
  # seuraavan uudelleenkäynnistyksen — ja se tapahtuisi seuraavan deployn yhteydessä,
  # jolloin koko sivusto katoaisi syystä joka ei liity siihen julkaisuun mitenkään.
  if ! nginx -t; then
    echo "nginx -t EPÄONNISTUI. Palautetaan varmuuskopio."
    cp "$varmuuskopio" "$KONFIGURAATIO"
    exit 1
  fi
  systemctl reload nginx
  echo "nginx ladattu uudelleen."
fi

# --- 5. Todennus --------------------------------------------------------------------
#
# RANGE-PYYNTÖ ON SE JOKA RATKAISEE. MapLibre lukee PMTiles-tiedostoa paloittain eikä
# lataa sitä kokonaan; jos nginx vastaa 200:lla, jokainen tiilipyyntö vetäisi gigatavuja
# eikä kartta latautuisi koskaan. Ero 206:n ja 200:n välillä ei näy mistään muusta.

tiedosto=$(basename "$(ls -1 "$HAKEMISTO"/*.pmtiles | head -1)")
url="$OSOITE/tiilet/$tiedosto"
echo "Testataan: $url"
otsakkeet=$(curl -sI -r 0-99 "$url" || true)
koodi=$(printf '%s' "$otsakkeet" | head -1)
echo "$koodi"
printf '%s' "$otsakkeet" | grep -i -e content-range -e content-length -e cache-control || true

if printf '%s' "$koodi" | grep -q "206"; then
  echo "=== OK: range-pyyntö toimii. Tiilet ovat tarjolla osoitteessa /tiilet/$tiedosto ==="
else
  echo "=== VAROITUS: vastaus ei ollut 206. Kartta ei toimi ennen kuin tämä on kunnossa. ==="
  exit 1
fi
