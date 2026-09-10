// Vuoroon kirjautuminen: mobiiliversion ensimmäinen näkymä kirjautumisen jälkeen.
//
// Vartija valitsee VUORON eikä kohdetta (erä 17). Ero on koko erän tarkoitus: vuoro
// tietää tehtävänsä, joten vartijan ei tarvitse tietää mitä kohteessa pitäisi tehdä.
// Valinta ratkaisee myös mihin kohteeseen hälytykset ja tiedotteet kohdistuvat, joten se
// on kysyttävä ennen kuin mitään muuta näytetään — arvattu kohde tarkoittaisi, että
// hätäpainike hälyttää väärän kohteen numeroihin.
//
// --- Miksi estetty vuoro näkyy eikä katoa -----------------------------------------
//
// Perehdyttämätön ja väärään aikaan oleva vuoro näytetään harmaana. Piilotettu rivi
// tuottaa kysymyksen "miksi en näe tätä", johon vartija ei löydä vastausta; harmaa rivi
// vastaa siihen itse ja kertoo mitä pitää pyytää. Kaksi estettä pidetään erillään
// samasta syystä: toiseen pyydetään perehdytys, toiseen odotetaan tai soitetaan
// hälytyskeskukseen, eivätkä ne ole sama ohje.
import { Building2, ChevronRight, Clock, GraduationCap } from 'lucide-react';

import { LaiteSidonta } from '../../shared/komponentit/LaiteSidonta';
import type { Vuorokohde, VuoroVaihtoehto } from '../vuorot';

type Props = {
  kohteet: Vuorokohde[];
  ladattu: boolean;
  ilmanPerehdytysta: number;
  virhe: string | null;
  aloittaa: boolean;
  onValitse: (siteId: string, vuoro: VuoroVaihtoehto) => void;
};

const aikavali = (v: VuoroVaihtoehto) =>
  (v.alkaa && v.paattyy ? `${v.alkaa}–${v.paattyy}` : 'ei kellonaikaa');

// Mitä vuoroon kuuluu, lukuina. Tämä on se lupaus jonka takia vuoroon kirjaudutaan:
// sisältö on tiedossa ennen valintaa eikä vasta sen jälkeen.
const sisalto = (v: VuoroVaihtoehto) => {
  const osat: string[] = [];
  if (v.tehtavia > 0) osat.push(v.tehtavia === 1 ? '1 tehtävä' : `${v.tehtavia} tehtävää`);
  if (v.kierroksia > 0) osat.push(v.kierroksia === 1 ? '1 kierros' : `${v.kierroksia} kierrosta`);
  return osat.length > 0 ? osat.join(' · ') : 'ei tehtäviä eikä kierroksia';
};

export const Vuorovalinta = ({
  kohteet, ladattu, ilmanPerehdytysta, virhe, aloittaa, onValitse,
}: Props) => (
  <div>
    <h2 className="text-2xl font-bold text-ink-strong mb-1">Kirjaudu vuoroon:</h2>
    <p className="text-base text-ink-muted leading-relaxed mb-6">
      Valitse vuoro jonka olet tulossa tekemään. Vuoron tehtävät ja kierrokset tulevat
      mukana automaattisesti.
    </p>

    {virhe && (
      <div className="mb-6 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3">
        <p className="text-sm text-danger-ink">{virhe}</p>
      </div>
    )}

    {kohteet.length === 0 ? (
      <div className="rounded-xl border border-line bg-surface p-8 text-center">
        <Building2 className="w-8 h-8 text-ink-subtle mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-base text-ink-muted">
          {!ladattu
            ? 'Haetaan vuoroja…'
            : ilmanPerehdytysta > 0
              ? 'Sinua ei ole perehdytetty yhteenkään vuoroon. Ota yhteys esimieheesi.'
              : 'Sinulle ei ole merkitty yhtään vuoroa. Ota yhteys esimieheesi.'}
        </p>
      </div>
    ) : (
      <div className="space-y-6">
        {kohteet.map((kohde) => (
          <div key={kohde.siteId}>
            <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-2">
              {kohde.siteNimi}
            </h3>
            <div className="space-y-2">
              {kohde.vuorot.map((v) => {
                const auki = v.perehdytetty && v.ikkunassa;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={!auki || aloittaa}
                    onClick={() => onValitse(kohde.siteId, v)}
                    className={`w-full text-left rounded-xl border p-4 flex items-center gap-3 transition-colors ${
                      auki
                        ? 'border-line bg-surface hover:bg-sunken'
                        : 'border-line-soft bg-sunken/50 cursor-not-allowed'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`block text-xl font-bold truncate ${auki ? 'text-ink-strong' : 'text-ink-muted'}`}>
                        {v.nimi}
                      </span>
                      <span className="block text-base text-ink-muted mt-0.5 truncate">
                        {aikavali(v)} · {sisalto(v)}
                      </span>

                      {/* Este omalla rivillään ja omalla ikonillaan. Perehdytys ja kello
                          ovat eri asioita, ja niiden niputtaminen yhdeksi "ei käytössä"
                          -tekstiksi jättäisi vartijan arvaamaan kumpaa pitää korjata. */}
                      {!v.perehdytetty ? (
                        <span className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-muted">
                          <GraduationCap size={14} className="shrink-0" />
                          Ei perehdytystä tähän vuoroon
                        </span>
                      ) : !v.ikkunassa ? (
                        <span className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-muted">
                          <Clock size={14} className="shrink-0" />
                          Ei vielä auki — hälytyskeskus voi avata sen tarvittaessa
                        </span>
                      ) : null}
                    </span>
                    {auki && <ChevronRight size={20} className="text-ink-subtle shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    )}

    {/* Laitteen sidonta on kertaluonteinen käyttöönotto, ja se kuuluu tähän näkymään
        kahdesta syystä: vartijalla ei ole asetusoikeuksia, ja puhelimen käyttöönotto ja
        vuoroon kirjautuminen ovat ihmiselle sama hetki. Sidottunakin kortti jää näkyviin
        ja kertoo laitteen mallin: väärä malli on ainoa tapa huomata että sidonta on
        vanhassa puhelimessa. */}
    <LaiteSidonta />
  </div>
);
