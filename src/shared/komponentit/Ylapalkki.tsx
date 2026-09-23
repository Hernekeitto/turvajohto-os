// Sovelluksen yläpalkki. Jaettu: molemmilla puolilla on sama palkki, vain tuotenimi ja
// alaotsikko vaihtuvat.
//
// Tämä komponentti syntyi siitä, että sama 26-rivinen palkki oli kopioitu App.tsx:ään
// 13 kertaa. Konkreettinen seuraus: kun tuotenimi vaihtui "Turvajohto OS" -> "Turvajohto
// EVENT", muutos piti tehdä 14 paikkaan. Siksi tuoteNimi on propsi eikä vakio.
//
// HUOM: tapahtumanäkymän oma yläpalkki (sivuvalikkonappi + pikatoiminnot) ei käytä tätä.
// Se on aidosti erilainen, eikä sitä kannata pakottaa tähän lisäpropseilla — se käyttää
// vain YlapalkkiLogoa.

import type { ReactNode } from 'react';
import { ShieldCheck, Clock } from 'lucide-react';
import { NotificationBell, ProfileMenu, type Ilmoitus } from './YlapalkkiOsat';

type YlapalkkiLogoProps = {
  tuoteNimi: string;
  alaotsikko?: string;
  onLogo: () => void;
};

// Palkin vasen laita: logo, tuotenimi ja näkymän nimi. Vie aina etusivulle.
export const YlapalkkiLogo = ({ tuoteNimi, alaotsikko, onLogo }: YlapalkkiLogoProps) => (
  <button
    type="button"
    onClick={onLogo}
    title="Etusivulle"
    className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
  >
    <ShieldCheck className="text-accent-on-dark" size={28} />
    {alaotsikko ? (
      <div>
        <h1 className="text-xl font-bold leading-tight tracking-tight">{tuoteNimi}</h1>
        <p className="hidden md:block text-xs text-ink-on-dark-muted font-medium">{alaotsikko}</p>
      </div>
    ) : (
      <h1 className="text-xl font-bold leading-tight tracking-tight">{tuoteNimi}</h1>
    )}
  </button>
);

type YlapalkkiProps<T extends Ilmoitus> = YlapalkkiLogoProps & {
  // Annettu kellonaika näytetään palkissa; puuttuva jättää kellon pois.
  kello?: string;
  sticky?: boolean;
  // Tuotekohtainen lisäpainike ilmoituskellon VASEMMALLE puolelle (esim. GUARD-puolen
  // PTT-painike). Puuttuva ei näytä mitään — EVENT-puoli ei anna tätä propsia lainkaan,
  // eikä tämän jaetun komponentin tarvitse tietää mitä tuotteita on olemassa.
  ekstra?: ReactNode;
  ilmoitukset: T[];
  onIlmoitus: (ilmoitus: T) => void;
  nimimerkki: string;
  isAdmin: boolean;
  onChangePassword?: () => void;
  onViewAuditLog?: () => void;
  onLogout: () => void;
};

export const Ylapalkki = <T extends Ilmoitus,>({
  tuoteNimi,
  alaotsikko,
  onLogo,
  kello,
  sticky = false,
  ekstra,
  ilmoitukset,
  onIlmoitus,
  nimimerkki,
  isAdmin,
  onChangePassword,
  onViewAuditLog,
  onLogout,
}: YlapalkkiProps<T>) => (
  <nav
    className={`bg-surface-dark text-ink-on-dark px-6 py-4 flex justify-between items-center shadow-md${
      sticky ? ' sticky top-0 z-50' : ''
    }`}
  >
    <YlapalkkiLogo tuoteNimi={tuoteNimi} alaotsikko={alaotsikko} onLogo={onLogo} />
    <div className="flex items-center gap-4">
      {kello && (
        <div className="hidden md:flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg">
          <Clock size={16} className="text-accent-on-dark" />
          <span className="font-mono text-sm tracking-widest">{kello}</span>
        </div>
      )}
      {ekstra}
      <NotificationBell notifications={ilmoitukset} onOpen={onIlmoitus} />
      <ProfileMenu
        nickname={nimimerkki}
        isAdmin={isAdmin}
        onChangePassword={onChangePassword}
        onViewAuditLog={onViewAuditLog}
        onLogout={onLogout}
      />
    </div>
  </nav>
);
