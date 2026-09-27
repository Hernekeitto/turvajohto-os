import { useState } from 'react';
import { AlertTriangle, ChevronRight, Users } from 'lucide-react';
import { muotoileTunniste } from '../tunnisteet';

// Käyttäjätunnusten YLEISKATSAUS. Tunnuksia ei hallita täällä.
//
// YKSI PAIKKA (päätös 27.9.2026): jokainen tunnus kuuluu henkilölle työntekijäpankissa,
// ja tunnus luodaan, sen oikeuksia muutetaan, salasana ja Authenticator nollataan ja
// tunnus poistetaan pankin osiosta 10 (shared/komponentit/TyontekijanTunnus.tsx). Tämä
// lista näyttää kaikki tunnukset kerralla ja vie henkilön tietoihin. Aiemmin sama asia
// oli hallittavissa kolmesta paikasta, ja tunnukset ja pankin henkilöt erkanivat
// toisistaan (esim. Johto1 oli sekä tunnuksena #1000 että pankissa #1006).
//
// Tunnus jolla ei ole henkilöä (ennen päätöstä syntynyt) näytetään varoituksena, ja sille
// voi luoda pankkitietueen samalla numerolla (POST /api/users/:username/tyontekija).

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
  // Palvelin rajaa tunnuslistan pääkäyttäjään. Muille näytetään selitys.
  isAdmin: boolean;
  // Avaa henkilön työntekijäpankissa tunnusosio auki.
  onAvaaHenkilo: (employeeId: string) => void;
  onMuuttui: () => void;
};

export const Kayttajat = ({ kayttajat, roles, isAdmin, onAvaaHenkilo, onMuuttui }: Props) => {
  const [kesken, setKesken] = useState<string | null>(null);
  const [virhe, setVirhe] = useState('');

  const luoHenkilo = async (username: string) => {
    setKesken(username);
    setVirhe('');
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(username)}/tyontekija`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error || 'Pankkitietueen luonti epäonnistui.');
      onMuuttui();
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Pankkitietueen luonti epäonnistui.');
    } finally {
      setKesken(null);
    }
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
        <p className="text-sm text-ink-muted mt-3">Käyttäjätunnusten tiedot ovat vain pääkäyttäjille.</p>
      </div>
    );
  }

  const ilmanHenkiloa = kayttajat.filter((k) => !k.employeeId).length;

  return (
    <div className="bg-surface rounded-xl border border-line shadow-sm p-6 mb-6 space-y-4">
      {otsikko}
      <p className="text-sm text-ink-muted">
        Kaikki tunnukset yhdellä silmäyksellä. Tunnuksia luodaan ja hallitaan
        <span className="font-medium text-ink-body"> työntekijäpankista</span> henkilön
        kohdasta 10. Valitse rivi avataksesi henkilön.
      </p>
      {virhe && (
        <p className="text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">{virhe}</p>
      )}
      {ilmanHenkiloa > 0 && (
        <p className="text-sm text-warning-ink bg-warning-soft border border-warning/30 rounded-lg px-4 py-3 flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          {ilmanHenkiloa === 1 ? '1 tunnus ei kuulu' : `${ilmanHenkiloa} tunnusta ei kuulu`} kenellekään
          työntekijäpankissa, joten sitä ei voi hallita. Luo sille pankkitietue.
        </p>
      )}

      <div className="border border-line rounded-lg divide-y divide-line-soft overflow-hidden">
        {kayttajat.length === 0 ? (
          <p className="text-sm text-ink-muted p-4">Ei käyttäjiä.</p>
        ) : kayttajat.map((k) => {
          const taso = k.roleName || roles.find((r) => r.id === k.roleId)?.name || k.roleId || 'ei tasoa';
          const sisalto = (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink truncate">
                {k.nickname || k.username}
                {k.displayId ? <span className="text-ink-subtle font-normal"> {muotoileTunniste(k.displayId)}</span> : null}
              </p>
              <p className="text-xs text-ink-muted truncate">
                <span className="font-mono">{k.username}</span>
                {' · '}{taso}
                {' · '}{(k.tuotteet || []).map((t) => t.toUpperCase()).join(', ') || '—'}
                {k.role !== 'admin' && k.totp_required === false && ' · Authenticator pois'}
                {' · '}{k.last_login_at ? `kirjautunut ${new Date(k.last_login_at).toLocaleDateString('fi-FI')}` : 'ei kirjautunut'}
              </p>
            </div>
          );
          return k.employeeId ? (
            <button
              key={k.username}
              type="button"
              onClick={() => onAvaaHenkilo(k.employeeId as string)}
              className="w-full text-left p-4 bg-surface hover:bg-sunken flex items-center gap-3 transition-colors"
            >
              {sisalto}
              <ChevronRight size={16} className="text-ink-subtle shrink-0" />
            </button>
          ) : (
            <div key={k.username} className="p-4 bg-warning-soft/40 flex flex-col sm:flex-row sm:items-center gap-3">
              {sisalto}
              <button
                type="button"
                onClick={() => luoHenkilo(k.username)}
                disabled={kesken === k.username}
                className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-warning/40 text-warning-ink hover:bg-warning-soft disabled:opacity-60"
              >
                {kesken === k.username ? 'Luodaan…' : 'Luo pankkitietue'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
