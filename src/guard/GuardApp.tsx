import { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Pencil, Trash2, MapPin, Phone, Building2 } from 'lucide-react';
import { useSession } from '../SessionContext';
import { canView, canEdit } from '../shared/oikeudet';
import { Ylapalkki } from '../shared/komponentit/Ylapalkki';
import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';

// Turvajohto GUARD -puolen juurikomponentti. Ensimmäinen oikea näkymä on kohdelista:
// vartiointikohteiden luonti, muokkaus ja poisto. Kaikki muu vartiointitoiminnallisuus
// (kierrokset, vuorot, poikkeamat) kiinnittyy kohteeseen, joten tämä on niiden pohja.
//
// Kohteet ovat guardSites-kokoelmassa (server/store.js). Kohteen id toimii samana
// oikeusavaimena kuin tapahtuman id EVENT-puolella, joten käyttäjän rajaus tiettyihin
// kohteisiin toimii samalla eventAccess-listalla.

export type Kohde = {
  id: string;
  name: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  archived?: boolean;
};

const tyhjaKohde = (): Kohde => ({
  id: '',
  name: '',
  address: '',
  contactName: '',
  contactPhone: '',
  notes: '',
});

// Lomakekentän kehys. Toistuu tässä tiedostossa kuusi kertaa, ja EVENT-puolen vastaava
// rakenne on yhä App.tsx:ssä 52 kopiona — kun se aikanaan puretaan jaetuksi, tämä korvataan
// sillä. Ei siirretä jaettuun kansioon vielä, koska GUARDin tarpeet voivat vielä muuttua.
const Kentta = ({
  label,
  arvo,
  onChange,
  placeholder,
  monirivinen = false,
}: {
  label: string;
  arvo: string;
  onChange: (arvo: string) => void;
  placeholder?: string;
  monirivinen?: boolean;
}) => (
  <label className="block">
    <span className="block text-sm font-medium text-ink-body mb-1">{label}</span>
    {monirivinen ? (
      <textarea
        value={arvo}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-lg border border-line-strong p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
      />
    ) : (
      <input
        type="text"
        value={arvo}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line-strong p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
      />
    )}
  </label>
);

export default function GuardApp() {
  const session = useSession();
  const isAdmin = session?.role === 'admin';
  const perms = session?.permissions || {};
  // Kohdevalinta on globaali solmu (ks. server/permissions.js: GLOBAL_NODES), joten
  // tarkistus tehdään aina __default__-asetusta vasten — siksi eventId on null.
  const saaNahda = isAdmin || canView(perms, null, 'guard_sites');
  const saaMuokata = isAdmin || canEdit(perms, null, 'guard_sites');

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
    const kohde: Kohde = {
      ...lomake,
      name: nimi,
      id: lomake.id || (crypto.randomUUID?.() ?? `kohde-${Date.now()}`),
    };
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

  const kirjauduUlos = async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    window.location.reload();
  };

  const ylapalkki = (alaotsikko: string) => (
    <Ylapalkki
      tuoteNimi="Turvajohto GUARD"
      alaotsikko={alaotsikko}
      onLogo={() => { setLomake(null); setPoistettava(null); }}
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
      {ylapalkki(lomake ? (lomake.id ? 'Muokkaa kohdetta' : 'Uusi kohde') : 'Kohdevalinta')}

      <main className="flex-1 p-6 md:p-10">
        <div className="max-w-5xl mx-auto">
          {virhe && (
            <p className="mb-6 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
              {virhe}
            </p>
          )}

          {lomake ? (
            <div className="bg-surface rounded-xl shadow-sm border border-line-soft p-6 md:p-8 max-w-2xl">
              <TakaisinLinkki onClick={() => setLomake(null)}>Takaisin kohdelistaan</TakaisinLinkki>
              <h2 className="text-xl font-bold text-ink-strong mb-6">
                {lomake.id ? 'Muokkaa kohdetta' : 'Uusi kohde'}
              </h2>
              <div className="space-y-4">
                <Kentta
                  label="Kohteen nimi"
                  arvo={lomake.name}
                  onChange={(v) => setLomake({ ...lomake, name: v })}
                  placeholder="esim. Kauppakeskus Alfa"
                />
                <Kentta
                  label="Osoite"
                  arvo={lomake.address || ''}
                  onChange={(v) => setLomake({ ...lomake, address: v })}
                  placeholder="Katuosoite, postinumero ja kaupunki"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Kentta
                    label="Yhteyshenkilö"
                    arvo={lomake.contactName || ''}
                    onChange={(v) => setLomake({ ...lomake, contactName: v })}
                  />
                  <Kentta
                    label="Puhelin"
                    arvo={lomake.contactPhone || ''}
                    onChange={(v) => setLomake({ ...lomake, contactPhone: v })}
                  />
                </div>
                <Kentta
                  label="Ohjeet vartijalle"
                  arvo={lomake.notes || ''}
                  onChange={(v) => setLomake({ ...lomake, notes: v })}
                  placeholder="Kulkuohjeet, hälytysjärjestelmä, erityishuomiot"
                  monirivinen
                />
              </div>
              <div className="flex justify-end gap-3 pt-6 mt-2 border-t border-line-soft">
                <button
                  type="button"
                  onClick={() => setLomake(null)}
                  className="px-5 py-2.5 text-sm font-medium text-ink-body bg-sunken hover:bg-line rounded-lg transition-colors"
                >
                  Peruuta
                </button>
                <button
                  type="button"
                  disabled={tallentaa}
                  onClick={tallennaLomake}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors disabled:opacity-60"
                >
                  {tallentaa ? 'Tallennetaan…' : 'Tallenna kohde'}
                </button>
              </div>
            </div>
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
                {saaMuokata && (
                  <button
                    type="button"
                    onClick={() => setLomake(tyhjaKohde())}
                    className="shrink-0 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
                  >
                    <Plus size={16} />
                    Uusi kohde
                  </button>
                )}
              </div>

              {kohteet.length === 0 ? (
                <div className="bg-surface border border-line rounded-xl p-10 text-center">
                  <Building2 className="w-10 h-10 text-ink-subtle mx-auto mb-4" strokeWidth={1.5} />
                  <p className="text-sm text-ink-muted">
                    {ladattu
                      ? 'Yhtään kohdetta ei ole vielä lisätty.'
                      : 'Ladataan kohteita…'}
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
                      {saaMuokata && (
                        <div className="flex gap-2 pt-4 mt-3 border-t border-line-soft">
                          <button
                            type="button"
                            onClick={() => setLomake({ ...kohde })}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-body hover:text-accent transition-colors"
                          >
                            <Pencil size={14} />
                            Muokkaa
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
