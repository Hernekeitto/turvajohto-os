#!/bin/bash
#
# Karttatekstien kirjasimet palvelimelle (vaihe B4).
#
# Kartassa ei ollut katujen eikä paikkojen nimiä, ja syy oli tämä: MapLibre ei piirrä
# tekstiä kirjasintiedostosta vaan ESILASKETUISTA KIRJASINATLAKSISTA (signed distance
# field, .pbf). Ilman niitä tekstitasot epäonnistuvat hiljaa — kartta latautuu, tiet
# piirtyvät, nimiä ei näy eikä mikään kerro miksi.
#
# MIKSI LADATAAN VALMIIT EIKÄ TEHDÄ ITSE. Atlaksen tuottaminen (fontnik) vaatii
# natiivikäännöksen ja onnistuu Windowsilla huonosti. Protomaps julkaisee samat atlakset
# joita sen oma peruskartta käyttää, ja ne on tehty samasta Noto Sansista jolle
# tiilipaketin merkistö on suunniteltu. Lataus tapahtuu ASENNUKSESSA, ei ajonaikana:
# selain hakee kirjasimet vain omalta palvelimeltamme, joten CSP:n `font-src 'self'`
# ja `default-src 'self'` pysyvät koskemattomina eikä käyttäjän selain ota yhteyttä
# GitHubiin.
#
# MIKSI PÄIVÄTTY HAKEMISTO. nginx tarjoilee /tiilet/-polun `immutable`-otsakkeella,
# koska tiilipaketin nimessä on buildin päivä eikä sisältö muutu nimen alla. Sama
# lupaus on pidettävä kirjasimista: uusi kirjasinsatsi on uusi hakemistonimi ja
# src/guard/kartta/lataa.ts:n KIRJASIMET-rivin muutos. Muuten vanha atlas jäisi
# välimuistiin vuodeksi.
#
# JÄRJESTYS ON TÄRKEÄ: aja tämä ENNEN kuin tekstitasot sisältävä sovellusversio
# julkaistaan. Väärässä järjestyksessä kartta toimii mutta jokainen tekstitaso hakee
# 404:n, ja konsoli täyttyy virheistä joiden syy ei ole koodissa.
#
# AJO:
#   scp -i <avain> asennus/kirjasimet.sh root@94.237.12.162:/root/kirjasimet.sh
#   ssh -i <avain> root@94.237.12.162 bash /root/kirjasimet.sh
#
# Turvallinen ajaa uudelleen: valmiit tiedostot ohitetaan.

set -euo pipefail

# Kirjasinsatsin päivä. Tämä on hakemiston nimi, ja sen on vastattava lataa.ts:n
# KIRJASIMET-vakiota. Ei latauslähteen versio vaan MEIDÄN julkaisumme tunniste.
SATSI="${SATSI:-20260916}"

# Sama hakemisto kuin tiilipaketilla, jotta nginx-muutosta ei tarvita lainkaan:
# olemassa oleva `location /tiilet/ { alias /var/lib/turvajohto-tiilet/; }` tarjoilee
# myös alihakemistot.
HAKEMISTO="${HAKEMISTO:-/var/lib/turvajohto-tiilet}"
KOHDE="$HAKEMISTO/kirjasimet-$SATSI"

LAHDE="${LAHDE:-https://raw.githubusercontent.com/protomaps/basemaps-assets/main/fonts}"
OSOITE="${OSOITE:-https://turvajohto-os.fi}"

# Kaksi leikkausta, ei enempää.
#
# EIVÄTKÄ NE OLE KOSKAAN SAMASSA text-font-LISTASSA. MapLibre yhdistää useamman
# kirjasimen yhdeksi pyynnöksi ("A,B/0-255.pbf") ja odottaa palvelimen koostavan ne.
# Staattinen tiedostopalvelin ei koosta mitään, joten sellainen pyyntö on aina 404 ja
# teksti katoaa. Yksi nimi per taso, ks. tyyli.ts.
declare -a LEIKKAUKSET=("Noto Sans Regular" "Noto Sans Medium")

# MapLibre pyytää atlaksia 256 merkin lohkoissa: 0-255, 256-511, ... 65280-65535.
# Lohkoja on 256 ja ne kaikki ovat olemassa, joten lista lasketaan eikä haeta.
LOHKOJA="${LOHKOJA:-256}"
YRITYKSET="${YRITYKSET:-3}"

echo "=== kirjasimet.sh $(date -Is) ==="
echo "Kohde: $KOHDE"

if [ ! -d "$HAKEMISTO" ]; then
  echo "KESKEYTETTY: hakemistoa $HAKEMISTO ei ole. Aja ensin tiilet.sh."
  exit 1
fi

mkdir -p "$KOHDE"

