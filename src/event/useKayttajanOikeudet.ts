// Käyttäjän oikeusnäkymän tila ja palvelinoperaatiot.
//
// Ensimmäinen App.tsx:stä irrotettu hook. Se valittiin aloituskohteeksi koska
// KayttajanOikeudet-näkymä tarvitsi 18 propsia — ei siksi että näkymä olisi
// monimutkainen, vaan siksi että App omisti 14 erillistä perm*-alkuista tilaa jotka
// kuuluvat yhteen. Hookin palautusarvo vastaa lähes suoraan näkymän propseja.
//
// RAJAUS: tänne tulee vain se mikä on tämän muokkausistunnon omaa.
//   - roles/rolesLoading EI, koska myös käyttäjälista ja sovellusasetukset lukevat ne
//   - uusiSalasanaNaytto EI, koska sama näyttö palvelee myös uuden tunnuksen luontia
//   - näkymänvaihdot EIVÄT, koska hook ei tiedä mikä näkymä on päällä
// Nämä kolme tulevat sisään callbackeina. Ilman rajausta hook olisi vetänyt mukanaan
// puolet App():n käyttäjähallinnasta eikä olisi enää kuvannut mitään yhtä asiaa.

import { useState } from 'react';

import type { KayttajaRivi, TotpTiedot, UusiSalasana } from './tyypit';

type Valinnat = {
  // Palvelimen arpoma salasana näytetään kertaalleen. null tyhjentää näytön.
  onUusiSalasana: (salasana: UusiSalasana | null) => void;
  // Oikeusnäkymä avattiin — kutsuja vaihtaa näkymän.
  onAvattu: () => void;
  // Muokkaus päättyi (tallennus tai peruutus) — kutsuja palaa listaan.
  onSuljettu: () => void;
  // Tasolista haetaan tuoreena kun näkymä avataan.
  onHaeTasot: () => void;
};

