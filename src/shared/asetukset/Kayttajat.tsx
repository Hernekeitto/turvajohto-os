import { useState } from 'react';
import { UserPlus, KeyRound, Smartphone, LogOut, Users } from 'lucide-react';
import { muotoileTunniste } from '../tunnisteet';
import { KertaSalasana, type SalasanaNaytto } from '../komponentit/KertaSalasana';

// Käyttäjätunnusten hallinta: kuka pääsee sisään, millä tasolla ja kummalle puolelle.
// Jaettu molemmille tuotteille samasta syystä kuin käyttäjätasot — tunnukset ovat koko
// sovelluksen yhteisiä, eikä GUARD-puolen pääkäyttäjän kuulu joutua kirjautumaan
// tapahtumapuolelle luodakseen vartijalle tunnuksen.
//
// EI SIVUKARTTA-OIKEUKSIA. Ne tulevat yksinomaan käyttäjätasolta (server/roles.js:
// "TASO MÄÄRÄÄ KAIKEN"), joten tässä valitaan taso eikä yksittäisiä sivuja. Tasojen
// sisältöä muokataan Käyttäjätasot-osiossa.
//
// Komponentti hakee itse kaikki muutoksensa palvelimelle (kuten Kayttajatasot) ja
// kertoo kutsujalle `onMuuttui`-takaisinkutsulla, että lista kannattaa hakea uudelleen.

export type Tuote = 'event' | 'guard';

export type KayttajaRivi = {
  username: string;
  nickname?: string;
  displayId?: number | null;
  role?: string;
  roleId?: string;
  roleName?: string | null;
  tuotteet?: Tuote[];
  must_change_password?: boolean;
  // Puuttuva tai true = kirjautuminen vaatii Authenticator-koodin. Vain nimenomainen
  // false ohittaa sen (server/index.js: `user.totp_required !== false`), joten
  // vertailut tehdään tässäkin falseen eikä totuusarvoon.
  totp_required?: boolean;
  last_login_at?: string | null;
  // Työntekijäpankin tietue johon tunnus on kytketty (PUT /api/users: employeeId).
  employeeId?: string;
};

type Props = {
  kayttajat: KayttajaRivi[];
  roles: { id: string; name: string }[];
  // Palvelin rajaa kaikki tämän osion reitit pääkäyttäjään. Muille näytetään selitys
  // eikä nappeja, jotka johtaisivat 403-virheeseen.
  isAdmin: boolean;
  // Kummalta puolelta osio avattiin. Ratkaisee vain uuden käyttäjän oletustuotteen:
  // GUARDista luodaan käytännössä aina vartija, EVENTistä tapahtumaväkeä.
  puoli: Tuote;
  onMuuttui: () => void;
};

