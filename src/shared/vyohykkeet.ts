// Alueen vyöhykkeet (lohkot, portit, EA-pisteet). Jaettu: tapahtumalla ja
// vartiointikohteella on sama tarve ja sama datamalli.
//
// Vyöhyke on tapahtuman KENTTÄ eikä oma kokoelmansa (päätös V5). Uusi kokoelma vaatisi
// oman oikeussääntönsä, rekisteröinnin kolmeen paikkaan ja romahdussuojan erikoistapauksen
// — vyöhykkeet taas ovat merkityksettömiä ilman tapahtumaa jolle ne on piirretty.
//
// Koordinaatit ovat OSUUKSIA (0–1) pohjakuvan leveydestä ja korkeudesta, eivät pikseleitä.
// Pikselit sitoisivat piirroksen siihen kuvatiedostoon jolla se tehtiin: kartan
// vaihtaminen tarkempaan skannaukseen siirtäisi jokaisen vyöhykkeen väärään paikkaan.
// Osuuksilla sama piirros kelpaa myös eri kokoiselle kuvalle, kunhan rajaus on sama.

export type Piste = { x: number; y: number };

export type Vyohyke = {
  id: string;
  nimi: string;
  vari: string;
  pisteet: Piste[];
};

// Värit ovat kiinteä valikoima eikä vapaa värivalitsin: kartalta pitää erottaa
// vyöhykkeet toisistaan yhdellä silmäyksellä, ja se onnistuu vain jos värejä on vähän ja
// ne ovat kaukana toisistaan. Sama nimi näkyy myös suodattimissa.
export const VYOHYKEVARIT = [
  { id: 'indigo', nimi: 'Sininen', reuna: '#4f46e5', tayte: 'rgba(79, 70, 229, 0.22)' },
  { id: 'emerald', nimi: 'Vihreä', reuna: '#059669', tayte: 'rgba(5, 150, 105, 0.22)' },
  { id: 'amber', nimi: 'Keltainen', reuna: '#d97706', tayte: 'rgba(217, 119, 6, 0.22)' },
  { id: 'rose', nimi: 'Punainen', reuna: '#e11d48', tayte: 'rgba(225, 29, 72, 0.22)' },
  { id: 'violet', nimi: 'Violetti', reuna: '#7c3aed', tayte: 'rgba(124, 58, 237, 0.22)' },
  { id: 'slate', nimi: 'Harmaa', reuna: '#475569', tayte: 'rgba(71, 85, 105, 0.22)' },
];

export const vari = (id: string) => VYOHYKEVARIT.find((v) => v.id === id) || VYOHYKEVARIT[0];

export const uusiVyohykeId = () =>
  `vy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const vyohykkeet = (tapahtuma: any): Vyohyke[] =>
  Array.isArray(tapahtuma?.zones) ? tapahtuma.zones : [];

export const vyohykkeenNimi = (lista: Vyohyke[], id: unknown) =>
  lista.find((v) => v.id === id)?.nimi || '';

// Monikulmion keskipiste nimilapun sijoittamiseen. Pisteiden keskiarvo riittää tähän:
// se ei ole geometrinen keskipiste koveralle alueelle, mutta festivaalialueen lohkot
// ovat käytännössä suorakulmioita, ja väärässä paikassa oleva lappu on korjattavissa
// siirtämällä piirrosta — toisin kuin väärässä paikassa oleva vyöhyke.
export const keskipiste = (v: Vyohyke): Piste => {
  const pisteet = v.pisteet || [];
  if (pisteet.length === 0) return { x: 0.5, y: 0.5 };
  const summa = pisteet.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: summa.x / pisteet.length, y: summa.y / pisteet.length };
};

// Monikulmio tarvitsee vähintään kolme pistettä. Kahdella pisteellä syntyisi viiva jota
// ei voi napsauttaa eikä nähdä kartalla — se olisi vyöhyke jota ei ole olemassa.
export const VYOHYKKEEN_MIN_PISTEET = 3;
