// Avainkartta: tunnistuskuvat avainmalleista, infopallon takana.
//
// KYSYMYS JOHON TÄMÄ VASTAA on "mikä avain tämä on kädessäni". Avaimen tyyppi kirjataan
// pankkiin vapaana tekstinä, ja ilman kuvaa kirjaaja joko tietää mallin ulkoa tai
// kirjoittaa sinne jotain. Kartta tekee siitä valinnan: katso kuvaa, valitse nimi.
//
// VALINTA TÄYTTÄÄ KENTÄN eikä vain näytä kuvaa. Juuri se on ero muistiinpanon ja
// työkalun välillä — ja se on myös ainoa tapa saada pankkiin yksi kirjoitusasu per
// malli, jolloin haku "Abloy Exec" löytää ne kaikki.
//
// KARTTAA VOI TÄYDENTÄÄ käytön aikana: uusi avainmalli tulee käyttöön kesken vuoden,
// eikä sen lisääminen saa vaatia ohjelmistopäivitystä. Kuvat kulkevat tavallisina
// liitteinä kirjautumisen takana — ne ovat valmistajien tuotekuvia eivätkä meidän
// omaamme, joten ne eivät kuulu julkiseen lähdekoodiin.
import { useEffect, useRef, useState } from 'react';
import { Info, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';

import { useTakaisinEste } from '../../shared/navigointi';
import {
  haeAvaintyypit, kuvanOsoite, lahetaKuva, luoAvaintyyppi, paivitaAvaintyyppi,
  poistaAvaintyyppi, type Avaintyyppi,
} from './avaintyypit';

type Props = {
  // Pankin ylläpito-oikeus: ilman sitä kartta on pelkkä katselu. Sama oikeus kuin
  // kaluston jyvittämiseen, koska kartan rivi näkyy kaikille avaimia kirjaaville.
  saaHallita: boolean;
  // Kutsutaan kun käyttäjä valitsee tyypin. Puuttuessaan kartta on pelkkä hakuteos —
  // esimerkiksi avaimen kortilla, jossa tyyppi on jo kirjattu.
  onValitse?: (nimi: string) => void;
  // Nykyinen arvo korostetaan, jotta näkee mitä on jo valittu.
  valittuNimi?: string;
};

export const AvainkarttaNappi = ({ saaHallita, onValitse, valittuNimi }: Props) => {
  const [auki, setAuki] = useState(false);

  // Takaisin-nappi sulkee kartan eikä vaihda näkymää. Este on TÄÄLLÄ eikä modaalissa
  // itsessään: hook työntää historiamerkinnän mount-efektissä ja kuluttaa sen
  // siivouksessa, ja StrictModen mount → siivous → mount -pari sulkisi vasta avatun
  // modaalin välittömästi. Aina mountattu nappi näkee kaksoisajon lipun ollessa false.
  useTakaisinEste(auki, () => setAuki(false));

  return (
    <>
      <button
        type="button"
        onClick={() => setAuki(true)}
        aria-label="Avaa avainkartta: tunnistuskuvat avainmalleista"
        title="Tunnistuskuvat avainmalleista"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-ink-muted hover:text-accent hover:bg-sunken transition-colors align-middle"
      >
        <Info size={15} />
      </button>
      {auki && (
        <Avainkartta
          saaHallita={saaHallita}
          onValitse={onValitse}
          valittuNimi={valittuNimi}
          onSulje={() => setAuki(false)}
        />
      )}
    </>
  );
};

const TYHJA_LOMAKE = { nimi: '', kuvaus: '' };

const Avainkartta = ({ saaHallita, onValitse, valittuNimi, onSulje }: Props & { onSulje: () => void }) => {
  const [tyypit, setTyypit] = useState<Avaintyyppi[] | null>(null);
  const [haku, setHaku] = useState('');
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tyoskentelee, setTyoskentelee] = useState(false);
  const [lomakeAuki, setLomakeAuki] = useState(false);
  const [lomake, setLomake] = useState(TYHJA_LOMAKE);
  const [tiedosto, setTiedosto] = useState<File | null>(null);
  // Muokattavan tyypin id, tai null kun ollaan lisäämässä uutta.
  const [muokattava, setMuokattava] = useState<string | null>(null);
  const [poistettava, setPoistettava] = useState<string | null>(null);
  const tiedostoRef = useRef<HTMLInputElement>(null);

  const lataa = async () => setTyypit(await haeAvaintyypit());
  useEffect(() => { lataa(); }, []);

  const nakyvat = (tyypit || []).filter((t) => {
    const kysely = haku.trim().toLowerCase();
    if (!kysely) return true;
    return `${t.nimi} ${t.kuvaus}`.toLowerCase().includes(kysely);
  });

  const suljeLomake = () => {
    setLomakeAuki(false);
    setMuokattava(null);
    setLomake(TYHJA_LOMAKE);
    setTiedosto(null);
    if (tiedostoRef.current) tiedostoRef.current.value = '';
  };

  const avaaMuokkaus = (tyyppi: Avaintyyppi) => {
    setMuokattava(tyyppi.id);
    setLomake({ nimi: tyyppi.nimi, kuvaus: tyyppi.kuvaus });
    setTiedosto(null);
    setLomakeAuki(true);
  };

  const tallenna = async () => {
    setVirhe(null);
    if (!lomake.nimi.trim()) {
      setVirhe('Avaintyypille on annettava nimi.');
      return;
    }
    // Uusi tyyppi tarvitsee kuvan; muokkauksessa vanha kuva säilyy jos uutta ei valita.
    if (!muokattava && !tiedosto) {
      setVirhe('Valitse tunnistuskuva.');
      return;
    }

    setTyoskentelee(true);
    try {
      let uploadId: string | undefined;
      if (tiedosto) {
        const lahetys = await lahetaKuva(tiedosto);
        if (!lahetys.ok || !lahetys.id) {
          setVirhe(lahetys.error || 'Kuvan lähetys epäonnistui.');
          return;
        }
        uploadId = lahetys.id;
      }

      const tulos = muokattava
        ? await paivitaAvaintyyppi(muokattava, { ...lomake, uploadId })
        : await luoAvaintyyppi({ ...lomake, uploadId: uploadId as string });
      if (!tulos.ok) {
        setVirhe(tulos.error || 'Tallennus epäonnistui.');
        return;
      }
      suljeLomake();
      await lataa();
    } finally {
      setTyoskentelee(false);
    }
  };

  const poista = async (id: string) => {
    setVirhe(null);
    setTyoskentelee(true);
    try {
      const tulos = await poistaAvaintyyppi(id);
      if (!tulos.ok) setVirhe(tulos.error || 'Poisto epäonnistui.');
      else {
        setPoistettava(null);
        await lataa();
      }
    } finally {
      setTyoskentelee(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-canvas rounded-xl shadow-xl w-full max-w-4xl my-8">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-line-soft">
          <div>
            <h3 className="text-lg font-bold text-ink-strong">Avainkartta</h3>
            <p className="text-sm text-ink-muted mt-0.5">
              {onValitse
                ? 'Vertaa avainta kuvaan ja valitse malli — valinta täyttää tyyppikentän.'
                : 'Tunnistuskuvat käytössä olevista avainmalleista.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onSulje}
            aria-label="Sulje avainkartta"
            className="p-1.5 rounded-lg text-ink-muted hover:bg-sunken shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {virhe && (
            <div className="flex items-start justify-between gap-3 text-sm bg-danger-soft text-danger-ink border border-danger/30 rounded-lg px-3 py-2">
              <span>{virhe}</span>
              <button type="button" onClick={() => setVirhe(null)} aria-label="Sulje ilmoitus">
                <X size={15} />
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[12rem]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={haku}
                onChange={(e) => setHaku(e.target.value)}
                placeholder="Hae avainmallia"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
              />
            </div>
            {saaHallita && !lomakeAuki && (
              <button
                type="button"
                onClick={() => { setMuokattava(null); setLomake(TYHJA_LOMAKE); setLomakeAuki(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95"
              >
                <Plus size={15} />
                Lisää avaintyyppi
              </button>
            )}
          </div>

          {lomakeAuki && saaHallita && (
            <div className="border border-line rounded-xl p-4 space-y-3 bg-surface">
              <h4 className="font-medium text-ink-strong">
                {muokattava ? 'Muokkaa avaintyyppiä' : 'Uusi avaintyyppi'}
              </h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">Nimi</label>
                  <input
                    value={lomake.nimi}
                    onChange={(e) => setLomake((l) => ({ ...l, nimi: e.target.value }))}
                    placeholder="Abloy Exec"
                    className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                  />
                  <p className="text-xs text-ink-muted mt-1">
                    Kirjoita nimi siinä muodossa kuin se halutaan pankkiin — valinta
                    täyttää tyyppikentän juuri tällä tekstillä.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">
                    Tuntomerkki (valinnainen)
                  </label>
                  <input
                    value={lomake.kuvaus}
                    onChange={(e) => setLomake((l) => ({ ...l, kuvaus: e.target.value }))}
                    placeholder="Punainen nappi kahvassa"
                    className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                  />
                  <p className="text-xs text-ink-muted mt-1">
                    Se mistä mallin erottaa lähimmästä sukulaisestaan.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  Tunnistuskuva{muokattava ? ' (valinnainen — vanha säilyy)' : ''}
                </label>
                <input
                  ref={tiedostoRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setTiedosto(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-ink-body file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-line file:bg-sunken file:text-ink-body file:text-sm"
                />
                <p className="text-xs text-ink-muted mt-1 inline-flex items-center gap-1.5">
                  <Upload size={13} />
                  Kuva pienennetään selaimessa ennen lähetystä, joten valmistajan
                  alkuperäinen tuotekuva kelpaa sellaisenaan.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={tyoskentelee}
                  onClick={tallenna}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95 disabled:opacity-50"
                >
                  {tyoskentelee ? 'Tallennetaan…' : 'Tallenna'}
                </button>
                <button
                  type="button"
                  onClick={suljeLomake}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken"
                >
                  Peruuta
                </button>
              </div>
            </div>
          )}

          {tyypit === null ? (
            <p className="text-sm text-ink-muted">Haetaan avainkarttaa…</p>
          ) : nakyvat.length === 0 ? (
            <div className="bg-sunken border border-line-soft rounded-xl p-8 text-center">
              <p className="font-medium text-ink-strong mb-1">
                {(tyypit.length === 0) ? 'Avainkartta on tyhjä' : 'Ei osumia'}
              </p>
              <p className="text-sm text-ink-muted max-w-md mx-auto">
                {tyypit.length === 0
                  ? (saaHallita
                    ? 'Lisää käytössä olevat avainmallit kuvineen. Kartta on yhteinen kaikille avaimia kirjaaville.'
                    : 'Pääkäyttäjä ei ole vielä lisännyt avainmalleja karttaan.')
                  : 'Kokeile toista hakusanaa.'}
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {nakyvat.map((tyyppi) => {
                const valittu = valittuNimi && valittuNimi.trim().toLowerCase() === tyyppi.nimi.toLowerCase();
                return (
                  <li
                    key={tyyppi.id}
                    className={`border rounded-xl overflow-hidden bg-surface ${
                      valittu ? 'border-accent ring-2 ring-accent/30' : 'border-line-soft'
                    }`}
                  >
                    <button
                      type="button"
                      disabled={!onValitse}
                      onClick={() => { onValitse?.(tyyppi.nimi); onSulje(); }}
                      className="w-full text-left disabled:cursor-default"
                    >
                      {/* Kuva valkoisella: tuotekuvat on irrotettu vaalealle taustalle,
                          ja tumman teeman päällä läpinäkyvä avain katoaisi omaan
                          väriinsä. Kiinteä korkeus pitää ruudukon tasaisena kun kuvat
                          ovat eri muotoisia — pystyavain ja vaaka-avain samassa
                          listassa. */}
                      <span className="flex items-center justify-center bg-white h-28 p-2">
                        <img
                          src={kuvanOsoite(tyyppi.uploadId)}
                          alt={`Avainmalli ${tyyppi.nimi}`}
                          loading="lazy"
                          className="max-h-full max-w-full object-contain"
                        />
                      </span>
                      <span className="block px-3 py-2">
                        <span className="block text-sm font-medium text-ink-strong">{tyyppi.nimi}</span>
                        {tyyppi.kuvaus && (
                          <span className="block text-xs text-ink-muted mt-0.5">{tyyppi.kuvaus}</span>
                        )}
                      </span>
                    </button>
                    {saaHallita && (
                      <div className="flex items-center gap-1 px-2 pb-2">
                        <button
                          type="button"
                          onClick={() => avaaMuokkaus(tyyppi)}
                          aria-label={`Muokkaa avaintyyppiä ${tyyppi.nimi}`}
                          className="p-1.5 rounded text-ink-subtle hover:text-accent hover:bg-sunken"
                        >
                          <Pencil size={14} />
                        </button>
                        {poistettava === tyyppi.id ? (
                          <>
                            <button
                              type="button"
                              disabled={tyoskentelee}
                              onClick={() => poista(tyyppi.id)}
                              className="px-2 py-1 rounded text-xs font-medium bg-danger-soft text-danger-ink border border-danger/30 disabled:opacity-50"
                            >
                              Poista kartasta
                            </button>
                            <button
                              type="button"
                              onClick={() => setPoistettava(null)}
                              className="px-2 py-1 rounded text-xs text-ink-muted hover:bg-sunken"
                            >
                              Peruuta
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPoistettava(tyyppi.id)}
                            aria-label={`Poista avaintyyppi ${tyyppi.nimi}`}
                            className="p-1.5 rounded text-ink-subtle hover:text-danger-ink hover:bg-danger-soft"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Poisto ei kajoa jo kirjattuihin avaimiin: tyyppi on niissä tekstinä eikä
              viittauksena. Se on sanottava ääneen, koska "poista kartasta" kuulostaa
              siltä kuin se veisi tiedon avaimiltakin. */}
          {saaHallita && (tyypit?.length || 0) > 0 && (
            <p className="text-xs text-ink-muted">
              Kartasta poistaminen ei muuta jo kirjattuja avaimia — tyyppi jää niihin
              tekstinä. Kartta on tunnistusapu, ei pakotettu luettelo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
