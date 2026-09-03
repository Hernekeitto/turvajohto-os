// Jälkiraporttien selainpuoli (erä 9).
//
// Säännöt (valmis on lukittu, avaaminen vaatii syyn, luvut jäädytetään luontihetkellä)
// ovat palvelimella server/jalkiraportti.js:ssä. Tämä moduuli kysyy ja muotoilee.

import { aikavaliTekstina, hetki, kesto, luku, prosentti, type Kooste } from './analytiikka.ts';
import { tulostaDokumentti, tulostusDokumentti } from './tuloste.ts';

export type Toimenpide = {
  id: string;
  teksti: string;
  vastuu: string;
  maarapaiva: string;
  tehty: boolean;
};

export type JalkiraportinHistoria = {
  ts: string; tapahtuma: string; user: string | null; teksti: string;
};

export type Jalkiraportti = {
  id: string;
  ownerId: string;
  omistaja: 'kohde' | 'tapahtuma';
  nimi: string;
  ikkuna: { alku: string | null; loppu: string | null };
  kooste: Kooste;
  tila: 'luonnos' | 'valmis';
  luotu: string;
  laatija: string | null;
  muokattu?: string;
  muokkaaja?: string | null;
  valmis: { ts: string; user: string | null } | null;
  yhteenveto: string;
  onnistui: string;
  kehitettavaa: string;
  oppi: string;
  toimenpiteet: Toimenpide[];
  historia: JalkiraportinHistoria[];
};

// Sama neljä kysymystä kuin palvelimen OSIOT-listassa. Ohjeteksti on frontin puolella:
// se on käyttöliittymää eikä sääntö, ja palvelin ei sitä tarvitse.
export const OSIOT: { id: 'yhteenveto' | 'onnistui' | 'kehitettavaa' | 'oppi'; nimi: string; ohje: string }[] = [
  { id: 'yhteenveto', nimi: 'Yhteenveto', ohje: 'Mitä tapahtui, kuinka monta ja mitä poikkeuksellista.' },
  { id: 'onnistui', nimi: 'Mikä toimi', ohje: 'Mitkä ratkaisut kannattaa tehdä samoin ensi kerralla.' },
  { id: 'kehitettavaa', nimi: 'Mikä ei toiminut', ohje: 'Missä meni pieleen ja miksi. Ilman tätä osiota purku on kiitospuhe.' },
  { id: 'oppi', nimi: 'Opit ja suositukset', ohje: 'Mitä seuraavan tapahtuman suunnittelijan on tiedettävä.' },
];

type Vastaus = { ok: boolean; error?: string; raportti?: Jalkiraportti };

async function kutsu(polku: string, asetukset: RequestInit): Promise<Vastaus> {
  try {
    const vastaus = await fetch(polku, { credentials: 'include', ...asetukset });
    const data = await vastaus.json().catch(() => null);
    if (!vastaus.ok) return { ok: false, error: data?.error || `Palvelin vastasi virheellä ${vastaus.status}.` };
    return data || { ok: false, error: 'Palvelimen vastausta ei voitu lukea.' };
  } catch {
    return { ok: false, error: 'Ei yhteyttä palvelimeen. Muutosta ei tallennettu.' };
  }
}

const posti = (polku: string, runko?: unknown) => kutsu(polku, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(runko ?? {}),
});

export const luoJalkiraportti = (runko: { ownerId: string; nimi: string; alku: string | null; loppu: string | null }) =>
  posti('/api/jalkiraportti', runko);

export const tallennaJalkiraportti = (id: string, muutokset: Partial<Jalkiraportti>) =>
  posti(`/api/jalkiraportti/${encodeURIComponent(id)}/tallenna`, muutokset);

export const merkitseValmiiksi = (id: string) =>
  posti(`/api/jalkiraportti/${encodeURIComponent(id)}/valmis`);

export const avaaUudelleen = (id: string, syy: string) =>
  posti(`/api/jalkiraportti/${encodeURIComponent(id)}/avaa`, { syy });

export const poistaJalkiraportti = (id: string) =>
  kutsu(`/api/jalkiraportti/${encodeURIComponent(id)}`, { method: 'DELETE' });

export async function haeJalkiraportit(): Promise<Jalkiraportti[] | null> {
  try {
    const vastaus = await fetch('/api/data/debriefs', { credentials: 'include' });
    if (!vastaus.ok) return null;
    const data = await vastaus.json();
    return data?.ok === true && Array.isArray(data.data) ? (data.data as Jalkiraportti[]) : null;
  } catch {
    return null;
  }
}

// --- Tuloste -----------------------------------------------------------------------

