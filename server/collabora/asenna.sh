#!/bin/bash
# Toimisto (Collabora Online CODE) Turvajohto OS:n palvelimelle. Ajetaan rootina:
#
#   bash /var/www/sivusto/server/collabora/asenna.sh              # täysi asennus
#   bash /var/www/sivusto/server/collabora/asenna.sh --paivitys   # vain kontin päivitys
#
# Täysi asennus voidaan ajaa uudelleen: jokainen vaihe tarkistaa onko se jo tehty.
#   1. Docker (Ubuntun docker.io), jos puuttuu
#   2. Collabora-kontti uusimmasta imagesta: kuuntelee VAIN localhostia, muisti rajattu
#      (rajan ylitys kaataa Collaboran eikä hälytysjärjestelmää)
#   3. TLS-varmenne aliverkkotunnukselle toimisto.turvajohto-os.fi (certbot --webroot)
#   4. nginx: Toimiston oma server-lohko (toimisto.conf + nginx.conf), Collabora-polut pois
#      sovelluksen lohkosta ja sovelluksen CSP:hen lupa upottaa Toimisto. Vanha
#      konfiguraatio palautetaan, jos nginx -t ei hyväksy uutta.
#   5. EDITORI_URL backendille, API:n uudelleenkäynnistys
#   6. viikoittainen automaattinen päivitys (systemd-ajastin, ajaa --paivitys)
#
# --paivitys: hakee uusimman imagen ja luo kontin uudelleen VAIN jos image vaihtui.
# Ei koske nginxiin eikä API:in. Collaboran tietoturvakorjaukset tulevat vain tätä
# kautta — CODE ei päivitä itseään.
set -euo pipefail

HAKEMISTO="$(cd "$(dirname "$0")" && pwd)"
DOMAIN=turvajohto-os.fi
TOIMISTO=toimisto.turvajohto-os.fi
PALVELIN_IP=94.237.12.162
SIVUSTO=/etc/nginx/sites-available/sivusto
TOIMISTO_CONF=/etc/nginx/sites-available/toimisto
SNIPPET=/etc/nginx/snippets/turvajohto-collabora.conf
ACME_JUURI=/var/www/letsencrypt
ENV_TIEDOSTO=/etc/turvajohto-api/env
IMAGE=collabora/code
# Palvelin kasvatettiin 28.9.2026 4 Gt:uun (oli 2 Gt, jolloin raja oli 800m ja
# Collabora käytti siitä tyhjäkäynnillä ~715 MiB). Muu järjestelmä vie noin 0,7 Gt,
# joten tällä rajalla backendille ja hälytysjärjestelmälle jää yli 1,5 Gt.
MUISTI=1500m

kaynnista_kontti() {
  # Vanha kontti pois. Ei putkea grepiin: pipefailin kanssa grep -q voi katkaista
  # putken ja tulkita olemassa olevan kontin puuttuvaksi.
  docker rm -f collabora >/dev/null 2>&1 || true
  # aliasgroup1 = WOPI-isäntä jolta Collabora suostuu hakemaan tiedostoja (vain tämä).
  #   Sovellus ja WOPI-rajapinta pysyvät osoitteessa turvajohto-os.fi.
  # server_name = osoite jossa selain näkee Collaboran (discoveryn urlsrc).
  # net.frame_ancestors = kuka saa upottaa editorin iframeen: vain sovellus.
  # ssl.termination: nginx hoitaa TLS:n, kontti puhuu pelkkää HTTP:tä localhostiin.
  docker run -d --name collabora --restart unless-stopped \
    -p 127.0.0.1:9980:9980 \
    --memory "$MUISTI" --memory-swap "$MUISTI" \
    -e "aliasgroup1=https://$DOMAIN:443" \
    -e "server_name=$TOIMISTO" \
    -e "DONT_GEN_SSL_CERT=1" \
    -e "extra_params=--o:ssl.enable=false --o:ssl.termination=true --o:admin_console.enable=false --o:net.frame_ancestors=https://$DOMAIN" \
    "$IMAGE" >/dev/null

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
}

