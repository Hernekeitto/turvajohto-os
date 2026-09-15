#!/bin/bash
#
# Suomen karttatiilet palvelimelle (vaihe B0).
#
# Poimii Protomapsin päivittäisestä planeettabuildista Suomen alueen omaksi
# PMTiles-tiedostokseen. Tuloksena on YKSI tiedosto jota nginx tarjoilee
# range-pyynnöillä; erillistä tiilipalvelinta ei tarvita.
#
# MIKSI PLANEETTAA EI LADATA. Lähde on 138 gigatavua, ja palvelimella on vapaana
# kaksikymmentä. `pmtiles extract` lukee lähteen HTTP range -pyynnöillä ja lataa vain
# ne tiilet jotka osuvat rajaukseen — planeetta ei käy levyllä missään vaiheessa.
#
# MIKSI OMA HAKEMISTO EIKÄ WEB-JUURI. Tiilitiedosto on gigatavuja ja se on
# riippumaton sovelluksen versiosta. Deploy kirjoittaa web-juuren uusiksi, ja siellä
# oleva tiilitiedosto joko katoaisi tai kaksinkertaistuisi jokaisessa julkaisussa.
# nginx osoittaa tähän hakemistoon `location /tiilet/ { alias ... }` -lohkolla.
#
# AJO (pitkäkestoinen, aja irti terminaalista):
#   scp -i <avain> asennus/tiilet.sh root@94.237.12.162:/root/tiilet.sh
#   ssh -i <avain> root@94.237.12.162 nohup bash /root/tiilet.sh
#
# Etenemisen näkee lokista: tail -f /root/tiilet.log

set -euo pipefail

# Planeettabuildin päivä. Protomaps säilyttää buildeja noin viikon, joten vanha
# päivämäärä vastaa 404:llä — silloin valitse tuoreempi osoitteesta
# https://maps.protomaps.com/builds/
PLANEETTA_PVM="${PLANEETTA_PVM:-20260914}"

# Suomi + marginaali: lounaassa Ahvenanmaan länsipuoli, koillisessa Utsjoki.
# Marginaali on tarkoituksella reilu — rajalta puuttuva tiili näkyisi kartalla
# valkoisena alueena juuri siellä missä partio ylittää kuntarajan.
BBOX="${BBOX:-18.9,59.3,31.7,70.2}"

# Protomapsin perusbuild ulottuu tasolle 15. Se riittää katutasoon; MapLibre venyttää
# tarvittaessa pidemmälle. Jos tiedosto ei mahdu levylle, TÄMÄ on se luku jota
# lasketaan — taso 13 pienentää tiedoston murto-osaan mutta vie korttelitarkkuuden.
MAXZOOM="${MAXZOOM:-15}"

HAKEMISTO="${HAKEMISTO:-/var/lib/turvajohto-tiilet}"
CLI_VERSIO="${CLI_VERSIO:-1.31.2}"

# Rinnakkaisten latauspyyntöjen määrä.
#
# MITATTU SYY: ensimmäinen ajo 15.9.2026 kaatui 99 %:ssa noin kymmenen minuutin ja
# 2,7 gigatavun jälkeen virheeseen "stream error ... INTERNAL_ERROR; received from peer".
# Se ei ole levy- eikä levytilaongelma vaan vastapään katkaisema HTTP/2-virta. Mitä
# useampi virta on auki yhtä aikaa ja mitä pidempään, sitä todennäköisemmin yksi niistä
# katkeaa — ja koska poiminta on kaikki-tai-ei-mitään, yksi katkennut virta hukkaa koko
# ajon.
THREADS="${THREADS:-4}"

# Montako kertaa poiminta yritetään.
#
# Poiminta ei jatku keskeytyskohdasta, joten yritys on aina koko 2,7 GB alusta. Se on
# silti oikea ratkaisu: ajo on valvomaton ja kestää kymmenen minuuttia, joten kolme
# lisäyritystä maksaa pahimmillaan puoli tuntia palvelimen taustalla eikä mitään
# ihmisen aikaa. Vaihtoehto on että joku huomaa aamulla ettei mitään tapahtunut.
YRITYKSET="${YRITYKSET:-4}"

# Vaadittu vapaa tila. Suomen poiminnan kokoa ei tiedetä etukäteen — se MITATAAN
# tällä ajolla — joten varataan moninkertainen marginaali arvioon nähden. Jos tila ei
# riitä, työ keskeytyy tähän eikä kesken lataukseen: täyteen ajettu juurilevy kaataa
# myös sovelluksen ja tietokannan.
VAADITTU_GT="${VAADITTU_GT:-8}"

LOKI=/root/tiilet.log
exec > >(tee -a "$LOKI") 2>&1

echo "=== tiilet.sh $(date -Is) ==="
echo "planeetta=$PLANEETTA_PVM bbox=$BBOX maxzoom=$MAXZOOM hakemisto=$HAKEMISTO"

# --- 1. Levytila ------------------------------------------------------------------

