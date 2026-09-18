// Kaluston taulukkosyöttö: kymmeniä esineitä kerralla, mitä lajia tahansa.
//
// OMA SELAINVÄLILEHTENSÄ (/guard/era?laji=avain), ei modaali eikä välilehti pankin
// sisällä. Syy on leveys: rivillä on jopa kahdeksan saraketta, ja kymmenen riviä pitää
// nähdä yhtä aikaa jotta virheen huomaa. Modaalissa taulukko olisi vaakavieritettävä
// laatikko, ja vaakavieritettävään lomakkeeseen syötetään väärään sarakkeeseen.
//
// Toinen syy on työn luonne: erä kirjataan paperista — avaimet sopimuksesta, asusteet
// lähetteestä — ja se on oma työtehtävänsä joka kestää minuutteja. Pankki jää auki
// taustalle ja päivittyy kun tästä välilehdestä palataan.
//
// SARAKKEET TULEVAT LAJISTA (lajit.ts: LAJIT). Sama taulukko palvelee avaimia ja
// takkeja, koska ainoa ero on mitä kenttiä lajilla on — ja se tieto on jo olemassa
// yhdessä paikassa. Lajikohtainen taulukkokomponentti olisi seitsemän kopiota samasta
// liittämislogiikasta.
//
// --- Miksi tämä ei ole "Excel-tuonti" ---------------------------------------------
//
// Tiedoston lataaminen olisi houkutteleva mutta huonompi: .xlsx on pakattu XML jonka
// jäsentämiseen tarvitaan kirjasto, ja CSV:n erotinmerkki ja merkistö ovat suomalaisessa
// Excelissä jatkuva virhelähde. LIITTÄMINEN sen sijaan tulee selaimeen valmiina
// sarkainerotettuna tekstinä — käyttäjä maalaa solut Excelissä, painaa Ctrl+C ja
// liittää tähän. Sama lopputulos ilman yhtään tiedostomuotoa.
import { useEffect, useMemo, useState } from 'react';
import { Copy, Plus, Trash2, Upload, X } from 'lucide-react';

import { canEdit } from '../../shared/oikeudet';
import { AvainkarttaNappi } from './Avainkartta';
import { haeAvaintyypit, type Avaintyyppi } from './avaintyypit';
import { LAJIJARJESTYS, LAJIT, oletusSailo } from './lajit';
import { luoKalustoEra, type EraRivi } from './pankki';
import { SAILON_ILLATIIVI } from './tyypit';
import type { KalustoTietue, Laji } from './tyypit';

// Yksi sarake taulukossa. `perus` erottaa esineen omat kentät lajikohtaisista
// lisätiedoista, koska ne menevät palvelimelle eri paikkaan.
type Sarake = {
  avain: string;
  otsikko: string;
  perus: boolean;
  totuusarvo: boolean;
  paivamaara: boolean;
  vihje?: string;
  leveys: string;
};

// Sarakkeet siinä järjestyksessä kuin ne luetaan paperista: mikä esine, mitä tyyppiä,
// mikä yksilö, ja sitten lajin omat tiedot. Sama järjestys ratkaisee myös liittämisen —
// Excelistä kopioitu alue täyttyy vasemmalta oikealle.
const sarakkeet = (laji: Laji): Sarake[] => {
  const maar = LAJIT[laji];
  const lista: Sarake[] = [
    { avain: 'nimi', otsikko: 'Nimi', perus: true, totuusarvo: false, paivamaara: false, leveys: 'min-w-[13rem]', vihje: laji === 'avain' ? 'Hansa pääovi' : 'Talvitakki L' },
    { avain: 'alalaji', otsikko: 'Tyyppi', perus: true, totuusarvo: false, paivamaara: false, leveys: 'min-w-[9rem]', vihje: maar.alalajit[0] },
  ];
  // Sarjanumerosaraketta ei näytetä lajille jolla sitä ei ole (takki): tyhjä sarake
  // kutsuu täyttämään jotain, ja palvelin hylkäisi sen hiljaa.
  if (maar.sarjanumero !== 'ei') {
    lista.push({
      avain: 'sarjanumero',
      otsikko: maar.sarjanumero === 'pakollinen' ? 'Sarjanumero *' : 'Sarjanumero',
      perus: true, totuusarvo: false, paivamaara: false, leveys: 'min-w-[9rem]',
    });
  }
  for (const kentta of maar.lisakentat) {
    lista.push({
      avain: kentta.avain,
      otsikko: (kentta.lyhyt || kentta.otsikko) + (kentta.pakollinen ? ' *' : ''),
      perus: false,
      totuusarvo: kentta.totuusarvo === true,
      paivamaara: kentta.paivamaara === true,
      vihje: kentta.vihje && kentta.vihje.length < 24 ? kentta.vihje : undefined,
      leveys: kentta.totuusarvo ? 'w-24' : 'min-w-[9rem]',
    });
  }
  return lista;
};