// Luvut menevät tulosteeseen SIINÄ MUODOSSA jossa ne jäädytettiin. Tuloste on se
// dokumentti joka päätyy tilaajalle ja arkistoon, ja jos se laskisi lukunsa uudelleen
// tulostushetkellä, kaksi eri päivänä tulostettua kappaletta samasta raportista voisi
// olla eri sisältöisiä.
const lukurivit = (kooste: Kooste) => {
  const { kirjaukset, vasteajat, kierrokset, halytykset } = kooste;
  const rivit = [
    `Kirjauksia: ${luku(kirjaukset.yhteensa)} (poikkeamia ${kirjaukset.poikkeamia})`,
    `Vasteaika, mediaani: ${vasteajat.sulkeminen ? kesto(vasteajat.sulkeminen.mediaani) : '—'}${
      vasteajat.sulkeminen ? ` (n = ${vasteajat.sulkeminen.n}, p90 ${kesto(vasteajat.sulkeminen.p90)})` : ''}`,
    `Avoimia poikkeamia jakson lopussa: ${vasteajat.avoimia}`,
    `Hälytyksiä: ${halytykset.yhteensa} (kuitattu ${halytykset.kuitattuja}, eskaloitui ${halytykset.eskaloituja})`,
    `Hälytysten kuittausvaste, mediaani: ${halytykset.kuittausvaste ? kesto(halytykset.kuittausvaste.mediaani) : '—'}`,
  ];
  if (kierrokset.ajoja > 0) {
    rivit.push(`Kierroksia: ${kierrokset.ajoja} (valmiit ${kierrokset.valmiit}, keskeytetyt ${kierrokset.keskeytetyt})`);
    rivit.push(`Tarkistuspisteiden kattavuus: ${prosentti(kierrokset.kattavuus)} (${kierrokset.kuitattuja}/${kierrokset.pisteita})`);
  }
  if (kirjaukset.ajattomia > 0) {
    rivit.push(`Huom: ${kirjaukset.ajattomia} kirjausta ilman luontiaikaa ei ole mukana aikaan perustuvissa luvuissa.`);
  }
  return rivit.join('\n');
};

const jakaumaRivit = (rivit: { nimi: string; kpl: number }[]) =>
  (rivit.length === 0 ? '—' : rivit.map((r) => `${r.nimi}: ${r.kpl}`).join('\n'));

const toimenpideRivit = (toimenpiteet: Toimenpide[]) => (toimenpiteet.length === 0
  ? 'Ei kirjattuja toimenpiteitä.'
  : toimenpiteet.map((t, i) => {
    const lisat = [t.vastuu && `vastuu: ${t.vastuu}`, t.maarapaiva && `määräpäivä: ${t.maarapaiva}`, t.tehty && 'tehty']
      .filter(Boolean).join(', ');
    return `${i + 1}. ${t.teksti}${lisat ? ` (${lisat})` : ''}`;
  }).join('\n'));

// Dokumentin kokoaminen on erillään sen tulostamisesta, jotta sisältö voidaan testata
// ilman selainta: tulostaDokumentti avaa dialogin, eikä dialogia voi avata testissä.
export const jalkiraportinTuloste = (raportti: Jalkiraportti, ownerNimi: string) =>
  tulostusDokumentti({
    otsikko: raportti.nimi,
    tunniste: raportti.tila === 'valmis' ? 'VALMIS' : 'LUONNOS',
    meta: [
      { otsikko: raportti.omistaja === 'kohde' ? 'Kohde' : 'Tapahtuma', arvo: ownerNimi },
      { otsikko: 'Aikaväli', arvo: aikavaliTekstina(raportti.ikkuna) },
      { otsikko: 'Laatija', arvo: raportti.laatija || '' },
      { otsikko: 'Luvut laskettu', arvo: hetki(raportti.kooste?.laskettu) },
    ],
    kentat: [
      { otsikko: 'Tunnusluvut', arvo: lukurivit(raportti.kooste) },
      { otsikko: 'Kirjaukset tyypeittäin', arvo: jakaumaRivit(raportti.kooste.kirjaukset.tyypeittain) },
      { otsikko: 'Kirjaukset vyöhykkeittäin', arvo: jakaumaRivit(raportti.kooste.kirjaukset.vyohykkeittain) },
      ...OSIOT.map((o) => ({ otsikko: o.nimi, arvo: raportti[o.id] || '—' })),
      { otsikko: 'Toimenpiteet', arvo: toimenpideRivit(raportti.toimenpiteet || []) },
    ],
    huomio: raportti.tila === 'valmis'
      ? `<strong>Valmis jälkiraportti.</strong> Merkitty valmiiksi ${htmlAika(raportti.valmis?.ts)}${
        raportti.valmis?.user ? ` (${escapeTeksti(raportti.valmis.user)})` : ''}. Luvut on jäädytetty laskentahetkellä eivätkä muutu myöhemmin.`
      : '<strong>Luonnos.</strong> Raporttia ei ole merkitty valmiiksi, joten sen sisältö voi vielä muuttua.',
    alatunniste: `Turvajohto OS · jälkiraportti ${raportti.id}`,
  });

export const tulostaJalkiraportti = (raportti: Jalkiraportti, ownerNimi: string) =>
  tulostaDokumentti(jalkiraportinTuloste(raportti, ownerNimi));

// Huomio-kenttä menee tulosteeseen HTML:nä (se sisältää <strong>-korostuksen), joten
// käyttäjän syöttämä nimi on escapettava erikseen. Muut kentät escapetaan tuloste.ts:ssä.
const escapeTeksti = (arvo: unknown) => String(arvo ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const htmlAika = (iso?: string) => escapeTeksti(hetki(iso));
