// Anastusilmoitus (27.9.2026, käyttäjän kenttälista).
//
// Oma lomakkeensa eikä kolmas haara Raportit.tsx:ään: toimenpidekirjauksen lukumäärät ja
// voimakeinot eivät kuulu tähän, ja tämän tuotelista ja summat eivät kuulu niihin.
// Tallennus kulkee silti samaa tietä (guardReports, typeId 'guard_theft'), joten
// kirjaus saa saman tilamallin, lukituksen ja kenttäsalauksen kuin muut vartijan raportit.
//
// Tietojen sijoittelu tietueeseen (ks. tyypit.ts: GuardRaportti):
//   anastajan nimi ja hetu   subjectLastName / subjectFirstNames / subjectPersonalId
//   vartijan havainnot       description
// Nämä ovat jo salattuja kenttiä (server/store.js), joten henkilötunnus ei päädy levylle
// selväkielisenä.
//
// Korvausta vaaditaan tuotteiden ALV 0 -hinnasta (ks. anastus.ts).
import { useState, type ReactNode } from 'react';
import { CheckCircle2, Plus, Printer, ShoppingBag, Trash2 } from 'lucide-react';

import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { Liitteet } from '../shared/komponentit/Liitteet';
import type { Liite } from '../shared/liitteet';
import { paikallinenPaiva } from '../shared/ajat';
import { lomakeRaportille } from '../shared/lomakerekisteri';
import { Kentta } from './Kentta';
import {
  ALV_KANNAT, OLETUS_ALV, SELVITYSKULUT, euroina, laskeSummat, lueHinta,
  type AnastettuTuote, type MuuKulu,
} from './anastus';
import { uusiId, type GuardRaportti, type Kohde } from './tyypit';
import { tulostaAnastusilmoitus } from './anastustuloste';

