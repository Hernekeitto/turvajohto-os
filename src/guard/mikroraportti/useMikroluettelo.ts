// Mikroraportin valikot palvelimelta (2.10.2026). Pääkäyttäjä ylläpitää luetteloa
// taulukkona (server/mikroluettelo.js), ja vartijan lomake hakee voimassa olevan version.
//
// Lomake toimii myös ilman verkkoa (kirjaus menee jonoon), joten viimeksi haettu luettelo
// pidetään laitteen muistissa ja näytetään heti. Jos taulukkoa ei ole vielä luotu tai
// mitään ei ole koskaan saatu, käytössä on sisäänrakennettu luettelo.
import { useEffect, useState } from 'react';

import { SISAANRAKENNETTU, luetteloksi, type Luettelo } from './mikro';

const AVAIN = 'turvajohto-guard-mikro-luettelo';

const lueValimuisti = (): Luettelo | null => {
  try {
    return luetteloksi(JSON.parse(localStorage.getItem(AVAIN) || 'null')?.luettelo);
  } catch {
    return null;
  }
};

const kirjoitaValimuisti = (versio: number, luettelo: Luettelo | null) => {
  try {
    if (luettelo) localStorage.setItem(AVAIN, JSON.stringify({ versio, luettelo }));
    else localStorage.removeItem(AVAIN);
  } catch {
    // Estetty tallennus: luettelo haetaan seuraavalla kerralla uudelleen.
  }
};

export function useMikroluettelo(): Luettelo {
  const [luettelo, setLuettelo] = useState<Luettelo>(() => lueValimuisti() || SISAANRAKENNETTU);

  useEffect(() => {
    let peruttu = false;
    fetch('/api/mikroluettelo', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((vastaus) => {
        if (peruttu || !vastaus?.ok) return;
        const uusi = luetteloksi(vastaus.luettelo);
        kirjoitaValimuisti(vastaus.versio || 0, uusi);
        setLuettelo(uusi || SISAANRAKENNETTU);
      })
      .catch(() => { /* ei verkkoa: välimuisti tai sisäänrakennettu jää käyttöön */ });
    return () => { peruttu = true; };
  }, []);

  return luettelo;
}
