// GUARD-puolen etusivu: kumpaan työhön ollaan tulossa.
//
// Kaksi osiota, koska niitä tekee kaksi eri ihmistä: vartija menee kohteeseen ja kirjaa
// siellä, päivystäjä (HÄLKE) katsoo kaikkia kohteita eikä kirjaa mihinkään. Aiemmin
// kohdelista oli suoraan etusivu, mikä tarkoitti että päivystäjän piti etsiä
// hälytystilanne kohde kerrallaan.
//
// Painikkeissa on tilanneluvut. Ne ovat tässä tarkoituksella eivätkä vasta osion sisällä:
// etusivun tehtävä on kertoa MISSÄ pitää olla, ja lauennut hälytys on se tieto joka
// päättää sen.

import type { ReactNode } from 'react';
import {
  ArrowRight, Boxes, Building2, ClipboardList, History, Siren, Settings, Timer, Route,
  TriangleAlert, Users,
} from 'lucide-react';

type Props = {
  saaNahdaKohteet: boolean;
  saaNahdaHalytyskeskus: boolean;
  saaNahdaAsetukset: boolean;
  // Kalustopankki (erä 20). Kolmas kortti eikä kohteen sisäinen näkymä, koska pankki on
  // kohteiden YLI menevä rekisteri — samasta syystä kuin hälytyskeskus. Kohteen
  // kalustorekisteri on yhä olemassa, mutta se näyttää vain yhden kohteen osuuden.
  saaNahdaKalusto: boolean;
  // Tehtävien jako (erä 19): sama oikeus kuin hälytyskeskuksella, koska määrääjä on
  // pääkäyttäjä tai päivystäjä. Oma korttinsa eikä hälytyskeskuksen sisällä: hälytys on
  // tapahtuma johon reagoidaan, tehtävien jako on suunnittelua.
  saaJakaaTehtavia: boolean;
  // Työntekijäpankki. Sama rekisteri ja sama solmu kuin tapahtumapuolella
  // (global_employee_bank) — GUARD ei saa omaa pankkiaan vaan oman näkymänsä samaan.
  saaNahdaTyontekijat: boolean;
  // Sijaintihistoria (erä 24). Oma oikeutensa (guard_location_history) eikä
  // guard_locations: nykyisen sijainnin näkeminen ja liikehistorian katsominen ovat eri
  // asioita, ja jälkimmäisen katselupiiri on pienempi.
  saaNahdaSijaintihistorian: boolean;
  kohteita: number;
  lauenneita: number;
  ajastimia: number;
  kierroksiaKesken: number;
  kalustoa: number;
  kalustopyyntoja: number;
  kadonnuttaKalustoa: number;
  onKohteet: () => void;
  onKalusto: () => void;
  onHalytyskeskus: () => void;
  onTehtavanjako: () => void;
  onTyontekijat: () => void;
  onSijaintihistoria: () => void;
  onAsetukset: () => void;
};

