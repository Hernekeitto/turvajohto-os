import { useState, type ReactNode } from 'react';
import { ShieldCheck, Users, ChevronDown, Plus, CheckCircle, AlertTriangle } from 'lucide-react';
import { SitemapPermissionRow } from '../komponentit/SitemapPermissionRow';
import { collectDescendantIds, findAncestorIds, DEFAULT_BUCKET, type SivukarttaSolmu } from '../oikeudet';
import { muotoileTunniste } from '../tunnisteet';

// Käyttäjätasojen hallinta (server/roles.js). Jaettu molemmille puolille: tasot ovat
// koko sovelluksen yhteisiä, ja sama taso voi kattaa kummankin puolen sivuja — siksi
// editori näyttää aina molempien puolien sivukartat riippumatta siitä kummalta puolelta
// asetukset avattiin.
//
// Sivukartat annetaan propsina eikä tuoda tänne suoraan, jottei jaettu kansio joudu
// riippumaan kummastakaan tuotteesta.

export type AsetusSivukartta = {
  otsikko: string;
  solmut: SivukarttaSolmu[];
  // Solmu jonka kautta muihin päästään (EVENT: Tapahtumavalinta, GUARD: Kohdevalinta).
  // Ilman sitä muut saman puolen oikeudet eivät johda mihinkään, joten siitä varoitetaan.
  // Varoitusteksti tulee kutsujalta: sivun nimi taipuu suomessa eri tavoin eikä
  // yleiskäyttöinen lause olisi luettava kummallakaan puolella.
  portti: { id: string; sisaiset: string[]; varoitus: ReactNode };
};

type Rooli = {
  id: string;
  name: string;
  description?: string;
  builtin?: boolean;
  permissions?: Record<string, Record<string, { view?: boolean; edit?: boolean }>>;
};

type Props = {
  roles: Rooli[];
  rolesLoading: boolean;
  // Käyttäjälista tason käyttäjämäärien näyttämiseen. Tyhjä lista on kelvollinen: ilman
  // pääkäyttäjäoikeuksia sitä ei saa haettua, jolloin kortit näyttävät "Ei käyttäjiä".
  kayttajat: { username: string; nickname?: string; displayId?: number | null; roleId?: string | null }[];
  sivukartat: AsetusSivukartta[];
  // Tasojen luonti, muokkaus ja poisto ovat palvelimella pääkäyttäjärajattuja
  // (server/index.js: /api/roles). Muille näytetään lista ilman työkaluja sen sijaan,
  // että napit johtaisivat 403-virheeseen.
  isAdmin: boolean;
  // Kutsutaan kun tasoja on luotu, muokattu tai poistettu, jotta kutsuja voi hakea
  // listan uudelleen — sama lista näkyy myös käyttäjähallinnan tasovalinnassa.
  onMuuttui: () => void;
};

