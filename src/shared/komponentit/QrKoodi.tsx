// QR-koodi. Jaettu komponentti heti ensimmäisestä käyttökohteesta alkaen, koska
// tarvitsijoita on jo tiedossa kaksi: yleisöilmoitusten juliste (erä 4) ja vartiointi-
// kierrosten tarkistuspisteet (erä 5). Toinen toteutus tarkoittaisi kahta eri kokoa,
// kahta virheenkorjaustasoa ja kahta tapaa epäonnistua.
//
// Koodi muodostetaan PALVELIMELLA (POST /api/qr). Perustelut:
//   - qrcode-kirjasto on jo palvelimen riippuvuutena (TOTP-koodit), joten selainnippu
//     ei kasva
//   - CSP sallii vain 'self'-lähteet, joten valmista koodia ei voi hakea ulkopuolelta
//   - julisteen osoite sisältää tokenin, ja pyynnön rungossa se ei päädy access.logiin
//     (GET-parametrina päätyisi)
//
// Vastapaino: koodi vaatii verkkoyhteyden. Se on tietoinen valinta — QR-koodia
// katsotaan ja tulostetaan valvomon koneelta, ei kentällä huonossa verkossa.
import { useEffect, useState } from 'react';

// Hakee QR-koodin data-URI:na. Erillinen funktio komponentin rinnalla, koska tuloste
// tarvitsee saman kuvan omaan HTML-dokumenttiinsa (ks. tuloste.ts: tulostaDokumentti)
// eikä voi lukea sitä komponentin sisältä.
export async function haeQrKoodi(teksti: string): Promise<string | null> {
  try {
    const res = await fetch('/api/qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ teksti }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data && data.ok && typeof data.dataUri === 'string') return data.dataUri;
    return null;
  } catch {
    return null;
  }
}

type Props = {
  teksti: string;
  koko?: number;
  // Kuvan vaihtoehtoinen teksti. QR-koodin sisältö on osoite, joka ruudunlukijalle
  // luettuna on pelkkää melua, joten oletus kertoo mistä koodista on kyse.
  alt?: string;
};

export function QrKoodi({ teksti, koko = 200, alt = 'QR-koodi' }: Props) {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [virhe, setVirhe] = useState(false);

  useEffect(() => {
    let peruttu = false;
    setDataUri(null);
    setVirhe(false);
    if (!teksti) return;
    haeQrKoodi(teksti).then((tulos) => {
      if (peruttu) return;
      if (tulos) setDataUri(tulos);
      else setVirhe(true);
    });
    return () => { peruttu = true; };
  }, [teksti]);

  if (virhe) {
    return (
      <div
        style={{ width: koko, height: koko }}
        className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs text-slate-500"
      >
        QR-koodia ei saatu muodostettua.
      </div>
    );
  }

  if (!dataUri) {
    // Varattu tila samankokoisena: ilman sitä koko lohko hyppäisi kun kuva saapuu.
    return <div style={{ width: koko, height: koko }} className="rounded-lg bg-slate-100" aria-hidden="true" />;
  }

  return <img src={dataUri} alt={alt} width={koko} height={koko} className="rounded-lg bg-white" />;
}
