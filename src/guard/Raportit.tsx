import { useState } from 'react';
import { FileText, ShieldAlert } from 'lucide-react';
import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { Kentta } from './Kentta';
import { paikallinenPaiva } from '../shared/ajat';
import { lomakeRaportille } from '../shared/lomakerekisteri';
import { uusiId, type Kohde, type GuardRaportti, type RaporttiTyyppi } from './tyypit';

// Vartijan raportit. Kaksi lomaketta, jotka vastaavat tapahtumapuolen omia:
//
//   'guard_action'   — Vartijan toimenpide. Päivittäinen kirjaus: montako pääsyn estoa,
//                      poistamista ja kiinniottoa, ja käytettiinkö voimakeinoja.
//   'guard_jvreport' — Vartijan tapahtumailmoitus. Sisältää LYTP:n nojalla kirjattavat
//                      kohdehenkilötiedot, ja on siksi erillisen oikeuden takana
//                      (guard_report_jv) — se voi hyvin perustein olla eri joukolla
//                      ihmisiä kuin päivittäinen toimenpidekirjaus.
//
// Kentät ovat tarkoituksella samat kuin EVENT-puolen vastaavissa raporteissa: sama laki
// koskee molempia, ja palvelimen kenttäsalaus (store.js: ENCRYPTED_FIELDS.guardReports)
// on identtinen reportsin kanssa juuri siksi.

const OTSIKOT: Record<RaporttiTyyppi, { otsikko: string; kuvaus: string; Ikoni: typeof FileText }> = {
  guard_action: {
    otsikko: 'Vartijan toimenpide',
    kuvaus: 'Kirjaus vartijan tekemistä toimenpiteistä vuoron aikana.',
    Ikoni: FileText,
  },
  guard_jvreport: {
    otsikko: 'Vartijan tapahtumailmoitus',
    kuvaus:
      'Ilmoitus toimenpiteestä joka kohdistui henkilöön. Kohdehenkilön tiedot kirjataan '
      + 'lain nojalla, ja ne säilytetään salattuina.',
    Ikoni: ShieldAlert,
  },
};

// Toimenpiteiden lukumääräkentät. Yhdessä listassa, koska ne käyttäytyvät identtisesti ja
// erillisinä ne olisivat kolme lähes samaa lohkoa peräkkäin.
const MAARAT = [
  { avain: 'denied' as const, label: 'Pääsy estetty' },
  { avain: 'removed' as const, label: 'Poistettu alueelta' },
  { avain: 'detained' as const, label: 'Kiinniotettu' },
];

const VOIMAKEINOT = [
  { avain: 'force' as const, label: 'Voimakeinoja käytettiin' },
  { avain: 'tools' as const, label: 'Voimankäyttövälineitä käytettiin' },
  { avain: 'firearm' as const, label: 'Ampuma-asetta käytettiin' },
  { avain: 'firstAid' as const, label: 'Ensiapua annettiin' },
];

type Props = {
  kohde: Kohde;
  tyyppi: RaporttiTyyppi;
  vartija: string;
  onTallenna: (raportti: GuardRaportti) => Promise<boolean>;
  onTakaisin: () => void;
};

const nyt = () => new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });

