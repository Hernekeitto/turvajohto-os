import { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Pencil, Trash2, MapPin, Phone, Building2, GraduationCap, ClipboardList, FileText, ShieldAlert, Info, Settings } from 'lucide-react';
import { useSession } from '../SessionContext';
import { canView, canEdit } from '../shared/oikeudet';
import { jaotteleSailytysajan } from '../shared/sailytysaika';
import { Ylapalkki } from '../shared/komponentit/Ylapalkki';
import { KohteenHallinta } from './KohteenHallinta';
import { Tehtavat } from './Tehtavat';
import { Raportit } from './Raportit';
import { KohteenTiedot } from './KohteenTiedot';
import { Asetukset } from './Asetukset';
import { uusiId, type GuardRaportti, type Kohde, type KohteenTiedosto, type RaporttiTyyppi, type TehtavaSuoritus } from './tyypit';

// Turvajohto GUARD -puolen juurikomponentti. Vastaa näkymien välisestä vaihdosta ja
// kohdedatan lataamisesta; yksittäiset näkymät ovat omissa tiedostoissaan, jotta tänne
// ei synny toista App.tsx:ää.
//
// Kohteet ovat guardSites-kokoelmassa (server/store.js). Kohteen id toimii samana
// oikeusavaimena kuin tapahtuman id EVENT-puolella, joten käyttäjän rajaus tiettyihin
// kohteisiin toimii samalla eventAccess-listalla.

const tyhjaKohde = (): Kohde => ({
  id: '',
  name: '',
  address: '',
  contactName: '',
  contactPhone: '',
  notes: '',
  perehdytykset: [],
  tehtavat: [],
});

