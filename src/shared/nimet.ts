// Henkilönimien käsittely. Jaettu: työntekijärekisteri ja käyttäjätunnukset ovat
// yhteisiä EVENT- ja GUARD-puolelle, joten nimen ja tunnuksen johtamisen on toimittava
// molemmilla puolilla täsmälleen samoin.

// Käyttäjätunnus johdetaan aina nimestä muodossa sukunimi_etunimi. Ääkköset korvataan,
// koska tunnusta käytetään myös URL-poluissa (/api/users/:username).
export const kayttajatunnusNimesta = (form: any) => {
  const siisti = (osa: unknown) =>
    String(osa || '')
      .trim()
      .toLowerCase()
      .replace(/[äå]/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/[^a-z0-9]+/g, '')
      .trim();
  // Vain ensimmäinen etunimi: "Elli Marja Orvokki" -> "elli".
  const etunimi = siisti(String(form?.firstName || '').trim().split(/\s+/)[0]);
  const sukunimi = siisti(form?.lastName);
  if (!etunimi || !sukunimi) return '';
  return `${sukunimi}_${etunimi}`;
};

// Vanha data tunsi työntekijän vain yhtenä "Sukunimi Etunimi ToisetNimet" -merkkijonona
// (`name`). Uusi lomake kerää etu- ja sukunimen erikseen, mutta koko sovellus (haut,
// sisäänkirjaukset, näytöt) tunnistaa työntekijän edelleen tällä samalla yhdistetyllä
// nimellä, joten se lasketaan aina tallennettaessa eikä sitä koskaan muokata suoraan.
export const splitFullName = (name: unknown) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return { lastName: parts[0] || '', firstName: parts.slice(1).join(' ') };
};

export const buildFullName = (form: any) =>
  `${(form.lastName || '').trim()} ${(form.firstName || '').trim()}`.trim();
