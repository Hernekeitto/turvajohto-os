// Vuoroon kirjautuminen: mobiiliversion ensimmäinen näkymä kirjautumisen jälkeen.
//
// Vartija valitsee VUORON eikä kohdetta (erä 17). Ero on koko erän tarkoitus: vuoro
// tietää tehtävänsä, joten vartijan ei tarvitse tietää mitä kohteessa pitäisi tehdä.
// Valinta ratkaisee myös mihin kohteeseen hälytykset ja tiedotteet kohdistuvat, joten se
// on kysyttävä ennen kuin mitään muuta näytetään — arvattu kohde tarkoittaisi, että
// hätäpainike hälyttää väärän kohteen numeroihin.
//
// --- Kaksi askelta, ei yksi pitkä lista (käyttäjän päätös 18.9.2026) ----------------
//
// Ensin valitaan KOHDE, sitten seuraavassa valikossa VUORO. Vartija joka tekee vuoroja
// useassa kohteessa selasi aiemmin läpi jokaisen kohteen jokaisen vuoron löytääkseen
// omansa; kaksivaiheinen valinta pitää kummankin listan lyhyenä ja kysyy vain sen
// tiedon joka juuri sillä hetkellä tarvitaan.
//
// --- Miksi estetty vuoro näkyy eikä katoa -----------------------------------------
//
// Perehdyttämätön ja väärään aikaan oleva vuoro näytetään harmaana. Piilotettu rivi
// tuottaa kysymyksen "miksi en näe tätä", johon vartija ei löydä vastausta; harmaa rivi
// vastaa siihen itse ja kertoo mitä pitää pyytää. Kaksi estettä pidetään erillään
// samasta syystä: toiseen pyydetään perehdytys, toiseen odotetaan tai soitetaan
// hälytyskeskukseen, eivätkä ne ole sama ohje.
import { useState } from 'react';
import { ArrowLeft, Building2, ChevronRight, Clock, GraduationCap } from 'lucide-react';

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

// Kohderivin lyhyt yhteenveto ensimmäisessä vaiheessa. Esteiden tarkka syy (perehdytys
// vai kello) jää seuraavan vaiheen omalle vuororiville — kohdevalinta vastaa vain
// kysymykseen "onko täällä jotain minulle nyt", ei jokaisen vuoron omaa tilaa.
const kohteenTila = (kohde: Vuorokohde) => {
  const auki = kohde.vuorot.filter((v) => v.perehdytetty && v.ikkunassa).length;
  const vuoroja = kohde.vuorot.length === 1 ? '1 vuoro' : `${kohde.vuorot.length} vuoroa`;
  return auki > 0 ? `${vuoroja} · ${auki} auki nyt` : vuoroja;
};

export const Vuorovalinta = ({
  kohteet, ladattu, ilmanPerehdytysta, virhe, aloittaa, onValitse,
}: Props) => {
  const [valittuId, setValittuId] = useState<string | null>(null);
  // Haetaan tuoreesta `kohteet`-listasta id:llä eikä pidetä koko oliota tilassa: jos
  // vuorot päivittyvät kesken valinnan (esim. perehdytys myönnettiin juuri), näkymän on
  // näytettävä uusin tieto eikä sitä mikä oli voimassa kohdetta valittaessa.
  const valittu = valittuId ? kohteet.find((k) => k.siteId === valittuId) || null : null;

  if (valittu) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setValittuId(null)}
          className="flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-accent transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Takaisin kohteisiin
        </button>

        <h2 className="text-2xl font-bold text-ink-strong mb-1">{valittu.siteNimi}</h2>
        <p className="text-base text-ink-muted leading-relaxed mb-6">
          Valitse vuoro jonka olet tulossa tekemään. Vuoron tehtävät ja kierrokset tulevat
          mukana automaattisesti.
        </p>

        {virhe && (
          <div className="mb-6 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3">
            <p className="text-sm text-danger-ink">{virhe}</p>
          </div>
        )}

        <div className="space-y-2">
          {valittu.vuorot.map((v) => {
            const auki = v.perehdytetty && v.ikkunassa;
            return (
              <button
                key={v.id}
                type="button"
                disabled={!auki || aloittaa}
                onClick={() => onValitse(valittu.siteId, v)}
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

        <LaiteSidonta />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink-strong mb-1">Kirjaudu vuoroon:</h2>
      <p className="text-base text-ink-muted leading-relaxed mb-6">
        Valitse kohde jossa olet tulossa työskentelemään.
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
        <div className="space-y-2">
          {kohteet.map((kohde) => (
            <button
              key={kohde.siteId}
              type="button"
              onClick={() => setValittuId(kohde.siteId)}
              className="w-full text-left rounded-xl border border-line bg-surface hover:bg-sunken p-4 flex items-center gap-3 transition-colors"
            >
              <Building2 size={20} className="text-accent shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-bold text-ink-strong truncate">
                  {kohde.siteNimi}
                </span>
                <span className="block text-base text-ink-muted mt-0.5">
                  {kohteenTila(kohde)}
                </span>
              </span>
              <ChevronRight size={20} className="text-ink-subtle shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Laitteen sidonta on kertaluonteinen käyttöönotto, ja se kuuluu tähän näkymään
          kahdesta syystä: vartijalla ei ole asetusoikeuksia, ja puhelimen käyttöönotto ja
          vuoroon kirjautuminen ovat ihmiselle sama hetki. Sidottunakin kortti jää näkyviin
          ja kertoo laitteen mallin: väärä malli on ainoa tapa huomata että sidonta on
          vanhassa puhelimessa. Näkyy molemmissa vaiheissa, koska se ei riipu kohteesta
          eikä vuorosta — kumpi tahansa askel voi olla se jolla vartija sattuu seisomaan
          kun puhelin on uusi. */}
      <LaiteSidonta />
    </div>
  );
};
