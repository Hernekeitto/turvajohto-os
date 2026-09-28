#!/bin/bash
# Collabora Online (CODE) -asennus Turvajohto OS:n palvelimelle. Ajetaan rootina:
#
#   bash /var/www/sivusto/server/collabora/asenna.sh
#
# Voi ajaa uudelleen (esim. Collaboran päivitykseen): jokainen vaihe tarkistaa onko se
# jo tehty, ja kontti luodaan uusimmasta imagesta.
#
# Mitä tekee:
#   1. asentaa Dockerin (Ubuntun docker.io), jos sitä ei ole
#   2. käynnistää Collabora-kontin, joka kuuntelee VAIN localhostia ja jonka muisti on
#      rajattu — rajan ylitys kaataa Collaboran eikä hälytysjärjestelmää
#   3. lisää nginx-lohkot (nginx.conf tässä hakemistossa) ja palauttaa vanhan
#      konfiguraation, jos nginx -t ei hyväksy uutta
#   4. asettaa backendille EDITORI_URL:n ja käynnistää API-palvelun uudelleen
set -euo pipefail

HAKEMISTO="$(cd "$(dirname "$0")" && pwd)"
DOMAIN=turvajohto-os.fi
SIVUSTO=/etc/nginx/sites-available/sivusto
SNIPPET=/etc/nginx/snippets/turvajohto-collabora.conf
ENV_TIEDOSTO=/etc/turvajohto-api/env
# Palvelin kasvatettiin 28.9.2026 4 Gt:uun (oli 2 Gt, jolloin raja oli 800m ja
# Collabora käytti siitä tyhjäkäynnillä ~715 MiB). Muu järjestelmä vie noin 0,7 Gt,
# joten tällä rajalla backendille ja hälytysjärjestelmälle jää yli 1,5 Gt.
MUISTI=1500m

echo "== 1/4 Docker"
if ! command -v docker >/dev/null; then
  apt-get update -q
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q docker.io
  systemctl enable --now docker
fi
docker --version

echo "== 2/4 Collabora-kontti"
docker pull -q collabora/code
# Vanha kontti pois (uudelleenajo). Ei putkea grepiin: pipefailin kanssa grep -q voi
# katkaista putken ja tulkita olemassa olevan kontin puuttuvaksi.
docker rm -f collabora >/dev/null 2>&1 || true
# aliasgroup1 = WOPI-isäntä jolta Collabora suostuu hakemaan tiedostoja (vain tämä).
# ssl.termination: nginx hoitaa TLS:n, kontti puhuu pelkkää HTTP:tä localhostiin.
docker run -d --name collabora --restart unless-stopped \
  -p 127.0.0.1:9980:9980 \
  --memory "$MUISTI" --memory-swap "$MUISTI" \
  -e "aliasgroup1=https://$DOMAIN:443" \
  -e "server_name=$DOMAIN" \
  -e "DONT_GEN_SSL_CERT=1" \
  -e "extra_params=--o:ssl.enable=false --o:ssl.termination=true --o:admin_console.enable=false" \
  collabora/code >/dev/null

echo -n "odotetaan käynnistystä"
for _ in $(seq 1 60); do
  if curl -sf -o /dev/null http://127.0.0.1:9980/hosting/discovery; then break; fi
  echo -n "."
  sleep 2
done
echo
if ! curl -sf -o /dev/null http://127.0.0.1:9980/hosting/discovery; then
  echo "VIRHE: Collabora ei vastaa. Kontin loki:"
  docker logs --tail 30 collabora
  exit 1
fi
echo "discovery vastaa:"
# `|| true`: head sulkee putken ensimmäisen rivin jälkeen, jolloin grep saa SIGPIPEn ja
# pipefail kaataisi koko skriptin — pelkkä tulostusrivi ei saa tehdä sitä.
curl -s http://127.0.0.1:9980/hosting/discovery | grep -o 'urlsrc="[^"]*"' | head -1 || true

echo "== 3/4 nginx"
install -m 644 "$HAKEMISTO/nginx.conf" "$SNIPPET"
if ! grep -q turvajohto-collabora.conf "$SIVUSTO"; then
  cp "$SIVUSTO" "$SIVUSTO.ennen-collaboraa"
  # Samaan server-lohkoon kuin karttatiilien snippet (443-lohko).
  sed -i 's#^\(\s*\)include snippets/turvajohto-tiilet.conf;#&\n\1include snippets/turvajohto-collabora.conf;#' "$SIVUSTO"
fi
if ! grep -q turvajohto-collabora.conf "$SIVUSTO"; then
  echo "VIRHE: include-riviä ei saatu lisättyä ($SIVUSTO)."
  exit 1
fi
if ! nginx -t; then
  if [ -f "$SIVUSTO.ennen-collaboraa" ]; then cp "$SIVUSTO.ennen-collaboraa" "$SIVUSTO"; fi
  rm -f "$SNIPPET"
  echo "VIRHE: nginx ei hyväksynyt konfiguraatiota — vanha palautettu, nginxiä ei ladattu uudelleen."
  exit 1
fi
systemctl reload nginx

echo "== 4/4 Backend"
if ! grep -q '^EDITORI_URL=' "$ENV_TIEDOSTO"; then
  # Puuttuva rivinvaihto tiedoston lopussa liimaisi uuden rivin edelliseen.
  if [ -n "$(tail -c1 "$ENV_TIEDOSTO")" ]; then echo >> "$ENV_TIEDOSTO"; fi
  echo "EDITORI_URL=https://$DOMAIN" >> "$ENV_TIEDOSTO"
fi
systemctl restart turvajohto-api
sleep 3
echo "turvajohto-api: $(systemctl is-active turvajohto-api)"

echo "== Tarkistus"
echo "editori julkisesti: $(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/browser/")"
echo "hallintakonsoli (pitää olla 403): $(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/browser/dist/admin/admin.html")"
docker stats --no-stream --format 'muisti: {{.MemUsage}}' collabora
free -m | head -2 || true
echo "VALMIS"
