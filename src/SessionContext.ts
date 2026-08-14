import { createContext, useContext } from 'react';

export type NodePermission = { view?: boolean; edit?: boolean };
export type Permissions = Record<string, NodePermission>;

export interface SessionProfile {
  username: string;
  nickname: string;
  role: 'admin' | 'user';
  permissions: Permissions;
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
