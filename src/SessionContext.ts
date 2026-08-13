import { createContext, useContext } from 'react';

// Kirjautuneen käyttäjän tunnus koko sovelluksen käyttöön (esim. raporttien "Laatija"-kenttä).
export const SessionContext = createContext<string | null>(null);

export function useSessionUsername() {
  return useContext(SessionContext);
}
