// Yhden hälytystehtävän näkymä kentällä (erä 22).
//
// Kolme välilehteä, jotka vastaavat kolmea eri kysymystä samasta keikasta:
//
//   Tapahtumat — mitä on tapahtunut ja kuka on matkalla. Tämä on se näkymä jossa
//                vartija näkee onko toinen yksikkö jo kohteessa.
//   Tiedot     — mistä hälytys tuli ja mitä hälytyskeskus on nähnyt. Aloitusvälilehti,
//                koska se on ainoa jonka vartija lukee ennen kuin lähtee liikkeelle.
//   Avaimet    — miten kohteeseen pääsee sisään.
//
// TOIMINNOT EIVÄT OLE TÄLLÄ SIVULLA vaan yläpalkin kolmen pisteen valikossa (ks.
// MobiiliKehys ja GuardApp). Se on käyttäjän oma määrittely, ja sillä on hyvä peruste:
// "ota tehtävä vastaan" on näytön ainoa peruuttamaton painallus, eikä se saa olla siinä
// mihin peukalo osuu kun sivua rullataan autossa.
//
// AVAINTIEDOT AUKEAVAT VASTA VASTAANOTON JÄLKEEN. Palvelin ei lähetä kohteen tietoja
// ennen sitä (server/index.js: vartijanTehtava), joten tämä ei ole piilotus vaan tyhjä
// tila — hälytyksen näkeminen on hälytys, ei pääsy kohteen avaimiin.
import { useState, type ReactNode } from 'react';
import {
  Check, ChevronRight, Eye, Info, KeyRound, Loader2, MapPin, Phone, Siren, TriangleAlert,
} from 'lucide-react';

import {
  KOHDENNUKSEN_SELITE, LAJIN_NIMI, kellonaika, kellonaikaSek, omaYksikko,
  type Halytystehtava,
} from '../halytystehtavat';

type Valilehti = 'loki' | 'tiedot' | 'avaimet';

type Props = {
  tehtava: Halytystehtava;
  kayttaja: string;
  // Millä nimellä vastaanotto kirjautuu hälytyskeskuksen ruudulle: vuoron nimi
  // ("Piiri 301") jos vuoro on, muuten nimimerkki. Näytetään ENNEN painallusta, koska
  // se on hälytyskeskukselle se ainoa tunnus jolla yksikkö erottuu — ja vartijan on
  // hyvä huomata jos siinä lukee hänen nimimerkkinsä eikä piirinumero.
  yksikko: string;
  // Onko jokin toiminto käynnissä. Estää tuplapainallukset kaikilta napeilta kerralla:
  // kentällä painetaan uudelleen kun ruutu ei ehtinyt päivittyä.
  tyoskentelee: boolean;
  virhe: string | null;
  // null jos tunnuksella ei ole oikeutta kirjata tapahtumailmoitusta. Painike jota ei voi
  // painaa läpi on huonompi kuin puuttuva painike.
  onRaportoi: (() => void) | null;
  onMasterkoodi: () => Promise<string | null>;
  // Toiminnot painikkeina sivulla. Mobiiliversiossa TYHJÄ: siellä ne ovat yläpalkin
  // kolmen pisteen valikossa, ja kahdessa paikassa olevat samat napit olisivat kaksi eri
  // vastausta kysymykseen "mistä tämä tehdään". Työpöytäversiossa kolmen pisteen valikkoa
  // ei ole, joten siellä ne ovat tässä.
  toiminnot?: { id: string; label: string; vaara?: boolean }[];
  onToiminto?: (id: string) => void;
};