export const Kayttajatasot = ({ roles, rolesLoading, kayttajat, sivukartat, isAdmin, onMuuttui }: Props) => {
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleUsersOpen, setRoleUsersOpen] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [draft, setDraft] = useState<Record<string, { view?: boolean; edit?: boolean }>>({});
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [virhe, setVirhe] = useState('');
  const [ilmoitus, setIlmoitus] = useState('');
  const [tallentaa, setTallentaa] = useState(false);

  // Muokataan vain __default__-bucketia: tapahtumakohtainen hienosäätö kuuluu
  // käyttäjälle (eventAccess), ei tasolle.
  const avaaMuokkaukseen = (role: Rooli) => {
    setEditingRoleId(role.id);
    setDraft({ ...(role.permissions?.[DEFAULT_BUCKET] || {}) });
    setDraftName(role.name || '');
    setDraftDesc(role.description || '');
    setVirhe('');
    setIlmoitus('');
  };

  // Esi-isät haetaan KAIKISTA annetuista sivukartoista: sama taso voi kattaa kummankin
  // puolen solmut, ja yhden kartan käyttäminen jättäisi toisen alasivut ilman yläsivun
  // näkyvyyttä — oikeus olisi myönnetty mutta sivu ei näkyisi valikossa.
  const esiisat = (nodeId: string): string[] => {
    for (const kartta of sivukartat) {
      const loydetty = findAncestorIds(nodeId, kartta.solmut);
      if (loydetty) return loydetty;
    }
    return [];
  };

  // Arvo tulee ruudun omasta tilasta (SitemapPermissionRow antaa e.target.checked) eikä
  // sitä päätellä kääntämällä nykyistä: yläsivun ruutu kutsuu sekä tätä että
  // vaihdaRekursiivisesti, ja jos molemmat päättelisivät suunnan itse, ne kumoaisivat
  // toisensa — yläsivun rastia ei saisi otettua pois lainkaan.
  const vaihda = (nodeId: string, kentta: 'view' | 'edit', arvo: boolean) => {
    setDraft((prev) => {
      const nykyinen = prev[nodeId] || {};
      const seuraava = { ...nykyinen, [kentta]: arvo };
      // Muokkausoikeus ilman näkyvyyttä ei tarkoita mitään: sivu ei näy valikossa, joten
      // sinne ei pääse muokkaamaan. Näkyvyyden poisto vie siis myös muokkauksen.
      if (kentta === 'view' && !seuraava.view) seuraava.edit = false;
      if (kentta === 'edit' && seuraava.edit) seuraava.view = true;
      const uusi = { ...prev, [nodeId]: seuraava };
      if (seuraava.view) {
        for (const esiisa of esiisat(nodeId)) {
          uusi[esiisa] = { ...(uusi[esiisa] || {}), view: true };
        }
      }
      return uusi;
    });
  };

  const vaihdaRekursiivisesti = (node: SivukarttaSolmu, kentta: 'view' | 'edit', arvo: boolean) => {
    const idt = [node.id, ...collectDescendantIds(node)];
    setDraft((prev) => {
      const uusi = { ...prev };
      for (const id of idt) {
        const nykyinen = uusi[id] || {};
        const seuraava = { ...nykyinen, [kentta]: arvo };
        if (kentta === 'view' && !arvo) seuraava.edit = false;
        if (kentta === 'edit' && arvo) seuraava.view = true;
        uusi[id] = seuraava;
      }
      if (arvo) {
        for (const esiisa of esiisat(node.id)) {
          uusi[esiisa] = { ...(uusi[esiisa] || {}), view: true };
        }
      }
      return uusi;
    });
  };

  const tallenna = async () => {
    if (!editingRoleId) return;
    setVirhe('');
    setIlmoitus('');
    if (!draftName.trim()) {
      setVirhe('Käyttäjätason nimi ei voi olla tyhjä.');
      return;
    }
    setTallentaa(true);
    try {
      const res = await fetch(`/api/roles/${encodeURIComponent(editingRoleId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: draftName.trim(),
          description: draftDesc.trim(),
          permissions: { [DEFAULT_BUCKET]: draft },
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setIlmoitus('Käyttäjätaso tallennettu. Muutos koskee heti kaikkia tason käyttäjiä.');
        onMuuttui();
      } else {
        setVirhe(data.error || 'Tallennus epäonnistui.');
      }
    } catch {
      setVirhe('Yhteysvirhe. Yritä uudelleen.');
    } finally {
      setTallentaa(false);
    }
  };

  const luo = async () => {
    setVirhe('');
    setIlmoitus('');
    if (!newRoleName.trim()) {
      setVirhe('Anna uudelle käyttäjätasolle nimi.');
      return;
    }
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        // Uusi taso aloittaa ilman oikeuksia: turvallisempi lähtökohta kuin kopioida
        // jotain olemassa olevaa, koska oikeudet on joka tapauksessa käytävä läpi.
        body: JSON.stringify({ name: newRoleName.trim(), description: '', permissions: { [DEFAULT_BUCKET]: {} } }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setNewRoleName('');
        onMuuttui();
        avaaMuokkaukseen(data.role);
        setIlmoitus(`Taso "${data.role.name}" luotu. Valitse sille oikeudet alta.`);
      } else {
        setVirhe(data.error || 'Tason luonti epäonnistui.');
      }
    } catch {
      setVirhe('Yhteysvirhe. Yritä uudelleen.');
    }
  };

  const poista = async (role: Rooli) => {
    if (!window.confirm(`Poistetaanko käyttäjätaso "${role.name}"? Tätä ei voi perua.`)) return;
    setVirhe('');
    setIlmoitus('');
    try {
      const res = await fetch(`/api/roles/${encodeURIComponent(role.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        if (editingRoleId === role.id) setEditingRoleId(null);
        if (roleUsersOpen === role.id) setRoleUsersOpen(null);
        onMuuttui();
        setIlmoitus('Käyttäjätaso poistettu.');
      } else {
        setVirhe(data.error || 'Poisto epäonnistui.');
      }
    } catch {
      setVirhe('Yhteysvirhe. Yritä uudelleen.');
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-line shadow-sm p-6 mb-6">
      <h3 className="text-lg font-bold text-ink flex items-center gap-2">
        <ShieldCheck size={18} className="text-accent" />
        Käyttäjätasot
      </h3>
      <p className="text-sm text-ink-muted mt-1 mb-5">
        Taso määrää mitä sivuja sen käyttäjät näkevät ja voivat muokata. Muutos vaikuttaa
        heti kaikkiin tason käyttäjiin. Käyttäjän tason valitset "Muokkaa käyttäjiä"
        -näkymästä.
      </p>

      {!isAdmin ? (
        <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg p-3">
          Käyttäjätasojen hallinta kuuluu pääkäyttäjälle. Oman tasosi näet profiilistasi.
        </p>
      ) : rolesLoading && roles.length === 0 ? (
        <p className="text-sm text-ink-muted">Ladataan käyttäjätasoja…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            {roles.map((role) => {
              const tasonKayttajat = kayttajat.filter((u) => u.roleId === role.id);
              const auki = roleUsersOpen === role.id;
              return (
                <div
                  key={role.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    editingRoleId === role.id ? 'bg-accent-soft border-accent' : 'bg-sunken border-line'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <p className="text-sm font-bold text-ink min-w-0 truncate">{role.name}</p>
                    {role.builtin && (
                      <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wide shrink-0">vakio</span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted min-h-[2rem]">{role.description || '—'}</p>

                  <button
                    type="button"
                    onClick={() => setRoleUsersOpen(auki ? null : role.id)}
                    className="mt-2 w-full flex items-center justify-between gap-2 text-xs font-medium text-ink-body hover:text-ink-strong bg-surface hover:bg-sunken border border-line px-3 py-1.5 rounded-md transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <Users size={13} className="text-ink-subtle" />
                      {tasonKayttajat.length === 0
                        ? 'Ei käyttäjiä'
                        : `${tasonKayttajat.length} ${tasonKayttajat.length === 1 ? 'käyttäjä' : 'käyttäjää'}`}
                    </span>
                    {tasonKayttajat.length > 0 && (
                      <ChevronDown size={13} className={`transition-transform ${auki ? 'rotate-180' : ''}`} />
                    )}
                  </button>

                  {auki && tasonKayttajat.length > 0 && (
                    <ul className="mt-2 bg-surface border border-line rounded-md divide-y divide-line-soft max-h-48 overflow-y-auto">
                      {tasonKayttajat.map((u) => (
                        <li key={u.username} className="px-3 py-2 flex items-baseline justify-between gap-2">
                          <span className="text-xs font-medium text-ink truncate">{u.nickname}</span>
                          <span className="text-[11px] font-mono text-ink-subtle shrink-0">
                            {u.displayId ? muotoileTunniste(u.displayId) : u.username}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex gap-2 mt-3">
                    {role.id === 'admin' ? (
                      <span className="text-xs text-ink-subtle italic py-1.5">Aina täydet oikeudet</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => avaaMuokkaukseen(role)}
                        className="text-xs font-bold text-accent hover:text-accent-ink bg-accent-soft hover:bg-accent-soft px-3 py-1.5 rounded-md transition-colors"
                      >
                        Muokkaa oikeuksia
                      </button>
                    )}
                    {!role.builtin && (
                      <button
                        type="button"
                        onClick={() => poista(role)}
                        title="Poista käyttäjätaso"
                        className="text-xs font-medium text-danger hover:text-danger-ink bg-danger-soft px-3 py-1.5 rounded-md transition-colors"
                      >
                        Poista
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-5 pb-5 border-b border-line-soft">
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Uuden käyttäjätason nimi, esim. Ensiapuvastaava"
              className="flex-1 rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent"
            />
            <button
              type="button"
              onClick={luo}
              className="shrink-0 px-4 py-2.5 text-sm font-bold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={16} />
              Luo käyttäjätaso
            </button>
          </div>

          {virhe && <p className="text-sm text-danger mb-3">{virhe}</p>}
          {ilmoitus && <p className="text-sm text-success-ink font-medium mb-3">{ilmoitus}</p>}

          {editingRoleId && (
            <div className="border-t border-line-soft pt-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-ink-body mb-1">Tason nimi</label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-body mb-1">Kuvaus</label>
                  <input
                    type="text"
                    value={draftDesc}
                    onChange={(e) => setDraftDesc(e.target.value)}
                    placeholder="Mihin tasoa käytetään"
                    className="w-full rounded-lg border-line-strong border p-2.5 text-sm focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Umpikujavaroitus per puoli: sivut eivät ole saavutettavissa ilman sitä
                  solmua jonka kautta niihin mennään. Ilman tätä pääkäyttäjä voisi luoda
                  tason joka näyttää oikealta mutta jättää käyttäjän ilman pääsyä. */}
              {sivukartat.map((kartta) => {
                const onSisaisia = kartta.portti.sisaiset.some((id) => draft[id]?.view);
                if (!onSisaisia || draft[kartta.portti.id]?.view) return null;
                return (
                  <div key={kartta.otsikko} className="bg-warning-soft border border-warning/30 rounded-lg p-3 mb-3 flex gap-2.5">
                    <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-warning-ink leading-relaxed">{kartta.portti.varoitus}</p>
                  </div>
                );
              })}

              <div className="bg-sunken border border-line rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 py-2 pr-2 bg-sunken border-b border-line">
                  <span className="flex-1 text-xs font-bold text-ink-muted uppercase tracking-wide pl-2">Sivu</span>
                  <span className="text-xs font-bold text-ink-muted uppercase tracking-wide shrink-0 w-28">Näkyy</span>
                  <span className="text-xs font-bold text-ink-muted uppercase tracking-wide shrink-0 w-32">Muokattavissa</span>
                </div>
                <div className="bg-surface divide-y divide-line-soft max-h-[28rem] overflow-y-auto">
                  {/* Molempien puolien sivukartat samassa listassa, omien otsikoidensa
                      alla: sama käyttäjätaso voi kattaa kummankin puolen, ja ilman
                      otsikoita ei näkisi kumpaan sivu kuuluu. */}
                  {sivukartat.map((kartta) => (
                    <div key={kartta.otsikko}>
                      <div className="px-3 py-2 bg-sunken text-xs font-bold text-ink-muted uppercase tracking-wide">
                        {kartta.otsikko}
                      </div>
                      {kartta.solmut.map((node) => (
                        <SitemapPermissionRow
                          key={node.id}
                          node={node}
                          depth={0}
                          permDraft={draft}
                          onToggle={vaihda}
                          onCascade={vaihdaRekursiivisesti}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setEditingRoleId(null)}
                  className="px-5 py-2.5 text-sm font-medium text-ink-body bg-sunken hover:bg-line rounded-lg transition-colors"
                >
                  Sulje
                </button>
                <button
                  type="button"
                  disabled={tallentaa}
                  onClick={tallenna}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-accent hover:bg-accent-hover disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  <CheckCircle size={18} />
                  {tallentaa ? 'Tallennetaan…' : 'Tallenna käyttäjätaso'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
