// Avainerän taulukkosyöttö: kymmeniä avaimia kerralla.
//
// OMA SELAINVÄLILEHTENSÄ (/guard/avainera), ei modaali eikä välilehti pankin sisällä.
// Syy on leveys: rivillä on seitsemän saraketta, ja kymmenen avainta pitää nähdä yhtä
// aikaa jotta virheen huomaa. Modaalissa taulukko olisi vaakavieritettävä laatikko, ja
// vaakavieritettävään lomakkeeseen syötetään väärään sarakkeeseen.
//
// Toinen syy on työn luonne: avainerä kirjataan sopimuspaperista, ja se on oma
// työtehtävänsä joka kestää minuutteja. Pankki jää auki taustalle ja päivittyy kun
// tästä välilehdestä palataan.
//
// --- Miksi tämä ei ole "Excel-tuonti" ---------------------------------------------
//
// Tiedoston lataaminen olisi houkutteleva mutta huonompi: .xlsx on pakattu XML jonka
// jäsentämiseen tarvitaan kirjasto, ja CSV:n erotinmerkki ja merkistö ovat suomalaisessa
// Excelissä jatkuva virhelähde. LIITTÄMINEN sen sijaan tulee selaimeen valmiina
// sarkainerotettuna tekstinä — käyttäjä maalaa solut Excelissä, painaa Ctrl+C ja
// liittää tähän. Sama lopputulos ilman yhtään tiedostomuotoa.
import { useState } from 'react';
import { Plus, Trash2, Upload, X } from 'lucide-react';

import { LAJIT } from './lajit';
import { luoAvainEra, type AvainRivi } from './pankki';
import type { KalustoTietue } from './tyypit';

// Sarakkeet siinä järjestyksessä kuin ne luetaan sopimuspaperista. Sama järjestys
// ratkaisee myös liittämisen: Excelistä kopioitu alue täyttyy vasemmalta oikealle.
const SARAKKEET: { avain: keyof AvainRivi; otsikko: string; leveys: string; vihje?: string }[] = [
  { avain: 'nimi', otsikko: 'Nimi', leveys: 'min-w-[13rem]', vihje: 'Hansa pääovi' },
  { avain: 'alalaji', otsikko: 'Tyyppi', leveys: 'min-w-[9rem]', vihje: 'Yleisavain' },
  { avain: 'avaintyyppi', otsikko: 'Avaimen tyyppi', leveys: 'min-w-[9rem]', vihje: 'Abloy Exec' },
  { avain: 'kohdeNimi', otsikko: 'Mihin käy', leveys: 'min-w-[11rem]', vihje: 'Kauppakeskus Hansa' },
  { avain: 'sarjanumero', otsikko: 'Sarjanumero', leveys: 'min-w-[9rem]' },
  { avain: 'sarjanumerointi', otsikko: 'Numerointi', leveys: 'min-w-[7rem]', vihje: '4/12' },
  { avain: 'luovutussopimus', otsikko: 'Sopimus', leveys: 'min-w-[9rem]' },
];

const TYHJA: AvainRivi = {
  nimi: '', alalaji: '', avaintyyppi: '', kohdeNimi: '',
  sarjanumero: '', sarjanumerointi: '', luovutussopimus: '', kuvaus: '',
};

const RIVEJA_ALUKSI = 10;
const tyhjatRivit = (n: number) => Array.from({ length: n }, () => ({ ...TYHJA }));

// Onko rivillä mitään. Tyhjät rivit pudotetaan lähetyksestä, jotta taulukossa saa olla
// varalla rivejä ilman että ne päätyvät pankkiin.
const onTyhja = (rivi: AvainRivi) => Object.values(rivi).every((arvo) => !String(arvo).trim());