// Tulostuspainikkeet: sama pari tallennuksen vahvistuksessa ja kohteen tiedoissa.
export const AnastusTulosteet = ({ raportti }: { raportti: GuardRaportti }) => (
  <div className="flex flex-wrap gap-2">
    {([['poliisi', 'Tuloste poliisille'], ['kauppias', 'Tuloste kauppiaalle']] as const).map(([v, nimi]) => (
      <button
        key={v}
        type="button"
        onClick={() => tulostaAnastusilmoitus(raportti, v)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-body bg-surface border border-line hover:bg-sunken rounded-lg transition-colors"
      >
        <Printer size={16} />
        {nimi}
      </button>
    ))}
  </div>
);

// Tallennetun anastusilmoituksen tiivistelmä kohteen tiedoissa (KohteenTiedot).
// Anastajan tiedot näkyvät siellä jo kohdehenkilö-lohkossa peitettyine hetuineen, joten
// tässä on vain se mikä on anastusilmoitukselle omaa.
export const AnastuksenYhteenveto = ({ raportti: r }: { raportti: GuardRaportti }) => {
  const s = laskeSummat(r.theftItems || [], r.theftOtherCosts || []);
  return (
    <div className="bg-sunken rounded-lg p-3 space-y-2 text-xs">
      <p className="font-medium text-ink-body">Anastusilmoitus</p>
      <p className="text-ink-muted">
        Korvauksen vaatija: {r.theftClaimant || '—'} · Rangaistusvaatimusmenettely:{' '}
        {r.theftPenaltyOrderConsent === true ? 'kyllä' : r.theftPenaltyOrderConsent === false ? 'ei' : '—'}
      </p>
      <ul className="text-ink-muted">
        {(r.theftItems || []).map((t) => (
          <li key={t.id}>{t.nimi} · {euroina(Math.round(t.hinta * 100))}</li>
        ))}
      </ul>
      <p className="text-ink-body font-medium">
        Korvausvaatimus {euroina(s.vaatimusSnt)} (tuotteet ALV 0 {euroina(s.alv0Snt)}
        {s.muutKulutSnt > 0 ? ` + muut kulut ${euroina(s.muutKulutSnt)}` : ''})
      </p>
      <AnastusTulosteet raportti={r} />
    </div>
  );
};

type Props = {
  kohde: Kohde;
  vartija: string;
  onTallenna: (raportti: GuardRaportti) => Promise<boolean>;
  onTakaisin: () => void;
};

// datetime-local-kentän arvo nykyhetkestä paikallisessa ajassa.
const nytPaikallisena = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const kellonaika = (paikallinen: string) => paikallinen.slice(11, 16);

const uusiTuote = (): AnastettuTuote & { hintaTeksti: string } => ({
  id: uusiId(), nimi: '', hinta: 0, alv: OLETUS_ALV, hintaTeksti: '',
});

export const Anastusilmoitus = ({ kohde, vartija, onTallenna, onTakaisin }: Props) => {
  const [tallentaa, setTallentaa] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [liitteet, setLiitteet] = useState<Liite[]>([]);
  const [liitteetLataa, setLiitteetLataa] = useState(false);
  // Tallennettu ilmoitus. Lomake ei sulkeudu tallennuksessa, koska tuloste tehdään
  // yleensä heti: poliisi ja kauppias odottavat paperia paikan päällä.
  const [tallennettu, setTallennettu] = useState<GuardRaportti | null>(null);

  const [yhteystiedot, setYhteystiedot] = useState(
    [kohde.name, kohde.address, kohde.contactName, kohde.contactPhone].filter(Boolean).join('\n'),
  );
  const [vaatija, setVaatija] = useState('');
  const [suostumus, setSuostumus] = useState<boolean | null>(null);
  const [anastusAika, setAnastusAika] = useState(nytPaikallisena);
  const [kassalinja, setKassalinja] = useState('');
  const [kiinniotto, setKiinniotto] = useState('');
  // Hinta pidetään myös tekstinä, jotta "12," ei muutu kesken kirjoittamisen "12":ksi.
  const [tuotteet, setTuotteet] = useState([uusiTuote()]);
  const [havainnot, setHavainnot] = useState('');
  const [sukunimi, setSukunimi] = useState('');
  const [etunimet, setEtunimet] = useState('');
  const [hetu, setHetu] = useState('');
  const [muitaKuluja, setMuitaKuluja] = useState<boolean | null>(null);
  const [kulut, setKulut] = useState<(MuuKulu & { summaTeksti: string })[]>([]);

  const summat = laskeSummat(tuotteet, muitaKuluja ? kulut : []);

  const muutaTuote = (id: string, muutos: Partial<AnastettuTuote & { hintaTeksti: string }>) =>
    setTuotteet((l) => l.map((t) => (t.id === id ? { ...t, ...muutos } : t)));
  const muutaKulu = (id: string, muutos: Partial<MuuKulu & { summaTeksti: string }>) =>
    setKulut((l) => l.map((k) => (k.id === id ? { ...k, ...muutos } : k)));

  const tallenna = async () => {
    const kirjatut = tuotteet.filter((t) => t.nimi.trim() || t.hinta > 0);
    const puutteet = [
      !vaatija.trim() && 'korvauksen vaatija',
      suostumus === null && 'suostumus rangaistusvaatimusmenettelyyn',
      !anastusAika && 'anastuksen ajankohta',
      kirjatut.length === 0 && 'vähintään yksi anastettu tuote',
      kirjatut.some((t) => !t.nimi.trim()) && 'tuotteen nimi jokaiselle riville',
      !havainnot.trim() && 'vartijan havainnot',
      muitaKuluja === null && 'tieto muista kuluista',
    ].filter(Boolean);
    if (puutteet.length > 0) {
      setVirhe(`Täytä vielä: ${puutteet.join(', ')}.`);
      return;
    }
    if (liitteetLataa) {
      setVirhe('Odota, että liitteiden lähetys valmistuu.');
      return;
    }
    setVirhe(null);
    setTallentaa(true);

    const lomakepohja = lomakeRaportille('guard_theft');
    const tuotteita = kirjatut.length === 1 ? '1 tuote' : `${kirjatut.length} tuotetta`;
    const raportti: GuardRaportti = {
      id: uusiId(),
      siteId: kohde.id,
      typeId: 'guard_theft',
      type: 'Anastusilmoitus',
      author: vartija,
      date: anastusAika.slice(0, 10) || paikallinenPaiva(),
      time: kellonaika(anastusAika),
      place: kohde.name,
      // Yhteenvedossa ei ole nimeä eikä henkilötunnusta: se näkyy listoissa ja
      // koosteissa, joissa anastajan tietoja ei tarvita.
      summary: `Anastus: ${tuotteita}, korvausvaatimus ${euroina(summat.vaatimusSnt)}`,
      description: havainnot.trim(),
      luotu: new Date().toISOString(),
      // Kiinniotto kirjataan myös lukumääränä, jotta se näkyy toimenpidetilastoissa ja
      // lukitsee kirjauksen kuten muutkin kiinniotot (kirjaukset.ts: onLukittu).
      detained: kiinniotto ? 1 : 0,
      subjectLastName: sukunimi.trim(),
      subjectFirstNames: etunimet.trim(),
      subjectPersonalId: hetu.trim(),
      theftSiteContact: yhteystiedot.trim(),
      theftClaimant: vaatija.trim(),
      theftPenaltyOrderConsent: suostumus,
      theftAt: anastusAika,
      theftCheckoutAt: kassalinja,
      theftDetainedAt: kiinniotto,
      theftItems: kirjatut.map(({ id, nimi, hinta, alv }) => ({ id, nimi: nimi.trim(), hinta, alv })),
      theftOtherCosts: muitaKuluja
        ? kulut.filter((k) => k.selite.trim() || k.summa > 0)
          .map(({ id, selite, summa }) => ({ id, selite: selite.trim(), summa }))
        : [],
      status: 'open',
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
    if (ok) setTallennettu(raportti);
  };

  if (tallennettu) {
    return (
      <div className="max-w-3xl">
        <div className="bg-surface rounded-xl shadow-sm border border-line-soft p-6 md:p-8">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle2 className="w-6 h-6 text-success-ink shrink-0 mt-0.5" strokeWidth={1.75} />
            <div>
              <h2 className="text-xl font-bold text-ink-strong">Anastusilmoitus tallennettu</h2>
              <p className="text-sm text-ink-muted mt-1 leading-relaxed">
                Korvausvaatimus {euroina(laskeSummat(tallennettu.theftItems || [], tallennettu.theftOtherCosts || []).vaatimusSnt)}.
                Tulosta kappale poliisille ja kauppiaalle. Tulosteen saa myöhemmin myös
                kohteen tiedoista.
              </p>
            </div>
          </div>
          <AnastusTulosteet raportti={tallennettu} />
          <div className="flex justify-end pt-6 mt-6 border-t border-line-soft">
            <button
              type="button"
              onClick={onTakaisin}
              className="px-5 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
            >
              Valmis
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <TakaisinLinkki onClick={onTakaisin}>Takaisin kohteeseen</TakaisinLinkki>

      <div className="bg-surface rounded-xl shadow-sm border border-line-soft p-6 md:p-8">
        <div className="flex items-start gap-3 mb-6">
          <ShoppingBag className="w-6 h-6 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <h2 className="text-xl font-bold text-ink-strong">Anastusilmoitus</h2>
            <p className="text-sm text-ink-muted mt-1 leading-relaxed">
              Anastuksen tiedot ja korvausvaatimus. Anastajan tiedot tallennetaan salattuina.
            </p>
          </div>
        </div>

        {virhe && (
          <p className="mb-6 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
            {virhe}
          </p>
        )}

        <div className="space-y-6">
          <Osio otsikko="Kohde ja korvauksen vaatija">
            <Kentta label="Kohteen yhteystiedot" arvo={yhteystiedot} onChange={setYhteystiedot} monirivinen />
            <Kentta
              label="Kuka korvausta vaatii"
              arvo={vaatija}
              onChange={setVaatija}
              placeholder="Esim. yrityksen nimi ja yhteyshenkilö"
            />
            <KyllaEi
              label="Suostuuko korvauksen vaatija rangaistusvaatimusmenettelyyn?"
              arvo={suostumus}
              onChange={setSuostumus}
            />
          </Osio>

          <Osio otsikko="Ajankohdat">
            <div className="grid gap-4 sm:grid-cols-3">
              <Kentta label="Anastus tapahtui" arvo={anastusAika} onChange={setAnastusAika} tyyppi="datetime-local" />
              <Kentta label="Kassalinja ylitettiin" arvo={kassalinja} onChange={setKassalinja} tyyppi="datetime-local" />
              <Kentta label="Kiinniotto" arvo={kiinniotto} onChange={setKiinniotto} tyyppi="datetime-local" />
            </div>
          </Osio>

          <Osio otsikko="Anastetut tuotteet" vinkki="Hinta sisältää ALV:n. Korvausta vaaditaan ALV 0 -hinnasta.">
            <div className="space-y-2">
              {tuotteet.map((t) => (
                <div key={t.id} className="grid gap-2 grid-cols-[1fr_5.5rem_5rem_auto] sm:grid-cols-[1fr_7rem_6rem_auto] items-end">
                  <label className="block">
                    <span className="block text-xs text-ink-muted mb-1">Tuotteen nimi</span>
                    <input
                      value={t.nimi}
                      onChange={(e) => muutaTuote(t.id, { nimi: e.target.value })}
                      className="w-full rounded-lg border border-line-strong p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-ink-muted mb-1">Hinta €</span>
                    <input
                      inputMode="decimal"
                      value={t.hintaTeksti}
                      onChange={(e) => muutaTuote(t.id, { hintaTeksti: e.target.value, hinta: lueHinta(e.target.value) })}
                      className="w-full rounded-lg border border-line-strong p-2.5 text-sm text-right outline-none focus:ring-2 focus:ring-accent"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-ink-muted mb-1">ALV %</span>
                    <select
                      value={t.alv}
                      onChange={(e) => muutaTuote(t.id, { alv: Number(e.target.value) })}
                      className="w-full rounded-lg border border-line-strong p-2.5 text-sm bg-surface outline-none focus:ring-2 focus:ring-accent"
                    >
                      {ALV_KANNAT.map((k) => (
                        <option key={k} value={k}>{String(k).replace('.', ',')}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    aria-label="Poista tuote"
                    disabled={tuotteet.length === 1}
                    onClick={() => setTuotteet((l) => l.filter((x) => x.id !== t.id))}
                    className="p-2.5 rounded-lg text-ink-muted hover:bg-sunken disabled:opacity-30"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setTuotteet((l) => [...l, uusiTuote()])}
              className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover"
            >
              <Plus size={16} />
              Lisää tuote
            </button>

            <dl className="mt-2 rounded-lg bg-sunken border border-line p-4 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
              <dt className="text-ink-muted">Yhteishinta (sis. ALV)</dt>
              <dd className="text-right tabular-nums">{euroina(summat.verollinenSnt)}</dd>
              <dt className="text-ink-muted">ALV</dt>
              <dd className="text-right tabular-nums">{euroina(summat.alvSnt)}</dd>
              <dt className="font-medium text-ink-strong">Yhteensä ALV 0</dt>
              <dd className="text-right tabular-nums font-medium text-ink-strong">{euroina(summat.alv0Snt)}</dd>
            </dl>
          </Osio>

          <Osio otsikko="Vartijan havainnot">
            <Kentta
              label="Havainnot tilanteesta"
              arvo={havainnot}
              onChange={setHavainnot}
              placeholder="Mitä havaitsit, missä järjestyksessä ja miten tilanne eteni"
              monirivinen
            />
          </Osio>

          <Osio otsikko="Anastajan tiedot" vinkki="Tallennetaan salattuina.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Kentta label="Sukunimi" arvo={sukunimi} onChange={setSukunimi} />
              <Kentta label="Etunimet" arvo={etunimet} onChange={setEtunimet} />
              <Kentta label="Henkilötunnus" arvo={hetu} onChange={setHetu} />
            </div>
          </Osio>

          <Osio otsikko="Muut kulut">
            <KyllaEi
              label="Vaatiiko korvauksen vaatija muita kuluja?"
              arvo={muitaKuluja}
              onChange={(v) => {
                setMuitaKuluja(v);
                // Ensimmäisellä kyllä-valinnalla valmiiksi yleisin kulu: se kirjataan
                // lähes aina, ja tyhjä lista pakottaisi kirjoittamaan sen joka kerta.
                if (v && kulut.length === 0) {
                  setKulut([{ id: uusiId(), ...SELVITYSKULUT, summaTeksti: String(SELVITYSKULUT.summa) }]);
                }
              }}
            />
            {muitaKuluja && (
              <>
                <div className="space-y-2">
                  {kulut.map((k) => (
                    <div key={k.id} className="grid gap-2 grid-cols-[1fr_7rem_auto] items-end">
                      <label className="block">
                        <span className="block text-xs text-ink-muted mb-1">Selite</span>
                        <input
                          value={k.selite}
                          onChange={(e) => muutaKulu(k.id, { selite: e.target.value })}
                          className="w-full rounded-lg border border-line-strong p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
                        />
                      </label>
                      <label className="block">
                        <span className="block text-xs text-ink-muted mb-1">Summa €</span>
                        <input
                          inputMode="decimal"
                          value={k.summaTeksti}
                          onChange={(e) => muutaKulu(k.id, { summaTeksti: e.target.value, summa: lueHinta(e.target.value) })}
                          className="w-full rounded-lg border border-line-strong p-2.5 text-sm text-right outline-none focus:ring-2 focus:ring-accent"
                        />
                      </label>
                      <button
                        type="button"
                        aria-label="Poista kulu"
                        onClick={() => setKulut((l) => l.filter((x) => x.id !== k.id))}
                        className="p-2.5 rounded-lg text-ink-muted hover:bg-sunken"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setKulut((l) => [...l, { id: uusiId(), selite: '', summa: 0, summaTeksti: '' }])}
                  className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover"
                >
                  <Plus size={16} />
                  Lisää kulu
                </button>
              </>
            )}
          </Osio>

          <dl className="rounded-lg border-2 border-accent/40 p-4 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            <dt className="text-ink-muted">Tuotteet ALV 0</dt>
            <dd className="text-right tabular-nums">{euroina(summat.alv0Snt)}</dd>
            <dt className="text-ink-muted">Muut kulut</dt>
            <dd className="text-right tabular-nums">{euroina(summat.muutKulutSnt)}</dd>
            <dt className="font-bold text-ink-strong">Korvausvaatimus yhteensä</dt>
            <dd className="text-right tabular-nums font-bold text-ink-strong">{euroina(summat.vaatimusSnt)}</dd>
          </dl>

          <div>
            <p className="text-sm font-medium text-ink-strong mb-2">Liitteet</p>
            <Liitteet liitteet={liitteet} onMuutos={setLiitteet} onLatausTila={setLiitteetLataa} />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-line-soft">
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
            onClick={tallenna}
            className="px-5 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors disabled:opacity-60"
          >
            {tallentaa ? 'Tallennetaan…' : 'Tallenna anastusilmoitus'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Osio = ({ otsikko, vinkki, children }: { otsikko: string; vinkki?: string; children: ReactNode }) => (
  <section className="space-y-3">
    <div>
      <h3 className="font-bold text-ink-strong">{otsikko}</h3>
      {vinkki && <p className="text-xs text-ink-muted mt-0.5">{vinkki}</p>}
    </div>
    {children}
  </section>
);

const KyllaEi = ({ label, arvo, onChange }: {
  label: string; arvo: boolean | null; onChange: (v: boolean) => void;
}) => (
  <fieldset>
    <legend className="block text-sm font-medium text-ink-body mb-2">{label}</legend>
    <div className="flex gap-2">
      {[{ v: true, nimi: 'Kyllä' }, { v: false, nimi: 'Ei' }].map(({ v, nimi }) => (
        <button
          key={nimi}
          type="button"
          aria-pressed={arvo === v}
          onClick={() => onChange(v)}
          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
            arvo === v
              ? 'bg-accent-soft border-accent text-accent-ink'
              : 'bg-surface border-line text-ink-body hover:bg-sunken'
          }`}
        >
          {nimi}
        </button>
      ))}
    </div>
  </fieldset>
);
