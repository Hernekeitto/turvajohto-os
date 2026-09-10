#!/bin/bash
# Kytkee sijaintiseurannan päälle palvelimella.
#
# Sijaintiseuranta ei ole tietokannan asetus vaan YMPÄRISTÖMUUTTUJA:
# server/sijainti.js -> seurantaKaytossa = () => process.env.SIJAINTISEURANTA === '1'
# Sitä ei siis voi kytkeä rajapinnan kautta millään käyttöoikeuksilla.
#
# Ajo palvelimella:  bash /root/sijaintiseuranta-paalle.sh
#
# Skripti ei tulosta yhdenkään muuttujan ARVOA — vain nimet. Palvelimen konfiguraatiossa
# on JWT_SECRET, TOTP_ENCRYPTION_KEY ja DATA_ENCRYPTION_KEY, eivätkä ne kuulu tulosteisiin.

set -euo pipefail

echo "== etsitaan API-palvelu =="
YKSIKKO=$(grep -ril -e turvajohto -e DATA_DIR /etc/systemd/system/*.service 2>/dev/null | head -1)

if [ -z "$YKSIKKO" ]; then
  echo "API-palvelua ei loytynyt hakemistosta /etc/systemd/system."
  echo "Listaa palvelut kasin:  ls /etc/systemd/system"
  exit 1
fi

NIMI=$(basename "$YKSIKKO")
echo "loytyi: $NIMI"

echo
echo "== nykyiset ymparistomuuttujat (vain nimet) =="
grep -oE '^Environment=[A-Za-z_]+' "$YKSIKKO" || echo "(ei Environment-rivejä itse yksikkotiedostossa)"

echo
echo "== kirjoitetaan drop-in =="
# Drop-in eikä yksikkotiedoston muokkaus: alkuperainen tiedosto jaa koskematta, ja
# muutoksen voi perua poistamalla yhden hakemiston.
mkdir -p "/etc/systemd/system/$NIMI.d"
printf '[Service]\nEnvironment=SIJAINTISEURANTA=1\n' \
  > "/etc/systemd/system/$NIMI.d/sijaintiseuranta.conf"
echo "kirjoitettu: /etc/systemd/system/$NIMI.d/sijaintiseuranta.conf"

echo
echo "== ladataan ja kaynnistetaan uudelleen =="
systemctl daemon-reload
systemctl restart "$NIMI"
sleep 2
systemctl is-active "$NIMI"

echo
echo "== varmistus (vain nimet) =="
systemctl show "$NIMI" -p Environment | grep -oE '[A-Za-z_]+=' | tr -d '=' | sort

echo
echo "Valmis. Tarkista viela selaimesta: /api/session -> sijaintiseuranta: true"
echo
echo "Perutus tarvittaessa:"
echo "  rm -rf /etc/systemd/system/$NIMI.d && systemctl daemon-reload && systemctl restart $NIMI"
