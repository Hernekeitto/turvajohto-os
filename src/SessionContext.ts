import { createContext, useContext } from 'react';

// Tuotteet joihin sovellus jakautuu. Sama merkkijono palvelimella (server/index.js: TUOTTEET)
// ja osoitepolussa (/event, /guard).
export type Tuote = 'event' | 'guard';

export type NodePermission = { view?: boolean; edit?: boolean };
export type Permissions = Record<string, NodePermission>;

export interface SessionProfile {
  username: string;
  nickname: string;
  role: 'admin' | 'user';
  // Pysyvä tunnistenumero (#1000 →), jolla henkilö yksilöidään raporteissa
  // tapahtumakohtaisen nimimerkin lisäksi. null jos tunnukselle ei ole annettu numeroa.
  displayId: number | null;
  // Mihin työntekijäpankin tietueeseen tunnus liittyy.
  employeeId: string | null;
  // Käyttäjätaso, joka määrää sivukartta-oikeudet (ks. server/roles.js).
  roleId: string | null;
  roleName: string | null;
  // true = pääkäyttäjä on asettanut väliaikaisen salasanan, joka on vaihdettava
  // ennen kuin sovellusta voi käyttää. Palvelin estää kaiken muun (server/index.js).
  mustChangePassword: boolean;
  // Mihin puoliin tunnus pääsee: 'event' = Turvajohto EVENT, 'guard' = Turvajohto GUARD.
  // Palvelin ratkaisee tämän (server/index.js: paaseeTuotteisiin) ja admin saa aina
  // molemmat. Käyttöliittymän esto on kohteliaisuus — varsinainen portti on palvelimella.
  tuotteet: Tuote[];
  permissions: Permissions;
  // Tämän istunnon kirjautumishetki ISO-muodossa, tai null jos käyttäjä ei ole
  // kirjautunut kertaakaan sen jälkeen kun palvelin alkoi tallentaa sitä.
  lastLoginAt: string | null;
  // Onko sijaintiseuranta kytketty palvelimella päälle (SIJAINTISEURANTA=1). Ei
  // oikeustieto vaan tieto siitä onko toiminto olemassa: ilman tätä selain kysyisi
  // paikannuslupaa toimintoon jota ei ole. Sijaintien NÄKEMINEN on oma solmunsa
  // ('locations'). Valinnainen, koska laitteelle tallennettu istunto (shared/istunto.ts)
  // voi olla vanhempi kuin tämä kenttä.
  sijaintiseuranta?: boolean;
}

// Kirjautuneen käyttäjän koko profiili koko sovelluksen käyttöön: tunnus,
// nimimerkki (esim. raporttien "Laatija"-kenttä), rooli ja sivukartta-oikeudet.
export const SessionContext = createContext<SessionProfile | null>(null);

export function useSession() {
  return useContext(SessionContext);
}

// Taannehtiva mukavuushook niille kohdille, jotka tarvitsevat vain tunnuksen.
export function useSessionUsername() {
  return useSession()?.username ?? null;
}
