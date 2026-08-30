import { useEffect, useState } from 'react';
import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { Kayttajatasot } from '../shared/asetukset/Kayttajatasot';
import { Tallennustila } from '../shared/asetukset/Tallennustila';
import { Sailytysajat } from '../shared/asetukset/Sailytysajat';
import { ASETUSTEN_SIVUKARTAT } from '../asetusten-sivukartat';
import type { GuardRaportti } from './tyypit';

// GUARD-puolen sovellusasetukset. Samat osiot kuin tapahtumapuolella yhtä lukuun
// ottamatta: pikatoiminnot (hätätekstiviestit) ovat tapahtuman johtamisen työkalu ja
// jäävät EVENT-puolelle.
//
// Osiot ovat jaettuja komponentteja (shared/asetukset/), joten näkymä ei ole kopio
// App.tsx:n asetuksista vaan sama koodi. Käyttäjätasot ja tallennustila ovat koko
// sovelluksen yhteisiä; vain säilytysaikaosio saa eri datan, koska se laskee sen puolen
// raporteista jolta se avataan.

type Props = {
  raportit: GuardRaportti[];
  isAdmin: boolean;
  onHavita: () => void;
  onTakaisin: () => void;
};

export const Asetukset = ({ raportit, isAdmin, onHavita, onTakaisin }: Props) => {
  const [roles, setRoles] = useState<any[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [kayttajat, setKayttajat] = useState<any[]>([]);

  // Molemmat reitit ovat palvelimella pääkäyttäjärajattuja. 403 ei ole tässä virhe vaan
  // odotettu lopputulos muille: tasot näkyvät silloin tyhjänä listana eikä käyttäjämääriä
  // voi laskea.
  const haeTasot = () => {
    setRolesLoading(true);
    fetch('/api/roles', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.ok) setRoles(data.roles || []); })
      .catch(() => { /* virhe näkyy tyhjänä listana */ })
      .finally(() => setRolesLoading(false));
  };

  const haeKayttajat = () => {
    fetch('/api/users', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.ok) setKayttajat(data.users || []); })
      .catch(() => { /* käyttäjämäärät jäävät näyttämättä */ });
  };

  useEffect(() => {
    if (!isAdmin) return;
    haeTasot();
    haeKayttajat();
  }, [isAdmin]);

  // Säilytysaikaosio odottaa laatimisajan createdAt-kentässä; GUARD-raporteissa se on
  // luotu. Normalisointi tehdään tässä eikä komponentissa, jotta jaettu osio pysyy
  // riippumattomana siitä miten kumpikin puoli nimeää kenttänsä.
  const sailytysRaportit = raportit.map((r) => ({
    id: r.id,
    type: r.type,
    createdAt: r.luotu || null,
  }));

  return (
    <div>
      <TakaisinLinkki onClick={onTakaisin}>Takaisin kohdelistaan</TakaisinLinkki>

      <h2 className="text-2xl font-bold text-ink-strong mb-1">Sovellusasetukset</h2>
      <p className="text-sm text-ink-muted mb-8">
        Käyttäjätasot, palvelimen tallennustila ja lakisääteiset säilytysajat.
      </p>

      <Kayttajatasot
        roles={roles}
        rolesLoading={rolesLoading}
        kayttajat={kayttajat}
        sivukartat={ASETUSTEN_SIVUKARTAT}
        isAdmin={isAdmin}
        onMuuttui={() => { haeTasot(); haeKayttajat(); }}
      />

      <Tallennustila isAdmin={isAdmin} />

      <Sailytysajat
        raportit={sailytysRaportit}
        isAdmin={isAdmin}
        onHavita={onHavita}
      />
    </div>
  );
};
