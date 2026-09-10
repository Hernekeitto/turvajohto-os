// Yläpalkin oikean laidan osat: ilmoituskello ja profiilivalikko. Jaettu — molemmilla
// puolilla on sama yläpalkki, samat ilmoitukset ja sama tunnus.

import { useState } from 'react';
import { Bell, KeyRound, History, LogOut, Smartphone, X } from 'lucide-react';

import { LaiteSidonta } from './LaiteSidonta';

// Ilmoituksen muoto on tarkoituksella yleinen, ks. NotificationBellin kommentti.
export type Ilmoitus = {
  id: string;
  otsikko: string;
  kuvaus?: string;
  aika?: string;
  [avain: string]: unknown;
};

type NotificationBellProps<T extends Ilmoitus> = {
  notifications: T[];
  onOpen: (ilmoitus: T) => void;
};

type ProfileMenuProps = {
  nickname: string;
  isAdmin: boolean;
  // Salasananvaihto ja audit-loki ovat valinnaisia: GUARD-puolella ne odottavat vielä
  // purkamista jaetuksi, ja rivi joka ei tee mitään olisi pahempi kuin puuttuva rivi.
  onChangePassword?: () => void;
  onViewAuditLog?: () => void;
  onLogout: () => void;
};

// Nimimerkin alkukirjaimet profiilipainikkeeseen (esim. "Turva 1" -> "T1", "TIKE Päivystäjä" -> "TP").
const getInitials = (name: unknown) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

// Yläpalkin ilmoituskello. Rakenne on tarkoituksella yleinen (tyyppi/otsikko/kuvaus/aika),
// jotta muut ilmoituslajit voi lisätä palvelimen /api/notifications-reittiin ilman että
// tätä komponenttia tarvitsee muuttaa. Toistaiseksi ainoa laji on pääkäyttäjälle tuleva
// jakolinkin hyväksymispyyntö.
export const NotificationBell = <T extends Ilmoitus,>({ notifications, onOpen }: NotificationBellProps<T>) => {
  const [open, setOpen] = useState(false);
  const maara = notifications.length;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={maara === 0 ? 'Ei uusia ilmoituksia' : `${maara} ilmoitusta`}
        className="relative w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-ink-on-dark-muted hover:text-ink-on-dark transition-colors"
      >
        <Bell size={16} />
        {maara > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[1.05rem] h-[1.05rem] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
            {maara > 9 ? '9+' : maara}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-surface rounded-xl shadow-xl border border-line py-2 z-50 text-left">
            <div className="px-4 py-2 border-b border-line-soft">
              <p className="text-sm font-bold text-ink">Ilmoitukset</p>
            </div>
            {maara === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-muted text-center">Ei uusia ilmoituksia.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-line-soft">
                {notifications.map((ilm) => (
                  <button
                    key={ilm.id}
                    onClick={() => { setOpen(false); onOpen(ilm); }}
                    className="w-full text-left px-4 py-3 hover:bg-sunken transition-colors"
                  >
                    <p className="text-sm font-medium text-ink">{ilm.otsikko}</p>
                    <p className="text-xs text-ink-muted mt-0.5">{ilm.kuvaus}</p>
                    {ilm.aika && (
                      <p className="text-[11px] text-ink-subtle mt-1">
                        {new Date(ilm.aika).toLocaleString('fi-FI')}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Yläpalkin profiilipainike + pudotusvalikko. Korvaa aiemman kovakoodatun "TJ"-badgen
// kaikissa nav-palkeissa (ks. käyttöpaikat renderöinnin puolella).
// HUOM: "Muokkaa käyttäjiä" ja "Sovellusasetukset" eivät ole enää täällä vaan etusivun
// painikkeina — valikkoon jäävät vain omaan tunnukseen liittyvät toiminnot.
export const ProfileMenu = ({ nickname, isAdmin, onChangePassword, onViewAuditLog, onLogout }: ProfileMenuProps) => {
  const [open, setOpen] = useState(false);
  // Sidonta avautuu omaan ikkunaansa eikä uutena näkymänä, eikä se ole propsi: se on
  // omaan tunnukseen liittyvä toiminto niin kuin salasanan vaihto, ja se koskee juuri
  // sitä laitetta jolla valikko on auki. Ilman ikkunaa jokainen käyttöpaikka joutuisi
  // kytkemään oman reitin samaan korttiin.
  const [laiteAuki, setLaiteAuki] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={nickname}
        className="w-8 h-8 rounded-full bg-accent hover:bg-accent-hover flex items-center justify-center font-bold text-sm text-white transition-colors"
      >
        {getInitials(nickname)}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-surface rounded-xl shadow-xl border border-line py-2 z-50 text-left">
            <div className="px-4 py-2 border-b border-line-soft">
              <p className="text-sm font-bold text-ink truncate">{nickname}</p>
              {isAdmin && <p className="text-xs text-accent font-medium mt-0.5">Pääkäyttäjä</p>}
            </div>
            {onChangePassword && (
              <button
                onClick={() => { setOpen(false); onChangePassword(); }}
                className="w-full text-left px-4 py-2 text-sm text-ink-body hover:bg-sunken flex items-center gap-2 transition-colors"
              >
                <KeyRound size={16} className="text-ink-subtle" />
                Vaihda salasana
              </button>
            )}
            <button
              onClick={() => { setOpen(false); setLaiteAuki(true); }}
              className="w-full text-left px-4 py-2 text-sm text-ink-body hover:bg-sunken flex items-center gap-2 transition-colors"
            >
              <Smartphone size={16} className="text-ink-subtle" />
              Laitteen sidonta
            </button>
            {isAdmin && onViewAuditLog && (
              <button
                onClick={() => { setOpen(false); onViewAuditLog(); }}
                className="w-full text-left px-4 py-2 text-sm text-ink-body hover:bg-sunken flex items-center gap-2 transition-colors"
              >
                <History size={16} className="text-ink-subtle" />
                Audit-loki
              </button>
            )}
            <div className="border-t border-line-soft my-1" />
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full text-left px-4 py-2 text-sm text-danger-ink hover:bg-danger-soft flex items-center gap-2 transition-colors"
            >
              <LogOut size={16} />
              Kirjaudu ulos
            </button>
          </div>
        </>
      )}

      {laiteAuki && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setLaiteAuki(false)}
        >
          {/* Klikkaus kortin sisällä ei saa sulkea ikkunaa: sidontapainikkeen painaminen
              on juuri sellainen klikkaus, ja ikkunan katoaminen sen alta veisi odotustilan
              näkyvistä juuri kun sitä pitäisi katsoa. */}
          <div
            className="w-full max-w-md mt-16 text-ink"
            onClick={(tapahtuma) => tapahtuma.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setLaiteAuki(false)}
                aria-label="Sulje"
                className="mb-2 p-2 rounded-lg bg-surface border border-line hover:bg-sunken transition-colors"
              >
                <X size={16} className="text-ink-muted" />
              </button>
            </div>
            <LaiteSidonta className="" />
          </div>
        </div>
      )}
    </div>
  );
};