export function useKayttajanOikeudet({
  onUusiSalasana, onAvattu, onSuljettu, onHaeTasot,
}: Valinnat) {
  const [muokattava, setMuokattava] = useState<KayttajaRivi | null>(null);
  const [nimimerkki, setNimimerkki] = useState('');
  const [taso, setTaso] = useState('');
  // Tapahtumarajaus: tyhjä = ei rajoitusta (näkee kaikki tapahtumat), muuten lista
  // tapahtuma-id:itä joihin käyttäjä on rajattu (ks. server/permissions.js: eventAccess).
  const [tapahtumaPaasy, setTapahtumaPaasy] = useState<string[]>([]);
  // Tuotepääsy: mihin puoliin ('event' / 'guard') tunnus pääsee. Palvelin torjuu tyhjän
  // listan, joten UI ei anna poistaa viimeistä valintaa (ks. vaihdaTuote).
  const [tuotteet, setTuotteet] = useState(['event']);

  const [tallennusVirhe, setTallennusVirhe] = useState('');
  const [tallennusKesken, setTallennusKesken] = useState(false);

  const [totpInfo, setTotpInfo] = useState<TotpTiedot | null>(null);
  const [totpLataa, setTotpLataa] = useState(false);
  const [totpVirhe, setTotpVirhe] = useState('');
  const [totpNollataan, setTotpNollataan] = useState(false);
  const [totpVaihdetaan, setTotpVaihdetaan] = useState(false);

  const [uloskirjausKesken, setUloskirjausKesken] = useState(false);
  const [uloskirjausViesti, setUloskirjausViesti] = useState('');

  const haeTotpTiedot = (username: string) => {
    setTotpLataa(true);
    setTotpVirhe('');
    fetch(`/api/users/${encodeURIComponent(username)}/totp`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setTotpInfo(data);
        else setTotpVirhe(data.error || 'Authenticator-tietojen haku epäonnistui.');
      })
      .catch(() => setTotpVirhe('Yhteysvirhe.'))
      .finally(() => setTotpLataa(false));
  };

  const avaa = (user: KayttajaRivi) => {
    setMuokattava(user);
    setTapahtumaPaasy(user.eventAccess || []);
    setTuotteet(Array.isArray(user.tuotteet) && user.tuotteet.length > 0 ? user.tuotteet : ['event']);
    setNimimerkki(user.nickname || '');
    setTaso(user.roleId || '');
    onUusiSalasana(null);
    onHaeTasot();
    setTallennusVirhe('');
    setTotpInfo(null);
    setTotpVirhe('');
    setUloskirjausViesti('');
    onAvattu();
    if (user.role !== 'admin') haeTotpTiedot(user.username);
  };

  const sulje = () => {
    setMuokattava(null);
    onSuljettu();
  };

  // Pelkkä tyhjennys ilman navigointia — kutsuja on jo vaihtamassa näkymää muualle
  // (ks. App.tsx: palaaEtusivulle).
  const nollaa = () => setMuokattava(null);

  const nollaaTotp = () => {
    if (!muokattava) return;
    const confirmed = window.confirm(
      `Nollataanko "${muokattava.nickname}" (${muokattava.username}) Authenticator-käyttöönotto?\n\n` +
      'Vanha koodi lakkaa toimimasta heti ja uusi QR-koodi pitää skannata puhelimeen.'
    );
    if (!confirmed) return;
    setTotpNollataan(true);
    setTotpVirhe('');
    fetch(`/api/users/${encodeURIComponent(muokattava.username)}/totp/reset`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setTotpInfo(data);
        else setTotpVirhe(data.error || 'Nollaus epäonnistui.');
      })
      .catch(() => setTotpVirhe('Yhteysvirhe.'))
      .finally(() => setTotpNollataan(false));
  };

  const vaihdaTotpVaatimus = () => {
    if (!muokattava) return;
    const nextRequired = !(totpInfo ? totpInfo.totpRequired !== false : muokattava.totp_required !== false);
    setTotpVaihdetaan(true);
    setTotpVirhe('');
    fetch(`/api/users/${encodeURIComponent(muokattava.username)}/totp`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ required: nextRequired }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setTotpInfo((prev) => (prev ? { ...prev, totpRequired: data.totpRequired } : prev));
          setMuokattava((prev) => (prev ? { ...prev, totp_required: data.totpRequired } : prev));
        } else {
          setTotpVirhe(data.error || 'Muutos epäonnistui.');
        }
      })
      .catch(() => setTotpVirhe('Yhteysvirhe.'))
      .finally(() => setTotpVaihdetaan(false));
  };

  const pakotaUloskirjaus = () => {
    if (!muokattava) return;
    const confirmed = window.confirm(
      `Kirjataanko "${muokattava.nickname}" (${muokattava.username}) ulos välittömästi?\n\n` +
      'Käyttäjän nykyinen istunto mitätöityy heti, ja hänen täytyy kirjautua uudelleen.'
    );
    if (!confirmed) return;
    setUloskirjausKesken(true);
    setUloskirjausViesti('');
    setTotpVirhe('');
    fetch(`/api/users/${encodeURIComponent(muokattava.username)}/logout`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setUloskirjausViesti('Käyttäjä kirjattu ulos.');
        else setTotpVirhe(data.error || 'Uloskirjaus epäonnistui.');
      })
      .catch(() => setTotpVirhe('Yhteysvirhe.'))
      .finally(() => setUloskirjausKesken(false));
  };

  // Tapahtumarajauksen valintaruudun kytkin — sama "lista mukana / pois" -periaate kuin
  // muuallakin sovelluksessa (ks. esim. toggleAddEmpSelected).
  const vaihdaTapahtumaPaasy = (eventId: string) => {
    setTapahtumaPaasy((prev) => (
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    ));
  };

  // Tuotepääsyn vaihto. Viimeistä valintaa ei voi poistaa: tyhjä lista lukitsisi käyttäjän
  // ulos molemmilta puolilta, ja palvelin torjuisi tallennuksen joka tapauksessa (PUT
  // /api/users). Parempi estää se tässä kuin näyttää virhe vasta tallennettaessa.
  const vaihdaTuote = (tuote: string) => {
    setTuotteet((prev) => {
      if (!prev.includes(tuote)) return [...prev, tuote];
      return prev.length > 1 ? prev.filter((t) => t !== tuote) : prev;
    });
  };

  // Puuttuvien puolien lisäys kerralla, kun valittu taso edellyttää niitä.
  const lisaaPuolet = (puolet: string[]) => {
    setTuotteet((prev) => [...new Set([...prev, ...puolet])]);
  };

  const tallenna = async () => {
    if (!muokattava) return;
    setTallennusVirhe('');
    if (!nimimerkki.trim()) {
      setTallennusVirhe('Nimimerkki ei voi olla tyhjä.');
      return;
    }
    setTallennusKesken(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(muokattava.username)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        // permissions-kenttää EI enää lähetetä: sivukartta-oikeudet tulevat tasolta
        // (roleId), ei käyttäjätietueesta. Tapahtumarajaus pysyy käyttäjäkohtaisena.
        body: JSON.stringify({
          nickname: nimimerkki.trim(),
          eventAccess: tapahtumaPaasy,
          tuotteet,
          ...(taso ? { roleId: taso } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        sulje();
      } else {
        setTallennusVirhe(data.error || 'Tallennus epäonnistui.');
      }
    } catch {
      setTallennusVirhe('Yhteysvirhe. Yritä uudelleen.');
    } finally {
      setTallennusKesken(false);
    }
  };

  // Pääkäyttäjä nollaa salasanan kun käyttäjä ei muista omaansa. Palvelin arpoo uuden
  // ja pakottaa käyttäjän vaihtamaan sen omakseen heti seuraavalla kirjautumisella.
  const nollaaSalasana = async () => {
    if (!muokattava) return;
    const vahvistus = window.confirm(
      `Nollataanko "${muokattava.nickname}" (${muokattava.username}) salasana?\n\n` +
      'Palvelin arpoo uuden väliaikaisen salasanan, joka näytetään sinulle kerran. ' +
      'Käyttäjä kirjautuu sillä ja joutuu heti vaihtamaan sen omakseen. ' +
      'Mahdolliset avoimet istunnot katkaistaan.'
    );
    if (!vahvistus) return;
    setTallennusVirhe('');
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(muokattava.username)}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        onUusiSalasana({ username: muokattava.username, password: data.password });
      } else {
        setTallennusVirhe(data.error || 'Salasanan nollaus epäonnistui.');
      }
    } catch {
      setTallennusVirhe('Yhteysvirhe. Yritä uudelleen.');
    }
  };

  // Palautusarvo on muotoiltu KayttajanOikeudet-näkymän propseiksi: operaatiokohtaiset
  // ryhmät (totp, uloskirjaus, tallennus) menevät sellaisenaan läpi.
  return {
    muokattava,
    nimimerkki,
    setNimimerkki,
    taso,
    setTaso,
    tuotteet,
    vaihdaTuote,
    lisaaPuolet,
    tapahtumaPaasy,
    vaihdaTapahtumaPaasy,
    totp: {
      info: totpInfo,
      virhe: totpVirhe,
      lataa: totpLataa,
      nollataan: totpNollataan,
      vaihdetaan: totpVaihdetaan,
      onNollaa: nollaaTotp,
      onVaihda: vaihdaTotpVaatimus,
    },
    uloskirjaus: {
      viesti: uloskirjausViesti,
      kesken: uloskirjausKesken,
      onPakota: pakotaUloskirjaus,
    },
    tallennus: {
      kesken: tallennusKesken,
      virhe: tallennusVirhe,
      onTallenna: tallenna,
    },
    avaa,
    sulje,
    nollaa,
    nollaaSalasana,
  };
}
