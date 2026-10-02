import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Archive, HardDrive, ListTree, ShieldCheck, Smartphone, UserCog, Users,
} from 'lucide-react';
import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { AsetusValikko } from '../shared/komponentit/AsetusValikko';
import { useTakaisinEste } from '../shared/navigointi';
import { Kayttajatasot } from '../shared/asetukset/Kayttajatasot';
import { Kayttajat } from '../shared/asetukset/Kayttajat';
import { Laitteet } from '../shared/asetukset/Laitteet';
import { Tallennustila } from '../shared/asetukset/Tallennustila';
import { KayttajienTallennustila } from '../shared/asetukset/KayttajienTallennustila';
import { Sailytysajat } from '../shared/asetukset/Sailytysajat';
import { ASETUSTEN_SIVUKARTAT } from '../asetusten-sivukartat';
import type { GuardRaportti } from './tyypit';
import { MikroraportinValikot } from './MikroraportinValikot';

// GUARD-puolen sovellusasetukset. Samat osiot kuin tapahtumapuolella yhtä lukuun
// ottamatta: pikatoiminnot (hätätekstiviestit) ovat tapahtuman johtamisen työkalu ja
// jäävät EVENT-puolelle.
//
// Osiot ovat jaettuja komponentteja (shared/asetukset/), joten näkymä ei ole kopio
// App.tsx:n asetuksista vaan sama koodi. Käyttäjätasot ja tallennustila ovat koko
// sovelluksen yhteisiä; vain säilytysaikaosio saa eri datan, koska se laskee sen puolen
// raporteista jolta se avataan.
//
// Jokainen osio on oma painikkeensa (2.10.2026, käyttäjän pyyntö): kaikki osiot yhdellä
// sivulla tekivät siitä niin pitkän, että etsitty asetus hukkui. Avattu osio näkyy
// yksinään, ja takaisin pääsee linkistä tai selaimen/puhelimen takaisin-painikkeella.

type OsioId = 'kayttajat' | 'tasot' | 'laitteet' | 'mikro' | 'tallennustila' | 'kayttajien_tila' | 'sailytys';

const OSIOT: { id: OsioId; nimi: string; kuvaus: string; Ikoni: LucideIcon; vainPaakayttajalle?: boolean }[] = [
  { id: 'kayttajat', nimi: 'Käyttäjät', kuvaus: 'Käyttäjätunnukset, tasot ja kirjautumiset.', Ikoni: Users },
  { id: 'tasot', nimi: 'Käyttäjätasot', kuvaus: 'Tasojen oikeudet sivukartan solmuittain.', Ikoni: ShieldCheck },
  { id: 'laitteet', nimi: 'Laitteet', kuvaus: 'Sovellukseen sidotut puhelimet ja niiden nollaus.', Ikoni: Smartphone },
  {
    id: 'mikro', nimi: 'Mikroraportin valikot', kuvaus: 'Paikat ja otsikot, joista vartija valitsee.',
    Ikoni: ListTree, vainPaakayttajalle: true,
  },
  { id: 'tallennustila', nimi: 'Tallennustila', kuvaus: 'Palvelimen levytilan käyttö.', Ikoni: HardDrive },
  { id: 'kayttajien_tila', nimi: 'Käyttäjien tallennustila', kuvaus: 'Henkilökohtaiset kiintiöt ja lisätilapyynnöt.', Ikoni: UserCog },
  { id: 'sailytys', nimi: 'Säilytysajat', kuvaus: 'Lakisääteiset säilytysajat ja vanhentuneiden hävitys.', Ikoni: Archive },
];

type Props = {
  raportit: GuardRaportti[];
  isAdmin: boolean;
  onHavita: () => void;
  // Käyttäjälistan rivi avaa henkilön työntekijäpankissa (tunnusten ainoa hallintapaikka).
  onAvaaHenkilo: (employeeId: string) => void;
  onTakaisin: () => void;
};

export const Asetukset = ({ raportit, isAdmin, onHavita, onAvaaHenkilo, onTakaisin }: Props) => {
  const [roles, setRoles] = useState<any[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [kayttajat, setKayttajat] = useState<any[]>([]);
  const [osio, setOsio] = useState<OsioId | null>(null);
  // Takaisin-painike sulkee avatun osion eikä poistu koko asetuksista.
  useTakaisinEste(!!osio, () => setOsio(null));

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

  const osiot = OSIOT.filter((o) => !o.vainPaakayttajalle || isAdmin);
  const auki = osiot.find((o) => o.id === osio) || null;

  // Avatun osion sisältö. Osiot ovat samat jaetut komponentit kuin ennenkin; vain se
  // muuttui, että kerralla näkyy yksi.
  const sisalto = (id: OsioId) => {
    switch (id) {
      case 'kayttajat':
        return (
          <Kayttajat
            kayttajat={kayttajat}
            roles={roles}
            isAdmin={isAdmin}
            onAvaaHenkilo={onAvaaHenkilo}
            onMuuttui={haeKayttajat}
          />
        );
      case 'tasot':
        return (
          <Kayttajatasot
            roles={roles}
            rolesLoading={rolesLoading}
            kayttajat={kayttajat}
            sivukartat={ASETUSTEN_SIVUKARTAT}
            isAdmin={isAdmin}
            onMuuttui={() => { haeTasot(); haeKayttajat(); }}
          />
        );
      // Laitesidonnat GUARD-puolella eikä EVENTissä: sovellus on vartijan työkalu, ja
      // nollausoikeus on hälytyskeskuksella joka on tämän puolen käsite.
      case 'laitteet':
        return <Laitteet />;
      case 'mikro':
        return <MikroraportinValikot isAdmin={isAdmin} />;
      case 'tallennustila':
        return <Tallennustila isAdmin={isAdmin} />;
      case 'kayttajien_tila':
        return <KayttajienTallennustila isAdmin={isAdmin} />;
      case 'sailytys':
        return <Sailytysajat raportit={sailytysRaportit} isAdmin={isAdmin} onHavita={onHavita} />;
    }
  };

  // Painikkeen alle tuleva tieto, kun se on jo käsillä ilman erillistä hakua.
  const tiivistelma = (id: OsioId): string | null => {
    if (!isAdmin) return null;
    if (id === 'kayttajat' && kayttajat.length > 0) return `${kayttajat.length} tunnusta`;
    if (id === 'tasot' && roles.length > 0) return `${roles.length} tasoa`;
    return null;
  };

  if (auki) {
    return (
      <div>
        <TakaisinLinkki onClick={() => setOsio(null)}>Sovellusasetukset</TakaisinLinkki>
        {sisalto(auki.id)}
      </div>
    );
  }

  return (
    <div>
      <TakaisinLinkki onClick={onTakaisin}>Takaisin</TakaisinLinkki>

      <h2 className="text-2xl font-bold text-ink-strong mb-1">Sovellusasetukset</h2>
      <p className="text-sm text-ink-muted mb-6">Valitse muokattava asetus.</p>

      <AsetusValikko osiot={osiot.map((o) => ({ ...o, tiivistelma: tiivistelma(o.id) }))} onValitse={setOsio} />
    </div>
  );
};
