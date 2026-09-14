// Kohteen kalustorekisteri: mitä tälle kohteelle on jyvitetty, ja mitä siltä puuttuu.
//
// TÄMÄ EI OLE OMA REKISTERINSÄ vaan näkymä pankkiin. Kohteen kalusto on pankin rivejä
// joiden sijoitus osoittaa tähän kohteeseen — ei kopio eikä osajoukko, jota pitäisi
// pitää synkassa. Juuri se on syy miksi kohdekohtainen avainrekisteri korvattiin: kaksi
// rekisteriä samasta esineestä on kaksi eri käsitystä siitä missä se on.
//
// PYYNTÖ EIKÄ SIIRTO — paitsi pääkäyttäjälle. Vuoroesimies tietää mitä kohteessa
// tarvitaan, mutta jyvityksen tekee pääkäyttäjä; muuten kolme esimiestä voisi vetää saman
// patukan kolmeen kohteeseen samana iltana. Pyyntö on siksi tämän näkymän tärkein
// toiminto, ja se on lukuoikeuden takana (server/index.js).
//
// Muokkausoikeudella sama lomake siirtää suoraan. Pyyntö itselle olisi jonoon jäävä rivi
// jonka pääkäyttäjä hyväksyisi seuraavassa klikkauksessa — ja historiassa se näyttäisi
// siltä kuin päätöksen olisi tehnyt joku muu.
import { useMemo, useState } from 'react';
import { Boxes, Plus, Search, X } from 'lucide-react';

import { LAJIT } from './lajit';
import { aikaleima, osuuHakuun, pyydaKalustoa, siirraKalusto, sijainti } from './pankki';
import { TILAN_SELITE, TILAN_VARI, type KalustoTietue } from './tyypit';

type Props = {
  kohde: { id: string; nimi: string };
  kalusto: KalustoTietue[];
  ladattu: boolean;
  omaTunnus: string;
  // Muokkausoikeus pankkiin. PÄÄKÄYTTÄJÄ SIIRTÄÄ SUORAAN eikä pyydä: pyyntö itselleen
  // olisi jonoon jäävä rivi jonka hän hyväksyisi seuraavassa klikkauksessa, ja se
  // näyttäisi ulospäin siltä kuin päätöksen olisi tehnyt joku muu.
  saaHallita: boolean;
  // Pääsy pankkiin (guard_assets luku). Ilman tätä näkymä on PELKKÄ LISTA: vartija näkee
  // mitä kohteessa on, muttei voi hakea pankista eikä pyytää. Hänen palvelimelta saamansa
  // aineisto on jo rajattu oman vuoronsa kohteeseen (server/kalusto.js: vuoronKalusto),
  // joten pankkihaku ei edes löytäisi mitään muuta — ja hakukenttä joka ei löydä mitään
  // on huonompi kuin ei hakukenttää.
  saaPyytaa: boolean;
  onMuuttui: () => void;
  onAvaa: (esine: KalustoTietue) => void;
};

