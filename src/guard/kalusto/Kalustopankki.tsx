// Kalustopankki: koko yrityksen kalusto yhtenä listana.
//
// Näkymä vastaa neljään kysymykseen, ja siksi siinä on neljä välilehteä:
//
//   Kalusto  — mitä meillä on ja missä se on
//   Avaimet  — avaimet ja avainkaapit, holvipaikkoineen
//   Pyynnöt  — mitä kentältä on pyydetty ja odottaa päätöstä
//   Henkilöt — kenellä on mitäkin, ja mistä siitä tulostetaan luovutustosite
//
// AVAIMET OMANA VÄLILEHTENÄÄN, koska niitä on kertaluokkaa enemmän kuin muuta kalustoa:
// holvipaikat alkavat tuhannesta ja avaimia kirjataan kymmenittäin kerralla. Samassa
// listassa yhdeksän kymmenestä rivistä on avain, eikä siitä näe mitä muuta yrityksellä
// on. Jako tehdään lajin perusteella (lajit.ts: AVAINLAJIT) eikä uudella kokoelmalla —
// avain on kalustoa siinä missä muukin, ja sama tietue pysyy yhdessä paikassa.
//
// Kaikki neljä lukevat SAMAA listaa eri tavalla ryhmiteltynä. Se on tarkoituksellista:
// jos "henkilöllä olevat" olisi oma kokoelmansa, se voisi erota pankista — ja juuri sen
// eron välttäminen on koko pankin syy.
//
// Oikeusjako näkyy suoraan käyttöliittymässä: ilman muokkausoikeutta lista on sama mutta
// napit ovat "Pyydä kohteelle" eikä "Siirrä". Kaksi eri näkymää samasta asiasta olisi
// kaksi paikkaa jossa oikeus voi mennä väärin.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Boxes, ClipboardList, KeyRound, Plus, Printer, Search, Table2, TriangleAlert, Users, X,
} from 'lucide-react';

import { haeQrKoodi } from '../../shared/komponentit/QrKoodi';
import { TakaisinLinkki } from '../../shared/komponentit/TakaisinLinkki';
import { useTakaisinEste } from '../../shared/navigointi';
import { muotoileTunniste } from '../../shared/tunnisteet';
import { kilpimerkkiDokumentti, tulostaDokumentti, type TulostettavaKilpimerkki } from '../../shared/tuloste';
import { KalustoKortti } from './KalustoKortti';
import { KilpiEsikatselu } from './KilpiEsikatselu';
import { AVAINERAPOLKU } from '../../shared/laitevalinta';
import { AVAINLAJIT, LAJIT, MUUT_LAJIT, avainJarjestys, onAvainlaji } from './lajit';
import { tulostaLuovutuslomake } from './luovutuslomake';
import {
  aikaleima, luoKalustoa, osuuHakuun, ratkaisePyynto, sijainti, tarranOsoite,
  type UusiKalusto,
} from './pankki';
import {
  SIJOITUKSEN_SELITE, TILAN_SELITE, TILAN_VARI,
  type KalustonTila, type KalustoTietue, type Laji, type SijoitusLaji,
} from './tyypit';

export type Tyontekija = { id: string; nimi: string; displayId?: number | null };

type Props = {
  kalusto: KalustoTietue[];
  kohteet: { id: string; nimi: string }[];
  tyontekijat: Tyontekija[];
  saaHallita: boolean;
  omaTunnus: string;
  // Luovutustositteen "luovuttaja". Kirjautuneen nimi eikä tunnus: tosite on paperi jonka
  // kaksi ihmistä allekirjoittaa, ja käyttäjätunnus ei ole kummankaan nimi.
  omaNimi: string;
  ladattu: boolean;
  onMuuttui: () => void;
  onTakaisin: () => void;
  // Avataan suoraan tämä tunnus (QR-skannaus). Tyhjä = ei avata mitään.
  avaaTunnus?: string | null;
  onAvausKasitelty?: () => void;
};

type Valilehti = 'kalusto' | 'avaimet' | 'pyynnot' | 'henkilot';

const TYHJA_LOMAKE = {
  laji: 'asuste' as Laji,
  alalaji: '',
  nimi: '',
  kuvaus: '',
  sarjanumero: '',
  lisatiedot: {} as Record<string, string | boolean>,
  sijoitusLaji: 'holvi' as SijoitusLaji,
  sijoitusId: '',
  kappaletta: 1,
};