export const Etusivu = ({
  saaNahdaKohteet, saaNahdaHalytyskeskus, saaNahdaAsetukset, saaJakaaTehtavia, saaNahdaKalusto,
  saaNahdaTyontekijat, saaNahdaSijaintihistorian,
  kohteita, lauenneita, ajastimia, kierroksiaKesken,
  kalustoa, kalustopyyntoja, kadonnuttaKalustoa,
  onKohteet, onKalusto, onHalytyskeskus, onTehtavanjako, onTyontekijat, onSijaintihistoria,
  onAsetukset,
}: Props) => (
  <div>
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-ink-strong mb-1">Turvajohto GUARD</h2>
      <p className="text-sm text-ink-muted leading-relaxed">
        Valitse osio. Kohteista tehdään vuoron työ, hälytyskeskuksesta katsotaan kaikkien
        kohteiden tilanne yhtä aikaa, ja kalustopankki kertoo mitä yrityksellä on ja missä.
      </p>
    </div>

    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {saaNahdaKohteet && (
        <button
          type="button"
          onClick={onKohteet}
          className="group text-left flex flex-col bg-surface hover:bg-sunken border border-line hover:border-line-strong rounded-2xl p-6 transition-colors"
        >
          <Building2 className="w-8 h-8 mb-4 text-accent" strokeWidth={1.75} />
          <h3 className="text-xl font-bold text-ink-strong mb-1">Kohteet</h3>
          <p className="text-sm text-ink-muted mb-3">Vuoron työ kohteessa</p>
          <p className="text-sm text-ink-body leading-relaxed mb-5 flex-1">
            Kierrokset, tehtävät, raportointi, kalusto ja kohteen tiedot. Kaikki kirjataan
            aina kohteelle.
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Merkki>{kohteita === 1 ? '1 kohde' : `${kohteita} kohdetta`}</Merkki>
            {kierroksiaKesken > 0 && (
              <Merkki taso="varoitus">
                <Route size={12} />
                {kierroksiaKesken} kierros kesken
              </Merkki>
            )}
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-medium text-accent">
            Avaa kohdelista
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>
      )}

      {saaNahdaHalytyskeskus && (
        <button
          type="button"
          onClick={onHalytyskeskus}
          className={`group text-left flex flex-col border rounded-2xl p-6 transition-colors ${
            lauenneita > 0
              ? 'bg-danger-soft border-danger/50 hover:brightness-95'
              : 'bg-surface border-line hover:bg-sunken hover:border-line-strong'
          }`}
        >
          <Siren
            className={`w-8 h-8 mb-4 ${lauenneita > 0 ? 'text-danger-ink' : 'text-accent'}`}
            strokeWidth={1.75}
          />
          <h3 className={`text-xl font-bold mb-1 ${lauenneita > 0 ? 'text-danger-ink' : 'text-ink-strong'}`}>
            Hälytyskeskus
          </h3>
          <p className="text-sm text-ink-muted mb-3">Päivystäjän tilannekuva</p>
          <p className="text-sm text-ink-body leading-relaxed mb-5 flex-1">
            Lauenneet hälytykset, käynnissä olevat ajastimet, kentällä olevat vartijat ja
            kaikkien kohteiden tilanne yhdellä ruudulla.
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {lauenneita > 0 ? (
              <Merkki taso="kriittinen">
                <Siren size={12} />
                {lauenneita} lauennut hälytys
              </Merkki>
            ) : (
              <Merkki>Ei lauenneita hälytyksiä</Merkki>
            )}
            {ajastimia > 0 && (
              <Merkki taso="varoitus">
                <Timer size={12} />
                {ajastimia} ajastin käynnissä
              </Merkki>
            )}
          </div>
          <span className={`inline-flex items-center gap-2 text-sm font-medium ${lauenneita > 0 ? 'text-danger-ink' : 'text-accent'}`}>
            Avaa hälytyskeskus
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>
      )}

      {saaNahdaKalusto && (
        <button
          type="button"
          onClick={onKalusto}
          className="group text-left flex flex-col bg-surface hover:bg-sunken border border-line hover:border-line-strong rounded-2xl p-6 transition-colors"
        >
          <Boxes className="w-8 h-8 mb-4 text-accent" strokeWidth={1.75} />
          <h3 className="text-xl font-bold text-ink-strong mb-1">Kalusto</h3>
          <p className="text-sm text-ink-muted mb-3">Koko yrityksen kalustopankki</p>
          <p className="text-sm text-ink-body leading-relaxed mb-5 flex-1">
            Avaimet, ajoneuvot, asusteet, voimankäyttövälineet ja tietotekniikka. Jokaisella
            esineellä on oma tunnus ja kilpimerkki, ja pankista jyvitetään tavaraa
            kohteille ja vartijoille.
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Merkki>{kalustoa === 1 ? '1 esine' : `${kalustoa} esinettä`}</Merkki>
            {kalustopyyntoja > 0 && (
              <Merkki taso="varoitus">
                <ClipboardList size={12} />
                {kalustopyyntoja === 1 ? '1 pyyntö odottaa' : `${kalustopyyntoja} pyyntöä odottaa`}
              </Merkki>
            )}
            {kadonnuttaKalustoa > 0 && (
              <Merkki taso="kriittinen">
                <TriangleAlert size={12} />
                {kadonnuttaKalustoa} kadonnut
              </Merkki>
            )}
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-medium text-accent">
            Avaa kalustopankki
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>
      )}
    </div>

    {/* Tehtävien jako (erä 19). Riviksi eikä kortiksi: kortit vastaavat kysymykseen
        "missä pitää olla nyt", ja tehtävien jako on suunnittelua johon mennään kun
        siihen on syytä — ei tilanne joka vaatii huomiota. */}
    {saaNahdaTyontekijat && (
      <button
        type="button"
        onClick={onTyontekijat}
        className="mt-6 mr-6 inline-flex items-center gap-2 text-sm font-medium text-ink-body hover:text-accent transition-colors"
      >
        <Users size={16} />
        Työntekijäpankki
      </button>
    )}

    {saaJakaaTehtavia && (
      <button
        type="button"
        onClick={onTehtavanjako}
        className="mt-6 mr-6 inline-flex items-center gap-2 text-sm font-medium text-ink-body hover:text-accent transition-colors"
      >
        <ClipboardList size={16} />
        Tehtävien jako
      </button>
    )}

    {/* Sijaintihistoria (erä 24). RIVIKSI EIKÄ KORTIKSI, ja perustelu on sama kuin
        tehtävien jaolla mutta painavampi: kortit vastaavat kysymykseen "missä pitää olla
        nyt", ja työntekijän liikehistoria ei ole koskaan se. Se on näkymä johon mennään
        kun jotain selvitetään jälkikäteen — ei tilanne joka vaatii huomiota.
        Etusivun kortti houkuttelisi avaamaan sen ohimennen. */}
    {saaNahdaSijaintihistorian && (
      <button
        type="button"
        onClick={onSijaintihistoria}
        className="mt-6 mr-6 inline-flex items-center gap-2 text-sm font-medium text-ink-body hover:text-accent transition-colors"
      >
        <History size={16} />
        Sijaintihistoria
      </button>
    )}

    {/* Sovellusasetukset myös täältä. Aiemmin ainoa reitti oli kohdelistan yläpalkki,
        eikä pelkällä päivystysoikeudella varustettu käyttäjä pääse sinne lainkaan. */}
    {saaNahdaAsetukset && (
      <button
        type="button"
        onClick={onAsetukset}
        className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-ink-body hover:text-accent transition-colors"
      >
        <Settings size={16} />
        Sovellusasetukset
      </button>
    )}
  </div>
);

const Merkki = ({
  taso = 'perus', children,
}: {
  taso?: 'kriittinen' | 'varoitus' | 'perus';
  children: ReactNode;
}) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${
      taso === 'kriittinen'
        ? 'bg-danger-soft text-danger-ink border-danger/40'
        : taso === 'varoitus'
          ? 'bg-warning-soft text-warning-ink border-warning/30'
          : 'bg-sunken text-ink-body border-line'
    }`}
  >
    {children}
  </span>
);
