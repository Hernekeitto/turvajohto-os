import { createContext, useContext } from 'react';

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
  permissions: Permissions;
  // Tämän istunnon kirjautumishetki ISO-muodossa, tai null jos käyttäjä ei ole
  // kirjautunut kertaakaan sen jälkeen kun palvelin alkoi tallentaa sitä.
  lastLoginAt: string | null;
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
