// GUARD-puolen työntekijäpankki.
//
// SAMA REKISTERI JA SAMAT KOMPONENTIT KUIN EVENTISSÄ, ei kopio. Lista ja lomake tulevat
// `shared/komponentit/`-kansiosta, palvelimella kokoelma on yksi (`employees`) yhden
// globaalin solmun takana (`global_employee_bank`, ei tuoteporttia). Kumpi tahansa puoli
// näyttää siis saman henkilön samana tietueena, ja muutos toisella näkyy toisella.
//
// Tämä tiedosto on VAIN KUORI: se pitää kirjaa siitä ollaanko listalla vai lomakkeella,
// ja tallentaa. Kaikki kenttälogiikka on jaetuissa komponenteissa.
//
// TALLENNUS ON EKSPLISIITTINEN eikä automaattinen useEffect, ja `ladattu`-lippu estää
// tallennuksen ennen onnistunutta hakua. Sama sääntö kuin GUARDin kohdelistalla:
// epäonnistunut haku jättäisi tilan tyhjäksi, ja automaattitallennus pyyhkisi silloin
// koko henkilöstörekisterin palvelimelta.
import { useState } from 'react';

import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { TyontekijaLista } from '../shared/komponentit/TyontekijaLista';
import { TyontekijanMuokkaus } from '../shared/komponentit/TyontekijanMuokkaus';
import { buildFullName } from '../shared/nimet';
import { seuraavaTunnisteNumero } from '../shared/tunnisteet';
import {
  emptyEmpForm, employeeToFormState,
  type Tyontekija, type TyontekijaLomake,
} from '../shared/tyontekijat';

type Props = {
  tyontekijat: Tyontekija[];
  ladattu: boolean;
  saaMuokata: boolean;
  // Tallentaa koko kokoelman. Palauttaa false jos tallennus epäonnistui, jolloin
  // näkymä jää lomakkeelle eikä muutos katoa käyttäjän silmistä.
  onTallenna: (lista: Tyontekija[]) => Promise<boolean>;
  onTakaisin: () => void;
};

export const Tyontekijapankki = ({
  tyontekijat, ladattu, saaMuokata, onTallenna, onTakaisin,
}: Props) => {
  const [nakyma, setNakyma] = useState<'lista' | 'lomake'>('lista');
  const [haku, setHaku] = useState('');
  const [muokattava, setMuokattava] = useState<Tyontekija | null>(null);
  const [lomake, setLomake] = useState<TyontekijaLomake>(emptyEmpForm);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tallentaa, setTallentaa] = useState(false);

  const kentta = (avain: string, arvo: unknown) =>
    setLomake((edellinen) => ({ ...edellinen, [avain]: arvo }) as TyontekijaLomake);

  const takaisinListaan = () => {
    setNakyma('lista');
    setMuokattava(null);
    setLomake(emptyEmpForm);
    setVirhe(null);
  };

  const tallenna = async () => {
    if (!lomake.firstName.trim() || !lomake.lastName.trim()) {
      setVirhe('Kirjaa vähintään etunimi ja sukunimi.');
      return;
    }
    setVirhe(null);
    setTallentaa(true);
    try {
      const name = buildFullName(lomake);
      const uusi = muokattava
        ? tyontekijat.map((t) => (t.id === muokattava.id ? { ...lomake, id: muokattava.id, name } : t))
        : [
          ...tyontekijat,
          {
            ...lomake,
            id: `emp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            // Tunnistenumero annetaan KERRAN luontihetkellä eikä sitä muuteta: tallennetut
            // raportit viittaavat siihen kirjaajatiedossaan. Numero lasketaan koko
            // listasta, joten poistetun numero ei palaa kiertoon.
            displayId: seuraavaTunnisteNumero(tyontekijat),
          },
        ];
      if (await onTallenna(uusi as Tyontekija[])) takaisinListaan();
      else setVirhe('Tallennus epäonnistui. Tiedot ovat yhä lomakkeella.');
    } finally {
      setTallentaa(false);
    }
  };

  const poista = async (kohde: Tyontekija) => {
    if (!window.confirm(`Poistetaanko ${kohde.name} työntekijäpankista?`)) return;
    setVirhe(null);
    const jaljelle = tyontekijat.filter((t) => t.id !== kohde.id);
    if (await onTallenna(jaljelle)) takaisinListaan();
    else setVirhe('Poisto epäonnistui.');
  };

  return (
    <div>
      <TakaisinLinkki onClick={nakyma === 'lomake' ? takaisinListaan : onTakaisin}>
        {nakyma === 'lomake' ? 'Takaisin työntekijälistaan' : 'Takaisin etusivulle'}
      </TakaisinLinkki>

      {virhe && (
        <div className="text-sm bg-danger-soft text-danger-ink border border-danger/30 rounded-lg px-3 py-2 mb-4 max-w-5xl">
          {virhe}
        </div>
      )}

      {!ladattu ? (
        <p className="text-sm text-ink-muted">Haetaan työntekijöitä…</p>
      ) : nakyma === 'lomake' ? (
        <TyontekijanMuokkaus
          lomake={lomake}
          onKentta={kentta}
          muokattava={muokattava}
          saaMuokata={saaMuokata && !tallentaa}
          onTallenna={tallenna}
          onPeruuta={takaisinListaan}
          onPoista={poista}
          // Käyttäjätunnusten luonti on tarkoituksella POIS GUARD-puolelta: /api/users
          // vaatii pääkäyttäjän, ja tunnuksen luonti on hallintaa eikä henkilöstötietojen
          // ylläpitoa. Se tehdään tapahtumapuolen pankista tai käyttäjähallinnasta.
          saaLuodaTunnuksen={false}
          kayttajatunnus=""
          olemassaOlevaTunnus={null}
          onAvaaTunnus={() => {}}
          onLisaaKieli={() => setLomake((e) => ({ ...e, languages: [...(e.languages || []), { language: '', level: 3 }] }))}
          onPoistaKieli={(i) => setLomake((e) => ({ ...e, languages: (e.languages || []).filter((_, k) => k !== i) }))}
          onMuutaKieli={(i, avain, arvo) => setLomake((e) => ({
            ...e,
            languages: (e.languages || []).map((rivi, k) => (k === i ? { ...rivi, [avain]: arvo } : rivi)),
          }))}
        />
      ) : (
        <TyontekijaLista
          tyontekijat={tyontekijat}
          haku={haku}
          onHaku={setHaku}
          saaMuokata={saaMuokata}
          onUusi={() => { setMuokattava(null); setLomake(emptyEmpForm); setNakyma('lomake'); }}
          onMuokkaa={(t) => { setMuokattava(t); setLomake(employeeToFormState(t)); setNakyma('lomake'); }}
          onPoista={poista}
        />
      )}
    </div>
  );
};