const tyhjaRivi = (): EraRivi => ({
  nimi: '', alalaji: '', sarjanumero: '', kuvaus: '', lisatiedot: {},
});

const RIVEJA_ALUKSI = 10;
const tyhjatRivit = (n: number) => Array.from({ length: n }, tyhjaRivi);

const lue = (rivi: EraRivi, sarake: Sarake): string | boolean =>
  (sarake.perus
    ? (rivi[sarake.avain as 'nimi' | 'alalaji' | 'sarjanumero'] ?? '')
    : (rivi.lisatiedot[sarake.avain] ?? (sarake.totuusarvo ? false : '')));

const aseta = (rivi: EraRivi, sarake: Sarake, arvo: string | boolean): EraRivi =>
  (sarake.perus
    ? { ...rivi, [sarake.avain]: arvo }
    : { ...rivi, lisatiedot: { ...rivi.lisatiedot, [sarake.avain]: arvo } });

// Liitetyn solun tulkinta rastiksi. Excelissä kyllä-sarake voi olla mitä tahansa näistä,
// ja tyhjä on ei — muuten koko sarakkeen liittäminen rastittaisi joka rivin.
const TOSI = new Set(['kyllä', 'kylla', 'x', 'k', 'true', '1', 'on', 'yes']);
const tulkitseTotuus = (teksti: string) => TOSI.has(teksti.trim().toLowerCase());

// Liitetyn päivämäärän tulkinta. Excelistä tulee suomalainen muoto (1.5.2027 tai
// 01.05.2027); ISO menee läpi sellaisenaan. null = ei tunnistettu.
//
// Ilman tätä koko sarakkeen liittäminen tuottaisi tyhjiä soluja HILJAA: date-kenttä
// hylkää muun kuin ISO-arvon näyttämättä mitään, ja käyttäjä luulisi liittäneensä
// päivät kunnes palvelin kirjaa esineet ilman määräpäivää.
const SUOMALAINEN = /^([0-9]{1,2})[.]([0-9]{1,2})[.]([0-9]{4})$/;
const ISO = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

const tulkitsePaiva = (teksti: string): string | null => {
  const arvo = String(teksti || '').trim();
  if (!arvo) return '';
  if (ISO.test(arvo)) return arvo;
  const osat = SUOMALAINEN.exec(arvo);
  if (!osat) return null;
  const [, pv, kk, vuosi] = osat;
  const iso = `${vuosi}-${kk.padStart(2, '0')}-${pv.padStart(2, '0')}`;
  // Olematon päivä (31.2.) ei saa muuttua kelvolliseksi pelkällä muotoilulla:
  // palvelin torjuisi sen, ja virhe näkyisi vasta tallennuksessa.
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
};

