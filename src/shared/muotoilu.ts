// Lukujen esitysmuodot. Jaettu: palkat, tallennustila ja euromäärät näytetään samoin
// molemmilla puolilla.

// Työsopimuksen palkkarivien summaus. Pilkku hyväksytään desimaalierottimena, koska
// suomalainen näppäilee palkan muodossa "12,45".
export const euroLuku = (arvo: unknown) => {
  const n = parseFloat(String(arvo ?? '').replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export const muotoileEuro = (arvo: number, desimaalit = 2) =>
  arvo.toLocaleString('fi-FI', { minimumFractionDigits: desimaalit, maximumFractionDigits: desimaalit });

export const muotoileTavut = (tavua: number) => {
  if (!Number.isFinite(tavua)) return '—';
  const gb = tavua / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(tavua / (1024 * 1024)).toFixed(0)} MB`;
};

// Kokonaispalkka työsopimuslomakkeelle.
//
// HUOM tulkinta: "Henkilökohtainen palkka (jos sovittu)" KORVAA tasopalkan ja
// henkilökohtaisen palkanosan summan silloin kun se on täytetty — TES:n tasopalkka on
// vähimmäispalkka, ja erikseen sovittu henkilökohtainen palkka sovitaan sen tilalle
// eikä sen päälle. "Muu palkka" lisätään aina päälle. Laskenta näytetään lomakkeella
// auki (ks. Palkkaus-lohko), jotta virheellinen tulkinta huomataan heti.
export const laskeKokonaispalkka = (form: any) => {
  const tasopalkka = euroLuku(form?.basePay);
  const hlokohtainenOsa = euroLuku(form?.personalPayPart);
  const hlokohtainenPalkka = euroLuku(form?.personalPay);
  const muuPalkka = euroLuku(form?.otherPay);
  const pohja = hlokohtainenPalkka > 0 ? hlokohtainenPalkka : tasopalkka + hlokohtainenOsa;
  const kuukaudessa = pohja + muuPalkka;
  const jakaja = euroLuku(form?.hourDivisor);
  return {
    kuukaudessa,
    tunnissa: jakaja > 0 ? kuukaudessa / jakaja : 0,
    // Kertoo kumpi laskutapa oli käytössä, jotta lomake voi selittää sen käyttäjälle.
    korvaava: hlokohtainenPalkka > 0,
  };
};

// Sama sääntö kuin palvelimella (server/index.js) — tämä on vain välitöntä
// käyttäjäpalautetta varten, palvelin on todellinen portti.
export const isValidPasswordClient = (pw: unknown) =>
  typeof pw === 'string' && pw.length >= 10 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw);