export const KohteenKalusto = ({
  kohde, kalusto, ladattu, omaTunnus, saaHallita, saaPyytaa, onMuuttui, onAvaa,
}: Props) => {
  const [pyyntoAuki, setPyyntoAuki] = useState(false);
  const [haku, setHaku] = useState('');
  const [valittu, setValittu] = useState<KalustoTietue | null>(null);
  const [perustelu, setPerustelu] = useState('');
  const [virhe, setVirhe] = useState<string | null>(null);
  const [onnistui, setOnnistui] = useState<string | null>(null);
  const [tyoskentelee, setTyoskentelee] = useState(false);

  const omat = useMemo(() => kalusto
    .filter((e) => e.sijoitusLaji === 'kohde' && e.sijoitusId === kohde.id && e.tila !== 'poistettu')
    .sort((a, b) => a.tunnus.localeCompare(b.tunnus)),
  [kalusto, kohde.id]);

  // Omat avoimet pyynnöt: mitä tälle kohteelle on jo pyydetty. Ilman tätä listaa sama
  // esine pyydettäisiin toistamiseen, ja palvelin vastaisi virheellä jota käyttäjä ei
  // osaisi tulkita.
  const odottavat = useMemo(
    () => kalusto.filter((e) => e.pyynto?.kohdeId === kohde.id),
    [kalusto, kohde.id]
  );

  // Mitä voi pyytää: kaikki käytössä oleva joka ei ole jo täällä eikä odota päätöstä.
  const pyydettavat = useMemo(() => kalusto
    .filter((e) => e.tila === 'kaytossa' && !e.pyynto)
    .filter((e) => !(e.sijoitusLaji === 'kohde' && e.sijoitusId === kohde.id))
    // Henkilökohtaista esinettä ei voi siirtää kohteelle (server/kalusto.js), joten sitä
    // ei myöskään tarjota pyydettäväksi — pyyntö jonka hyväksyminen epäonnistuu on
    // pahempi kuin puuttuva rivi listalla.
    .filter((e) => e.lisatiedot?.henkilokohtainen !== true)
    .filter((e) => osuuHakuun(e, haku))
    .sort((a, b) => a.tunnus.localeCompare(b.tunnus))
    .slice(0, 40),
  [kalusto, kohde.id, haku]);

  const laheta = async () => {
    if (!valittu) return;
    setVirhe(null);
    setTyoskentelee(true);
    try {
      const tulos = saaHallita
        ? await siirraKalusto(valittu.id, { laji: 'kohde', id: kohde.id }, perustelu)
        : await pyydaKalustoa(valittu.id, kohde.id, perustelu);
      if (!tulos.ok) {
        setVirhe(tulos.error || (saaHallita ? 'Siirto epäonnistui.' : 'Pyyntö epäonnistui.'));
        return;
      }
      setOnnistui(saaHallita
        ? `${valittu.nimi} (${valittu.tunnus}) siirrettiin kohteelle.`
        : `${valittu.nimi} (${valittu.tunnus}) pyydettiin kohteelle. Pääkäyttäjä ratkaisee pyynnön.`);
      setValittu(null);
      setPerustelu('');
      setHaku('');
      setPyyntoAuki(false);
      onMuuttui();
    } finally {
      setTyoskentelee(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-bold text-ink-strong mb-1">Kohteen kalusto</h3>
        <p className="text-sm text-ink-muted">
          Kalustopankista tälle kohteelle jyvitetty tavara.
          {saaHallita
            ? ' Puuttuvan kaluston voi siirtää pankista suoraan.'
            : saaPyytaa
              ? ' Puuttuvasta kalustosta tehdään pyyntö, jonka pääkäyttäjä hyväksyy.'
              : ' Puuttuvasta kalustosta ilmoitetaan esimiehelle.'}
        </p>
      </div>

      {virhe && (
        <div className="text-sm bg-danger-soft text-danger-ink border border-danger/30 rounded-lg px-3 py-2">
          {virhe}
        </div>
      )}
      {onnistui && (
        <div className="flex items-start justify-between gap-3 text-sm bg-success-soft text-success-ink border border-success/30 rounded-lg px-3 py-2">
          <span>{onnistui}</span>
          <button type="button" onClick={() => setOnnistui(null)} aria-label="Sulje ilmoitus">
            <X size={15} />
          </button>
        </div>
      )}

      {odottavat.length > 0 && (
        <div className="border border-warning/30 bg-warning-soft rounded-lg p-3">
          <p className="text-sm font-bold text-warning-ink mb-2">
            {odottavat.length === 1 ? '1 pyyntö odottaa päätöstä' : `${odottavat.length} pyyntöä odottaa päätöstä`}
          </p>
          <ul className="space-y-1">
            {odottavat.map((esine) => (
              <li key={esine.id} className="text-sm text-ink-body">
                <span className="font-mono text-xs">{esine.tunnus}</span>{' '}
                {esine.nimi}
                <span className="text-ink-muted">
                  {' · '}{esine.pyynto?.pyytaja === omaTunnus ? 'sinun pyyntösi' : esine.pyynto?.pyytaja}
                  {' · '}{aikaleima(esine.pyynto?.luotu)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!ladattu ? (
        <p className="text-sm text-ink-muted">Haetaan kalustoa…</p>
      ) : omat.length === 0 ? (
        <div className="bg-sunken border border-line-soft rounded-xl p-6 text-center">
          <p className="font-medium text-ink-strong mb-1">Kohteelle ei ole jyvitetty kalustoa</p>
          <p className="text-sm text-ink-muted">
            {saaPyytaa
              ? `${saaHallita ? 'Siirrä' : 'Pyydä'} pankista se mitä kohteessa tarvitaan — avaimet, voimankäyttövälineet, avainkaappi tai tietotekniikka.`
              /* Vartijalle lista on tyhjä kahdesta syystä: kohteelle ei ole jyvitetty
                 mitään, TAI vuoro ei ole käynnissä eikä palvelin siksi palauta mitään
                 (server/kalusto.js: vuoronKalusto). Jälkimmäinen on tavallisempi ja se on
                 sanottava ääneen — muuten vartija luulee kohteen olevan tyhjä. */
              : 'Kalusto näkyy sen kohteen osalta jossa olet vuorossa. Jos vuoro ei ole käynnissä, lista on tyhjä.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {omat.map((esine) => {
            const Ikoni = LAJIT[esine.laji]?.ikoni || Boxes;
            return (
              <li key={esine.id}>
                <button
                  type="button"
                  onClick={() => onAvaa(esine)}
                  className="w-full flex items-center gap-3 text-left bg-surface border border-line-soft rounded-lg px-3 py-2.5 hover:bg-sunken transition-colors"
                >
                  <Ikoni size={18} className="text-ink-muted shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink-strong truncate">{esine.nimi}</span>
                    <span className="block text-xs text-ink-muted font-mono">
                      {esine.tunnus}
                      {esine.alalaji ? ` · ${esine.alalaji}` : ''}
                    </span>
                  </span>
                  {esine.tila !== 'kaytossa' && (
                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-bold border ${TILAN_VARI[esine.tila]}`}>
                      {TILAN_SELITE[esine.tila]}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* --- Pyyntö tai siirto pankista. Pelkällä vuoro-oikeudella tätä ei ole
             lainkaan: vartija katsoo listaa eikä kirjaa kalustoa. --- */}
      {!saaPyytaa ? null : pyyntoAuki ? (
        <div className="border border-line rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h4 className="font-medium text-ink-strong">
              {saaHallita ? 'Siirrä kalustoa pankista' : 'Pyydä kalustoa pankista'}
            </h4>
            <button
              type="button"
              onClick={() => { setPyyntoAuki(false); setValittu(null); setHaku(''); }}
              className="p-1 rounded-lg text-ink-muted hover:bg-sunken"
              aria-label="Sulje"
            >
              <X size={16} />
            </button>
          </div>

          {valittu ? (
            <div className="space-y-3">
              <div className="bg-sunken border border-line-soft rounded-lg px-3 py-2">
                <p className="font-medium text-ink-strong">{valittu.nimi}</p>
                <p className="text-xs text-ink-muted font-mono">{valittu.tunnus}</p>
                <p className="text-xs text-ink-muted mt-1">Nyt: {sijainti(valittu)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  {saaHallita ? 'Huomio (valinnainen)' : 'Mihin kalustoa tarvitaan?'}
                </label>
                <textarea
                  value={perustelu}
                  rows={2}
                  onChange={(e) => setPerustelu(e.target.value)}
                  placeholder="Yövuoron piirivartija tarvitsee kohteen avaimet."
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                />
                <p className="text-xs text-ink-muted mt-1">
                  {saaHallita
                    ? 'Huomio jää esineen historiaan siirtomerkinnän yhteyteen.'
                    : 'Perustelu on pakollinen: pääkäyttäjä ratkaisee pyynnön sen perusteella.'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={tyoskentelee}
                  onClick={laheta}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95 disabled:opacity-50"
                >
                  {saaHallita ? 'Siirrä kohteelle' : 'Lähetä pyyntö'}
                </button>
                <button
                  type="button"
                  onClick={() => setValittu(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken"
                >
                  Valitse toinen
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  value={haku}
                  onChange={(e) => setHaku(e.target.value)}
                  placeholder="Hae tunnuksella, nimellä tai tyypillä"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                />
              </div>
              {pyydettavat.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  Ei pyydettävissä olevaa kalustoa{haku ? ' tällä haulla' : ''}.
                </p>
              ) : (
                <ul className="max-h-72 overflow-y-auto space-y-1">
                  {pyydettavat.map((esine) => (
                    <li key={esine.id}>
                      <button
                        type="button"
                        onClick={() => setValittu(esine)}
                        className="w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg hover:bg-sunken"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink-strong truncate">{esine.nimi}</span>
                          <span className="block text-xs text-ink-muted font-mono">{esine.tunnus}</span>
                        </span>
                        <span className="text-xs text-ink-muted shrink-0 max-w-[8rem] truncate">
                          {sijainti(esine)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPyyntoAuki(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95"
        >
          <Plus size={15} />
          {saaHallita ? 'Siirrä kalustoa pankista' : 'Pyydä kalustoa pankista'}
        </button>
      )}
    </div>
  );
};