// Onko rivillä mitään. Tyhjät rivit pudotetaan lähetyksestä, jotta taulukossa saa olla
// varalla rivejä ilman että ne päätyvät pankkiin. Rasti yksin ei tee rivistä täytettyä:
// se on oletusarvo eikä syöte.
const onTyhja = (rivi: EraRivi) =>
  !rivi.nimi.trim() && !rivi.alalaji.trim() && !rivi.sarjanumero.trim() && !rivi.kuvaus.trim()
  && Object.values(rivi.lisatiedot).every((arvo) => arvo === false || !String(arvo).trim());

// Laji osoiterivistä. Tuntematon tai puuttuva → avain, koska erä on tavallisimmin
// avainerä ja väärä oletus on täällä halpa: lajin voi vaihtaa yhdellä klikkauksella.
const lajiOsoitteesta = (): Laji => {
  const arvo = new URLSearchParams(window.location.search).get('laji') || '';
  return (LAJIJARJESTYS as string[]).includes(arvo) ? (arvo as Laji) : 'avain';
};

export const KalustoEra = () => {
  const [laji, setLaji] = useState<Laji>(lajiOsoitteesta);
  const [rivit, setRivit] = useState<EraRivi[]>(() => tyhjatRivit(RIVEJA_ALUKSI));
  const [virhe, setVirhe] = useState<string | null>(null);
  const [virheRivi, setVirheRivi] = useState<number | null>(null);
  const [tallentaa, setTallentaa] = useState(false);
  const [valmiit, setValmiit] = useState<KalustoTietue[] | null>(null);

  const maar = LAJIT[laji];
  const sarakelista = useMemo(() => sarakkeet(laji), [laji]);
  const onAvain = laji === 'avain';
  // Mihin erä kirjautuu. Sama sääntö kuin palvelimella (server/kalusto.js: oletusSailo),
  // ja se kerrotaan ääninä eikä oleteta: kirjaaja menee hakemaan tavaran sieltä minne
  // tämä sivu sanoo sen kirjanneensa.
  const sailoon = SAILON_ILLATIIVI[oletusSailo(laji)];

  // Avainkartta taulukkoa varten. Sivu on oma välilehtensä ilman GuardAppia, joten
  // oikeudet ja kartta haetaan tässä — sama istuntoreitti jota sovelluskin käyttää.
  // Kartan nimet menevät datalistiin: taulukossa ei ole tilaa infopallolle joka
  // rivillä, mutta automaattitäydennys antaa saman hyödyn eli yhden kirjoitusasun.
  const [avaintyypit, setAvaintyypit] = useState<Avaintyyppi[]>([]);
  const [saaHallita, setSaaHallita] = useState(false);
  useEffect(() => {
    if (!onAvain) return;
    let elossa = true;
    haeAvaintyypit().then((lista) => { if (elossa) setAvaintyypit(lista); });
    fetch('/api/session', { credentials: 'include' })
      .then((v) => v.json())
      .then((s) => {
        if (!elossa) return;
        setSaaHallita(s?.role === 'admin' || canEdit(s?.permissions, null, 'guard_assets'));
      })
      .catch(() => {});
    return () => { elossa = false; };
  }, [onAvain]);

  const paivita = (rivi: number, sarake: Sarake, arvo: string | boolean) =>
    setRivit((edelliset) => edelliset.map((r, i) => (i === rivi ? aseta(r, sarake, arvo) : r)));

  const poistaRivi = (rivi: number) =>
    setRivit((edelliset) => (edelliset.length === 1 ? tyhjatRivit(1) : edelliset.filter((_, i) => i !== rivi)));

  /**
   * Rivin monistus. Kymmenen samanlaista S-kokoista takkia eroavat toisistaan vain
   * tunnuksella, jonka palvelin antaa — kaiken muun kirjoittaminen kymmenesti on
   * työtä jonka tulos on kymmenen kertaa sama rivi.
   *
   * SARJANUMERO JÄTETÄÄN POIS kopioista. Se on ainoa kenttä joka yksilöi esineen, ja
   * kymmenen riviä samalla sarjanumerolla on rekisterissä pahempi virhe kuin tyhjä
   * kenttä: tyhjän huomaa, päällekkäisen ei. Sumuttimen numero kirjoitetaan siis yhä
   * käsin, takissa sellaista ei ole.
   *
   * Kopiot tulevat heti lähderivin perään eivätkä taulukon loppuun, jotta ne pysyvät
   * silmissä yhdessä sen kanssa mistä ne tulivat.
   */
  const monista = (rivi: number, kertaa: number) => setRivit((edelliset) => {
    const lahde = edelliset[rivi];
    if (!lahde) return edelliset;
    const kopio = { ...lahde, sarjanumero: '', lisatiedot: { ...lahde.lisatiedot } };
    const kopiot = Array.from({ length: kertaa }, () => ({
      ...kopio, lisatiedot: { ...kopio.lisatiedot },
    }));
    return [...edelliset.slice(0, rivi + 1), ...kopiot, ...edelliset.slice(rivi + 1)];
  });

  /**
   * Lajin vaihto. PERUSTIEDOT SÄILYVÄT ja lajikohtaiset tyhjenevät: nimi ja tyyppi ovat
   * samat kentät lajista riippumatta, mutta lisätietosarakkeet katoavat näkyvistä
   * kokonaan — ja näkymätön arvo joka menisi silti tallennukseen on pahempi kuin
   * tyhjennys josta kerrotaan.
   */
  const vaihdaLaji = (uusi: Laji) => {
    if (uusi === laji) return;
    setLaji(uusi);
    setRivit((edelliset) => edelliset.map((r) => ({ ...r, lisatiedot: {} })));
    setVirhe(null);
    setVirheRivi(null);
    // Osoiterivi mukaan, jotta välilehden päivitys ei palauta edellistä lajia.
    const osoite = `${window.location.pathname}?laji=${uusi}`;
    window.history.replaceState(null, '', osoite);
  };

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

    let tunnistamattomia = 0;
    setRivit((edelliset) => {
      const tarvitaan = rivi + taulukko.length;
      const uudet = [...edelliset, ...tyhjatRivit(Math.max(0, tarvitaan - edelliset.length))];
      taulukko.forEach((solut, r) => {
        solut.forEach((arvo, s) => {
          const sarakeTiedot = sarakelista[sarake + s];
          if (!sarakeTiedot) return; // liitos on taulukkoa leveämpi: ylimenevä osa jätetään
          let uusi: string | boolean;
          if (sarakeTiedot.totuusarvo) {
            uusi = tulkitseTotuus(arvo);
          } else if (sarakeTiedot.paivamaara) {
            const paiva = tulkitsePaiva(arvo);
            if (paiva === null) tunnistamattomia += 1;
            uusi = paiva ?? '';
          } else {
            uusi = arvo.trim();
          }
          uudet[rivi + r] = aseta(uudet[rivi + r], sarakeTiedot, uusi);
        });
      });
      return uudet;
    });
    setVirhe(tunnistamattomia > 0
      ? `${tunnistamattomia} päivämäärää ei tunnistettu, ja ${tunnistamattomia === 1 ? 'se jäi tyhjäksi' : 'ne jäivät tyhjiksi'}. Käytä muotoa pp.kk.vvvv.`
      : null);
    setVirheRivi(null);
  };

  const laheta = async () => {
    const lahetettavat = rivit.filter((r) => !onTyhja(r));
    if (lahetettavat.length === 0) {
      setVirhe('Taulukossa ei ole yhtään täytettyä riviä.');
      return;
    }
    // Nimi tarkistetaan selaimessa, koska se on ainoa kenttä jonka puuttuminen on
    // taulukossa tavallista: rivi jää kesken. Muut pakolliset kentät (aseen lupanumero)
    // tarkistaa palvelin ja kertoo rivinumeron.
    const puuttuvaNimi = lahetettavat.findIndex((r) => !r.nimi.trim());
    if (puuttuvaNimi !== -1) {
      setVirhe(`Rivi ${puuttuvaNimi + 1}: ${maar.nimi.toLowerCase()} tarvitsee nimen.`);
      setVirheRivi(puuttuvaNimi);
      return;
    }

    setVirhe(null);
    setVirheRivi(null);
    setTallentaa(true);
    try {
      const tulos = await luoKalustoEra(laji, lahetettavat);
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
  // Tunnukset näytetään heti, koska ne ovat se tieto jota kirjaaja tarvitsee
  // seuraavaksi: kilvet tulostetaan ja kiinnitetään esineisiin. Avaimilla mukana on
  // holvipaikka — se kertoo mihin koukkuun avain ripustetaan.
  if (valmiit) {
    return (
      <div className="min-h-screen bg-canvas p-6 md:p-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-ink-strong mb-1">
            {valmiit.length} {valmiit.length === 1 ? 'esine' : 'esinettä'} kirjattu {sailoon}
          </h1>
          <p className="text-sm text-ink-muted mb-6">
            {onAvain
              ? 'Jokaiselle varattiin holvipaikka. Tulosta kilvet kalustopankista — voit sulkea tämän välilehden.'
              : `Kaikki kirjattiin ${sailoon}. Tulosta kilvet kalustopankista ja jyvitä sieltä — voit sulkea tämän välilehden.`}
          </p>

          <div className="bg-surface border border-line rounded-xl overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-ink-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Tunnus</th>
                  {onAvain && <th className="text-left px-4 py-2">Holvipaikka</th>}
                  <th className="text-left px-4 py-2">Nimi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {valmiit.map((esine) => (
                  <tr key={esine.id}>
                    <td className="px-4 py-2 font-mono text-ink-strong">{esine.tunnus}</td>
                    {onAvain && <td className="px-4 py-2 font-mono text-ink-body">{esine.holviPaikka}</td>}
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
              Kirjaa lisää
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
          <h1 className="text-2xl font-bold text-ink-strong mb-1">Eräkirjaus</h1>
          <p className="text-sm text-ink-muted max-w-3xl leading-relaxed">
            Yksi rivi per esine. Jokainen saa oman tunnuksensa{onAvain ? ' ja varatun holvipaikan (1000→)' : ''} tallennettaessa,
            ja kaikki kirjataan {sailoon} — jyvitys kohteille ja henkilöille tehdään pankista
            jälkikäteen.
          </p>
          <p className="text-sm text-ink-body mt-2 inline-flex items-center gap-2">
            <Upload size={15} className="text-ink-muted" />
            Voit maalata alueen Excelissä ja liittää sen suoraan taulukkoon. Rivejä
            lisätään automaattisesti. Samanlaisia esineitä varten monista täytetty rivi
            rivin lopun painikkeella — sarjanumero jää kopioissa tyhjäksi.
          </p>
        </div>

        {/* Lajivalinta taulukon yläpuolella eikä sarakkeena: koko taulukko on yhtä lajia,
            koska sarakkeet ovat lajin kentät. Sekalajinen erä tarkoittaisi tyhjiä
            sarakkeita joka rivillä. */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-medium text-ink-muted mr-1">Laji</span>
          {LAJIJARJESTYS.map((vaihtoehto) => {
            const Ikoni = LAJIT[vaihtoehto].ikoni;
            return (
              <button
                key={vaihtoehto}
                type="button"
                onClick={() => vaihdaLaji(vaihtoehto)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  laji === vaihtoehto
                    ? 'bg-accent text-white border-accent'
                    : 'border-line text-ink-body hover:bg-sunken'
                }`}
              >
                <Ikoni size={14} />
                {LAJIT[vaihtoehto].nimi}
              </button>
            );
          })}
          <span className="text-xs text-ink-muted">
            Tunnukset alkavat <span className="font-mono">TJ-{maar.koodi}-</span>. Lajin
            vaihto tyhjentää lajikohtaiset sarakkeet.
          </span>
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
                {sarakelista.map((sarake) => (
                  <th key={sarake.avain} className={`text-left px-2 py-2 ${sarake.leveys}`}>
                    <span className="inline-flex items-center gap-1.5">
                      {sarake.otsikko}
                      {/* Infopallo sarakeotsikossa eikä joka solussa: kymmenellä
                          rivillä se olisi kymmenen palloa samasta asiasta. Kartta on
                          tässä hakuteos — valinta täyttäisi rivin jota otsikko ei
                          tiedä, ja solun täydennys hoituu datalistillä. */}
                      {sarake.avain === 'avaintyyppi' && (
                        <AvainkarttaNappi saaHallita={saaHallita} />
                      )}
                    </span>
                  </th>
                ))}
                <th className="w-28 text-left px-2 py-2">
                  <span className="inline-flex items-center gap-1">
                    <Copy size={12} />
                    Monista
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rivit.map((rivi, r) => (
                <tr key={r} className={virheRivi === r ? 'bg-danger-soft' : undefined}>
                  <td className="px-2 py-1 text-right text-xs text-ink-subtle font-mono align-middle">
                    {r + 1}
                  </td>
                  {sarakelista.map((sarake, s) => (
                    <td key={sarake.avain} className="px-1 py-1">
                      {sarake.totuusarvo ? (
                        <input
                          type="checkbox"
                          checked={lue(rivi, sarake) === true}
                          onChange={(e) => paivita(r, sarake, e.target.checked)}
                          aria-label={`${sarake.otsikko}, rivi ${r + 1}`}
                          className="ml-2"
                        />
                      ) : (
                        <input
                          type={sarake.paivamaara ? 'date' : 'text'}
                          value={String(lue(rivi, sarake))}
                          onChange={(e) => paivita(r, sarake, e.target.value)}
                          onPaste={(e) => liita(e, r, s)}
                          placeholder={r === 0 ? sarake.vihje : undefined}
                          // Alalaji on vapaata tekstiä mutta tavallisimmat tarjotaan:
                          // sama lista kuin yksittäisen esineen lomakkeessa.
                          list={sarake.avain === 'alalaji'
                            ? 'era-alalajit'
                            : (sarake.avain === 'avaintyyppi' ? 'era-avaintyypit' : undefined)}
                          className="w-full px-2 py-1.5 rounded border border-line bg-surface text-sm text-ink-body focus:ring-2 focus:ring-accent focus:border-accent"
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <div className="flex items-center gap-0.5">
                      {/* Monistus näkyy vain täytetyllä rivillä: tyhjän rivin kopiointi
                          tuottaisi tyhjiä rivejä, ja painike jota ei voi käyttää
                          järkevästi on häiriö jokaisella rivillä. */}
                      {!onTyhja(rivi) && [5, 10].map((kertaa) => (
                        <button
                          key={kertaa}
                          type="button"
                          onClick={() => monista(r, kertaa)}
                          aria-label={`Monista rivi ${r + 1} ${kertaa} kertaa`}
                          title={`Monista tämä rivi ${kertaa} kertaa (sarjanumero jää tyhjäksi)`}
                          className="px-1.5 py-1 rounded text-xs font-bold text-ink-subtle hover:text-accent hover:bg-sunken"
                        >
                          +{kertaa}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => poistaRivi(r)}
                        aria-label={`Tyhjennä rivi ${r + 1}`}
                        className="p-1.5 rounded text-ink-subtle hover:text-danger-ink hover:bg-danger-soft"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="era-alalajit">
            {maar.alalajit.map((a) => <option key={a} value={a} />)}
          </datalist>
          <datalist id="era-avaintyypit">
            {avaintyypit.map((t) => <option key={t.id} value={t.nimi} />)}
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
              : `Kirjaa ${taytettyja} ${taytettyja === 1 ? 'esine' : 'esinettä'} ${sailoon}`}
          </button>
          <span className="text-xs text-ink-muted">
            Tyhjät rivit jätetään huomiotta. Erä tallennetaan kokonaan tai ei lainkaan.
          </span>
        </div>
      </div>
    </div>
  );
};