export const Kayttajat = ({ kayttajat, roles, isAdmin, puoli, onMuuttui }: Props) => {
  const [lomakeAuki, setLomakeAuki] = useState(false);
  const [tunnus, setTunnus] = useState('');
  const [nimimerkki, setNimimerkki] = useState('');
  const [taso, setTaso] = useState('');
  const [tuotteet, setTuotteet] = useState<Tuote[]>([puoli]);
  const [virhe, setVirhe] = useState('');
  const [tallentaa, setTallentaa] = useState(false);
  const [salasana, setSalasana] = useState<SalasanaNaytto | null>(null);
  // Käynnissä oleva toimenpide muodossa "<tunnus>:<toiminto>", jotta vain se yksi nappi
  // näyttää odotustilan eikä koko lista lukkiudu.
  const [kesken, setKesken] = useState<string | null>(null);

  const nollaaLomake = () => {
    setTunnus('');
    setNimimerkki('');
    setTaso('');
    setTuotteet([puoli]);
    setVirhe('');
  };

  const pyynto = async (polku: string, asetukset: RequestInit) => {
    const r = await fetch(polku, { credentials: 'include', ...asetukset });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data?.ok) throw new Error(data?.error || 'Toiminto epäonnistui.');
    return data;
  };

  const luo = async () => {
    setVirhe('');
    if (!tunnus.trim()) return setVirhe('Käyttäjätunnus vaaditaan.');
    // Palvelin vaatii nimimerkin eikä hyväksy tyhjää. Täytetään tunnuksella, jotta
    // luonti ei kaadu pelkän valinnaiselta näyttävän kentän takia.
    const nimi = nimimerkki.trim() || tunnus.trim();
    // Talteen ennen lomakkeen nollausta: nollaus tyhjentää nämä tilat, mutta tason
    // asetus tarvitsee arvot vielä sen jälkeen.
    const luotavaTunnus = tunnus.trim();
    const valittuTaso = taso;
    const valitutTuotteet = tuotteet;
    setTallentaa(true);
    try {
      const data = await pyynto('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: luotavaTunnus, nickname: nimi }),
      });
      // Salasana näkyviin HETI kun tunnus on luotu, ennen tason asetusta. Luonti on
      // peruuttamaton ja arvottu salasana näkyy vain kerran: jos se näytettäisiin vasta
      // koko ketjun jälkeen, epäonnistunut tasonasetus jättäisi pääkäyttäjälle tunnuksen
      // jonka salasanaa hän ei koskaan nähnyt.
      setSalasana({ username: luotavaTunnus, password: data.password, syy: 'luotu' });

      // Lomake nollataan ENNEN tason asetusta, koska nollaus tyhjentää myös
      // virheilmoituksen — muuten se pyyhkisi juuri asetetun varoituksen alta.
      nollaaLomake();
      setLomakeAuki(false);

      // Taso ja tuotteet asetetaan omalla kutsullaan: POST /api/users ei ota niitä
      // vastaan, ja uusi tunnus jäisi muuten ilman oikeuksia ja ilman puolta.
      if (valittuTaso || valitutTuotteet.length > 0) {
        try {
          await pyynto(`/api/users/${encodeURIComponent(luotavaTunnus)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...(valittuTaso ? { roleId: valittuTaso } : {}),
              ...(valitutTuotteet.length > 0 ? { tuotteet: valitutTuotteet } : {}),
            }),
          });
        } catch (e) {
          // Tunnus on olemassa, vain taso jäi asettamatta. Kerrotaan se täsmällisesti:
          // korjaus on yksi valinta listasta, ei uusi käyttäjä.
          setVirhe(
            `Tunnus ${luotavaTunnus} luotiin, mutta tason tai puolten asetus epäonnistui `
            + `(${e instanceof Error ? e.message : 'tuntematon virhe'}). Aseta ne listasta.`,
          );
        }
      }

      onMuuttui();
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Käyttäjän luonti epäonnistui.');
    } finally {
      setTallentaa(false);
    }
  };

  const muuta = async (username: string, muutos: Record<string, unknown>, toiminto: string) => {
    setKesken(`${username}:${toiminto}`);
    setVirhe('');
    try {
      await pyynto(`/api/users/${encodeURIComponent(username)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(muutos),
      });
      onMuuttui();
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Muutos epäonnistui.');
    } finally {
      setKesken(null);
    }
  };

  const nollaaSalasana = async (username: string) => {
    if (!window.confirm(`Nollataanko käyttäjän ${username} salasana? Vanha lakkaa toimimasta heti.`)) return;
    setKesken(`${username}:salasana`);
    setVirhe('');
    try {
      const data = await pyynto(`/api/users/${encodeURIComponent(username)}/password`, { method: 'POST' });
      setSalasana({ username, password: data.password, syy: 'nollattu' });
      onMuuttui();
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Nollaus epäonnistui.');
    } finally {
      setKesken(null);
    }
  };

  const nollaaTotp = async (username: string) => {
    if (!window.confirm(`Nollataanko käyttäjän ${username} Authenticator? Hän joutuu lukemaan uuden QR-koodin ennen kuin pääsee sisään.`)) return;
    setKesken(`${username}:totp`);
    setVirhe('');
    try {
      await pyynto(`/api/users/${encodeURIComponent(username)}/totp/reset`, { method: 'POST' });
      onMuuttui();
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Nollaus epäonnistui.');
    } finally {
      setKesken(null);
    }
  };

  // Authenticator-vaatimuksen kytkeminen pois. Tarpeen kahdessa tilanteessa: tunnus
  // jota käytetään ilman puhelinta (esim. sovelluskaupan arvioija, joka ei voi syöttää
  // kertakoodia), ja tilapäinen apu kun käyttäjän puhelin on rikki.
  //
  // POISKYTKENTÄ HEIKENTÄÄ TUNNUKSEN SUOJAA olennaisesti: sen jälkeen pelkkä salasana
  // riittää sisäänpääsyyn. Siksi siitä kysytään erikseen ja päälle kytkeminen menee
  // läpi ilman kysymystä.
  const vaihdaTotpVaatimus = async (k: KayttajaRivi) => {
    const vaaditaanNyt = k.totp_required !== false;
    if (vaaditaanNyt && !window.confirm(
      `Poistetaanko Authenticator-vaatimus käyttäjältä ${k.username}?\n\n`
      + 'Sen jälkeen tunnukselle pääsee sisään pelkällä salasanalla. Käytä vain '
      + 'tunnuksiin joiden on toimittava ilman puhelinta.',
    )) return;
    setKesken(`${k.username}:vaatimus`);
    setVirhe('');
    try {
      await pyynto(`/api/users/${encodeURIComponent(k.username)}/totp`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ required: !vaaditaanNyt }),
      });
      onMuuttui();
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Muutos epäonnistui.');
    } finally {
      setKesken(null);
    }
  };

  // Pakkouloskirjaus. Sama koneisto jolla kadonneen laitteen istunto katkaistaan
  // (server/index.js: session_invalidated_at) — ja se on syy sille, että asennetussa
  // sovelluksessa istuntoa ei tarvitse rajoittaa ajallisesti.
  const kirjaaUlos = async (username: string) => {
    if (!window.confirm(`Kirjataanko ${username} ulos kaikilta laitteilta heti?`)) return;
    setKesken(`${username}:ulos`);
    setVirhe('');
    try {
      await pyynto(`/api/users/${encodeURIComponent(username)}/logout`, { method: 'POST' });
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Uloskirjaus epäonnistui.');
    } finally {
      setKesken(null);
    }
  };

  const vaihdaTuote = (tuote: Tuote) => {
    setTuotteet((edelliset) =>
      edelliset.includes(tuote) ? edelliset.filter((t) => t !== tuote) : [...edelliset, tuote]);
  };

  const otsikko = (
    <h3 className="text-lg font-bold text-ink flex items-center gap-2">
      <Users size={18} className="text-accent" />
      Käyttäjätunnukset
    </h3>
  );

  if (!isAdmin) {
    return (
      <div className="bg-surface rounded-xl border border-line shadow-sm p-6 mb-6">
        {otsikko}
        <p className="text-sm text-ink-muted mt-3">
          Käyttäjätunnusten hallinta on vain pääkäyttäjille.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-line shadow-sm p-6 mb-6 space-y-4">
      {otsikko}
      <p className="text-sm text-ink-muted">
        Kuka pääsee sisään, millä tasolla ja kummalle puolelle. Sivukohtaiset oikeudet
        tulevat käyttäjätasolta, ei tästä.
      </p>
      {virhe && (
        <p className="text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
          {virhe}
        </p>
      )}

      {salasana && <KertaSalasana key={salasana.password} {...salasana} onSulje={() => setSalasana(null)} />}

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">
          {kayttajat.length} {kayttajat.length === 1 ? 'tunnus' : 'tunnusta'}
        </p>
        <button
          type="button"
          onClick={() => { nollaaLomake(); setLomakeAuki((auki) => !auki); }}
          className="inline-flex items-center gap-2 px-3 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          <UserPlus size={16} />
          {lomakeAuki ? 'Peruuta' : 'Uusi käyttäjä'}
        </button>
      </div>

      {lomakeAuki && (
        <div className="border border-line rounded-lg p-4 bg-sunken space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-sm font-medium text-ink-body mb-1">Käyttäjätunnus</span>
              <input
                type="text"
                autoComplete="off"
                value={tunnus}
                onChange={(e) => setTunnus(e.target.value)}
                placeholder="esim. vartija1"
                className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-ink-body mb-1">
                Nimimerkki <span className="text-ink-subtle font-normal">(näkyy raporteissa)</span>
              </span>
              <input
                type="text"
                autoComplete="off"
                value={nimimerkki}
                onChange={(e) => setNimimerkki(e.target.value)}
                placeholder="esim. Vartija 1"
                className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="block text-sm font-medium text-ink-body mb-1">Käyttäjätaso</span>
            <select
              value={taso}
              onChange={(e) => setTaso(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm"
            >
              <option value="">Valitse taso…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <span className="block text-xs text-ink-subtle mt-1">
              Taso ratkaisee mitä sivuja käyttäjä näkee. Ilman tasoa tunnus pääsee
              kirjautumaan mutta ei näe mitään.
            </span>
          </label>

          <div>
            <span className="block text-sm font-medium text-ink-body mb-1">Puolet</span>
            <div className="flex gap-4">
              {(['guard', 'event'] as Tuote[]).map((t) => (
                <label key={t} className="inline-flex items-center gap-2 text-sm text-ink-body">
                  <input
                    type="checkbox"
                    checked={tuotteet.includes(t)}
                    onChange={() => vaihdaTuote(t)}
                  />
                  {t === 'guard' ? 'GUARD (vartiointi)' : 'EVENT (tapahtumat)'}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={luo}
              disabled={tallentaa}
              className="px-4 py-2 bg-action hover:bg-action-hover disabled:opacity-60 text-white text-sm font-bold rounded-lg transition-colors"
            >
              {tallentaa ? 'Luodaan…' : 'Luo käyttäjä'}
            </button>
          </div>
        </div>
      )}

      <div className="border border-line rounded-lg divide-y divide-line-soft overflow-hidden">
        {kayttajat.length === 0 ? (
          <p className="text-sm text-ink-muted p-4">Ei käyttäjiä.</p>
        ) : kayttajat.map((k) => {
          const admin = k.role === 'admin';
          return (
            <div key={k.username} className="p-4 bg-surface">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {k.nickname || k.username}
                    {k.displayId ? (
                      <span className="text-ink-subtle font-normal"> {muotoileTunniste(k.displayId)}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {k.username}
                    {k.must_change_password && ' · salasana vaihdettava'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={k.roleId || ''}
                    disabled={kesken === `${k.username}:taso`}
                    onChange={(e) => muuta(k.username, { roleId: e.target.value }, 'taso')}
                    className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs"
                  >
                    <option value="">Ei tasoa</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => nollaaSalasana(k.username)}
                    disabled={kesken === `${k.username}:salasana`}
                    title="Nollaa salasana"
                    className="p-2 rounded-lg border border-line text-ink-muted hover:text-accent hover:border-line-strong transition-colors"
                  >
                    <KeyRound size={15} />
                  </button>
                  {/* Authenticator ja pakkouloskirjaus eivät koske pääkäyttäjää:
                      palvelin torjuu molemmat 400:lla, joten nappeja ei näytetä. */}
                  {!admin && (
                    <>
                      {/* Authenticator-vaatimus tekstinä eikä ikonina: tila on
                          turvallisuuden kannalta merkittävä, eikä sitä saa joutua
                          arvaamaan ikonin väristä. */}
                      <button
                        type="button"
                        onClick={() => vaihdaTotpVaatimus(k)}
                        disabled={kesken === `${k.username}:vaatimus`}
                        title="Vaaditaanko Authenticator-koodi kirjautumisessa"
                        className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          k.totp_required === false
                            ? 'border-warning/40 bg-warning-soft text-warning-ink'
                            : 'border-line text-ink-muted hover:border-line-strong'
                        }`}
                      >
                        {k.totp_required === false ? 'Authenticator pois' : 'Authenticator'}
                      </button>
                      <button
                        type="button"
                        onClick={() => nollaaTotp(k.username)}
                        disabled={kesken === `${k.username}:totp`}
                        title="Nollaa Authenticator"
                        className="p-2 rounded-lg border border-line text-ink-muted hover:text-accent hover:border-line-strong transition-colors"
                      >
                        <Smartphone size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => kirjaaUlos(k.username)}
                        disabled={kesken === `${k.username}:ulos`}
                        title="Kirjaa ulos kaikilta laitteilta"
                        className="p-2 rounded-lg border border-line text-ink-muted hover:text-danger-ink hover:border-danger/40 transition-colors"
                      >
                        <LogOut size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
