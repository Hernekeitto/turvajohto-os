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
import { useEffect, useState } from 'react';
import { KeyRound, X } from 'lucide-react';

import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { TyontekijaLista } from '../shared/komponentit/TyontekijaLista';
import { TyontekijanMuokkaus } from '../shared/komponentit/TyontekijanMuokkaus';
import { TyontekijanTunnus } from '../shared/komponentit/TyontekijanTunnus';
import type { KayttajaRivi } from '../shared/asetukset/Kayttajat';
import { useTakaisinEste } from '../shared/navigointi';
import { buildFullName, kayttajatunnusNimesta } from '../shared/nimet';
import { seuraavaTunnisteNumero } from '../shared/tunnisteet';
import {
  emptyEmpForm, employeeToFormState,
  type Tyontekija, type TyontekijaLomake,
} from '../shared/tyontekijat';

type Props = {
  tyontekijat: Tyontekija[];
  ladattu: boolean;
  saaMuokata: boolean;
  // Tunnusten luonti ja salasanan nollaus ovat palvelimella pääkäyttäjärajattuja
  // (/api/users), joten osion 10 painike näytetään vain pääkäyttäjälle.
  isAdmin: boolean;
  // Tallentaa koko kokoelman. Palauttaa false jos tallennus epäonnistui, jolloin
  // näkymä jää lomakkeelle eikä muutos katoa käyttäjän silmistä.
  onTallenna: (lista: Tyontekija[]) => Promise<boolean>;
  onTakaisin: () => void;
};

export const Tyontekijapankki = ({
  tyontekijat, ladattu, saaMuokata, isAdmin, onTallenna, onTakaisin,
}: Props) => {
  const [nakyma, setNakyma] = useState<'lista' | 'lomake'>('lista');
  const [haku, setHaku] = useState('');
  const [muokattava, setMuokattava] = useState<Tyontekija | null>(null);
  const [lomake, setLomake] = useState<TyontekijaLomake>(emptyEmpForm);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tallentaa, setTallentaa] = useState(false);
  const [tunnusAuki, setTunnusAuki] = useState(false);
  // Vain painikkeen tekstiä varten ("Luo" vai "Muokkaa"); modaali hakee oman tuoreen
  // listansa.
  const [kayttajat, setKayttajat] = useState<KayttajaRivi[]>([]);

  const haeKayttajat = () => {
    if (!isAdmin) return;
    fetch('/api/users', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.ok) setKayttajat(data.users || []); })
      .catch(() => { /* painike näyttää silloin luontitekstin */ });
  };

  useEffect(haeKayttajat, [isAdmin]);

  // Takaisin-este vanhemmassa eikä modaalissa, StrictModen vuoksi (ks. KalustoKortti.tsx).
  useTakaisinEste(tunnusAuki, () => setTunnusAuki(false));

  const kentta = (avain: string, arvo: unknown) =>
    setLomake((edellinen) => ({ ...edellinen, [avain]: arvo }) as TyontekijaLomake);

  const takaisinListaan = () => {
    setNakyma('lista');
    setMuokattava(null);
    setLomake(emptyEmpForm);
    setVirhe(null);
    setTunnusAuki(false);
  };

  // Modaali näyttää TALLENNETUN työntekijän tiedot: tunnus kytketään tietueeseen ja sen
  // numeroon, joten tallentamaton nimimuutos ei saa päätyä tunnukseen.
  const tallennettu = muokattava ? tyontekijat.find((t) => t.id === muokattava.id) || muokattava : null;
  const lomakkeenTunnus = kayttajatunnusNimesta(lomake);
  const olemassaOlevaTunnus = (muokattava && kayttajat.find((k) => k.employeeId === muokattava.id))
    || kayttajat.find((k) => k.username === lomakkeenTunnus)
    || null;

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
            // Tunnistenumero annetaan KERRAN luontihetkellä eikä sitä muuteta: jo
            // tallennetut merkinnät — perehdytykset ja kaluston luovutustositteet —
            // viittaavat siihen. Numero lasketaan koko listasta, joten poistetun
            // numero ei palaa kiertoon.
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
          // Vain pääkäyttäjälle: /api/users on palvelimella pääkäyttäjärajattu.
          saaLuodaTunnuksen={isAdmin}
          // GUARDissa kirjaajana on tunnuksen oma nimimerkki eikä numeroa liitetä siihen
          // (GuardApp.tsx: author = session.nickname). Numero yksilöi henkilön muualla,
          // ja vihje kertoo missä — tapahtumapuolen sanasto olisi täällä väärin.
          tunnisteVihje={
            'Numero yksilöi henkilön perehdytysmerkinnöissä ja kaluston luovutustositteissa. '
            + 'Se annetaan kerran tallennettaessa eikä sitä muuteta jälkikäteen.'
          }
          kayttajatunnus={olemassaOlevaTunnus?.username || lomakkeenTunnus}
          olemassaOlevaTunnus={olemassaOlevaTunnus}
          onAvaaTunnus={() => setTunnusAuki(true)}
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

      {tunnusAuki && tallennettu && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center px-3 py-4 overflow-y-auto"
          onClick={() => setTunnusAuki(false)}
        >
          <div
            className="bg-surface rounded-xl shadow-xl border border-line w-full max-w-lg my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 p-5 border-b border-line-soft">
              <h3 className="font-bold text-ink-strong flex items-center gap-2">
                <KeyRound size={18} className="text-accent" />
                Käyttäjätunnus
              </h3>
              <button
                type="button"
                onClick={() => setTunnusAuki(false)}
                className="p-1.5 rounded-lg text-ink-muted hover:bg-sunken shrink-0"
                aria-label="Sulje"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <TyontekijanTunnus tyontekija={tallennettu} puoli="guard" onMuuttui={haeKayttajat} />
            </div>
          </div>
        </div>
      )}
      {tunnusAuki && !tallennettu && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-3" onClick={() => setTunnusAuki(false)}>
          <div className="bg-surface rounded-xl shadow-xl border border-line w-full max-w-sm p-5 text-sm text-ink-body">
            Tallenna työntekijä ensin. Tunnus kytketään tallennettuun työntekijään ja hänen
            tunnistenumeroonsa.
          </div>
        </div>
      )}
    </div>
  );
};
