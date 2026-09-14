// Kalusto: avainhallinta ja varustepoikkeamat samassa näkymässä välilehdillä.
//
// Kaksi rekisteriä yhdessä näkymässä, koska ne vastaavat samaan kysymykseen eri suunnasta:
// mitä kalustoa on ja onko se käytettävissä. Oikeudet ovat silti eri solmuissa — avaimen
// luovutusmerkintä kertoo kuka pääsee sisään, ja se on eri luottamusasia kuin rikkinäisen
// taskulampun ilmoittaminen.
import { useState, type ReactNode } from 'react';
import { KeyRound, Wrench, Plus, Check, TriangleAlert, Ban, Search, Undo2 } from 'lucide-react';

import {
  AVAIMEN_TILA, POIKKEAMAN_TILA, aikaleima, avaimenToiminto,
  ilmoitaPoikkeama, kasittelePoikkeama, luoAvain,
  type Avain, type Poikkeama,
} from '../kalusto';

type Props = {
  ownerId: string;
  ownerNimi: string;
  avaimet: Avain[];
  poikkeamat: Poikkeama[];
  // Avainrekisterin muutokset ja poikkeamien sulkeminen vaativat muokkausoikeuden;
  // poikkeaman ILMOITTAMINEN riittää lukuoikeudella (ks. server/index.js).
  saaMuokataAvaimia: boolean;
  saaKasitellaPoikkeamia: boolean;
  onAvaimetMuuttui: () => void;
  onPoikkeamatMuuttui: () => void;
  // Kumpi välilehti avataan ensin. GUARD avaa avaimet, EVENT varusteet — kumpikin sen
  // mukaan kumpaa siellä käytetään useammin.
  aloitusValilehti?: 'avaimet' | 'varusteet';
  // Ensimmäisen välilehden KORVAAVA sisältö (erä 20).
  //
  // GUARD-puolella kohteen kalusto ei ole enää oma avainrekisterinsä vaan näkymä
  // kalustopankkiin (src/guard/kalusto/KohteenKalusto.tsx). EVENT-puolella avainrekisteri
  // jatkaa ennallaan: tapahtuman avaimet ovat tapahtuman mittaisia eikä niitä jyvitetä
  // yrityksen laajuisesta pankista.
  //
  // Korvaava solmu propsina eikä kaksi eri komponenttia, koska varustepoikkeamat ovat
  // molemmilla puolilla samat ja ne ovat saman näkymän toinen välilehti. Kopio tästä
  // komponentista tarkoittaisi kahta paikkaa jossa poikkeaman käsittely voi erota.
  avainNakyma?: ReactNode;
  avainOtsikko?: string;
};

const TILAN_VARI: Record<string, string> = {
  hyllyssa: 'bg-success-soft text-success-ink border-success/30',
  ulkona: 'bg-warning-soft text-warning-ink border-warning/30',
  kadonnut: 'bg-danger-soft text-danger-ink border-danger/30',
  poistettu: 'bg-sunken text-ink-muted border-line-soft',
};