hae() {
  # $1 = url, $2 = kohdetiedosto
  local n=1
  while [ "$n" -le "$YRITYKSET" ]; do
    if curl -fsS --retry 2 --max-time 60 -o "$2.osa" "$1"; then
      mv "$2.osa" "$2"
      return 0
    fi
    n=$((n + 1))
    sleep 2
  done
  rm -f "$2.osa"
  return 1
}

# Lisenssi mukaan. Noto Sans on SIL Open Font Licensen alainen, ja lisenssi vaatii että
# se kulkee kirjasimen mukana. Se ei ole muotoseikka: ilman tätä tiedostoa palvelimella
# on lisensoitua aineistoa ilman lisenssiä.
if [ ! -s "$KOHDE/OFL.txt" ]; then
  hae "$LAHDE/OFL.txt" "$KOHDE/OFL.txt" || {
    echo "KESKEYTETTY: lisenssitiedoston lataus epäonnistui."
    exit 1
  }
fi
echo "Lisenssi: $KOHDE/OFL.txt"

puuttui=0
for leikkaus in "${LEIKKAUKSET[@]}"; do
  # Hakemiston nimi ON kirjasimen nimi: MapLibre rakentaa osoitteen text-font-arvosta
  # sellaisenaan. Välilyönnit kuuluvat asiaan, selain koodaa ne %20:ksi.
  mkdir -p "$KOHDE/$leikkaus"
  # Osoitteen välilyönnit on koodattava itse; curl ei tee sitä puolestamme.
  polku="${leikkaus// /%20}"
  ladattu=0
  for ((i = 0; i < LOHKOJA; i++)); do
    alku=$((i * 256))
    loppu=$((alku + 255))
    tiedosto="$KOHDE/$leikkaus/$alku-$loppu.pbf"
    [ -s "$tiedosto" ] && { ladattu=$((ladattu + 1)); continue; }
    if hae "$LAHDE/$polku/$alku-$loppu.pbf" "$tiedosto"; then
      ladattu=$((ladattu + 1))
    else
      puuttui=$((puuttui + 1))
      echo "  PUUTTUU: $leikkaus/$alku-$loppu.pbf"
    fi
  done
  koko=$(du -sh "$KOHDE/$leikkaus" | cut -f1)
  echo "$leikkaus: $ladattu/$LOHKOJA lohkoa, $koko"
done

if [ "$puuttui" -gt 0 ]; then
  echo "=== VIRHE: $puuttui lohkoa jäi lataamatta. Aja skripti uudelleen. ==="
  exit 1
fi

chmod -R a+rX "$KOHDE"

# --- Todennus ------------------------------------------------------------------------
#
# LEVYLLÄ OLEMINEN EI OLE SAMA KUIN TARJOILTU. Sama virhe on tehty tässä projektissa
# kerran: /tiilet/ osui SPA-varakäsittelyyn ja palautti index.html:ää 206-koodilla,
# jolloin pelkkää statuskoodia katsonut tarkistus näytti vihreältä. Siksi verrataan
# vastauksen kokoa levyllä olevan tiedoston kokoon — se on ainoa tarkistus joka vastaa
# kysymykseen "tarjoillaanko juuri tätä tiedostoa".
#
# Lohko 0-255 on latinalaiset perusmerkit. Jos vain se toimisi, kartalla näkyisi
# suomalaiset kadunnimet ilman ä- ja ö-kirjaimia; siksi tarkistetaan myös 256-511,
# jossa ovat pohjoissaamen č, đ, ŋ, š, ŧ ja ž.
virhe=0
for lohko in "0-255" "256-511"; do
  polku="$KOHDE/Noto Sans Regular/$lohko.pbf"
  levylla=$(stat -c %s "$polku")
  url="$OSOITE/tiilet/kirjasimet-$SATSI/Noto%20Sans%20Regular/$lohko.pbf"
  otsakkeet=$(curl -sI "$url" || true)
  koodi=$(printf '%s' "$otsakkeet" | head -1)
  tarjoiltu=$(printf '%s' "$otsakkeet" | grep -i '^content-length' | tr -dc '0-9' | head -c 12)
  echo "$lohko: $koodi tarjoiltu=${tarjoiltu:-?} levylla=$levylla"
  if [ "${tarjoiltu:-0}" != "$levylla" ]; then
    echo "  VIRHE: tarjoiltu koko ei vastaa levyllä olevaa."
    virhe=1
  fi
done

if [ "$virhe" -ne 0 ]; then
  echo "=== VIRHE: kirjasimia ei tarjoilla oikein osoitteesta /tiilet/kirjasimet-$SATSI/."
  echo "Tarkista että tiilet-nginx.sh on ajettu ja että alias osoittaa hakemistoon"
  echo "$HAKEMISTO. ==="
  exit 1
fi

echo
echo "=== OK. Aseta src/guard/kartta/lataa.ts:"
echo "    export const KIRJASIMET = '/tiilet/kirjasimet-$SATSI';"
echo "ja julkaise sovellus. ==="