export const HalytystehtavaNakyma = ({
  tehtava, kayttaja, yksikko, tyoskentelee, virhe, onRaportoi, onMasterkoodi,
  toiminnot = [], onToiminto,
}: Props) => {
  const [valilehti, setValilehti] = useState<Valilehti>('tiedot');
  const oma = omaYksikko(tehtava, kayttaja);
  const odottaa = tehtava.tila === 'odottaa';
  const palautettu = tehtava.hyvaksynta?.tila === 'palautettu';

  return (
    <div className="-mx-4 -my-4">
      {/* --- Välilehdet --- */}
      <div className="flex bg-neutral text-white">
        <Lehti nyt={valilehti} mika="loki" onClick={setValilehti} label="Tapahtumat">
          <Siren size={22} />
        </Lehti>
        <Lehti nyt={valilehti} mika="tiedot" onClick={setValilehti} label="Hälytyksen tiedot">
          <Info size={22} />
        </Lehti>
        <Lehti nyt={valilehti} mika="avaimet" onClick={setValilehti} label="Kohteen avaimet">
          <KeyRound size={22} />
        </Lehti>
      </div>

      <div className="px-4 py-4">
        {virhe && (
          <p className="mb-4 rounded-lg bg-danger-soft border border-danger/30 px-3 py-2.5 text-sm text-danger-ink">
            {virhe}
          </p>
        )}

        {/* Poistumislupaa odottava tila. Käyttäjän sanamuoto: "alas ilmestyy pyörivä
            ympyrä joka merkitsee hälytyskeskuksen hyväksyntää". Tämä on näkymän
            tärkein yksittäinen elementti — se on ainoa asia joka kertoo vartijalle
            ettei hän saa vielä lähteä. */}
        {odottaa && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-info/30 bg-info-soft px-4 py-4">
            <Loader2 size={22} className="mt-0.5 shrink-0 animate-spin text-info-ink" />
            <div className="min-w-0">
              <p className="text-base font-bold text-info-ink">Odottaa hälytyskeskuksen hyväksyntää</p>
              <p className="mt-1 text-sm text-info-ink leading-relaxed">
                Päivystäjä käy ilmoituksen läpi. Älä poistu kohteesta ennen kuin
                poistuminen on hyväksytty.
              </p>
            </div>
          </div>
        )}

        {/* Hylätty poistuminen. Kommentti on koko hylkäyksen sisältö — palvelin ei
            hyväksy hylkäystä ilman sitä (server/halytystehtava.js). */}
        {palautettu && !odottaa && (
          <div className="mb-4 rounded-xl border border-warning/40 bg-warning-soft px-4 py-4">
            <div className="flex items-start gap-3">
              <TriangleAlert size={20} className="mt-0.5 shrink-0 text-warning-ink" />
              <div className="min-w-0">
                <p className="text-base font-bold text-warning-ink">Hälytyskeskus ei hyväksynyt poistumista</p>
                <p className="mt-1 text-base text-warning-ink leading-relaxed">
                  {tehtava.hyvaksynta?.kommentti}
                </p>
                <p className="mt-2 text-sm text-warning-ink/80">
                  Tee puuttuvat toimenpiteet ja lähetä uusi raportti.
                </p>
              </div>
            </div>
          </div>
        )}

        {toiminnot.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {toiminnot.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={tyoskentelee}
                onClick={() => onToiminto?.(t.id)}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                  t.vaara
                    ? 'border border-danger/40 bg-danger-soft text-danger-ink hover:brightness-95'
                    : 'bg-accent text-white hover:bg-accent-hover'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {!oma && !odottaa && tehtava.tila !== 'suljettu' && (
          <p className="mb-4 text-sm text-ink-muted">
            Vastaanotto kirjataan hälytyskeskukselle nimellä{' '}
            <span className="font-bold text-ink">{yksikko}</span>.
          </p>
        )}

        {valilehti === 'tiedot' && (
          // `oma && !odottaa`: raportointipainike katoaa siksi ajaksi kun poistumislupa
          // on hälytyskeskuksen käsittelyssä. Palvelin hylkää toisen raportin siinä
          // tilassa, joten näkyvä painike lupaisi toiminnon jota ei tapahdu.
          <Tiedot
            tehtava={tehtava}
            oma={Boolean(oma) && !odottaa}
            onRaportoi={onRaportoi}
            tyoskentelee={tyoskentelee}
          />
        )}
        {valilehti === 'loki' && <Loki tehtava={tehtava} />}
        {valilehti === 'avaimet' && <Avaimet tehtava={tehtava} onMasterkoodi={onMasterkoodi} />}
      </div>
    </div>
  );
};

const Lehti = ({
  nyt, mika, onClick, label, children,
}: {
  nyt: Valilehti; mika: Valilehti; onClick: (v: Valilehti) => void; label: string; children: ReactNode;
}) => (
  <button
    type="button"
    onClick={() => onClick(mika)}
    aria-label={label}
    aria-current={nyt === mika ? 'page' : undefined}
    className={`flex-1 h-12 flex items-center justify-center border-b-4 transition-colors ${
      nyt === mika ? 'border-white bg-white/10' : 'border-transparent hover:bg-white/10'
    }`}
  >
    {children}
  </button>
);

// --- Välilehti: hälytyksen tiedot ----------------------------------------------------

const Tiedot = ({
  tehtava, oma, onRaportoi, tyoskentelee,
}: {
  tehtava: Halytystehtava; oma: boolean; onRaportoi: (() => void) | null; tyoskentelee: boolean;
}) => (
  <>
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-bold text-ink">{LAJIN_NIMI[tehtava.laji]}</h2>
      <span className="text-lg text-ink-muted tabular-nums">{kellonaika(tehtava.luotu)}</span>
    </div>
    <p className="mt-0.5 text-base text-ink-body">{tehtava.siteNimi}</p>

    {tehtava.silmukka && (
      <p className="mt-4 text-base text-ink">
        <span className="text-ink-muted">Silmukka: </span>
        {tehtava.silmukka}
      </p>
    )}

    {/* Miksi tämä hälytys tuli juuri minulle. Ilman tätä piirivartija saa hälytyksen
        kohteesta jossa ei ole koskaan käynyt eikä ymmärrä miksi. */}
    {tehtava.peruste && (
      <p className="mt-2 text-sm text-ink-muted">
        {KOHDENNUKSEN_SELITE[tehtava.peruste]}
        {tehtava.peruste === 'sade' && tehtava.etaisyysKm !== null && tehtava.etaisyysKm !== undefined
          ? ` (noin ${String(tehtava.etaisyysKm).replace('.', ',')} km)`
          : ''}
      </p>
    )}

    <h3 className="mt-5 text-base font-bold text-ink">Hälytyskeskuksen havainnot:</h3>
    {tehtava.havainnot.length === 0 ? (
      <p className="mt-2 text-base text-ink-muted">Ei havaintoja.</p>
    ) : (
      <div className="mt-2 space-y-3">
        {/* Uusin ylimmäksi: esimerkkikuvien järjestys, ja oikea järjestys — tuorein
            havainto on se joka muuttaa sen mitä kohteessa kannattaa tehdä. */}
        {[...tehtava.havainnot].reverse().map((h) => (
          <p key={h.id} className="text-base text-ink leading-relaxed">
            <span className="tabular-nums text-ink-muted">{kellonaikaSek(h.ts)} </span>
            {h.teksti}
          </p>
        ))}
      </div>
    )}

    {oma && onRaportoi && (
      <button
        type="button"
        onClick={onRaportoi}
        disabled={tyoskentelee}
        className="mt-8 w-full rounded-lg border border-line-strong bg-sunken py-4 text-xl text-ink hover:bg-line-soft disabled:opacity-50 transition-colors"
      >
        Raportoi
      </button>
    )}
    {oma && !onRaportoi && (
      <p className="mt-8 text-sm text-ink-muted">
        Tunnuksellasi ei ole oikeutta kirjata tapahtumailmoitusta. Poistumisluvan pyytää
        se yksikkö jolla oikeus on.
      </p>
    )}
  </>
);

// --- Välilehti: tapahtumat -----------------------------------------------------------

const Loki = ({ tehtava }: { tehtava: Halytystehtava }) => {
  // Uusin ylimmäksi, kuten esimerkkikuvassa. Kentällä luetaan ylin rivi ja siinä on
  // se mitä juuri tapahtui.
  const rivit = [...(tehtava.loki || [])].reverse();
  return (
    <>
      {rivit.length === 0 ? (
        <p className="text-base text-ink-muted">Ei tapahtumia.</p>
      ) : (
        <div className="space-y-3">
          {rivit.map((r, i) => (
            <div key={`${r.ts}-${i}`}>
              <p className="text-base tabular-nums text-ink-muted">{kellonaikaSek(r.ts)}</p>
              <p className="text-base font-medium text-ink leading-snug">{r.teksti}</p>
            </div>
          ))}
        </div>
      )}

      {/* Kieltäytymiset erikseen lokin alla. Ne ovat lokissa rivinä, mutta päivystäjän
          lisäksi myös toisen yksikön on nähtävä yhdellä silmäyksellä ettei apua ole
          tulossa siitä suunnasta. */}
      {(tehtava.yksikot || []).some((y) => y.kieltaytyi) && (
        <div className="mt-6 border-t border-line-soft pt-4">
          <p className="text-sm font-bold text-ink-muted">Kieltäytyneet</p>
          {tehtava.yksikot.filter((y) => y.kieltaytyi).map((y) => (
            <p key={y.vartija} className="mt-1 text-sm text-ink-body">
              {y.nimi}
              {y.syy ? ` — ${y.syy}` : ''}
            </p>
          ))}
        </div>
      )}
    </>
  );
};

// --- Välilehti: avaimet --------------------------------------------------------------

const Avaimet = ({
  tehtava, onMasterkoodi,
}: {
  tehtava: Halytystehtava; onMasterkoodi: () => Promise<string | null>;
}) => {
  const [koodi, setKoodi] = useState<string | null>(null);
  const [haetaan, setHaetaan] = useState(false);
  const kohde = tehtava.kohde;

  if (!kohde) {
    return (
      <p className="text-base text-ink-muted leading-relaxed">
        Kohteen avaintiedot avautuvat kun otat tehtävän vastaan.
      </p>
    );
  }

  const nayta = async () => {
    setHaetaan(true);
    try {
      setKoodi(await onMasterkoodi());
    } finally {
      setHaetaan(false);
    }
  };

  const lisatiedot = (kohde.avaimet || []).filter((a) => a.lisatieto);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-base font-bold text-ink">Kohteen avaimet:</p>
        {kohde.avaimet.length === 0 ? (
          <p className="mt-1 text-base text-ink-muted">Ei kirjattuja avaimia.</p>
        ) : (
          <ol className="mt-2 ml-5 list-decimal space-y-1">
            {kohde.avaimet.map((a, i) => (
              <li key={`${a.numero}-${i}`} className="text-base font-bold text-ink tabular-nums">
                {a.numero}
              </li>
            ))}
          </ol>
        )}
      </div>

      {lisatiedot.length > 0 && (
        <div>
          <p className="text-base font-bold text-ink">Avainten lisätiedot:</p>
          {lisatiedot.map((a, i) => (
            <p key={`${a.numero}-${i}`} className="mt-1 text-base text-ink">
              {a.numero} {a.lisatieto}
            </p>
          ))}
        </div>
      )}

      {kohde.halytysjarjestelma && (
        <div>
          <p className="text-base font-bold text-ink">Kohteen hälytysjärjestelmä:</p>
          <p className="mt-0.5 text-base text-ink">{kohde.halytysjarjestelma}</p>
        </div>
      )}

      {kohde.avaintenSailytys && (
        <p className="text-base font-bold text-ink">{kohde.avaintenSailytys}</p>
      )}

      <div className="flex items-center gap-3">
        <p className="text-base font-bold text-ink">Master koodi:</p>
        {koodi !== null ? (
          <span className="text-lg font-bold tabular-nums text-ink">{koodi}</span>
        ) : kohde.onMasterkoodi ? (
          <button
            type="button"
            onClick={nayta}
            disabled={haetaan}
            aria-label="Näytä master-koodi"
            className="flex h-9 w-11 items-center justify-center rounded-md text-ink hover:bg-sunken disabled:opacity-50 transition-colors"
          >
            {haetaan ? <Loader2 size={20} className="animate-spin" /> : <Eye size={22} />}
          </button>
        ) : (
          <span className="text-base text-ink-muted">ei kirjattu</span>
        )}
      </div>
      {/* Katsominen jää lokiin. Sanotaan se ääneen: piilotettu valvonta on huonompi
          kuin näkyvä, ja tieto muuttaa sitä milloin koodi avataan. */}
      {kohde.onMasterkoodi && koodi === null && (
        <p className="-mt-3 text-xs text-ink-subtle">Koodin avaaminen kirjataan lokiin.</p>
      )}

      {/* Kohteen perustiedot tässä eikä omalla välilehdellään: osoite ja puhelinnumero
          ovat osa sisäänpääsyä, ja neljäs välilehti kolmen rinnalle olisi neljäs paikka
          jota etsiä. */}
      <div className="border-t border-line-soft pt-4 space-y-2">
        {kohde.address && (
          <p className="flex items-start gap-2 text-base text-ink">
            <MapPin size={18} className="mt-0.5 shrink-0 text-ink-muted" />
            {kohde.address}
          </p>
        )}
        {kohde.contactPhone && (
          <a
            href={`tel:${kohde.contactPhone.replace(/\s/g, '')}`}
            className="flex items-center gap-2 text-base text-accent hover:underline"
          >
            <Phone size={18} className="shrink-0" />
            {kohde.contactName ? `${kohde.contactName} — ` : ''}{kohde.contactPhone}
          </a>
        )}
        {kohde.notes && <p className="text-base text-ink-body leading-relaxed">{kohde.notes}</p>}
      </div>
    </div>
  );
};

