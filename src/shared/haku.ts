// Vapaa tekstihaku listoihin.
//
// --- Miksi omana tiedostonaan ---------------------------------------------------------
//
// Hakuehdon täsmäys on puhdasta logiikkaa, ja se on juuri se osa joka menee hiljaa
// väärin: ääkköset, isot kirjaimet ja välilyönnit. Väärin täsmäävä haku ei näytä
// rikkinäiseltä vaan tyhjältä — ja tyhjä lista tarkoittaa päivystäjän ruudulla "ei
// tapahtumia", mikä on eri asia kuin "haku ei löytänyt".
//
// --- Ääkköset ------------------------------------------------------------------------
//
// Hakusana ja kohde normalisoidaan molemmat: "makela" löytää Mäkelän ja "MÄKELÄ" löytää
// makelan. Vartijan nimimerkki kirjoitetaan kiireessä ja puhelimen näppäimistöllä, eikä
// haku saa vaatia täsmällistä ääkköstä silloin kun etsitään ihmistä hälytyksen takaa.

/** Pienaakkoset ja ääkköset pois, jotta haku ei kaadu kirjoitusasuun. */
export function normalisoi(teksti: string): string {
  return teksti
    .toLowerCase()
    .normalize('NFD')
    // Yhdistyvät tarkkeet pois: ä -> a, ö -> o, é -> e.
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Osuuko hakuehto yhteenkään annetuista kentistä.
 *
 * <b>Tyhjä hakuehto osuu kaikkeen.</b> Näin kutsuja voi suodattaa ehdoitta samalla
 * koodilla eikä joudu kirjoittamaan haaraa "jos haku on tyhjä" jokaiseen listaan — juuri
 * sellainen haara jää helposti kirjoittamatta yhteen paikkaan.
 *
 * Useampi sana tarkoittaa JA-ehtoa: "virtanen tarkistus" löytää rivin jossa on
 * molemmat, missä kentässä tahansa. Se on se mitä ihminen tarkoittaa kirjoittaessaan
 * kaksi sanaa — ei riviä jossa on jompikumpi.
 */
export function osuu(kentat: (string | null | undefined)[], haku: string): boolean {
  const sanat = normalisoi(haku).split(/\s+/).filter(Boolean);
  if (sanat.length === 0) {
    return true;
  }
  const kasa = kentat
    .filter((k): k is string => typeof k === 'string' && k.length > 0)
    .map(normalisoi)
    .join(' ');
  return sanat.every((sana) => kasa.includes(sana));
}
