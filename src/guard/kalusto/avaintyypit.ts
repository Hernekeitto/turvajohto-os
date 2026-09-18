// Avaintyyppikartan selainpuoli: haku, kirjoitus ja kuvan lähetys.
//
// Kartta on luettelo avainmalleista tunnistuskuvineen. Se vastaa kysymykseen "mikä avain
// tämä on kädessäni" — kirjaaja vertaa kuvaa avaimeen ja valitsee nimen sen sijaan että
// kirjoittaisi sen muistista. Kirjoitusasujen kirjo on nimittäin se mikä rikkoo haun:
// "abloy exec", "Abloy EXEC" ja "ABLOY Exec" ovat pankissa kolme eri avaintyyppiä.

export type Avaintyyppi = {
  id: string;
  nimi: string;
  kuvaus: string;
  uploadId: string;
  luotu: string;
  luoja?: string | null;
};

type Vastaus = { ok: boolean; error?: string; tyyppi?: Avaintyyppi };

// Kuvan osoite. Liitepolku on sama kuin muillakin liitteillä, ja se on kirjautumisen
// takana — tunnistuskuvat ovat valmistajien tuotekuvia eivätkä kuulu julkiseen verkkoon.
export const kuvanOsoite = (uploadId: string) => `/api/uploads/${uploadId}`;

export async function haeAvaintyypit(): Promise<Avaintyyppi[]> {
  try {
    const vastaus = await fetch('/api/data/keyTypes', { credentials: 'include' });
    if (!vastaus.ok) return [];
    const data = await vastaus.json();
    const lista: Avaintyyppi[] = Array.isArray(data?.data) ? data.data : [];
    return lista.sort((a, b) => a.nimi.localeCompare(b.nimi, 'fi'));
  } catch {
    return [];
  }
}

async function kutsu(polku: string, runko: unknown, metodi: 'POST' | 'PUT'): Promise<Vastaus> {
  try {
    const vastaus = await fetch(polku, {
      method: metodi,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(runko),
    });
    const data = await vastaus.json().catch(() => null);
    if (!vastaus.ok) {
      return { ok: false, error: data?.error || `Palvelin vastasi virheellä ${vastaus.status}.` };
    }
    return data || { ok: false, error: 'Palvelimen vastausta ei voitu lukea.' };
  } catch {
    return { ok: false, error: 'Ei yhteyttä palvelimeen. Muutosta ei tallennettu.' };
  }
}

export const luoAvaintyyppi = (runko: { nimi: string; kuvaus: string; uploadId: string }) =>
  kutsu('/api/avaintyypit', runko, 'POST');

export const paivitaAvaintyyppi = (
  id: string,
  runko: { nimi: string; kuvaus: string; uploadId?: string }
) => kutsu(`/api/avaintyypit/${id}`, runko, 'PUT');

export async function poistaAvaintyyppi(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const vastaus = await fetch(`/api/avaintyypit/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await vastaus.json().catch(() => null);
    if (!vastaus.ok) return { ok: false, error: data?.error || 'Poisto epäonnistui.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Ei yhteyttä palvelimeen.' };
  }
}

// --- Kuvan pienennys ennen lähetystä -------------------------------------------------
//
// PIENENNYS TEHDÄÄN SELAIMESSA, koska palvelimella ei ole kuvankäsittelykirjastoa eikä
// sellaista kannata lisätä yhden ominaisuuden takia. Valmistajan tuotekuva on helposti
// 2500×5000 ja pari megatavua; tunnistamiseen riittää murto-osa siitä, ja erotus
// ladataan joka kerta kun vartija avaa kartan puhelimessa kentällä.
//
// WebP:hen, koska se säilyttää läpinäkyvyyden (moni tuotekuva on irrotettu taustastaan)
// ja on selvästi PNG:tä pienempi. Jos selain ei osaa koodata WebP:tä, toBlob palauttaa
// PNG:n — se on suurempi mutta kelvollinen, eikä lähetys saa kaatua siihen.
const KUVAN_MAX_SIVU = 1400;
const LAATU = 0.85;

export async function pienennaKuva(tiedosto: File): Promise<Blob> {
  try {
    const kuva = await createImageBitmap(tiedosto);
    const suhde = Math.min(1, KUVAN_MAX_SIVU / Math.max(kuva.width, kuva.height));
    // Jo valmiiksi pieni kuva lähetetään sellaisenaan: uudelleenkoodaus vain hävittäisi
    // laatua ilman että tiedosto pienenee.
    if (suhde === 1 && tiedosto.size < 400_000) {
      kuva.close();
      return tiedosto;
    }
    const kangas = document.createElement('canvas');
    kangas.width = Math.round(kuva.width * suhde);
    kangas.height = Math.round(kuva.height * suhde);
    const piirto = kangas.getContext('2d');
    if (!piirto) return tiedosto;
    piirto.drawImage(kuva, 0, 0, kangas.width, kangas.height);
    kuva.close();

    const blob = await new Promise<Blob | null>((valmis) => {
      kangas.toBlob(valmis, 'image/webp', LAATU);
    });
    return blob && blob.size > 0 ? blob : tiedosto;
  } catch {
    // Selain ei osannut lukea tiedostoa (HEIC vanhassa selaimessa tms.). Alkuperäinen
    // menee läpi jos palvelin hyväksyy sen tyypin — parempi kuin epäonnistua tässä.
    return tiedosto;
  }
}

export async function lahetaKuva(tiedosto: File): Promise<{ ok: boolean; id?: string; error?: string }> {
  const blob = await pienennaKuva(tiedosto);
  // Päätteen on vastattava sisältöä: palvelin tarkistaa sallitut tyypit nimen päätteestä
  // (server/uploads.js: isAllowedFile), ja pienennetty kuva on webp vaikka alkuperäinen
  // oli png.
  const nimi = blob === (tiedosto as Blob) ? tiedosto.name : 'avaintyyppi.webp';
  const lomake = new FormData();
  lomake.append('file', blob, nimi);
  try {
    const vastaus = await fetch('/api/uploads', {
      method: 'POST',
      credentials: 'include',
      body: lomake,
    });
    const data = await vastaus.json().catch(() => null);
    if (!vastaus.ok || !data?.id) {
      return { ok: false, error: data?.error || 'Kuvan lähetys epäonnistui.' };
    }
    return { ok: true, id: data.id };
  } catch {
    return { ok: false, error: 'Ei yhteyttä palvelimeen. Kuvaa ei lähetetty.' };
  }
}
