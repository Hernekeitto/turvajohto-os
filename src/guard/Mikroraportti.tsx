// Mikroraportti (2.10.2026, käyttäjän pyyntö): kevyt kirjaus raskaiden ilmoitusten
// rinnalle. Vartija valitsee valmiista otsikoista
//
//   1. missä      — kohta tai tila (mikroraportti/luettelo.ts: PAIKKARYHMAT)
//   2. mitä       — havainto, poikkeama vai toimenpide
//   3. mikä       — tapahtuma, havainto tai toimenpide (AIHEET, rajattu luokalla)
//
// ja voi kirjoittaa selvityksen ja liittää kuvia tai tiedostoja. Valinnoista koottu
// tunnus ("Toimenpide: Ovi avattu … — Aula") on raportin yhteenveto listoissa.
//
// Tavoite on madaltaa kynnystä: siksi selvitys ei ole pakollinen, viimeksi käytetyt
// otsikot ovat ylimpänä, ja "Tallenna ja kirjaa seuraava" pitää paikan valittuna.
// Jos sopivaa otsikkoa ei löydy, haun tekstin voi käyttää sellaisenaan — huono otsikko
// on parempi kuin kirjaamatta jäänyt asia.
import { useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronRight, NotebookPen, Search, X } from 'lucide-react';

import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { Liitteet } from '../shared/komponentit/Liitteet';
import type { Liite } from '../shared/liitteet';
import { paikallinenPaiva } from '../shared/ajat';
import { lomakeRaportille } from '../shared/lomakerekisteri';
import { uusiId, type GuardRaportti, type Kohde } from './tyypit';
import {
  LUOKAT, haePaikat, haeTapahtumat, lueViimeisimmat, raportinTunnus, ryhmittele, tallennaViimeisimmat,
  viimeisimmatPaikat, viimeisimmatTapahtumat, type Luokka, type Paikka, type Tapahtuma,
} from './mikroraportti/mikro';

// Itse kirjoitetun otsikon ryhmä. Erotettavissa luettelon riveistä tilastoissa.
const OMA = 'Muu (oma otsikko)';

// HH:MM itse koottuna: fi-FI-muotoilu antaa "20.06", jota <input type="time"> ei hyväksy.
const nyt = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Haku joka osuu täsmälleen luettelon riviin ei tarvitse "käytä omana" -vaihtoehtoa.
const tasmaa = (haku: string, ...tekstit: string[]) =>
  tekstit.some((t) => t.toLocaleLowerCase('fi') === haku.toLocaleLowerCase('fi'));

type Props = {
  kohde: Kohde;
  vartija: string;
  onTallenna: (raportti: GuardRaportti) => Promise<boolean>;
  onTakaisin: () => void;
};