# ---------------------------------------------------------------------------------
# Pelkkä päivitys (ajastin)
# ---------------------------------------------------------------------------------
if [ "${1:-}" = "--paivitys" ]; then
  echo "$(date -Is) Toimiston päivitystarkistus"
  docker pull -q "$IMAGE"
  UUSI=$(docker image inspect --format '{{.Id}}' "$IMAGE")
  NYKYINEN=$(docker inspect --format '{{.Image}}' collabora 2>/dev/null || echo puuttuu)
  if [ "$UUSI" = "$NYKYINEN" ]; then
    echo "ei uutta versiota"
    exit 0
  fi
  echo "uusi versio — luodaan kontti uudelleen"
  kaynnista_kontti
  # Vanhat imaget pois, muuten jokainen päivitys jättää ~1,5 Gt levylle.
  docker image prune -f >/dev/null || true
  echo "$(date -Is) päivitetty"
  exit 0
fi

# ---------------------------------------------------------------------------------
# Täysi asennus
# ---------------------------------------------------------------------------------
echo "== 1/6 Docker"
if ! command -v docker >/dev/null; then
  apt-get update -q
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q docker.io
  systemctl enable --now docker
fi
docker --version

echo "== 2/6 DNS"
# awk lukee koko syötteen, joten putki ei katkea kesken (pipefail).
TOIMISTO_IP=$(getent ahostsv4 "$TOIMISTO" | awk 'NR==1 { print $1 }' || true)
if [ "$TOIMISTO_IP" != "$PALVELIN_IP" ]; then
  echo "VIRHE: $TOIMISTO osoittaa osoitteeseen '${TOIMISTO_IP:-ei mihinkään}', odotettiin $PALVELIN_IP."
  echo "Lisää Louhelle A-tietue (toimisto -> $PALVELIN_IP) ja aja skripti uudelleen."
  exit 1
fi
echo "$TOIMISTO -> $TOIMISTO_IP"

echo "== 3/6 Collabora-kontti"
docker pull -q "$IMAGE"
kaynnista_kontti

echo "== 4/6 Varmenne ja nginx"
# Varmuuskopio ennen mitään muutoksia: jokin alla voi epäonnistua, ja sovelluksen
# nginx-lohkon on palattava sellaiseksi kuin se oli.
cp "$SIVUSTO" "$SIVUSTO.ennen-toimistoa"
palauta() {
  cp "$SIVUSTO.ennen-toimistoa" "$SIVUSTO"
  # Toimiston lohko pois käytöstä: jos vika on siinä, pelkkä sovelluslohkon palautus ei
  # saisi nginxiä takaisin kelvolliseksi.
  rm -f /etc/nginx/sites-enabled/toimisto
  if nginx -t 2>/dev/null; then systemctl reload nginx; fi
  echo "VIRHE: $1 — sovelluksen nginx-konfiguraatio palautettu ja Toimiston lohko poistettu käytöstä."
  exit 1
}

install -m 644 "$HAKEMISTO/nginx.conf" "$SNIPPET"
mkdir -p "$ACME_JUURI"
if [ ! -f "/etc/letsencrypt/live/$TOIMISTO/fullchain.pem" ]; then
  # Varmennetta ei vielä ole, joten 443-lohkoa ei voi vielä ladata. Ensin väliaikainen
  # pelkkä portti 80 Let's Encryptin tarkistusta varten.
  cat > "$TOIMISTO_CONF" <<EOF
server {
    listen 80;
    server_name $TOIMISTO;
    location ^~ /.well-known/acme-challenge/ { root $ACME_JUURI; }
    location / { return 404; }
}
EOF
  ln -sf "$TOIMISTO_CONF" /etc/nginx/sites-enabled/toimisto
  nginx -t || palauta "väliaikainen toimisto-lohko ei kelpaa"
  systemctl reload nginx
  # --deploy-hook tallentuu uusintaan: nginx lataa uudistetun varmenteen itse.
  certbot certonly --webroot -w "$ACME_JUURI" -d "$TOIMISTO" \
    --non-interactive --agree-tos --deploy-hook "systemctl reload nginx"