export const Raportit = ({ kohde, tyyppi, vartija, onTallenna, onTakaisin }: Props) => {
  const { otsikko, kuvaus, Ikoni } = OTSIKOT[tyyppi];
  const [tallentaa, setTallentaa] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [lomake, setLomake] = useState<GuardRaportti>({
    id: '',
    siteId: kohde.id,
    typeId: tyyppi,
    type: otsikko,
    author: vartija,
    date: paikallinenPaiva(),
    time: nyt(),
    place: kohde.name,
    summary: '',
    description: '',
    denied: 0,
    removed: 0,
    detained: 0,
    force: false,
    tools: false,
    firearm: false,
    firstAid: false,
  });

  const aseta = (muutos: Partial<GuardRaportti>) => setLomake((p) => ({ ...p, ...muutos }));

  // Yhteenveto kootaan kirjatuista toimenpiteistä jos vartija ei kirjoita omaansa: se
  // näkyy koosteessa ja listoissa, ja tyhjä rivi siellä olisi hyödytön.
  const koottuYhteenveto = () => {
    if (lomake.summary?.trim()) return lomake.summary.trim();
    const osat: string[] = [];
    for (const { avain, label } of MAARAT) {
      const arvo = Number(lomake[avain] || 0);
      if (arvo > 0) osat.push(`${label.toLowerCase()} ${arvo}`);
    }
    for (const { avain, label } of VOIMAKEINOT) {
      if (lomake[avain]) osat.push(label.toLowerCase());
    }
    if (tyyppi === 'guard_jvreport' && lomake.subjectLastName?.trim()) {
      osat.push('kohdehenkilö kirjattu');
    }
    return osat.length > 0 ? osat.join(', ') : 'ei toimenpiteitä kirjattu';
  };

  const tallenna = async () => {
    if (!lomake.description?.trim()) {
      setVirhe('Kirjoita tapahtuman kuvaus ennen tallennusta.');
      return;
    }
    setVirhe(null);
    setTallentaa(true);
    // Erän 1 kentät myös vartijan raportteihin: molemmat GUARD-tyypit ovat
    // poikkeamakirjauksia, joten ne saavat tilan heti. Lomaketunnus luetaan
    // rekisteristä samalla tavalla kuin EVENT-puolella.
    const lomakepohja = lomakeRaportille(tyyppi);
    const raportti: GuardRaportti = {
      ...lomake,
      id: uusiId(),
      summary: koottuYhteenveto(),
      luotu: new Date().toISOString(),
      status: 'open',
      severity: null,
      zoneId: null,
      assignedTo: null,
      closedAt: null,
      closedBy: null,
      attachments: [],
      location: { img: null, gps: null },
      formCode: lomakepohja?.koodi ?? null,
      formVersion: lomakepohja?.pohjaVersio ?? null,
      policeDeliveredAt: null,
      policeStation: null,
      corrections: [],
    };
    const ok = await onTallenna(raportti);
    setTallentaa(false);
    if (ok) onTakaisin();
  };

  return (
    <div className="max-w-3xl">
      <TakaisinLinkki onClick={onTakaisin}>Takaisin kohdelistaan</TakaisinLinkki>

      <div className="bg-surface rounded-xl shadow-sm border border-line-soft p-6 md:p-8">
        <div className="flex items-start gap-3 mb-6">
          <Ikoni className="w-6 h-6 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <h2 className="text-xl font-bold text-ink-strong">{otsikko}</h2>
            <p className="text-sm text-ink-muted mt-1 leading-relaxed">{kuvaus}</p>
          </div>
        </div>

        {virhe && (
          <p className="mb-6 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
            {virhe}
          </p>
        )}

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Kentta label="Kirjaaja" arvo={lomake.author} onChange={(v) => aseta({ author: v })} />
            <Kentta label="Kohde" arvo={lomake.place || ''} onChange={(v) => aseta({ place: v })} />
            <Kentta label="Päivämäärä" arvo={lomake.date} onChange={(v) => aseta({ date: v })} tyyppi="date" />
            <Kentta label="Kellonaika" arvo={lomake.time} onChange={(v) => aseta({ time: v })} tyyppi="time" />
          </div>

          {tyyppi === 'guard_jvreport' && (
            <Kentta
              label="Turvallisuusalan elinkeinoluvan haltija"
              arvo={lomake.licenseHolder || ''}
              onChange={(v) => aseta({ licenseHolder: v })}
            />
          )}

          <div>
            <span className="block text-sm font-medium text-ink-body mb-2">Toimenpiteet</span>
            <div className="grid gap-3 sm:grid-cols-3">
              {MAARAT.map(({ avain, label }) => (
                <label key={avain} className="block">
                  <span className="block text-xs text-ink-muted mb-1">{label}</span>
                  <input
                    type="number"
                    min={0}
                    value={String(lomake[avain] ?? 0)}
                    onChange={(e) => aseta({ [avain]: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full rounded-lg border border-line-strong p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-ink-body mb-2">Voimakeinot ja ensiapu</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {VOIMAKEINOT.map(({ avain, label }) => (
                <label
                  key={avain}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                    lomake[avain]
                      ? 'bg-accent-soft border-accent text-accent-ink'
                      : 'bg-surface border-line text-ink-body hover:bg-sunken'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!lomake[avain]}
                    onChange={(e) => aseta({ [avain]: e.target.checked })}
                    className="w-4 h-4 text-accent rounded border-line-strong focus:ring-accent"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {tyyppi === 'guard_jvreport' && (
            <div className="bg-sunken border border-line rounded-lg p-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-ink-body">Kohdehenkilön tiedot</p>
                <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                  Täytetään vain jos toimenpide kohdistui henkilöön. Tiedot tallennetaan
                  salattuina ja niitä koskee lakisääteinen säilytysaika.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Kentta
                  label="Sukunimi"
                  arvo={lomake.subjectLastName || ''}
                  onChange={(v) => aseta({ subjectLastName: v })}
                />
                <Kentta
                  label="Etunimet"
                  arvo={lomake.subjectFirstNames || ''}
                  onChange={(v) => aseta({ subjectFirstNames: v })}
                />
                <Kentta
                  label="Henkilötunnus"
                  arvo={lomake.subjectPersonalId || ''}
                  onChange={(v) => aseta({ subjectPersonalId: v })}
                />
                <Kentta
                  label="Osoite"
                  arvo={lomake.subjectAddress || ''}
                  onChange={(v) => aseta({ subjectAddress: v })}
                />
              </div>
              <Kentta
                label="Tuntomerkit"
                arvo={lomake.subjectFeatures || ''}
                onChange={(v) => aseta({ subjectFeatures: v })}
                placeholder="Jos henkilöä ei tunnistettu"
                monirivinen
              />
              <Kentta
                label="Havainnot henkilöstä"
                arvo={lomake.subjectObservations || ''}
                onChange={(v) => aseta({ subjectObservations: v })}
                placeholder="Käyttäytyminen, päihtymystila, muut havainnot"
                monirivinen
              />
            </div>
          )}

          <Kentta
            label="Tapahtuman kuvaus"
            arvo={lomake.description || ''}
            onChange={(v) => aseta({ description: v })}
            placeholder="Mitä tapahtui, missä järjestyksessä ja mihin toimenpiteisiin ryhdyttiin"
            monirivinen
          />

          <Kentta
            label="Yhteenveto (valinnainen)"
            arvo={lomake.summary || ''}
            onChange={(v) => aseta({ summary: v })}
            placeholder="Jätä tyhjäksi, niin yhteenveto kootaan kirjatuista toimenpiteistä"
            vinkki="Näkyy kohteen tiedoissa ja raporttilistoissa."
          />
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
            {tallentaa ? 'Tallennetaan…' : 'Tallenna raportti'}
          </button>
        </div>
      </div>
    </div>
  );
};