mkdir -p "$HAKEMISTO"
vapaa_gt=$(df -BG --output=avail "$HAKEMISTO" | tail -1 | tr -dc '0-9')
echo "Vapaana: ${vapaa_gt} GB (vaaditaan ${VAADITTU_GT} GB)"
if [ "$vapaa_gt" -lt "$VAADITTU_GT" ]; then
  echo "KESKEYTETTY: levytila ei riitä. Vapauta tilaa tai laske MAXZOOM-arvoa."
  exit 1
fi

# --- 2. pmtiles-työkalu -----------------------------------------------------------

if ! command -v pmtiles >/dev/null 2>&1; then
  echo "Asennetaan pmtiles $CLI_VERSIO"
  tmp=$(mktemp -d)
  paketti="go-pmtiles_${CLI_VERSIO}_Linux_x86_64.tar.gz"
  curl -fsSL -o "$tmp/$paketti" \
    "https://github.com/protomaps/go-pmtiles/releases/download/v${CLI_VERSIO}/${paketti}"
  tar -xzf "$tmp/$paketti" -C "$tmp"
  install -m 0755 "$tmp/pmtiles" /usr/local/bin/pmtiles
  rm -rf "$tmp"
fi
pmtiles version

# --- 3. Poiminta ------------------------------------------------------------------

# Kesken oleva tiedosto on PISTEELLÄ ALKAVA ja se siirretään nimelleen vasta kun ajo
# on onnistunut. Syy: nginx tarjoilisi keskeneräisen tiedoston mielellään, ja
# puolivalmis PMTiles ei näytä rikkinäiseltä — se näyttää kartalta jossa puolet
# Suomesta puuttuu.
kesken="$HAKEMISTO/.suomi-kesken.pmtiles"
valmis="$HAKEMISTO/suomi-${PLANEETTA_PVM}.pmtiles"

if [ -f "$valmis" ]; then
  echo "Valmis tiedosto on jo olemassa: $valmis"
  ls -lh "$valmis"
  exit 0
fi

onnistui=0
for yritys in $(seq 1 "$YRITYKSET"); do
  # Keskeneräinen tiedosto pois ENNEN jokaista yritystä: pmtiles ei jatka
  # keskeytyskohdasta, ja edellisen yrityksen tynkä vain veisi levytilaa.
  rm -f "$kesken"
  echo "--- Yritys $yritys/$YRITYKSET alkoi $(date -Is) (threads=$THREADS) ---"
  if pmtiles extract \
      "https://build.protomaps.com/${PLANEETTA_PVM}.pmtiles" \
      "$kesken" \
      --bbox="$BBOX" \
      --maxzoom="$MAXZOOM" \
      --download-threads="$THREADS"; then
    onnistui=1
    break
  fi
  echo "Yritys $yritys epäonnistui $(date -Is)."
  # Pieni tauko ennen seuraavaa: jos vastapää rajoittaa tai on hetkellisesti huonossa
  # kunnossa, välitön uusi yritys osuu samaan tilanteeseen.
  #
  # `if` eikä `[ … ] && sleep`: set -e on päällä, ja AND-lista jonka ehto on epätosi
  # palauttaa ykkösen. Viimeisellä kierroksella se lopettaisi skriptin kesken silmukan,
  # jolloin alla oleva virheilmoitus jäisi tulostamatta ja loki päättyisi kuin mitään
  # ei olisi tapahtunut.
  if [ "$yritys" -lt "$YRITYKSET" ]; then
    sleep 30
  fi
done

if [ "$onnistui" -ne 1 ]; then
  rm -f "$kesken"
  echo "KESKEYTETTY: poiminta ei onnistunut $YRITYKSET yrityksellä."
  echo "Kokeile pienempää rinnakkaisuutta: THREADS=2 bash /root/tiilet.sh"
  exit 1
fi

mv "$kesken" "$valmis"
chmod 0644 "$valmis"

echo "=== VALMIS $(date -Is) ==="
ls -lh "$valmis"
df -h "$HAKEMISTO" | tail -1

cat <<'OHJE'

--- Seuraava askel: nginx ---------------------------------------------------------

Lisää palvelinlohkoon. `alias` eikä `root`, koska tiedostot ovat web-juuren
ulkopuolella. Range-pyynnöt ovat päällä oletuksena; niitä EI saa katkaista, koska
MapLibre lukee tiedostoa paloittain eikä lataa sitä kokonaan.

    location /tiilet/ {
        alias /var/lib/turvajohto-tiilet/;
        # Tiedostonimessä on buildin päivämäärä, joten sisältö ei muutu nimen alla.
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        # Suuri tiedosto, ei gzipiä: PMTiles on jo pakattu sisäisesti.
        gzip off;
    }

Tarkista sen jälkeen että range toimii:

    curl -sI -r 0-99 https://turvajohto-os.fi/tiilet/suomi-<pvm>.pmtiles

Vastauksen on oltava 206 ja Content-Range-otsake mukana. Jos tulee 200, nginx
tarjoilee koko tiedoston jokaiselle tiilipyynnölle eikä kartta lataudu koskaan.
OHJE