fi
install -m 644 "$HAKEMISTO/toimisto.conf" "$TOIMISTO_CONF"
ln -sf "$TOIMISTO_CONF" /etc/nginx/sites-enabled/toimisto

# Collabora-polut pois sovelluksen lohkosta: turvajohto-os.fi/browser ja /cool eivät
# enää ohjaudu Collaboralle.
sed -i '/include snippets\/turvajohto-collabora.conf;/d' "$SIVUSTO"
# Sovelluksen CSP: iframe ja token-lomake osoittavat nyt Toimistoon. Sama muutos on
# tehty repon csp.ts:ään — näiden on vastattava toisiaan.
if ! grep -q "$TOIMISTO" "$SIVUSTO"; then
  sed -i "s#object-src 'none'#frame-src 'self' https://$TOIMISTO; object-src 'none'#g; s#form-action 'self'#form-action 'self' https://$TOIMISTO#g" "$SIVUSTO"
fi
if [ "$(grep -c "frame-src 'self' https://$TOIMISTO" "$SIVUSTO" || true)" = "0" ]; then
  palauta "CSP:n päivitys ei onnistunut"
fi
nginx -t || palauta "nginx ei hyväksynyt konfiguraatiota"
systemctl reload nginx

echo "== 5/6 Backend"
if ! grep -q '^EDITORI_URL=' "$ENV_TIEDOSTO"; then
  # Puuttuva rivinvaihto tiedoston lopussa liimaisi uuden rivin edelliseen.
  if [ -n "$(tail -c1 "$ENV_TIEDOSTO")" ]; then echo >> "$ENV_TIEDOSTO"; fi
  echo "EDITORI_URL=https://$DOMAIN" >> "$ENV_TIEDOSTO"
fi
systemctl restart turvajohto-api
sleep 3
echo "turvajohto-api: $(systemctl is-active turvajohto-api)"

echo "== 6/6 Viikoittainen päivitys"
cat > /etc/systemd/system/toimisto-paivitys.service <<EOF
[Unit]
Description=Toimisto (Collabora) - uusimman version haku
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/bin/bash $HAKEMISTO/asenna.sh --paivitys
EOF
cat > /etc/systemd/system/toimisto-paivitys.timer <<EOF
[Unit]
Description=Toimisto (Collabora) - viikoittainen päivitys

[Timer]
# Sunnuntaiyö: kontin uudelleenluonti katkaisee auki olevat editori-istunnot.
OnCalendar=Sun *-*-* 04:00:00
RandomizedDelaySec=15min
Persistent=true

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now toimisto-paivitys.timer >/dev/null
echo "seuraava ajo: $(systemctl show toimisto-paivitys.timer -p NextElapseUSecRealtime --value)"

echo "== Tarkistus"
HASH=$(curl -s http://127.0.0.1:9980/hosting/discovery | grep -o '/browser/[^/]*/' | awk 'NR==1' || true)
echo "Toimisto julkisesti (pitää olla 200): $(curl -s -o /dev/null -w '%{http_code}' "https://$TOIMISTO${HASH}cool.html")"
echo "muunnospalvelu (pitää olla 403): $(curl -s -o /dev/null -w '%{http_code}' -X POST "https://$TOIMISTO/cool/convert-to/pdf")"
echo "hallintakonsoli (pitää olla 403): $(curl -s -o /dev/null -w '%{http_code}' "https://$TOIMISTO/browser/dist/admin/admin.html")"
echo "vanha polku sovelluksessa (ei enää Collabora): $(curl -s -o /dev/null -w '%{http_code} %{content_type}' "https://$DOMAIN${HASH}cool.html")"
docker stats --no-stream --format 'muisti: {{.MemUsage}}' collabora
free -m | head -2 || true
echo "VALMIS"