export const Kalusto = ({
  ownerId, ownerNimi, avaimet, poikkeamat, saaMuokataAvaimia, saaKasitellaPoikkeamia,
  onAvaimetMuuttui, onPoikkeamatMuuttui, aloitusValilehti = 'avaimet',
  avainNakyma, avainOtsikko = 'Avaimet',
}: Props) => {
  const [valilehti, setValilehti] = useState<'avaimet' | 'varusteet'>(aloitusValilehti);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tyoskentelee, setTyoskentelee] = useState(false);
  const [avattu, setAvattu] = useState<string | null>(null);

  const [uusiTunnus, setUusiTunnus] = useState('');
  const [uusiKuvaus, setUusiKuvaus] = useState('');
  const [kentat, setKentat] = useState<Record<string, string>>({});

  const [varuste, setVaruste] = useState('');
  const [vikaKuvaus, setVikaKuvaus] = useState('');
  const [kriittinen, setKriittinen] = useState(false);
  const [kasittelyHuomiot, setKasittelyHuomiot] = useState<Record<string, string>>({});

  const omatAvaimet = avaimet.filter((a) => a.ownerId === ownerId);
  const kaytossa = omatAvaimet.filter((a) => a.tila !== 'poistettu');
  const poistetut = omatAvaimet.filter((a) => a.tila === 'poistettu');
  const omatPoikkeamat = poikkeamat.filter((p) => p.ownerId === ownerId);
  const avoimet = omatPoikkeamat.filter((p) => p.tila === 'avoin');
  const kasitellyt = omatPoikkeamat
    .filter((p) => p.tila !== 'avoin')
    .sort((a, b) => String(b.ilmoitettu).localeCompare(String(a.ilmoitettu)))
    .slice(0, 20);

  const kutsu = async (tehtava: () => Promise<{ ok: boolean; error?: string }>, jalkeen: () => void) => {
    setVirhe(null);
    setTyoskentelee(true);
    try {
      const tulos = await tehtava();
      if (tulos.ok) jalkeen();
      else setVirhe(tulos.error || 'Toiminto epäonnistui.');
    } finally {
      setTyoskentelee(false);
    }
  };

  const kentta = (id: string) => kentat[id] || '';
  const asetaKentta = (id: string, arvo: string) => setKentat((e) => ({ ...e, [id]: arvo }));

  const avainrivi = (a: Avain) => {
    const auki = avattu === a.id;
    return (
      <li key={a.id} className="bg-surface border border-line rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-ink-strong flex items-center gap-2">
              <KeyRound size={16} className="text-ink-muted" />
              {a.tunnus}
            </p>
            {a.kuvaus && <p className="text-xs text-ink-muted mt-0.5">{a.kuvaus}</p>}
            {a.tila === 'ulkona' && (
              <p className="text-sm text-ink-body mt-1">
                {a.haltija} · otettu {aikaleima(a.otettu)}
              </p>
            )}
            {a.tila === 'kadonnut' && (
              <p className="text-sm text-danger-ink mt-1">
                Kadonnut {aikaleima(a.kadonnut || null)}
                {a.haltija ? ` · viimeksi ${a.haltija}` : ''}
              </p>
            )}
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border shrink-0 ${TILAN_VARI[a.tila]}`}>
            {AVAIMEN_TILA[a.tila]}
          </span>
        </div>

        {saaMuokataAvaimia && a.tila !== 'poistettu' && (
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            {a.tila === 'hyllyssa' && (
              <>
                <input
                  type="text"
                  value={kentta(a.id)}
                  onChange={(e) => asetaKentta(a.id, e.target.value)}
                  placeholder="Kenelle luovutetaan"
                  className="flex-1 min-w-[150px] bg-sunken border border-line-soft rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={tyoskentelee}
                  onClick={() => kutsu(
                    () => avaimenToiminto(a.id, 'luovuta', { haltija: kentta(a.id) }),
                    () => { asetaKentta(a.id, ''); onAvaimetMuuttui(); }
                  )}
                  className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-xs font-bold rounded-lg px-3 py-2"
                >
                  <Check size={14} />
                  Luovuta
                </button>
              </>
            )}
            {a.tila === 'ulkona' && (
              <button
                type="button"
                disabled={tyoskentelee}
                onClick={() => kutsu(() => avaimenToiminto(a.id, 'palauta'), onAvaimetMuuttui)}
                className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-xs font-bold rounded-lg px-3 py-2"
              >
                <Undo2 size={14} />
                Palautettu
              </button>
            )}
            {a.tila === 'kadonnut' ? (
              <button
                type="button"
                disabled={tyoskentelee}
                onClick={() => kutsu(() => avaimenToiminto(a.id, 'loytyi'), onAvaimetMuuttui)}
                className="inline-flex items-center gap-1.5 border border-line-strong hover:bg-sunken text-ink-body text-xs font-medium rounded-lg px-3 py-2"
              >
                <Search size={14} />
                Löytyi
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAvattu(auki ? null : a.id)}
                className="inline-flex items-center gap-1.5 text-ink-muted hover:text-danger text-xs font-medium px-2 py-2"
              >
                <TriangleAlert size={14} />
                Kadonnut
              </button>
            )}
          </div>
        )}

        {auki && a.tila !== 'kadonnut' && (
          <div className="mt-3 pt-3 border-t border-line-soft flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={kentta(`syy-${a.id}`)}
              onChange={(e) => asetaKentta(`syy-${a.id}`, e.target.value)}
              placeholder="Mitä tapahtui? (pakollinen)"
              className="flex-1 min-w-[180px] bg-sunken border border-line-soft rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={tyoskentelee}
              onClick={() => kutsu(
                () => avaimenToiminto(a.id, 'kadonnut', { syy: kentta(`syy-${a.id}`) }),
                () => { asetaKentta(`syy-${a.id}`, ''); setAvattu(null); onAvaimetMuuttui(); }
              )}
              className="inline-flex items-center gap-1.5 bg-danger hover:opacity-90 disabled:opacity-60 text-white text-xs font-bold rounded-lg px-3 py-2"
            >
              Merkitse kadonneeksi
            </button>
            <button
              type="button"
              disabled={tyoskentelee}
              onClick={() => kutsu(
                () => avaimenToiminto(a.id, 'poista', { syy: kentta(`syy-${a.id}`) }),
                () => { setAvattu(null); onAvaimetMuuttui(); }
              )}
              className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink-strong text-xs font-medium px-2 py-2"
            >
              <Ban size={13} />
              Poista käytöstä
            </button>
          </div>
        )}

        {a.historia.length > 1 && (
          <details className="mt-3">
            <summary className="text-xs text-ink-muted cursor-pointer">Historia ({a.historia.length})</summary>
            <ul className="mt-2 space-y-1">
              {[...a.historia].reverse().map((h, i) => (
                <li key={i} className="text-xs text-ink-muted">
                  {aikaleima(h.ts)} · {h.tapahtuma}
                  {h.haltija ? ` · ${h.haltija}` : ''}
                  {h.user ? ` · kirjasi ${h.user}` : ''}
                  {h.teksti ? ` — ${h.teksti}` : ''}
                </li>
              ))}
            </ul>
          </details>
        )}
      </li>
    );
  };

  const poikkeamarivi = (p: Poikkeama) => (
    <li key={p.id} className={`rounded-xl p-4 border ${p.vakavuus === 'kriittinen' && p.tila === 'avoin' ? 'bg-danger-soft border-danger/40' : 'bg-surface border-line'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-ink-strong flex items-center gap-2">
            <Wrench size={16} className="text-ink-muted" />
            {p.varuste}
            {p.vakavuus === 'kriittinen' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger-soft text-danger-ink border border-danger/30">
                kriittinen
              </span>
            )}
          </p>
          <p className="text-sm text-ink-body mt-1">{p.kuvaus}</p>
          <p className="text-xs text-ink-muted mt-0.5">
            {p.ilmoittaja} · {aikaleima(p.ilmoitettu)}
            {p.halytysId ? ' · hälytys tehty' : ''}
          </p>
          {p.tila !== 'avoin' && (
            <p className="text-xs text-ink-muted mt-0.5">
              {POIKKEAMAN_TILA[p.tila]} {aikaleima(p.kasitelty)} · {p.kasittelija}
              {p.kasittelyHuomio ? ` — ${p.kasittelyHuomio}` : ''}
            </p>
          )}
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border shrink-0 ${p.tila === 'avoin' ? 'bg-warning-soft text-warning-ink border-warning/30' : 'bg-sunken text-ink-muted border-line-soft'}`}>
          {POIKKEAMAN_TILA[p.tila]}
        </span>
      </div>

      {p.tila === 'avoin' && saaKasitellaPoikkeamia && (
        <div className="mt-3 pt-3 border-t border-line-soft flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={kasittelyHuomiot[p.id] || ''}
            onChange={(e) => setKasittelyHuomiot((edelliset) => ({ ...edelliset, [p.id]: e.target.value }))}
            placeholder="Mitä tehtiin? (valinnainen)"
            className="flex-1 min-w-[160px] bg-sunken border border-line-soft rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={tyoskentelee}
            onClick={() => kutsu(
              () => kasittelePoikkeama(p.id, { tila: 'korjattu', huomio: kasittelyHuomiot[p.id] }),
              onPoikkeamatMuuttui
            )}
            className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-xs font-bold rounded-lg px-3 py-2"
          >
            <Check size={14} />
            Korjattu
          </button>
          <button
            type="button"
            disabled={tyoskentelee}
            onClick={() => kutsu(
              () => kasittelePoikkeama(p.id, { tila: 'poistettu', huomio: kasittelyHuomiot[p.id] }),
              onPoikkeamatMuuttui
            )}
            className="inline-flex items-center gap-1.5 border border-line-strong hover:bg-sunken text-ink-body text-xs font-medium rounded-lg px-3 py-2"
          >
            <Ban size={14} />
            Poistettu käytöstä
          </button>
        </div>
      )}
    </li>
  );

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setValilehti('avaimet')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${valilehti === 'avaimet' ? 'bg-accent text-white' : 'bg-surface border border-line-soft text-ink-body hover:bg-sunken'}`}
        >
          {avainOtsikko}
          {!avainNakyma && kaytossa.some((a) => a.tila === 'kadonnut') && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger-soft text-danger-ink border border-danger/30">
              kadonnut
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setValilehti('varusteet')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${valilehti === 'varusteet' ? 'bg-accent text-white' : 'bg-surface border border-line-soft text-ink-body hover:bg-sunken'}`}
        >
          Varustepoikkeamat
          {avoimet.length > 0 && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-warning-soft text-warning-ink border border-warning/30">
              {avoimet.length}
            </span>
          )}
        </button>
      </div>

      <p className="text-sm text-ink-muted mb-4">{ownerNimi}</p>

      {virhe && (
        <p className="mb-4 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">{virhe}</p>
      )}

      {valilehti === 'avaimet' && avainNakyma ? (
        avainNakyma
      ) : valilehti === 'avaimet' ? (
        <div>
          {saaMuokataAvaimia && (
            <div className="bg-surface border border-line rounded-xl p-4 mb-4">
              <h4 className="font-bold text-ink-strong mb-3">Lisää avain</h4>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={uusiTunnus}
                  onChange={(e) => setUusiTunnus(e.target.value)}
                  placeholder="Tunnus, esim. A-12 pääovi"
                  className="flex-1 min-w-[160px] bg-sunken border border-line-soft rounded-lg px-3 py-2.5 text-sm"
                />
                <input
                  type="text"
                  value={uusiKuvaus}
                  onChange={(e) => setUusiKuvaus(e.target.value)}
                  placeholder="Kuvaus (valinnainen)"
                  className="flex-1 min-w-[160px] bg-sunken border border-line-soft rounded-lg px-3 py-2.5 text-sm"
                />
                <button
                  type="button"
                  disabled={tyoskentelee}
                  onClick={() => kutsu(
                    () => luoAvain({ ownerId, tunnus: uusiTunnus, kuvaus: uusiKuvaus }),
                    () => { setUusiTunnus(''); setUusiKuvaus(''); onAvaimetMuuttui(); }
                  )}
                  className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-bold rounded-lg px-4 py-2.5"
                >
                  <Plus size={16} />
                  Lisää
                </button>
              </div>
            </div>
          )}

          {kaytossa.length === 0 ? (
            <p className="text-sm text-ink-muted bg-sunken border border-line-soft rounded-lg p-4">
              Avainrekisterissä ei ole avaimia.
            </p>
          ) : (
            <ul className="space-y-3">{kaytossa.map(avainrivi)}</ul>
          )}

          {poistetut.length > 0 && (
            <p className="text-xs text-ink-subtle mt-4">
              Käytöstä poistettuja: {poistetut.length}. Ne säilyvät historiansa takia.
            </p>
          )}
        </div>
      ) : (
        <div>
          <div className="bg-surface border border-line rounded-xl p-4 mb-4">
            <h4 className="font-bold text-ink-strong mb-1">Ilmoita poikkeama</h4>
            <p className="text-xs text-ink-muted mb-3">
              Kriittinen tarkoittaa, että puute estää turvallisen työskentelyn juuri nyt. Silloin
              siitä tehdään hälytys, joka lähtee myös tekstiviestinä jos sitä ei kuitata.
            </p>
            <div className="space-y-2">
              <input
                type="text"
                value={varuste}
                onChange={(e) => setVaruste(e.target.value)}
                placeholder="Mikä varuste, esim. Radiopuhelin 3"
                className="w-full bg-sunken border border-line-soft rounded-lg px-3 py-2.5 text-sm"
              />
              <input
                type="text"
                value={vikaKuvaus}
                onChange={(e) => setVikaKuvaus(e.target.value)}
                placeholder="Mikä on vialla"
                className="w-full bg-sunken border border-line-soft rounded-lg px-3 py-2.5 text-sm"
              />
              <div className="flex flex-wrap gap-3 items-center">
                <label className="inline-flex items-center gap-2 text-sm text-ink-body">
                  <input type="checkbox" checked={kriittinen} onChange={(e) => setKriittinen(e.target.checked)} />
                  Kriittinen
                </label>
                <button
                  type="button"
                  disabled={tyoskentelee}
                  onClick={() => kutsu(
                    () => ilmoitaPoikkeama({
                      ownerId, varuste, kuvaus: vikaKuvaus, vakavuus: kriittinen ? 'kriittinen' : 'normaali',
                    }),
                    () => { setVaruste(''); setVikaKuvaus(''); setKriittinen(false); onPoikkeamatMuuttui(); }
                  )}
                  className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-bold rounded-lg px-4 py-2.5"
                >
                  <Wrench size={16} />
                  Ilmoita
                </button>
              </div>
            </div>
          </div>

          {avoimet.length === 0 ? (
            <p className="text-sm text-ink-muted bg-sunken border border-line-soft rounded-lg p-4">
              Ei avoimia varustepoikkeamia.
            </p>
          ) : (
            <ul className="space-y-3">{avoimet.map(poikkeamarivi)}</ul>
          )}

          {kasitellyt.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-bold text-ink-strong mb-2">Käsitellyt</h4>
              <ul className="space-y-3">{kasitellyt.map(poikkeamarivi)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