export default function GuardApp() {
  const session = useSession();
  const isAdmin = session?.role === 'admin';
  const perms = session?.permissions || {};
  // Kohdevalinta on globaali solmu (ks. server/permissions.js: GLOBAL_NODES), joten
  // tarkistus tehdään aina __default__-asetusta vasten — siksi eventId on null.
  const saaNahda = isAdmin || canView(perms, null, 'guard_sites');
  const saaMuokata = isAdmin || canEdit(perms, null, 'guard_sites');
  // Tehtävien kuittaus on oma oikeutensa: vartija kuittaa tehtäviä mutta ei välttämättä
  // saa muokata kohteen perustietoja.
  const saaNahdaTehtavat = isAdmin || canView(perms, null, 'guard_tasks');
  const saaKuitata = isAdmin || canEdit(perms, null, 'guard_tasks');
  const saaNahdaTiedot = isAdmin || canView(perms, null, 'guard_site_info');
  // Raportointi on jaettu lomaketyypeittäin: tapahtumailmoitus sisältää kohdehenkilötiedot
  // ja voi olla eri joukolla ihmisiä kuin päivittäinen toimenpidekirjaus.
  const saaKirjataToimenpiteen = isAdmin || canEdit(perms, null, 'guard_report_action');
  const saaKirjataIlmoituksen = isAdmin || canEdit(perms, null, 'guard_report_jv');
  // Sovellusasetukset on oma solmunsa (guard_settings), ei EVENTin 'settings': muuten
  // toisen puolen asetusoikeus avaisi myös tämän puolen asetukset.
  const saaNahdaAsetukset = isAdmin || canView(perms, null, 'guard_settings');
  const saaNahdaRaportit = isAdmin
    || canView(perms, null, 'guard_site_info')
    || canView(perms, null, 'guard_report_action')
    || canView(perms, null, 'guard_report_jv');

  const [kohteet, setKohteet] = useState<Kohde[]>([]);
  // Ladattu vasta onnistuneen haun jälkeen. Tallennus on estetty siihen asti: ilman tätä
  // epäonnistunut haku (verkkovirhe, oikeuksien puute) jättäisi tilan tyhjäksi ja
  // seuraava tallennus pyyhkisi koko kokoelman palvelimelta. Sama suoja kuin App.tsx:ssä.
  const [ladattu, setLadattu] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tallentaa, setTallentaa] = useState(false);
  // null = lista näkyvissä, muuten muokattavana oleva kohde (uudella id === '').
  const [lomake, setLomake] = useState<Kohde | null>(null);
  const [poistettava, setPoistettava] = useState<Kohde | null>(null);
  // Työntekijäpankki perehdytysvalintaa varten. Jää tyhjäksi jos käyttäjällä ei ole
  // siihen lukuoikeutta — silloin perehdytettävän nimi kirjoitetaan käsin.
  const [tyontekijat, setTyontekijat] = useState<{ id?: string; name?: string; displayId?: number | null }[]>([]);
  const [tiedostot, setTiedostot] = useState<KohteenTiedosto[]>([]);
  const [tiedostotLadattu, setTiedostotLadattu] = useState(false);
  const [suoritukset, setSuoritukset] = useState<TehtavaSuoritus[]>([]);
  // Kohde jonka tehtäviä ollaan kuittaamassa. Erillinen lomake-tilasta: sama kohde voi
  // olla auki joko hallintaa tai kuittausta varten, eikä niitä pidä sekoittaa.
  const [tehtavaKohde, setTehtavaKohde] = useState<Kohde | null>(null);
  const [raportit, setRaportit] = useState<GuardRaportti[]>([]);
  const [raporttiKohde, setRaporttiKohde] = useState<{ kohde: Kohde; tyyppi: RaporttiTyyppi } | null>(null);
  const [tietoKohde, setTietoKohde] = useState<Kohde | null>(null);
  const [asetuksissa, setAsetuksissa] = useState(false);

  useEffect(() => {
    if (!saaNahda) return;
    fetch('/api/data/guardSites', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true) {
          if (Array.isArray(res.data)) setKohteet(res.data);
          setLadattu(true);
        } else {
          setVirhe('Kohteita ei voitu hakea palvelimelta.');
        }
      })
      .catch(() => setVirhe('Kohteita ei voitu hakea: ei yhteyttä palvelimeen.'));
  }, [saaNahda]);

  useEffect(() => {
    if (!saaNahda) return;
    // 403 on tässä normaali lopputulos eikä virhe: kaikilla GUARD-käyttäjillä ei ole
    // oikeutta koko yrityksen työntekijärekisteriin. Silloin perehdytyslistaan
    // kirjoitetaan nimi käsin.
    fetch('/api/data/employees', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true && Array.isArray(res.data)) setTyontekijat(res.data);
      })
      .catch(() => { /* ei kriittinen */ });
  }, [saaNahda]);

  useEffect(() => {
    if (!saaNahda) return;
    fetch('/api/data/guardFiles', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true) {
          if (Array.isArray(res.data)) setTiedostot(res.data);
          setTiedostotLadattu(true);
        }
      })
      .catch(() => { /* virhe näkyy tiedostovälilehdellä tyhjänä listana */ });
  }, [saaNahda]);

  useEffect(() => {
    if (!saaNahdaTehtavat) return;
    fetch('/api/data/guardTaskRuns', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true && Array.isArray(res.data)) setSuoritukset(res.data);
      })
      .catch(() => { /* virhe näkyy tyhjänä suorituslistana */ });
  }, [saaNahdaTehtavat]);

  useEffect(() => {
    if (!saaNahdaRaportit) return;
    fetch('/api/data/guardReports', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true && Array.isArray(res.data)) setRaportit(res.data);
      })
      .catch(() => { /* virhe näkyy tyhjänä raporttilistana */ });
  }, [saaNahdaRaportit]);

  // Raportti lisätään uutena tietueena samalla periaatteella kuin tehtäväsuoritus:
  // kirjattua raporttia ei muokata jälkikäteen, vaan tarvittaessa kirjataan uusi.
  const tallennaRaportti = async (raportti: GuardRaportti) => {
    const uudet = [...raportit, raportti];
    try {
      const r = await fetch('/api/data/guardReports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(uudet),
      });
      const res = await r.json().catch(() => null);
      if (r.ok && res?.ok) {
        setRaportit(uudet);
        return true;
      }
      setVirhe(res?.error || 'Raportin tallennus epäonnistui.');
      return false;
    } catch {
      setVirhe('Raportin tallennus epäonnistui: ei yhteyttä palvelimeen.');
      return false;
    }
  };

  // Tehtäväsuoritus lisätään aina uutena tietueena eikä koskaan korvaa aiempaa: sama
  // kierros ajetaan joka vuorossa uudelleen, ja jokainen kerta on oma merkintänsä lokissa.
  const suoritaTehtava = async (suoritus: TehtavaSuoritus) => {
    const uudet = [...suoritukset, suoritus];
    try {
      const r = await fetch('/api/data/guardTaskRuns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(uudet),
      });
      const res = await r.json().catch(() => null);
      if (r.ok && res?.ok) {
        setSuoritukset(uudet);
        return true;
      }
      setVirhe(res?.error || 'Suorituksen kirjaus epäonnistui.');
      return false;
    } catch {
      setVirhe('Suorituksen kirjaus epäonnistui: ei yhteyttä palvelimeen.');
      return false;
    }
  };

  // Tiedoston lisäys on kaksivaiheinen: itse tiedosto menee uploads-hakemistoon ja siitä
  // saatu id tallennetaan guardFiles-kokoelmaan. Jos jälkimmäinen epäonnistuu, liite jää
  // orvoksi levylle — palvelimen roskienkeruu siivoaa sen armonajan jälkeen (uploads.js).
  const lisaaTiedosto = async (tiedosto: File) => {
    if (!lomake?.id) throw new Error('Tallenna kohde ennen tiedostojen lisäämistä.');
    if (!tiedostotLadattu) throw new Error('Tiedostoja ei ole vielä ladattu — yritä hetken kuluttua uudelleen.');
    const lomakedata = new FormData();
    lomakedata.append('file', tiedosto);
    const lataus = await fetch('/api/uploads', { method: 'POST', credentials: 'include', body: lomakedata });
    const latausRes = await lataus.json().catch(() => null);
    if (!lataus.ok || !latausRes?.ok) {
      throw new Error(latausRes?.error || 'Tiedoston lähetys epäonnistui.');
    }
    const merkinta: KohteenTiedosto = {
      id: uusiId(),
      siteId: lomake.id,
      name: latausRes.name || tiedosto.name,
      uploadId: latausRes.id,
      size: latausRes.size,
      lisatty: new Date().toISOString(),
      lisaaja: session?.nickname || undefined,
    };
    const uudet = [...tiedostot, merkinta];
    const r = await fetch('/api/data/guardFiles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(uudet),
    });
    const res = await r.json().catch(() => null);
    if (!r.ok || !res?.ok) throw new Error(res?.error || 'Tiedoston tallennus epäonnistui.');
    setTiedostot(uudet);
  };

  // Pohjakartta EI mene guardFiles-kokoelmaan vaan kohteen omaan kenttään, samoin kuin
  // tapahtuman kartta (App.tsx: tallennaPohjakartta). Se ei ole kohteen asiakirja vaan
  // se pinta jonka päälle vyöhykkeet piirretään, eikä sen kuulu näkyä tiedostolistassa.
  // Kartta tallentuu kohteen mukana vasta kun kohde tallennetaan.
  const lataaKartta = async (tiedosto: File) => {
    const lomakedata = new FormData();
    lomakedata.append('file', tiedosto);
    const lataus = await fetch('/api/uploads', { method: 'POST', credentials: 'include', body: lomakedata });
    const latausRes = await lataus.json().catch(() => null);
    if (!lataus.ok || !latausRes?.ok) {
      throw new Error(latausRes?.error || 'Kartan lähetys epäonnistui.');
    }
    setLomake((edellinen) =>
      edellinen ? { ...edellinen, mapUploadId: latausRes.id, mapUploadName: latausRes.name || tiedosto.name } : edellinen
    );
  };

  const poistaTiedosto = async (id: string) => {
    const jaljelle = tiedostot.filter((t) => t.id !== id);
    const r = await fetch(`/api/data/guardFiles${jaljelle.length === 0 ? '?allowEmpty=1' : ''}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(jaljelle),
    });
    const res = await r.json().catch(() => null);
    if (r.ok && res?.ok) setTiedostot(jaljelle);
    else setVirhe(res?.error || 'Tiedoston poisto epäonnistui.');
  };

  // salliTyhja=true ohittaa palvelimen romahdussuojan, joka muuten hylkää tallennuksen
  // joka korvaisi olemassa olevan datan tyhjällä (server/index.js: wouldWipeNonEmptyCollection).
  // Suoja on oikea oletus — epäonnistunut haku + automaattitallennus voisi muuten pyyhkiä
  // koko kokoelman — mutta VIIMEISEN kohteen tarkoituksellinen poisto on eri asia, ja ilman
  // tätä se epäonnistuisi harhaanjohtavaan virheeseen. HUOM: palvelin hyväksyy allowEmptyn
  // vain adminilta, joten muut eivät voi poistaa viimeistä kohdetta.
  const tallenna = async (uudet: Kohde[], { salliTyhja = false } = {}) => {
    if (!ladattu) {
      setVirhe('Kohteita ei ole vielä ladattu — muutosta ei tallennettu.');
      return false;
    }
    setTallentaa(true);
    setVirhe(null);
    try {
      const r = await fetch(`/api/data/guardSites${salliTyhja ? '?allowEmpty=1' : ''}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(uudet),
      });
      const res = await r.json().catch(() => null);
      if (r.ok && res && res.ok === true) {
        setKohteet(uudet);
        return true;
      }
      setVirhe(`Tallennus epäonnistui: ${(res && res.error) || `virhe ${r.status}`}`);
      return false;
    } catch {
      setVirhe('Tallennus epäonnistui: ei yhteyttä palvelimeen.');
      return false;
    } finally {
      setTallentaa(false);
    }
  };

  const tallennaLomake = async () => {
    if (!lomake) return;
    const nimi = lomake.name.trim();
    if (!nimi) {
      setVirhe('Kohteella on oltava nimi.');
      return;
    }
    const uusi = !lomake.id;
    const kohde: Kohde = { ...lomake, name: nimi, id: lomake.id || uusiId() };
    const uudet = uusi
      ? [...kohteet, kohde]
      : kohteet.map((k) => (k.id === kohde.id ? kohde : k));
    if (await tallenna(uudet)) setLomake(null);
  };

  const poista = async () => {
    if (!poistettava) return;
    const jaljelle = kohteet.filter((k) => k.id !== poistettava.id);
    if (await tallenna(jaljelle, { salliTyhja: jaljelle.length === 0 })) setPoistettava(null);
  };

  // Vanhentuneiden raporttien havitys. Sama kaksivaiheinen vahvistus kuin
  // tapahtumapuolella: poisto on peruuttamaton ja koskee lakisaateisesti sailytettya
  // aineistoa, joten pelkka OK-nappi ei riita.
  const havitaVanhentuneet = async () => {
    const { vanhentuneet } = jaotteleSailytysajan(
      raportit.map((r) => ({ ...r, createdAt: r.luotu || null }))
    );
    if (vanhentuneet.length === 0) return;
    const rivi = String.fromCharCode(10);
    const vahvistus = window.prompt(
      [
        `HÄVITETÄÄN ${vanhentuneet.length} ilmoitusta pysyvästi.`,
        '',
        'Näiden lakisääteinen säilytysaika (2 vuotta laatimisvuoden päättymisestä)',
        'on umpeutunut. Poistoa ei voi perua, ja myös liitetiedostot poistetaan.',
        '',
        'Vahvista kirjoittamalla: HÄVITÄ',
      ].join(rivi)
    );
    if (vahvistus === null) return;
    if (vahvistus.trim().toUpperCase() !== 'HÄVITÄ') {
      window.alert('Vahvistus ei täsmää — mitään ei poistettu.');
      return;
    }
    const poistettavat = new Set(vanhentuneet.map((r: any) => r.id));
    const jaljelle = raportit.filter((r) => !poistettavat.has(r.id));
    try {
      const r = await fetch(`/api/data/guardReports${jaljelle.length === 0 ? '?allowEmpty=1' : ''}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(jaljelle),
      });
      const res = await r.json().catch(() => null);
      if (!r.ok || !res?.ok) {
        setVirhe(res?.error || 'Hävitys epäonnistui.');
        return;
      }
      setRaportit(jaljelle);
      window.alert(`${vanhentuneet.length} ilmoitusta hävitettiin pysyvästi.`);
    } catch {
      setVirhe('Hävitys epäonnistui: ei yhteyttä palvelimeen.');
    }
  };

  const kirjauduUlos = async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    window.location.reload();
  };

  const ylapalkki = (alaotsikko: string) => (
    <Ylapalkki
      tuoteNimi="Turvajohto GUARD"
      alaotsikko={alaotsikko}
      onLogo={() => { setLomake(null); setPoistettava(null); setTehtavaKohde(null); setRaporttiKohde(null); setTietoKohde(null); setAsetuksissa(false); }}
      // GUARD-puolella ei ole vielä ilmoituksia eikä salasananvaihtoa: molemmat odottavat
      // purkamista jaetuksi App.tsx:stä. Uloskirjautuminen toimii jo.
      ilmoitukset={[]}
      onIlmoitus={() => {}}
      nimimerkki={session?.nickname || ''}
      isAdmin={!!isAdmin}
      onLogout={kirjauduUlos}
    />
  );

  if (!saaNahda) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex flex-col">
        {ylapalkki('Vartiointi')}
        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-md bg-surface border border-line rounded-xl p-6 text-center">
            <h2 className="font-bold mb-2 text-ink-strong">Ei näkyvyysoikeutta kohteisiin</h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              Käyttäjätasollasi ei ole oikeutta Kohdevalintaan. Pääkäyttäjä voi lisätä sen
              Sovellusasetusten Käyttäjätasot-osiosta.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      {ylapalkki(
        asetuksissa ? 'Sovellusasetukset'
          : raporttiKohde ? 'Raportointi'
          : tietoKohde ? 'Kohteen tiedot'
          : tehtavaKohde ? 'Työvuoron tehtävät'
          : lomake ? (lomake.id ? 'Kohteen hallinta' : 'Uusi kohde')
          : 'Kohdevalinta'
      )}

      <main className="flex-1 p-6 md:p-10">
        <div className="max-w-5xl mx-auto">
          {virhe && (
            <p className="mb-6 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
              {virhe}
            </p>
          )}

          {asetuksissa ? (
            <Asetukset
              raportit={raportit}
              isAdmin={!!isAdmin}
              onHavita={havitaVanhentuneet}
              onTakaisin={() => setAsetuksissa(false)}
            />
          ) : raporttiKohde ? (
            <Raportit
              kohde={raporttiKohde.kohde}
              tyyppi={raporttiKohde.tyyppi}
              vartija={session?.nickname || ''}
              onTallenna={tallennaRaportti}
              onTakaisin={() => setRaporttiKohde(null)}
            />
          ) : tietoKohde ? (
            <KohteenTiedot
              kohde={tietoKohde}
              tiedostot={tiedostot}
              suoritukset={suoritukset}
              raportit={raportit}
              onTakaisin={() => setTietoKohde(null)}
            />
          ) : tehtavaKohde ? (
            <Tehtavat
              kohde={tehtavaKohde}
              suoritukset={suoritukset}
              vartija={session?.nickname || ''}
              saaKuitata={saaKuitata}
              onSuorita={suoritaTehtava}
              onTakaisin={() => setTehtavaKohde(null)}
            />
          ) : lomake ? (
            <KohteenHallinta
              kohde={lomake}
              onChange={setLomake}
              onTallenna={tallennaLomake}
              onPeruuta={() => setLomake(null)}
              tallentaa={tallentaa}
              tyontekijat={tyontekijat}
              tiedostot={tiedostot.filter((t) => t.siteId === lomake.id)}
              onLisaaTiedosto={lisaaTiedosto}
              onPoistaTiedosto={poistaTiedosto}
              onLataaKartta={lataaKartta}
              saaMuokata={saaMuokata}
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-ink-strong mb-1">Kohteet</h2>
                  <p className="text-sm text-ink-muted">
                    Vartiointikohteet ja niiden perustiedot. Kierrokset, vuorot ja poikkeamat
                    kirjataan aina kohteelle.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {saaNahdaAsetukset && (
                    <button
                      type="button"
                      onClick={() => setAsetuksissa(true)}
                      className="inline-flex items-center gap-2 bg-surface hover:bg-sunken text-ink-body border border-line text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
                    >
                      <Settings size={16} />
                      Sovellusasetukset
                    </button>
                  )}
                  {saaMuokata && (
                    <button
                      type="button"
                      onClick={() => setLomake(tyhjaKohde())}
                      className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
                    >
                      <Plus size={16} />
                      Uusi kohde
                    </button>
                  )}
                </div>
              </div>

              {kohteet.length === 0 ? (
                <div className="bg-surface border border-line rounded-xl p-10 text-center">
                  <Building2 className="w-10 h-10 text-ink-subtle mx-auto mb-4" strokeWidth={1.5} />
                  <p className="text-sm text-ink-muted">
                    {ladattu ? 'Yhtään kohdetta ei ole vielä lisätty.' : 'Ladataan kohteita…'}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {kohteet.map((kohde) => (
                    <div
                      key={kohde.id}
                      className="bg-surface border border-line rounded-xl p-5 flex flex-col"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
                        <h3 className="font-bold text-ink-strong flex-1">{kohde.name}</h3>
                      </div>
                      <div className="space-y-1.5 text-sm text-ink-muted flex-1">
                        {kohde.address && (
                          <p className="flex items-start gap-2">
                            <MapPin size={14} className="shrink-0 mt-0.5" />
                            {kohde.address}
                          </p>
                        )}
                        {(kohde.contactName || kohde.contactPhone) && (
                          <p className="flex items-start gap-2">
                            <Phone size={14} className="shrink-0 mt-0.5" />
                            {[kohde.contactName, kohde.contactPhone].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {kohde.notes && (
                          <p className="text-xs text-ink-subtle pt-1 leading-relaxed">{kohde.notes}</p>
                        )}
                      </div>

                      {/* Kohteen sisältö lukuina: kertoo yhdellä silmäyksellä onko kohde
                          valmis vartioitavaksi vai vasta perustettu. */}
                      {((kohde.perehdytykset?.length || 0) > 0 || (kohde.tehtavat?.length || 0) > 0) && (
                        <div className="flex flex-wrap gap-3 pt-3 text-xs text-ink-muted">
                          {(kohde.perehdytykset?.length || 0) > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                              <GraduationCap size={13} />
                              {kohde.perehdytykset?.length} perehdytetty
                            </span>
                          )}
                          {(kohde.tehtavat?.length || 0) > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                              <ClipboardList size={13} />
                              {kohde.tehtavat?.length} tehtävää
                            </span>
                          )}
                        </div>
                      )}

                      {/* Vartijan päivittäiset toiminnot. Jokainen on oman oikeutensa
                          takana, joten kortti näyttää vain sen mitä käyttäjä voi tehdä. */}
                      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-4 mt-3 border-t border-line-soft">
                        {saaNahdaTehtavat && (kohde.tehtavat?.length || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => setTehtavaKohde(kohde)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                          >
                            <ClipboardList size={14} />
                            Tehtävät
                          </button>
                        )}
                        {saaKirjataToimenpiteen && (
                          <button
                            type="button"
                            onClick={() => setRaporttiKohde({ kohde, tyyppi: 'guard_action' })}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                          >
                            <FileText size={14} />
                            Toimenpide
                          </button>
                        )}
                        {saaKirjataIlmoituksen && (
                          <button
                            type="button"
                            onClick={() => setRaporttiKohde({ kohde, tyyppi: 'guard_jvreport' })}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                          >
                            <ShieldAlert size={14} />
                            Tapahtumailmoitus
                          </button>
                        )}
                        {saaNahdaTiedot && (
                          <button
                            type="button"
                            onClick={() => setTietoKohde(kohde)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-body hover:text-accent transition-colors ml-auto"
                          >
                            <Info size={14} />
                            Kohteen tiedot
                          </button>
                        )}
                      </div>

                      {saaMuokata && (
                        <div className="flex gap-2 pt-3 border-t border-line-soft">
                          <button
                            type="button"
                            onClick={() => setLomake({
                              ...kohde,
                              perehdytykset: [...(kohde.perehdytykset || [])],
                              tehtavat: (kohde.tehtavat || []).map((t) => ({ ...t, kohdat: [...t.kohdat] })),
                            })}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-body hover:text-accent transition-colors"
                          >
                            <Pencil size={14} />
                            Hallitse
                          </button>
                          <button
                            type="button"
                            onClick={() => setPoistettava(kohde)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-danger transition-colors ml-auto"
                          >
                            <Trash2 size={14} />
                            Poista
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {poistettava && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-xl shadow-xl border border-line max-w-sm w-full p-6">
            <h3 className="font-bold text-ink-strong mb-2">Poistetaanko kohde?</h3>
            <p className="text-sm text-ink-muted leading-relaxed mb-6">
              <strong className="text-ink">{poistettava.name}</strong> poistetaan pysyvästi.
              Kohteelle kirjattuja tietoja ei poisteta tämän mukana.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPoistettava(null)}
                className="px-4 py-2 text-sm font-medium text-ink-body bg-sunken hover:bg-line rounded-lg transition-colors"
              >
                Peruuta
              </button>
              <button
                type="button"
                disabled={tallentaa}
                onClick={poista}
                className="px-4 py-2 text-sm font-medium text-white bg-danger hover:brightness-95 rounded-lg transition-colors disabled:opacity-60"
              >
                {tallentaa ? 'Poistetaan…' : 'Poista kohde'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