export const Kalustopankki = ({
  kalusto, kohteet, tyontekijat, saaHallita, omaTunnus, omaNimi, ladattu,
  onMuuttui, onTakaisin, avaaTunnus, onAvausKasitelty,
}: Props) => {
  const [valilehti, setValilehti] = useState<Valilehti>('kalusto');
  const [haku, setHaku] = useState('');
  const [lajiSuodatin, setLajiSuodatin] = useState<Laji | 'kaikki'>('kaikki');
  const [tilaSuodatin, setTilaSuodatin] = useState<KalustonTila | 'kaikki'>('kaytossa');
  const [sijoitusSuodatin, setSijoitusSuodatin] = useState<SijoitusLaji | 'kaikki'>('kaikki');
  const [avattu, setAvattu] = useState<string | null>(null);
  const [lomakeAuki, setLomakeAuki] = useState(false);
  const [lomake, setLomake] = useState(TYHJA_LOMAKE);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tyoskentelee, setTyoskentelee] = useState(false);
  const [valitut, setValitut] = useState<Set<string>>(new Set());
  const [kilvet, setKilvet] = useState<TulostettavaKilpimerkki[] | null>(null);
  const [kilvetLataa, setKilvetLataa] = useState(false);
  const [hylkaykset, setHylkaykset] = useState<Record<string, string>>({});

  // QR-skannauksesta tullut tunnus avaa kortin. Tunnus eikä id, koska kilvessä on tunnus
  // — id on tietokannan asia eikä näy missään fyysisessä esineessä.
  const skannattu = avaaTunnus ? kalusto.find((e) => e.tunnus === avaaTunnus) : null;
  const avattuEsine = kalusto.find((e) => e.id === avattu) || skannattu || null;

  const pyynnot = useMemo(() => kalusto.filter((e) => e.pyynto), [kalusto]);

  // Kalusto- ja Avaimet-välilehti ovat sama näkymä eri pohjalistalla. Yksi render-haara
  // eikä kaksi: kaksi kopiota samasta listasta eroaisi ensimmäisessä korjauksessa, ja
  // juuri niitä eroja ei listalta huomaa.
  const avainlehti = valilehti === 'avaimet';
  const onKalustolehti = valilehti === 'kalusto' || avainlehti;

  const pohja = useMemo(
    () => kalusto.filter((e) => onAvainlaji(e.laji) === avainlehti),
    [kalusto, avainlehti]
  );

  // Välilehtien luvut lasketaan koko pankista eikä pohjalistasta: luvun on kerrottava
  // mitä toisella välilehdellä on, ei mitä tällä.
  const avaimia = useMemo(
    () => kalusto.filter((e) => onAvainlaji(e.laji) && e.tila !== 'poistettu').length,
    [kalusto]
  );
  const muitaEsineita = useMemo(
    () => kalusto.filter((e) => !onAvainlaji(e.laji) && e.tila !== 'poistettu').length,
    [kalusto]
  );

  // Kadonneet TÄMÄN välilehden kalustosta. Koko pankin luku näyttäisi kadonneita joita
  // listalla ei ole, ja "näytä ne" johtaisi tyhjään listaan.
  const kadonneet = useMemo(() => pohja.filter((e) => e.tila === 'kadonnut'), [pohja]);

  // Missä avaimet ovat. Vain varsinaiset avaimet, ei kaappeja: kaappi on paikka eikä
  // avain, ja sen laskeminen mukaan sotkisi täsmäytyksen.
  const avaintenPaikat = useMemo(() => {
    const luvut = new Map<SijoitusLaji, number>();
    for (const e of kalusto) {
      if (e.laji !== 'avain' || e.tila === 'poistettu') continue;
      luvut.set(e.sijoitusLaji, (luvut.get(e.sijoitusLaji) || 0) + 1);
    }
    return luvut;
  }, [kalusto]);

  // Ajoneuvot ja avainkaapit ovat itse kalustoa JA sijoituspaikkoja. Sama tietue
  // molemmissa rooleissa eikä erillinen paikkarekisteri: piiriauton avainkaappi on esine
  // joka voi kadota, ja paikkarekisteri ei osaisi kertoa sitä.
  const kantajat = useMemo(
    () => kalusto
      .filter((e) => (e.laji === 'ajoneuvo' || e.laji === 'avainkaappi') && e.tila !== 'poistettu')
      .map((e) => ({ id: e.id, nimi: `${e.nimi} (${e.tunnus})`, laji: e.laji as SijoitusLaji })),
    [kalusto]
  );

  const nakyvat = useMemo(() => pohja
    .filter((e) => (tilaSuodatin === 'kaikki' ? true : e.tila === tilaSuodatin))
    .filter((e) => (lajiSuodatin === 'kaikki' ? true : e.laji === lajiSuodatin))
    .filter((e) => (sijoitusSuodatin === 'kaikki' ? true : e.sijoitusLaji === sijoitusSuodatin))
    .filter((e) => osuuHakuun(e, haku))
    // Avainlehdellä järjestys on HOLVIPAIKAN mukaan eikä tunnuksen: holvipaikka on se
    // numero jolla avainta haetaan hyllystä, ja kirjanpidon on oltava samassa
    // järjestyksessä kuin hylly. Kaapit ensin, koska ne ovat paikkoja eivätkä avaimia.
    .sort((a, b) => (avainlehti
      ? avainJarjestys(a) - avainJarjestys(b) || a.tunnus.localeCompare(b.tunnus)
      : a.tunnus.localeCompare(b.tunnus))),
  [pohja, tilaSuodatin, lajiSuodatin, sijoitusSuodatin, haku, avainlehti]);

  // Henkilöittäin. Ryhmittely tehdään sijoitusId:n mukaan mutta nimi luetaan tietueesta:
  // rekisteristä poistettu työntekijä ei saa kadottaa sitä tietoa että hänellä on yhä
  // yrityksen tavaraa.
  const henkiloittain = useMemo(() => {
    const ryhmat = new Map<string, { id: string; nimi: string; esineet: KalustoTietue[] }>();
    for (const esine of kalusto) {
      if (esine.sijoitusLaji !== 'henkilo' || esine.tila === 'poistettu') continue;
      const id = esine.sijoitusId || '';
      const ryhma = ryhmat.get(id)
        || { id, nimi: esine.sijoitusNimi || 'Tuntematon', esineet: [] };
      ryhma.esineet.push(esine);
      ryhmat.set(id, ryhma);
    }
    return [...ryhmat.values()].sort((a, b) => a.nimi.localeCompare(b.nimi));
  }, [kalusto]);

  // Lomake ja lajisuodatin tarjoavat vain sen välilehden lajit jolla ollaan. Muuten
  // avaimen voisi lisätä Kalusto-välilehdeltä, ja se katoaisi heti toiselle välilehdelle.
  const lajiValinnat = avainlehti ? AVAINLAJIT : MUUT_LAJIT;

  // Lomakkeen avaus varmistaa että valittu laji kuuluu tälle välilehdelle. Laji voi olla
  // toisen välilehden jos välilehti vaihtui muuten kuin painikkeesta — skannattu kilpi
  // vaihtaa sen — ja silloin lomake tarjoaisi lajia jota sen omat painikkeet eivät näytä.
  // Tarkistus on avauksessa eikä välilehden vaihdossa, jolloin se pätee joka reitillä.
  const avaaLomake = () => {
    setLomakeAuki((auki) => !auki);
    setLomake((l) => (lajiValinnat.includes(l.laji) ? l : { ...TYHJA_LOMAKE, laji: lajiValinnat[0] }));
  };

  const maar = LAJIT[lomake.laji];

  const valitse = (id: string) => setValitut((edellinen) => {
    const uusi = new Set(edellinen);
    if (uusi.has(id)) uusi.delete(id);
    else uusi.add(id);
    return uusi;
  });

  // Kilpien haku. Koodit haetaan yksi kerrallaan palvelimelta (POST /api/qr), samoin kuin
  // kierrospohjien tarroissa — epäonnistunut haku jättää kilven ilman koodia eikä kaada
  // koko arkkia.
  const avaaKilvet = async (esineet: KalustoTietue[]) => {
    if (esineet.length === 0) return;
    setKilvetLataa(true);
    setKilvet(esineet.map((e) => ({ tunnus: e.tunnus, nimi: e.nimi })));
    const haetut: TulostettavaKilpimerkki[] = [];
    for (const esine of esineet) {
      haetut.push({
        tunnus: esine.tunnus,
        nimi: esine.nimi,
        qrDataUri: (await haeQrKoodi(tarranOsoite(esine.tunnus))) || undefined,
      });
    }
    setKilvet(haetut);
    setKilvetLataa(false);
  };

  const laheta = async () => {
    setVirhe(null);
    setTyoskentelee(true);
    try {
      const runko: UusiKalusto = {
        laji: lomake.laji,
        alalaji: lomake.alalaji,
        nimi: lomake.nimi,
        kuvaus: lomake.kuvaus,
        sarjanumero: lomake.sarjanumero,
        lisatiedot: lomake.lisatiedot,
        sijoitus: {
          laji: lomake.sijoitusLaji,
          id: lomake.sijoitusLaji === 'holvi' ? null : lomake.sijoitusId,
        },
        kappaletta: lomake.kappaletta,
      };
      const tulos = await luoKalustoa(runko);
      if (!tulos.ok) {
        setVirhe(tulos.error || 'Lisäys epäonnistui.');
        return;
      }
      setLomakeAuki(false);
      setLomake(TYHJA_LOMAKE);
      onMuuttui();
      // Uudet esineet suoraan kilpitulostukseen: jokainen niistä tarvitsee kilven, ja
      // erikseen etsiminen listalta on se vaihe jossa se jää tekemättä.
      if (tulos.esineet?.length) avaaKilvet(tulos.esineet);
    } finally {
      setTyoskentelee(false);
    }
  };

  const ratkaise = async (esine: KalustoTietue, hyvaksy: boolean) => {
    setVirhe(null);
    const tulos = await ratkaisePyynto(esine.id, hyvaksy, hylkaykset[esine.id]);
    if (!tulos.ok) setVirhe(tulos.error || 'Toiminto epäonnistui.');
    else {
      setHylkaykset((h) => { const uusi = { ...h }; delete uusi[esine.id]; return uusi; });
      onMuuttui();
    }
  };

  // Välilehden vaihto nollaa suodattimet ja sulkee lomakkeen. Suodattimet ovat yhteiset,
  // ja toiselta välilehdeltä jäänyt rajaus näyttäisi tyhjää listaa ilman näkyvää syytä.
  const vaihdaValilehti = (uusi: Valilehti) => {
    setValilehti(uusi);
    setHaku('');
    setLajiSuodatin('kaikki');
    setSijoitusSuodatin('kaikki');
    setTilaSuodatin('kaytossa');
    setLomakeAuki(false);
    setLomake(TYHJA_LOMAKE);
    setValitut(new Set());
  };

  const suljeKortti = () => {
    setAvattu(null);
    if (skannattu) onAvausKasitelty?.();
  };

  const suljeKilvet = () => {
    setKilvet(null);
    setValitut(new Set());
  };

  // Skannattu kilpi vie sille välilehdelle jolle esine kuuluu. Ilman tätä avaimen
  // skannaaminen avaisi kortin oikein, mutta kortin sulkemisen jälkeen esine ei olisi
  // siinä listassa jota katsotaan — kentällä se näyttäisi siltä että avain katosi.
  // Ehto vertaa nykyiseen välilehteen, joten toistuva render ei vaihda mitään.
  useEffect(() => {
    if (!skannattu) return;
    const kuuluu: Valilehti = onAvainlaji(skannattu.laji) ? 'avaimet' : 'kalusto';
    if (valilehti !== kuuluu) setValilehti(kuuluu);
  }, [skannattu, valilehti]);

  // Takaisin-nappi sulkee päällimmäisen modaalin eikä vaihda näkymää. Molemmat esteet
  // ovat TÄÄLLÄ eivätkä modaaleissa itsessään: hook työntää historiamerkinnän
  // mount-efektissä ja kuluttaa sen siivouksessa, ja StrictModen mount → siivous → mount
  // -pari sulkisi vasta avatun modaalin välittömästi. Aina mountattu vanhempi näkee
  // kaksoisajon silloin kun lippu on vielä false, eikä hook tee mitään.
  useTakaisinEste(!!avattuEsine, suljeKortti);
  useTakaisinEste(!!kilvet, suljeKilvet);

  return (
    <div>
      <TakaisinLinkki onClick={onTakaisin}>Takaisin etusivulle</TakaisinLinkki>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-ink-strong mb-1">Kalustopankki</h2>
        <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
          Yrityksen koko kalusto yhtenä rekisterinä. Jokaisella esineellä on oma tunnus ja
          kilpimerkki, ja pankista jyvitetään tavaraa kohteille ja vartijoille. Avaimet ja
          avainkaapit ovat omalla välilehdellään, koska niitä on eniten ja ne haetaan
          holvipaikan numerolla.
          {!saaHallita && ' Sinulla on lukuoikeus: voit pyytää kalustoa kohteelle, mutta jyvityksen tekee pääkäyttäjä.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5 border-b border-line-soft">
        <Valilehtinappi
          aktiivinen={valilehti === 'kalusto'} onClick={() => vaihdaValilehti('kalusto')}
          ikoni={<Boxes size={15} />} nimi="Kalusto" luku={muitaEsineita}
        />
        <Valilehtinappi
          aktiivinen={avainlehti} onClick={() => vaihdaValilehti('avaimet')}
          ikoni={<KeyRound size={15} />} nimi="Avaimet" luku={avaimia}
        />
        <Valilehtinappi
          aktiivinen={valilehti === 'pyynnot'} onClick={() => vaihdaValilehti('pyynnot')}
          ikoni={<ClipboardList size={15} />} nimi="Pyynnöt" luku={pyynnot.length}
          korosta={pyynnot.length > 0}
        />
        <Valilehtinappi
          aktiivinen={valilehti === 'henkilot'} onClick={() => vaihdaValilehti('henkilot')}
          ikoni={<Users size={15} />} nimi="Henkilöt" luku={henkiloittain.length}
        />
      </div>

      {virhe && (
        <div className="text-sm bg-danger-soft text-danger-ink border border-danger/30 rounded-lg px-3 py-2 mb-4">
          {virhe}
        </div>
      )}

      {/* Skannattu kilpi jonka tunnusta ei ole pankissa. Tämä on kerrottava ääneen:
          hiljainen epäonnistuminen näyttäisi siltä kuin skannaus ei olisi mennyt läpi,
          ja vartija lukisi saman kilven uudelleen. Syy on yleensä poistettu tietue tai
          toisesta järjestelmästä peräisin oleva tarra. */}
      {avaaTunnus && ladattu && !skannattu && (
        <div className="flex items-start justify-between gap-3 text-sm bg-warning-soft text-warning-ink border border-warning/30 rounded-lg px-3 py-2 mb-4">
          <span>
            Kilven tunnusta <span className="font-mono font-bold">{avaaTunnus}</span> ei
            löydy pankista. Tarra voi olla vanha tai esine poistettu rekisteristä.
          </span>
          <button type="button" onClick={() => onAvausKasitelty?.()} aria-label="Sulje ilmoitus">
            <X size={15} />
          </button>
        </div>
      )}

      {kadonneet.length > 0 && onKalustolehti && (
        <button
          type="button"
          onClick={() => { setTilaSuodatin('kadonnut'); setLajiSuodatin('kaikki'); setSijoitusSuodatin('kaikki'); }}
          className="flex items-center gap-2 text-sm bg-danger-soft text-danger-ink border border-danger/30 rounded-lg px-3 py-2 mb-4 w-full text-left"
        >
          <TriangleAlert size={15} />
          {kadonneet.length === 1 ? '1 esine on merkitty kadonneeksi' : `${kadonneet.length} esinettä on merkitty kadonneeksi`}
          {' '}— näytä ne
        </button>
      )}

      {/* ============ KALUSTO JA AVAIMET (sama näkymä, eri pohjalista) ============ */}
      {onKalustolehti && (
        <>
          {/* Missä avaimet ovat, yhtenä rivinä. Luvut ovat myös suodattimia: "kaapeissa
              12" on kysymys johon vastataan näyttämällä ne kaksitoista, ei kertomalla
              lukua. Vain avainlehdellä — muulla kalustolla sijainti ei ole sama
              täsmäytyskysymys. */}
          {avainlehti && avaintenPaikat.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
              <span className="text-ink-muted">Avaimet:</span>
              {/* Kiinteä järjestys eikä aineiston mukainen: nämä ovat painikkeita joita
                  painetaan toistuvasti, ja paikka joka vaihtuu sen mukaan mitä pankissa
                  sattuu olemaan on painike joka pitää joka kerta etsiä uudestaan. */}
              {(Object.keys(SIJOITUKSEN_SELITE) as SijoitusLaji[]).map((laji) => {
                const luku = avaintenPaikat.get(laji) || 0;
                if (luku === 0) return null;
                return (
                  <button
                    key={laji}
                    type="button"
                    onClick={() => { setSijoitusSuodatin(laji); setTilaSuodatin('kaikki'); }}
                    className={`px-2.5 py-1 rounded-lg border text-sm transition-colors ${
                      sijoitusSuodatin === laji
                        ? 'bg-accent text-white border-accent'
                        : 'border-line text-ink-body hover:bg-sunken'
                    }`}
                  >
                    {SIJOITUKSEN_SELITE[laji]} <span className="font-bold">{luku}</span>
                  </button>
                );
              })}
              {sijoitusSuodatin !== 'kaikki' && (
                <button
                  type="button"
                  onClick={() => setSijoitusSuodatin('kaikki')}
                  className="px-2.5 py-1 rounded-lg text-sm text-ink-muted hover:bg-sunken"
                >
                  Kaikki
                </button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[12rem]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={haku}
                onChange={(e) => setHaku(e.target.value)}
                placeholder={avainlehti
                  ? 'Holvipaikka, tunnus, nimi tai kohde'
                  : 'Tunnus, nimi, sarjanumero tai haltija'}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
              />
            </div>
            <select
              value={lajiSuodatin}
              onChange={(e) => setLajiSuodatin(e.target.value as Laji | 'kaikki')}
              className="px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
            >
              <option value="kaikki">{avainlehti ? 'Avaimet ja kaapit' : 'Kaikki lajit'}</option>
              {lajiValinnat.map((laji) => (
                <option key={laji} value={laji}>{LAJIT[laji].monikko}</option>
              ))}
            </select>
            <select
              value={sijoitusSuodatin}
              onChange={(e) => setSijoitusSuodatin(e.target.value as SijoitusLaji | 'kaikki')}
              className="px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
            >
              <option value="kaikki">Kaikki sijainnit</option>
              {(Object.keys(SIJOITUKSEN_SELITE) as SijoitusLaji[]).map((laji) => (
                <option key={laji} value={laji}>{SIJOITUKSEN_SELITE[laji]}</option>
              ))}
            </select>
            <select
              value={tilaSuodatin}
              onChange={(e) => setTilaSuodatin(e.target.value as KalustonTila | 'kaikki')}
              className="px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
            >
              {(Object.keys(TILAN_SELITE) as KalustonTila[]).map((tila) => (
                <option key={tila} value={tila}>{TILAN_SELITE[tila]}</option>
              ))}
              <option value="kaikki">Kaikki tilat</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {saaHallita && (
              <button
                type="button"
                onClick={avaaLomake}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95"
              >
                <Plus size={15} />
                {avainlehti ? 'Lisää avain tai kaappi' : 'Lisää kalustoa'}
              </button>
            )}
            {/* Avainerä vain avainlehdellä: se kirjaa pelkkiä avaimia, eikä painike kuulu
                näkymään jossa avaimia ei ole. */}
            {saaHallita && avainlehti && (
              <button
                type="button"
                // Uusi selainvälilehti eikä näkymänvaihto: taulukko tarvitsee koko
                // ruudun leveyden, ja pankki jää auki taustalle. Palattaessa lista on
                // yhä siinä mihin se jäi, ja uudet avaimet ilmestyvät kanavan kautta.
                onClick={() => window.open(AVAINERAPOLKU, '_blank', 'noopener')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken"
              >
                <Table2 size={15} />
                Kirjaa avainerä
              </button>
            )}
            {valitut.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => avaaKilvet(kalusto.filter((e) => valitut.has(e.id)))}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken"
                >
                  <Printer size={15} />
                  Tulosta {valitut.size} {valitut.size === 1 ? 'kilpi' : 'kilpeä'}
                </button>
                <button
                  type="button"
                  onClick={() => setValitut(new Set())}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-ink-muted hover:bg-sunken"
                >
                  <X size={15} />
                  Tyhjennä valinta
                </button>
              </>
            )}
          </div>

          {lomakeAuki && saaHallita && (
            <div className="border border-line rounded-xl p-4 mb-5 bg-surface space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Laji</label>
                <div className="flex flex-wrap gap-2">
                  {lajiValinnat.map((laji) => {
                    const Ikoni = LAJIT[laji].ikoni;
                    return (
                      <button
                        key={laji}
                        type="button"
                        onClick={() => setLomake((l) => ({ ...l, laji, alalaji: '', lisatiedot: {} }))}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          lomake.laji === laji
                            ? 'bg-accent text-white border-accent'
                            : 'border-line text-ink-body hover:bg-sunken'
                        }`}
                      >
                        <Ikoni size={14} />
                        {LAJIT[laji].nimi}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-ink-muted mt-2">
                  {maar.kuvaus} Tunnukset alkavat <span className="font-mono">TJ-{maar.koodi}-</span>.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <LomakeKentta otsikko="Nimi">
                  <input
                    value={lomake.nimi}
                    onChange={(e) => setLomake((l) => ({ ...l, nimi: e.target.value }))}
                    placeholder="Talvitakki L"
                    className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                  />
                </LomakeKentta>
                <LomakeKentta otsikko="Tyyppi">
                  <input
                    value={lomake.alalaji}
                    list="kalusto-alalajit"
                    onChange={(e) => setLomake((l) => ({ ...l, alalaji: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                  />
                  <datalist id="kalusto-alalajit">
                    {maar.alalajit.map((a) => <option key={a} value={a} />)}
                  </datalist>
                </LomakeKentta>
                {maar.sarjanumero !== 'ei' && (
                  <LomakeKentta
                    otsikko={`Sarjanumero${maar.sarjanumero === 'pakollinen' ? ' (pakollinen)' : ''}`}
                    vihje={lomake.kappaletta > 1 ? 'Jätetään tyhjäksi erää luotaessa — sarjanumero on esinekohtainen.' : undefined}
                  >
                    <input
                      value={lomake.sarjanumero}
                      disabled={lomake.kappaletta > 1}
                      onChange={(e) => setLomake((l) => ({ ...l, sarjanumero: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body disabled:opacity-50"
                    />
                  </LomakeKentta>
                )}
                <LomakeKentta otsikko="Kappalemäärä" vihje="Jokainen kappale saa oman tunnuksen ja kilven.">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={lomake.kappaletta}
                    onChange={(e) => setLomake((l) => ({ ...l, kappaletta: Math.max(1, Number(e.target.value) || 1) }))}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                  />
                </LomakeKentta>
                {maar.lisakentat.map((kentta) => (
                  <LomakeKentta
                    key={kentta.avain}
                    otsikko={`${kentta.otsikko}${kentta.pakollinen ? ' (pakollinen)' : ''}`}
                    vihje={kentta.vihje}
                  >
                    {kentta.totuusarvo ? (
                      <label className="flex items-center gap-2 text-sm text-ink-body py-2">
                        <input
                          type="checkbox"
                          checked={lomake.lisatiedot[kentta.avain] === true}
                          onChange={(e) => setLomake((l) => ({
                            ...l, lisatiedot: { ...l.lisatiedot, [kentta.avain]: e.target.checked },
                          }))}
                        />
                        Kyllä
                      </label>
                    ) : (
                      <input
                        value={String(lomake.lisatiedot[kentta.avain] ?? '')}
                        onChange={(e) => setLomake((l) => ({
                          ...l, lisatiedot: { ...l.lisatiedot, [kentta.avain]: e.target.value },
                        }))}
                        className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                      />
                    )}
                  </LomakeKentta>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <LomakeKentta otsikko="Sijoitus">
                  <select
                    value={lomake.sijoitusLaji}
                    onChange={(e) => setLomake((l) => ({
                      ...l, sijoitusLaji: e.target.value as SijoitusLaji, sijoitusId: '',
                    }))}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                  >
                    <option value="holvi">Holvi</option>
                    <option value="kohde">Kohde</option>
                  </select>
                </LomakeKentta>
                {lomake.sijoitusLaji === 'kohde' && (
                  <LomakeKentta otsikko="Kohde">
                    <select
                      value={lomake.sijoitusId}
                      onChange={(e) => setLomake((l) => ({ ...l, sijoitusId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                    >
                      <option value="">Valitse kohde…</option>
                      {kohteet.map((k) => <option key={k.id} value={k.id}>{k.nimi}</option>)}
                    </select>
                  </LomakeKentta>
                )}
              </div>

              <p className="text-xs text-ink-muted">
                Henkilölle luovutus tehdään lisäyksen jälkeen esineen kortista — silloin
                siitä jää luovutusmerkintä, ja tosite tulostuu Henkilöt-välilehdeltä.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={tyoskentelee}
                  onClick={laheta}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95 disabled:opacity-50"
                >
                  {lomake.kappaletta > 1 ? `Lisää ${lomake.kappaletta} kpl` : 'Lisää pankkiin'}
                </button>
                <button
                  type="button"
                  onClick={() => { setLomakeAuki(false); setLomake(TYHJA_LOMAKE); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken"
                >
                  Peruuta
                </button>
              </div>
            </div>
          )}

          {!ladattu ? (
            <p className="text-sm text-ink-muted">Haetaan kalustoa…</p>
          ) : nakyvat.length === 0 ? (
            <TyhjaTila
              otsikko={pohja.length === 0
                ? (avainlehti ? 'Avaimia ei ole vielä kirjattu' : 'Kalustoa ei ole vielä kirjattu')
                : 'Ei osumia'}
              teksti={pohja.length === 0
                ? (avainlehti
                  ? 'Jokainen avain saa holvista pysyvän paikan numerosta 1000 alkaen. Kymmeniä avaimia kerralla kirjataan avainerälomakkeella.'
                  : 'Lisää ensimmäinen esine. Jokainen saa oman tunnuksen ja kilpimerkin, jonka voi tulostaa heti.')
                : 'Kokeile toista hakusanaa tai laajenna suodatusta.'}
            />
          ) : (
            <ul className="space-y-2">
              {nakyvat.map((esine) => {
                const Ikoni = LAJIT[esine.laji]?.ikoni || Boxes;
                return (
                  <li key={esine.id} className="flex items-center gap-3 bg-surface border border-line-soft rounded-lg px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={valitut.has(esine.id)}
                      onChange={() => valitse(esine.id)}
                      aria-label={`Valitse ${esine.tunnus} kilpitulostukseen`}
                      className="shrink-0"
                    />
                    <button
                      type="button"
                      onClick={() => setAvattu(esine.id)}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left"
                    >
                      <Ikoni size={18} className="text-ink-muted shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-ink-strong truncate">{esine.nimi}</span>
                        <span className="block text-xs text-ink-muted font-mono">
                          {esine.tunnus}
                          {/* Holvipaikka on avaimen tunnus kirjanpidossa, ja se on se
                              numero jolla avainta puhelimessa etsitään. */}
                          {typeof esine.holviPaikka === 'number' && (' · holvi ' + esine.holviPaikka)}
                        </span>
                      </span>
                      <span className="hidden sm:block text-sm text-ink-body shrink-0 max-w-[10rem] truncate">
                        {sijainti(esine)}
                      </span>
                      {esine.pyynto && (
                        <span className="shrink-0 px-2 py-0.5 rounded-md text-xs font-bold border bg-warning-soft text-warning-ink border-warning/30">
                          Pyyntö
                        </span>
                      )}
                      {esine.tila !== 'kaytossa' && (
                        <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-bold border ${TILAN_VARI[esine.tila]}`}>
                          {TILAN_SELITE[esine.tila]}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* ================= PYYNNÖT ================= */}
      {valilehti === 'pyynnot' && (
        pyynnot.length === 0 ? (
          <TyhjaTila
            otsikko="Ei avoimia pyyntöjä"
            teksti={saaHallita
              ? 'Kun vuoroesimies pyytää kalustoa kohteelle, pyyntö ilmestyy tähän ratkaistavaksi.'
              : 'Voit pyytää kalustoa kohteelle esineen kortista tai kohteen kalustorekisteristä.'}
          />
        ) : (
          <ul className="space-y-3">
            {pyynnot.map((esine) => (
              <li key={esine.id} className="bg-surface border border-line-soft rounded-lg p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setAvattu(esine.id)}
                      className="font-medium text-ink-strong hover:text-accent text-left"
                    >
                      {esine.nimi}
                    </button>
                    <p className="text-xs text-ink-muted font-mono">{esine.tunnus}</p>
                    <p className="text-sm text-ink-body mt-2">
                      <span className="font-medium">{esine.pyynto?.kohdeNimi}</span>
                      {' — '}{esine.pyynto?.perustelu}
                    </p>
                    <p className="text-xs text-ink-muted mt-1">
                      {esine.pyynto?.pyytaja} · {aikaleima(esine.pyynto?.luotu)} · nyt: {sijainti(esine)}
                    </p>
                  </div>
                </div>
                {saaHallita && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-line-soft">
                    <button
                      type="button"
                      onClick={() => ratkaise(esine, true)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95"
                    >
                      Hyväksy ja siirrä
                    </button>
                    <input
                      value={hylkaykset[esine.id] || ''}
                      onChange={(e) => setHylkaykset((h) => ({ ...h, [esine.id]: e.target.value }))}
                      placeholder="Hylkäyksen syy"
                      className="flex-1 min-w-[10rem] px-3 py-1.5 rounded-lg border border-line bg-surface text-sm text-ink-body"
                    />
                    <button
                      type="button"
                      onClick={() => ratkaise(esine, false)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken"
                    >
                      Hylkää
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      {/* ================= HENKILÖT ================= */}
      {valilehti === 'henkilot' && (
        henkiloittain.length === 0 ? (
          <TyhjaTila
            otsikko="Kenelläkään ei ole kalustoa"
            teksti="Kun esine siirretään henkilölle, se näkyy täällä ja siitä voi tulostaa luovutustositteen allekirjoitettavaksi."
          />
        ) : (
          <ul className="space-y-4">
            {henkiloittain.map((henkilo) => {
              const tyontekija = tyontekijat.find((t) => t.id === henkilo.id);
              const tunniste = muotoileTunniste(tyontekija?.displayId);
              return (
                <li key={henkilo.id} className="bg-surface border border-line-soft rounded-lg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-bold text-ink-strong">
                        {henkilo.nimi}
                        {tunniste && <span className="text-ink-muted font-normal"> {tunniste}</span>}
                      </h3>
                      <p className="text-xs text-ink-muted">
                        {henkilo.esineet.length === 1 ? '1 esine' : `${henkilo.esineet.length} esinettä`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => tulostaLuovutuslomake({
                        vastaanottaja: { nimi: henkilo.nimi, displayId: tyontekija?.displayId },
                        esineet: henkilo.esineet,
                        luovuttaja: omaNimi,
                      })}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken"
                    >
                      <Printer size={15} />
                      Luovutustosite
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {henkilo.esineet.map((esine) => (
                      <li key={esine.id}>
                        <button
                          type="button"
                          onClick={() => setAvattu(esine.id)}
                          className="w-full flex items-center gap-2 text-left text-sm py-1 hover:text-accent"
                        >
                          <span className="font-mono text-xs text-ink-muted shrink-0">{esine.tunnus}</span>
                          <span className="text-ink-body truncate">{esine.nimi}</span>
                          {esine.tila !== 'kaytossa' && (
                            <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-bold border ${TILAN_VARI[esine.tila]}`}>
                              {TILAN_SELITE[esine.tila]}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )
      )}

      {avattuEsine && (
        <KalustoKortti
          esine={avattuEsine}
          kohteet={kohteet}
          tyontekijat={tyontekijat}
          kantajat={kantajat}
          kalusto={kalusto}
          saaHallita={saaHallita}
          omaTunnus={omaTunnus}
          onMuuttui={onMuuttui}
          onSulje={suljeKortti}
          onTulostaKilpi={(esine) => avaaKilvet([esine])}
        />
      )}

      {kilvet && (
        <KilpiEsikatselu
          kilvet={kilvet}
          lataa={kilvetLataa}
          onTulosta={() => tulostaDokumentti(kilpimerkkiDokumentti({ kilvet }))}
          onSulje={suljeKilvet}
        />
      )}
    </div>
  );
};

const Valilehtinappi = ({ aktiivinen, onClick, ikoni, nimi, luku, korosta }: {
  aktiivinen: boolean;
  onClick: () => void;
  ikoni: ReactNode;
  nimi: string;
  luku: number;
  korosta?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
      aktiivinen
        ? 'border-accent text-accent'
        : 'border-transparent text-ink-muted hover:text-ink-body'
    }`}
  >
    {ikoni}
    {nimi}
    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
      korosta ? 'bg-warning-soft text-warning-ink' : 'bg-sunken text-ink-muted'
    }`}
    >
      {luku}
    </span>
  </button>
);

const LomakeKentta = ({ otsikko, vihje, children }: {
  otsikko: string; vihje?: string; children: ReactNode;
}) => (
  <div>
    <label className="block text-xs font-medium text-ink-muted mb-1">{otsikko}</label>
    {children}
    {vihje && <p className="text-xs text-ink-muted mt-1">{vihje}</p>}
  </div>
);

const TyhjaTila = ({ otsikko, teksti }: { otsikko: string; teksti: string }) => (
  <div className="bg-sunken border border-line-soft rounded-xl p-8 text-center">
    <p className="font-medium text-ink-strong mb-1">{otsikko}</p>
    <p className="text-sm text-ink-muted max-w-md mx-auto">{teksti}</p>
  </div>
);