// Osion otsikko ja valittu arvo. Valittu osio tiivistyy yhdeksi riviksi, jotta seuraava
// valinta näkyy puhelimessa ilman vierittämistä.
const Osio = ({
  numero, otsikko, valittu, valmis = !!valittu, onVaihda, children,
}: {
  numero: number; otsikko: string; valittu?: ReactNode; valmis?: boolean; onVaihda?: () => void; children?: ReactNode;
}) => (
  <section className="border-t border-line-soft pt-4">
    <div className="flex items-center gap-2 mb-2">
      <span
        className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
          valmis ? 'bg-accent text-white' : 'bg-sunken text-ink-muted'
        }`}
      >
        {valmis ? <Check size={14} /> : numero}
      </span>
      <h3 className="text-sm font-semibold text-ink-strong">{otsikko}</h3>
    </div>
    {valittu ? (
      <div className="flex items-start gap-3 sm:pl-8">
        <div className="flex-1 min-w-0 text-sm text-ink-body">{valittu}</div>
        {onVaihda && (
          <button type="button" onClick={onVaihda} className="text-sm font-medium text-accent hover:underline shrink-0">
            Vaihda
          </button>
        )}
      </div>
    ) : (
      <div className="sm:pl-8">{children}</div>
    )}
  </section>
);

const Hakukentta = ({ arvo, onChange, placeholder }: { arvo: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="relative mb-3">
    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
    <input
      type="search"
      value={arvo}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-line-strong pl-9 pr-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent bg-surface"
    />
    {arvo && (
      <button
        type="button"
        aria-label="Tyhjennä haku"
        onClick={() => onChange('')}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-subtle hover:text-ink-body"
      >
        <X size={16} />
      </button>
    )}
  </div>
);

const Rivi = ({ onClick, children, ala }: { onClick: () => void; children: ReactNode; ala?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-sunken active:bg-line text-sm text-ink-body"
  >
    <span className="flex-1 min-w-0">
      {children}
      {ala && <span className="block text-xs text-ink-muted mt-0.5">{ala}</span>}
    </span>
    <ChevronRight size={16} className="text-ink-subtle shrink-0" />
  </button>
);

const Pikavalinnat = <T,>({
  rivit, nimi, onValitse,
}: { rivit: T[]; nimi: (r: T) => string; onValitse: (r: T) => void }) => {
  if (rivit.length === 0) return null;
  return (
    <div className="mb-3">
      <p className="text-xs font-medium text-ink-muted mb-1.5">Viimeksi käytetyt</p>
      <div className="flex flex-wrap gap-2">
        {rivit.map((r) => (
          <button
            key={nimi(r)}
            type="button"
            onClick={() => onValitse(r)}
            className="text-left text-sm px-3 py-1.5 rounded-full border border-accent/40 bg-accent-soft text-accent-ink hover:border-accent max-w-full truncate"
          >
            {nimi(r)}
          </button>
        ))}
      </div>
    </div>
  );
};

// Ryhmä joka aukeaa napautuksella. <details> eikä oma tila: avoimuus on pelkkää
// näkymää, ja natiivi elementti toimii näppäimistöllä ja ruudunlukijalla sellaisenaan.
const Ryhma = ({ otsikko, maara, children }: { otsikko: string; maara: number; children: ReactNode }) => (
  <details className="group border border-line rounded-lg mb-2 bg-surface">
    <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer list-none text-sm font-medium text-ink-strong">
      <ChevronRight size={16} className="text-ink-subtle transition-transform group-open:rotate-90 shrink-0" />
      <span className="flex-1">{otsikko}</span>
      <span className="text-xs text-ink-muted">{maara}</span>
    </summary>
    <div className="px-1 pb-2">{children}</div>
  </details>
);

export const Mikroraportti = ({ kohde, vartija, onTallenna, onTakaisin }: Props) => {
  const [paikka, setPaikka] = useState<Paikka | null>(null);
  const [luokka, setLuokka] = useState<Luokka | null>(null);
  const [tapahtuma, setTapahtuma] = useState<Tapahtuma | null>(null);
  const [paikkaHaku, setPaikkaHaku] = useState('');
  const [tapahtumaHaku, setTapahtumaHaku] = useState('');
  const [selvitys, setSelvitys] = useState('');
  const [paiva, setPaiva] = useState(paikallinenPaiva);
  const [kello, setKello] = useState(nyt);
  const [liitteet, setLiitteet] = useState<Liite[]>([]);
  const [liitteetLataa, setLiitteetLataa] = useState(false);
  const [tallentaa, setTallentaa] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);
  // Edellisen tallennuksen tunnus "Tallenna ja kirjaa seuraava" -kuittausta varten.
  const [kuittaus, setKuittaus] = useState<string | null>(null);
  // Luetaan kerran avattaessa; tallennus päivittää laitteen muistin seuraavaa kertaa varten.
  const [viimeisimmat] = useState(lueViimeisimmat);

  const paikat = useMemo(() => haePaikat(paikkaHaku), [paikkaHaku]);
  const tapahtumat = useMemo(
    () => (luokka ? haeTapahtumat(luokka, tapahtumaHaku) : []),
    [luokka, tapahtumaHaku]
  );
  const paikkaPika = useMemo(() => viimeisimmatPaikat(viimeisimmat.paikat), [viimeisimmat]);
  const tapahtumaPika = useMemo(
    () => (luokka ? viimeisimmatTapahtumat(viimeisimmat.tapahtumat, luokka) : []),
    [viimeisimmat, luokka]
  );

  const valitseLuokka = (uusi: Luokka) => {
    if (uusi !== luokka) setTapahtuma(null);
    setLuokka(uusi);
    setTapahtumaHaku('');
  };

  const omaPaikka = paikkaHaku.trim();
  const omaTapahtuma = tapahtumaHaku.trim();

  const tallenna = async (jatka: boolean) => {
    const puutteet = [!paikka && 'paikka', !luokka && 'laji (havainto, poikkeama tai toimenpide)', !tapahtuma && 'otsikko']
      .filter(Boolean);
    if (puutteet.length > 0) {
      setVirhe(`Valitse vielä: ${puutteet.join(', ')}.`);
      return;
    }
    if (liitteetLataa) {
      setVirhe('Odota, että liitteiden lähetys valmistuu.');
      return;
    }
    if (!paikka || !luokka || !tapahtuma) return;
    setVirhe(null);
    setTallentaa(true);
    const tunnus = raportinTunnus(luokka, tapahtuma.teksti, paikka.paikka);
    const lomakepohja = lomakeRaportille('guard_micro');
    const raportti: GuardRaportti = {
      id: uusiId(),
      siteId: kohde.id,
      typeId: 'guard_micro',
      type: 'Mikroraportti',
      author: vartija,
      date: paiva || paikallinenPaiva(),
      time: kello || nyt(),
      place: kohde.name,
      summary: tunnus,
      description: selvitys.trim(),
      luotu: new Date().toISOString(),
      microClass: luokka,
      microTopic: tapahtuma.aihe,
      microArea: tapahtuma.alue,
      microEvent: tapahtuma.teksti,
      microPlaceGroup: paikka.ryhma,
      microPlace: paikka.paikka,
      // Mikroraportti ei ole poikkeamakirjaus (kirjaukset.ts: POIKKEAMATYYPIT): sillä ei
      // ole käsittelytilaa, eikä sitä tarvitse sulkea. Poikkeama-luokan kirjaus näkyy
      // silti hälytyskeskuksen tapahtumavirrassa (tilannekuva.ts).
      status: null,
      severity: null,
      zoneId: null,
      assignedTo: null,
      closedAt: null,
      closedBy: null,
      attachments: liitteet,
      location: { img: null, gps: null },
      formCode: lomakepohja?.koodi ?? null,
      formVersion: lomakepohja?.pohjaVersio ?? null,
      policeDeliveredAt: null,
      policeStation: null,
      corrections: [],
    };
    const ok = await onTallenna(raportti);
    setTallentaa(false);
    if (!ok) return;
    // Omia otsikoita ei muisteta: ne eivät ole luettelossa, josta pikavalinnat haetaan.
    if (tapahtuma.aihe !== OMA) tallennaViimeisimmat(tapahtuma, paikka.ryhma === OMA ? null : paikka);
    if (!jatka) {
      onTakaisin();
      return;
    }
    // Seuraava kirjaus samassa paikassa: paikka jää, kaikki muu nollautuu.
    setKuittaus(tunnus);
    setLuokka(null);
    setTapahtuma(null);
    setTapahtumaHaku('');
    setSelvitys('');
    setLiitteet([]);
    setPaiva(paikallinenPaiva());
    setKello(nyt());
  };

  const luokanNimi = LUOKAT.find((l) => l.id === luokka)?.nimi;

  return (
    <div className="max-w-3xl">
      <TakaisinLinkki onClick={onTakaisin}>Takaisin kohteeseen</TakaisinLinkki>

      <div className="bg-surface rounded-xl shadow-sm border border-line-soft p-4 sm:p-6 md:p-8">
        <div className="flex items-start gap-3 mb-4">
          <NotebookPen className="w-6 h-6 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <h2 className="text-xl font-bold text-ink-strong">Mikroraportti</h2>
            <p className="text-sm text-ink-muted mt-1 leading-relaxed">
              Nopea kirjaus rutiineista, huomioista ja pienistä toimenpiteistä. {kohde.name}.
            </p>
          </div>
        </div>

        {kuittaus && (
          <p className="mb-4 text-sm text-accent-ink bg-accent-soft border border-accent/30 rounded-lg px-4 py-3 flex items-start gap-2">
            <Check size={16} className="shrink-0 mt-0.5" />
            <span>Tallennettu: {kuittaus}</span>
          </p>
        )}

        {virhe && (
          <p className="mb-4 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
            {virhe}
          </p>
        )}

        <div className="space-y-4">
          <Osio
            numero={1}
            otsikko="Missä?"
            valittu={paikka && (
              <>
                <span className="font-medium text-ink-strong">{paikka.paikka}</span>
                <span className="block text-xs text-ink-muted">{paikka.ryhma}</span>
              </>
            )}
            onVaihda={() => setPaikka(null)}
          >
            <Pikavalinnat rivit={paikkaPika} nimi={(p) => p.paikka} onValitse={setPaikka} />
            <Hakukentta arvo={paikkaHaku} onChange={setPaikkaHaku} placeholder="Hae kohtaa tai tilaa, esim. aula" />
            {omaPaikka ? (
              <div className="border border-line rounded-lg">
                {paikat.map((p) => (
                  <Rivi key={`${p.ryhma}|${p.paikka}`} onClick={() => setPaikka(p)} ala={p.ryhma}>{p.paikka}</Rivi>
                ))}
                {!paikat.some((p) => tasmaa(omaPaikka, p.paikka)) && (
                  <Rivi onClick={() => setPaikka({ ryhma: OMA, paikka: omaPaikka })} ala="Ei luettelossa — käytä omana">
                    ”{omaPaikka}”
                  </Rivi>
                )}
              </div>
            ) : (
              ryhmittele(paikat, (p) => p.ryhma).map(({ nimi, jasenet }) => (
                <Ryhma key={nimi} otsikko={nimi} maara={jasenet.length}>
                  {jasenet.map((p) => (
                    <Rivi key={p.paikka} onClick={() => setPaikka(p)}>{p.paikka}</Rivi>
                  ))}
                </Ryhma>
              ))
            )}
          </Osio>

          <Osio numero={2} otsikko="Mitä havaittiin tai tehtiin?" valmis={!!luokka}>
            <div className="grid grid-cols-3 gap-2">
              {LUOKAT.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={luokka === l.id}
                  onClick={() => valitseLuokka(l.id)}
                  className={`rounded-lg border px-1 py-3 text-center transition-colors min-w-0 ${
                    luokka === l.id
                      ? 'bg-accent-soft border-accent text-accent-ink'
                      : 'bg-surface border-line text-ink-body hover:bg-sunken'
                  }`}
                >
                  <span className="block text-sm font-semibold">{l.nimi}</span>
                  <span className="hidden sm:block text-xs text-ink-muted mt-0.5">{l.kuvaus}</span>
                </button>
              ))}
            </div>
          </Osio>

          {luokka && (
            <Osio
              numero={3}
              otsikko={`${luokanNimi}: mikä?`}
              valittu={tapahtuma && (
                <>
                  <span className="font-medium text-ink-strong">{tapahtuma.teksti}</span>
                  <span className="block text-xs text-ink-muted">
                    {tapahtuma.aihe === OMA ? OMA : `${tapahtuma.aihe} · ${tapahtuma.alue}`}
                  </span>
                </>
              )}
              onVaihda={() => setTapahtuma(null)}
            >
              <Pikavalinnat rivit={tapahtumaPika} nimi={(t) => t.teksti} onValitse={setTapahtuma} />
              <Hakukentta arvo={tapahtumaHaku} onChange={setTapahtumaHaku} placeholder="Hae otsikkoa, esim. ovi avattu" />
              {omaTapahtuma ? (
                <div className="border border-line rounded-lg">
                  {tapahtumat.map((t) => (
                    <Rivi key={t.teksti} onClick={() => setTapahtuma(t)} ala={t.alue}>{t.teksti}</Rivi>
                  ))}
                  {!tapahtumat.some((t) => tasmaa(omaTapahtuma, t.teksti)) && (
                    <Rivi
                      onClick={() => setTapahtuma({ luokka, aihe: OMA, alue: OMA, teksti: omaTapahtuma })}
                      ala="Ei luettelossa — käytä omana otsikkona"
                    >
                      ”{omaTapahtuma}”
                    </Rivi>
                  )}
                </div>
              ) : (
                ryhmittele(tapahtumat, (t) => t.aihe).map(({ nimi, jasenet }) => (
                  <Ryhma key={nimi} otsikko={nimi} maara={jasenet.length}>
                    {ryhmittele(jasenet, (t) => t.alue).map((alue) => (
                      <div key={alue.nimi} className="mt-1">
                        <p className="px-3 pt-2 pb-1 text-xs font-semibold text-ink-muted uppercase tracking-wide">
                          {alue.nimi}
                        </p>
                        {alue.jasenet.map((t) => (
                          <Rivi key={t.teksti} onClick={() => setTapahtuma(t)}>{t.teksti}</Rivi>
                        ))}
                      </div>
                    ))}
                  </Ryhma>
                ))
              )}
            </Osio>
          )}

          <section className="border-t border-line-soft pt-4 space-y-4">
            <label className="block">
              <span className="block text-sm font-semibold text-ink-strong mb-1">Selvitys (valinnainen)</span>
              <textarea
                value={selvitys}
                onChange={(e) => setSelvitys(e.target.value)}
                rows={3}
                placeholder={luokka === 'poikkeama'
                  ? 'Mitä tarkalleen havaitsit, ja kenelle siitä ilmoitettiin?'
                  : 'Lisätiedot tarvittaessa'}
                className="w-full rounded-lg border border-line-strong p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
              />
            </label>

            <div>
              <p className="text-sm font-semibold text-ink-strong mb-2">Kuvat ja tiedostot</p>
              <Liitteet liitteet={liitteet} onMuutos={setLiitteet} onLatausTila={setLiitteetLataa} />
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <label className="block">
                <span className="block text-xs text-ink-muted mb-1">Päivämäärä</span>
                <input
                  type="date"
                  value={paiva}
                  onChange={(e) => setPaiva(e.target.value)}
                  className="w-full rounded-lg border border-line-strong p-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                />
              </label>
              <label className="block">
                <span className="block text-xs text-ink-muted mb-1">Kellonaika</span>
                <input
                  type="time"
                  value={kello}
                  onChange={(e) => setKello(e.target.value)}
                  className="w-full rounded-lg border border-line-strong p-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                />
              </label>
            </div>
          </section>
        </div>

        {paikka && luokka && tapahtuma && (
          <p className="mt-6 text-sm text-ink-body bg-sunken rounded-lg px-4 py-3">
            <span className="block text-xs text-ink-muted mb-0.5">Raportin tunnus</span>
            {raportinTunnus(luokka, tapahtuma.teksti, paikka.paikka)}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 mt-6 border-t border-line-soft">
          <button
            type="button"
            onClick={onTakaisin}
            className="px-5 py-2.5 text-sm font-medium text-ink-body bg-sunken hover:bg-line rounded-lg transition-colors"
          >
            Peruuta
          </button>
          <button
            type="button"
            disabled={tallentaa}
            onClick={() => tallenna(true)}
            className="px-5 py-2.5 text-sm font-medium text-accent-ink bg-accent-soft border border-accent/40 hover:border-accent rounded-lg transition-colors disabled:opacity-60"
          >
            Tallenna ja kirjaa seuraava
          </button>
          <button
            type="button"
            disabled={tallentaa}
            onClick={() => tallenna(false)}
            className="px-5 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors disabled:opacity-60"
          >
            {tallentaa ? 'Tallennetaan…' : 'Tallenna'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Mikroraportin valinnat luettavana koosteena (Kohteen raportit, Kohteen tiedot).
export const MikroraportinTiedot = ({ raportti }: { raportti: GuardRaportti }) => {
  if (raportti.typeId !== 'guard_micro') return null;
  const rivit: [string, string | undefined][] = [
    ['Paikka', [raportti.microPlace, raportti.microPlaceGroup].filter(Boolean).join(' · ')],
    ['Laji', LUOKAT.find((l) => l.id === raportti.microClass)?.nimi],
    ['Otsikko', raportti.microEvent],
    ['Aihe', [raportti.microTopic, raportti.microArea].filter((x, i, a) => x && a.indexOf(x) === i).join(' · ')],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
      {rivit.filter(([, arvo]) => arvo).map(([nimi, arvo]) => (
        <div key={nimi} className="contents">
          <dt className="text-ink-muted">{nimi}</dt>
          <dd className="text-ink-body">{arvo}</dd>
        </div>
      ))}
    </dl>
  );
};