// --- Listarivi kellovalikkoon --------------------------------------------------------

// Hälytystehtävän rivi kohdelistoissa. Erillään itse näkymästä, koska sitä käytetään
// myös mobiilin etusivulla — sama rivi kahdessa paikassa eri näköisenä olisi kaksi eri
// lupausta samasta työstä.
export const TehtavaRivi = ({
  tehtava, kayttaja, onClick,
}: {
  tehtava: Halytystehtava; kayttaja: string; onClick: () => void;
}) => {
  const oma = omaYksikko(tehtava, kayttaja);
  const tila = tehtava.tila === 'odottaa'
    ? 'Odottaa hyväksyntää'
    : oma?.paikalla ? 'Olet kohteessa'
      : oma?.ajoon ? 'Olet ajossa'
        : oma ? 'Vastaanotettu'
          : `${(tehtava.yksikot || []).filter((y) => !y.kieltaytyi).length || 0} yksikköä matkalla`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-left hover:bg-sunken transition-colors"
    >
      <div className="flex items-center gap-3">
        <Siren
          size={22}
          className={`shrink-0 ${tehtava.laji === 'murto' ? 'text-danger' : 'text-warning'}`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-ink">{LAJIN_NIMI[tehtava.laji]}</p>
          <p className="truncate text-sm text-ink-muted">
            {tehtava.siteNimi}
            {tehtava.silmukka ? ` — ${tehtava.silmukka}` : ''}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-body">
            {oma && <Check size={13} className="shrink-0 text-success" />}
            {tila}
          </p>
        </div>
        <span className="shrink-0 text-sm tabular-nums text-ink-muted">{kellonaika(tehtava.luotu)}</span>
        <ChevronRight size={18} className="shrink-0 text-ink-subtle" />
      </div>
    </button>
  );
};