export const AvainEra = () => {
  const [rivit, setRivit] = useState<AvainRivi[]>(() => tyhjatRivit(RIVEJA_ALUKSI));
  const [virhe, setVirhe] = useState<string | null>(null);
  const [virheRivi, setVirheRivi] = useState<number | null>(null);
  const [tallentaa, setTallentaa] = useState(false);
  const [valmiit, setValmiit] = useState<KalustoTietue[] | null>(null);

  const aseta = (rivi: number, avain: keyof AvainRivi, arvo: string) =>
    setRivit((edelliset) => edelliset.map((r, i) => (i === rivi ? { ...r, [avain]: arvo } : r)));

  const poistaRivi = (rivi: number) =>
    setRivit((edelliset) => (edelliset.length === 1 ? tyhjatRivit(1) : edelliset.filter((_, i) => i !== rivi)));

  /**
   * Liittäminen Excelistä. Leikepöydällä on sarkainerotettu taulukko, ja se puretaan
   * ALKAEN SIITÄ SOLUSTA johon liitetään — samoin kuin taulukkolaskennassa. Rivejä
   * lisätään tarvittaessa, jotta 40 rivin liitos ei katkea kymmeneen.
   *
   * Yhden solun liitos (ei sarkainta eikä rivinvaihtoa) jätetään selaimen omaksi
   * asiaksi: se on tavallista tekstin liittämistä eikä taulukon täyttöä.
   */
  const liita = (tapahtuma: React.ClipboardEvent, rivi: number, sarake: number) => {
    const teksti = tapahtuma.clipboardData.getData('text/plain');
    if (!teksti || (!teksti.includes('\t') && !teksti.includes('\n'))) return;
    tapahtuma.preventDefault();

    const taulukko = teksti
      .replace(/\r\n?/g, '\n')
      .replace(/\n$/, '')
      .split('\n')
      .map((r) => r.split('\t'));

    setRivit((edelliset) => {
      const tarvitaan = rivi + taulukko.length;
      const uudet = [...edelliset, ...tyhjatRivit(Math.max(0, tarvitaan - edelliset.length))];
      taulukko.forEach((solut, r) => {
        solut.forEach((arvo, s) => {
          const sarakeTiedot = SARAKKEET[sarake + s];
          if (!sarakeTiedot) return; // liitos on taulukkoa leveämpi: ylimenevä osa jätetään
          uudet[rivi + r] = { ...uudet[rivi + r], [sarakeTiedot.avain]: arvo.trim() };
        });
      });
      return uudet;
    });
    setVirhe(null);
    setVirheRivi(null);
  };

  const laheta = async () => {
    const lahetettavat = rivit.filter((r) => !onTyhja(r));
    if (lahetettavat.length === 0) {
      setVirhe('Taulukossa ei ole yhtään täytettyä riviä.');
      return;
    }
    const puuttuvaNimi = lahetettavat.findIndex((r) => !r.nimi.trim());
    if (puuttuvaNimi !== -1) {
      setVirhe(`Rivi ${puuttuvaNimi + 1}: avaimelle on annettava nimi.`);
      setVirheRivi(puuttuvaNimi);
      return;
    }

    setVirhe(null);
    setVirheRivi(null);
    setTallentaa(true);
    try {
      const tulos = await luoAvainEra(lahetettavat);
      if (!tulos.ok) {
        setVirhe(tulos.error || 'Erän tallennus epäonnistui.');
        return;
      }
      setValmiit(tulos.esineet || []);
    } finally {
      setTallentaa(false);
    }
  };

  // --- Valmis: mitä syntyi ---------------------------------------------------------
  //
  // Tunnukset ja holvipaikat näytetään heti, koska ne ovat se tieto jota kirjaaja
  // tarvitsee seuraavaksi: kilvet tulostetaan ja avaimet ripustetaan koukkuihin.
  if (valmiit) {
    return (
      <div className="min-h-screen bg-canvas p-6 md:p-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-ink-strong mb-1">
            {valmiit.length} avainta kirjattu holviin
          </h1>
          <p className="text-sm text-ink-muted mb-6">
            Jokaiselle varattiin holvipaikka. Tulosta kilvet kalustopankista — voit sulkea
            tämän välilehden.
          </p>

          <div className="bg-surface border border-line rounded-xl overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-ink-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Tunnus</th>
                  <th className="text-left px-4 py-2">Holvipaikka</th>
                  <th className="text-left px-4 py-2">Nimi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {valmiit.map((esine) => (
                  <tr key={esine.id}>
                    <td className="px-4 py-2 font-mono text-ink-strong">{esine.tunnus}</td>
                    <td className="px-4 py-2 font-mono text-ink-body">{esine.holviPaikka}</td>
                    <td className="px-4 py-2 text-ink-body">{esine.nimi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => { setValmiit(null); setRivit(tyhjatRivit(RIVEJA_ALUKSI)); }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95"
            >
              Kirjaa lisää avaimia
            </button>
            <button
              type="button"
              onClick={() => window.close()}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken"
            >
              Sulje välilehti
            </button>
          </div>
        </div>
      </div>
    );
  }

  const taytettyja = rivit.filter((r) => !onTyhja(r)).length;

  return (
    <div className="min-h-screen bg-canvas p-4 md:p-8">
      <div className="max-w-full">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-ink-strong mb-1">Avainerän kirjaus</h1>
          <p className="text-sm text-ink-muted max-w-3xl leading-relaxed">
            Yksi rivi per avain. Jokainen saa oman tunnuksensa ja varatun holvipaikan
            (1000→) tallennettaessa, ja kaikki kirjataan holviin — jyvitys kohteille
            tehdään pankista jälkikäteen.
          </p>
          <p className="text-sm text-ink-body mt-2 inline-flex items-center gap-2">
            <Upload size={15} className="text-ink-muted" />
            Voit maalata alueen Excelissä ja liittää sen suoraan taulukkoon. Rivejä
            lisätään automaattisesti.
          </p>
        </div>

        {virhe && (
          <div className="flex items-start justify-between gap-3 text-sm bg-danger-soft text-danger-ink border border-danger/30 rounded-lg px-3 py-2 mb-4 max-w-3xl">
            <span>{virhe}</span>
            <button type="button" onClick={() => setVirhe(null)} aria-label="Sulje ilmoitus">
              <X size={15} />
            </button>
          </div>
        )}

        <div className="bg-surface border border-line rounded-xl overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead className="bg-sunken text-ink-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-right px-2 py-2 w-10">#</th>
                {SARAKKEET.map((sarake) => (
                  <th key={sarake.avain} className={`text-left px-2 py-2 ${sarake.leveys}`}>
                    {sarake.otsikko}
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rivit.map((rivi, r) => (
                <tr key={r} className={virheRivi === r ? 'bg-danger-soft' : undefined}>
                  <td className="px-2 py-1 text-right text-xs text-ink-subtle font-mono align-middle">
                    {r + 1}
                  </td>
                  {SARAKKEET.map((sarake, s) => (
                    <td key={sarake.avain} className="px-1 py-1">
                      <input
                        value={rivi[sarake.avain]}
                        onChange={(e) => aseta(r, sarake.avain, e.target.value)}
                        onPaste={(e) => liita(e, r, s)}
                        placeholder={r === 0 ? sarake.vihje : undefined}
                        // Avaimen alalaji on vapaata tekstiä mutta tavallisimmat
                        // tarjotaan: sama lista kuin yksittäisen avaimen lomakkeessa.
                        list={sarake.avain === 'alalaji' ? 'avain-alalajit' : undefined}
                        className="w-full px-2 py-1.5 rounded border border-line bg-surface text-sm text-ink-body focus:ring-2 focus:ring-accent focus:border-accent"
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => poistaRivi(r)}
                      aria-label={`Tyhjennä rivi ${r + 1}`}
                      className="p-1.5 rounded text-ink-subtle hover:text-danger-ink hover:bg-danger-soft"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="avain-alalajit">
            {LAJIT.avain.alalajit.map((a) => <option key={a} value={a} />)}
          </datalist>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setRivit((e) => [...e, ...tyhjatRivit(10)])}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken"
          >
            <Plus size={15} />
            Lisää 10 riviä
          </button>
          <button
            type="button"
            disabled={tallentaa || taytettyja === 0}
            onClick={laheta}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95 disabled:opacity-50"
          >
            {tallentaa
              ? 'Tallennetaan…'
              : `Kirjaa ${taytettyja} ${taytettyja === 1 ? 'avain' : 'avainta'} holviin`}
          </button>
          <span className="text-xs text-ink-muted">
            Tyhjät rivit jätetään huomiotta. Erä tallennetaan kokonaan tai ei lainkaan.
          </span>
        </div>
      </div>
    </div>
  );
};
