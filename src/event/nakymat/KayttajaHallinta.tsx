// Käyttäjähallinta: käyttäjälista, uuden tunnuksen luonti ja käyttäjän oikeudet.
//
// Irrotettu App.tsx:stä. Kolme näkymää samassa tiedostossa, koska ne ovat saman
// hallintasivun tilat (viewingUserAdmin: 'list' | 'new' | 'permissions') eivätkä
// erikseen käytettäviä. Sivun kuori jää App.tsx:ään (ks. AuditLoki.tsx:n perustelu).
//
// KayttajanOikeudet ohjaa neljää toisistaan riippumatonta palvelinoperaatiota, joilla
// on kullakin oma kesken/virhe-tilansa. Ne on ryhmitelty propseissa operaation mukaan
// (totp, salasana, uloskirjaus, tallennus) eikä levitetty kahdeksitoista litteäksi
// propsiksi: ryhmä kertoo mitkä tilat kuuluvat yhteen, ja jos operaatio joskus
// poistuu, poistuu yksi propsi eikä kolme.

import { AlertTriangle, CheckCircle, IdCard, Info, KeyRound, Layers, LogOut, QrCode,
  RefreshCw, ShieldCheck, Smartphone, UserPlus } from 'lucide-react';

import { muotoileTunniste } from '../../shared/tunnisteet';
import type { KayttajaRivi, Tapahtuma, TotpTiedot, UusiSalasana } from '../tyypit';

// Käyttäjätaso siltä osin kuin nämä näkymät sitä lukevat (GET /api/roles palauttaa
// enemmän). builtin = sisäänrakennettu taso jota ei voi poistaa.
type Taso = { id: string; name: string; builtin?: boolean; description?: string };

// Roolimerkki listassa ja oikeusnäkymän otsikossa.
const roleBadge = (role?: string) => (
  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
    {role === 'admin' ? 'Pääkäyttäjä' : 'Käyttäjä'}
  </span>
);

type ListaProps = {
  kayttajat: KayttajaRivi[];
  lataa: boolean;
  virhe: string;
  tasot: Taso[];
  onUusi: () => void;
  onOikeudet: (kayttaja: KayttajaRivi) => void;
};

export const KayttajaLista = ({ kayttajat, lataa, virhe, tasot, onUusi, onOikeudet }: ListaProps) => (
  <>
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Muokkaa käyttäjiä</h2>
        <p className="text-sm text-slate-500 mt-1">Kaikki sovelluksen käyttäjätunnukset ja niiden sivukartta-oikeudet.</p>
      </div>
      <button
        onClick={() => onUusi()}
        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm shrink-0"
      >
        <UserPlus size={16} />
        Uusi käyttäjä
      </button>
    </div>

    {virhe && <p className="text-sm text-rose-600 mb-4">{virhe}</p>}

    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
          <tr>
            <th className="p-4">Nimimerkki</th>
            <th className="p-4 w-24">Tunniste</th>
            <th className="p-4">Käyttäjätaso</th>
            <th className="p-4">Käyttäjätunnus</th>
            <th className="p-4">Luotu</th>
            <th className="p-4 text-right">Toiminnot</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {lataa ? (
            <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">Ladataan…</td></tr>
          ) : kayttajat.length === 0 ? (
            <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">Ei käyttäjiä.</td></tr>
          ) : kayttajat.map((u) => (
            <tr key={u.username} className="hover:bg-slate-50 transition-colors">
              <td className="p-4 font-medium text-slate-800">{u.nickname}</td>
              <td className="p-4">
                {u.displayId
                  ? <span className="font-mono text-xs font-bold text-indigo-700">{muotoileTunniste(u.displayId)}</span>
                  : <span className="text-xs text-slate-400">—</span>}
              </td>
              <td className="p-4 text-slate-600 text-xs">
                {tasot.find((r) => r.id === u.roleId)?.name || u.roleId || '—'}
              </td>
              <td className="p-4 font-mono text-xs text-slate-600">{u.username}</td>
              <td className="p-4 text-slate-500 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString('fi-FI') : '—'}</td>
              <td className="p-4 text-right">
                <button
                  onClick={() => onOikeudet(u)}
                  className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                >
                  Muokkaa oikeuksia
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
);

type UusiProps = {
  tunnus: string;
  onTunnus: (teksti: string) => void;
  virhe: string;
  kesken: boolean;
  onLuo: () => void;
  onPeruuta: () => void;
  // Luonnin jälkeen näytettävä väliaikainen salasana. Näkyy vain kerran.
  uusiSalasana: UusiSalasana | null;
};

export const UusiKayttaja = ({
  tunnus, onTunnus, virhe, kesken, onLuo, onPeruuta, uusiSalasana,
}: UusiProps) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8">
    <div className="mb-6 border-b border-slate-100 pb-4">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <UserPlus className="text-emerald-500" size={24} />
        Uusi käyttäjä
      </h2>
      <p className="text-sm text-slate-500 mt-1">
        Uudella käyttäjällä ei ole oletuksena mitään sivukartta-oikeuksia, ja hän tarvitsee Authenticator-sovelluksen kirjautuakseen — hoida molemmat luonnin jälkeen "Muokkaa oikeuksia" -kohdasta.
      </p>
    </div>
    <form className="space-y-4 text-left max-w-md" onSubmit={(e) => e.preventDefault()}>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Käyttäjä</label>
        <input
          type="text"
          autoComplete="username"
          value={tunnus}
          onChange={(e) => onTunnus(e.target.value)}
          className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
          placeholder="esim. tikepvst"
        />
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex gap-2.5">
        <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 leading-relaxed">
          Nimimerkkiä ei enää aseteta tässä. Raporttien "Laatija"-kenttä muodostuu
          tapahtumakohtaisesta nimimerkistä ja henkilön tunnistenumerosta (esim.
          "Ensiapu 1 #1028") — nimimerkki annetaan kun henkilö lisätään tapahtumaan.
          Tunnukset kannattaa luoda työntekijäpankista, jolloin nimi, tunnus ja
          tunnistenumero täyttyvät automaattisesti.
        </p>
      </div>
      {/* Salasanaa ei syötetä: palvelin arpoo sen ja näyttää kerran alla. */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex gap-2.5">
        <KeyRound size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 leading-relaxed">
          Salasanaa ei aseteta käsin. Palvelin arpoo väliaikaisen salasanan, joka
          näytetään sinulle kerran luonnin jälkeen. Käyttäjä kirjautuu sillä ja joutuu
          heti vaihtamaan sen omakseen.
        </p>
      </div>
      {uusiSalasana && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-4">
          <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide mb-1">
            Tunnus {uusiSalasana.username} luotu — väliaikainen salasana
          </p>
          <code className="block bg-white border border-emerald-200 rounded-lg px-3 py-2.5 text-base font-mono font-bold tracking-wider break-all text-slate-900">
            {uusiSalasana.password}
          </code>
          <p className="text-xs text-emerald-800 mt-2">
            Välitä tämä käyttäjälle. Salasanaa ei voi hakea myöhemmin uudelleen.
          </p>
        </div>
      )}
      {virhe && <p className="text-sm text-rose-600">{virhe}</p>}
      <div className="pt-2 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => onPeruuta()}
          className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          Peruuta
        </button>
        <button
          type="button"
          disabled={kesken}
          onClick={onLuo}
          className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
        >
          <CheckCircle size={18} />
          {kesken ? 'Luodaan…' : 'Luo käyttäjä'}
        </button>
      </div>
    </form>
  </div>
);

// Yhden palvelinoperaation tila ja käynnistys. Neljä tällaista ryhmää alla; ne ovat
// toisistaan riippumattomia, ja jokaisella on oma kesken/virhe-tilansa.
type TotpRyhma = {
  info: TotpTiedot | null;
  virhe: string;
  lataa: boolean;
  nollataan: boolean;
  vaihdetaan: boolean;
  onNollaa: () => void;
  onVaihda: () => void;
};

type OikeusProps = {
  muokattava: KayttajaRivi;
  nimimerkki: string;
  onNimimerkki: (teksti: string) => void;
  taso: string;
  onTaso: (id: string) => void;
  tasot: Taso[];
  tasotLatautuu: boolean;
  // Mitkä puolet (event/guard) valittu taso edellyttää — varoitus puuttuvista.
  tasonPuolet: (roleId: string) => string[];
  tuotteet: string[];
  onTuote: (tuote: string) => void;
  // Puuttuvien puolien lisäys kerralla, kun valittu taso edellyttää niitä.
  onLisaaPuolet: (puolet: string[]) => void;
  // Tyhjä = ei tapahtumarajausta (ks. server/db.js: withDefaults).
  tapahtumaPaasy: string[];
  onTapahtumaPaasy: (eventId: string) => void;
  tapahtumat: Tapahtuma[];
  totp: TotpRyhma;
  salasana: { naytto: UusiSalasana | null; onNollaa: () => void };
  uloskirjaus: { viesti: string; kesken: boolean; onPakota: () => void };
  tallennus: { kesken: boolean; virhe: string; onTallenna: () => void };
  onPeruuta: () => void;
};

export const KayttajanOikeudet = ({
  muokattava, nimimerkki, onNimimerkki, taso, onTaso, tasot, tasotLatautuu, tasonPuolet,
  tuotteet, onTuote, onLisaaPuolet, tapahtumaPaasy, onTapahtumaPaasy, tapahtumat,
  totp, salasana, uloskirjaus, tallennus, onPeruuta,
}: OikeusProps) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8">
    <div className="mb-6 border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <IdCard className="text-indigo-500" size={24} />
          Käyttöoikeudet: {muokattava.username}
        </h2>
        <p className="text-sm text-slate-500 mt-1">Valitse mitkä sivut käyttäjä näkee ja voi muokata.</p>
      </div>
      <div className="flex items-center gap-3">
        {roleBadge(muokattava.role)}
        {muokattava.role !== 'admin' && (
          <button
            type="button"
            disabled={uloskirjaus.kesken}
            onClick={uloskirjaus.onPakota}
            title="Mitätöi käyttäjän nykyisen istunnon välittömästi"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
          >
            <LogOut size={14} />
            {uloskirjaus.kesken ? 'Kirjataan ulos…' : 'Kirjaa käyttäjä ulos'}
          </button>
        )}
      </div>
    </div>
    {uloskirjaus.viesti && (
      <p className="text-sm text-emerald-600 -mt-4 mb-6">{uloskirjaus.viesti}</p>
    )}

    <div className="mb-6 max-w-sm">
      <label className="block text-sm font-medium text-slate-700 mb-1">Nimimerkki</label>
      <input
        type="text"
        value={nimimerkki}
        onChange={(e) => onNimimerkki(e.target.value)}
        className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
      />
    </div>

    {muokattava.role !== 'admin' && (
      <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
          <Smartphone size={18} className="text-slate-400" />
          Authenticator-sovellus (TOTP)
          {totp.info && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${totp.info.totpRequired !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
              {totp.info.totpRequired !== false ? 'Käytössä' : 'Pois käytöstä'}
            </span>
          )}
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Käyttäjä tarvitsee tämän kirjautuakseen. Skannaa QR-koodi Google Authenticatorilla (tai vastaavalla) käyttäjän puhelimeen, tai syötä tekstisalaisuus käsin.
        </p>
        {totp.lataa ? (
          <p className="text-sm text-slate-500">Ladataan…</p>
        ) : totp.info ? (
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <img
              src={totp.info.qrDataUri}
              alt="Authenticator-sovelluksen QR-koodi"
              className="w-40 h-40 rounded-lg border border-slate-200 bg-white p-2 shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <QrCode size={12} />
                  Tekstisalaisuus (jos QR ei skannaudu)
                </label>
                <code className="block bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono tracking-wide break-all">
                  {totp.info.secret}
                </code>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={totp.nollataan}
                  onClick={totp.onNollaa}
                  className="flex items-center gap-2 text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 disabled:opacity-60 px-3 py-2 rounded-lg transition-colors"
                >
                  <RefreshCw size={14} />
                  {totp.nollataan ? 'Nollataan…' : 'Nollaa Authenticator (esim. puhelin kadonnut)'}
                </button>
                <button
                  type="button"
                  disabled={totp.vaihdetaan}
                  onClick={totp.onVaihda}
                  className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 px-3 py-2 rounded-lg transition-colors"
                >
                  <Smartphone size={14} />
                  {totp.vaihdetaan
                    ? 'Päivitetään…'
                    : totp.info.totpRequired !== false
                      ? 'Poista Authenticator käytöstä'
                      : 'Ota Authenticator uudelleen käyttöön'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {totp.virhe && <p className="text-sm text-rose-600 mt-3">{totp.virhe}</p>}
      </div>
    )}

    {/* Sivukartta-oikeudet tulevat KÄYTTÄJÄTASOLTA (server/tasot.js), ei enää
        käyttäjäkohtaisesti. Täällä valitaan vain taso; itse tason sivuoikeuksia
        muokataan Sovellusasetuksissa. Näin yhdestä paikasta näkee kenellä on
        mitkä oikeudet, eikä efektiivisiä oikeuksia tarvitse laskea kahdesta
        lähteestä. */}
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
      <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
        <ShieldCheck className="text-indigo-500" size={16} />
        Käyttäjätaso
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        Taso määrää mitä sivuja käyttäjä näkee ja voi muokata. Tasojen sisältöä
        muokataan Sovellusasetuksista — muutos vaikuttaa kaikkiin tason käyttäjiin heti.
      </p>

      {tasotLatautuu ? (
        <p className="text-sm text-slate-500">Ladataan tasoja…</p>
      ) : tasot.length === 0 ? (
        <p className="text-sm text-rose-600">Käyttäjätasoja ei saatu ladattua.</p>
      ) : (
        <div className="space-y-2">
          {tasot.map((role) => (
            <label
              key={role.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                taso === role.id
                  ? 'bg-indigo-50 border-indigo-300'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="permRole"
                checked={taso === role.id}
                onChange={() => onTaso(role.id)}
                className="w-4 h-4 mt-0.5 text-indigo-600 focus:ring-indigo-500 shrink-0"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-800">
                  {role.name}
                  {role.builtin && <span className="ml-2 text-xs font-medium text-slate-400">vakio</span>}
                </span>
                {role.description && (
                  <span className="block text-xs text-slate-500 mt-0.5">{role.description}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}

      {taso === 'admin' && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
          Pääkäyttäjällä on täydet oikeudet kaikkeen, mukaan lukien käyttäjien ja
          tasojen hallinta. Anna tämä taso vain harkiten.
        </p>
      )}

      {(() => {
        if (taso === 'admin') return null;
        const puuttuvat = tasonPuolet(taso).filter((t) => !tuotteet.includes(t));
        if (puuttuvat.length === 0) return null;
        const nimet: Record<string, string> = {
          event: 'Turvajohto EVENT',
          guard: 'Turvajohto GUARD',
        };
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3 flex gap-2.5">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-amber-900 leading-relaxed">
                Taso antaa sivuja puolelta{' '}
                <strong>{puuttuvat.map((t) => nimet[t]).join(' ja ')}</strong>, mutta
                tunnuksella ei ole sinne pääsyä. Ilman sitä käyttäjä ei pääse
                kirjautumaan kyseiselle puolelle lainkaan.
              </p>
              <button
                type="button"
                onClick={() => onLisaaPuolet(puuttuvat)}
                className="mt-2 text-xs font-bold text-amber-900 underline hover:no-underline"
              >
                Lisää {puuttuvat.map((t) => nimet[t]).join(' ja ')} alla oleviin puoliin
              </button>
            </div>
          </div>
        );
      })()}
    </div>

    {/* Salasanan nollaus: käyttäjä ei muista omaansa */}
    <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5">
      <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
        <KeyRound className="text-indigo-500" size={16} />
        Salasana
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        Nollaus arpoo uuden väliaikaisen salasanan, joka näytetään sinulle kerran.
        Käyttäjä kirjautuu sillä ja joutuu heti vaihtamaan sen omakseen.
      </p>
      {salasana.naytto && salasana.naytto.username === muokattava.username ? (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-4">
          <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide mb-2">
            Väliaikainen salasana — näytetään vain nyt
          </p>
          <code className="block bg-white border border-emerald-200 rounded-lg px-3 py-2.5 text-base font-mono font-bold tracking-wider break-all text-slate-900">
            {salasana.naytto.password}
          </code>
          <p className="text-xs text-emerald-800 mt-2">
            Välitä tämä käyttäjälle. Salasanaa ei voi hakea myöhemmin uudelleen —
            jos se katoaa, nollaa uudestaan.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={salasana.onNollaa}
          className="flex items-center gap-2 text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg transition-colors"
        >
          <RefreshCw size={14} />
          Nollaa salasana
        </button>
      )}
    </div>

    {/* Tuotepääsy. Uusi koodi käyttää teematokeneita (ks. src/TEEMA.md) — värit ovat
        EVENT-puolella samat kuin viereisissä slate-luokissa, mutta lohko siirtyy
        aikanaan jaettuun kansioon sellaisenaan. */}
    {muokattava.role !== 'admin' && (
      <>
      <div className="mt-6 bg-sunken border border-line rounded-xl p-5">
        <h3 className="text-sm font-bold text-ink mb-1 flex items-center gap-2">
          <ShieldCheck className="text-accent" size={16} />
          Puolet
        </h3>
        <p className="text-xs text-ink-muted mb-4">
          Mihin puoliin tunnus pääsee kirjautumaan. Sama tunnus käy molempiin, ja
          valinta ratkaisee vain sen kumman osoitteen takaa sovellus aukeaa —
          sivukartta-oikeudet määräävät edelleen mitä hän siellä näkee. Vähintään
          yksi puoli on valittava.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'event', nimi: 'Turvajohto EVENT', selite: 'Tapahtumat' },
            { id: 'guard', nimi: 'Turvajohto GUARD', selite: 'Vartiointi' },
          ].map((t) => (
            <label
              key={t.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                tuotteet.includes(t.id)
                  ? 'bg-accent-soft border-accent text-accent-ink'
                  : 'bg-surface border-line text-ink-body hover:bg-sunken'
              }`}
            >
              <input
                type="checkbox"
                checked={tuotteet.includes(t.id)}
                onChange={() => onTuote(t.id)}
                className="w-4 h-4 text-accent rounded border-line-strong focus:ring-accent"
              />
              {t.nimi}
              <span className="text-xs text-ink-subtle">({t.selite})</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
          <Layers className="text-indigo-500" size={16} />
          Tapahtumarajaus
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Jos yhtään tapahtumaa ei ole valittu, käyttäjä näkee kaikkien tapahtumien datan
          normaaliin tapaan (ei rajoitusta). Valitsemalla tapahtumia käyttäjä näkee ja voi
          muokata vain niiden kirjauksia, raportteja ja riskiarviointeja — Sivukartta-
          oikeudet määräävät edelleen mitä sivuja hän ylipäätään näkee, tämä vain mitkä
          tapahtumat niillä sivuilla näkyvät.
        </p>
        {tapahtumat.length === 0 ? (
          <p className="text-sm text-slate-500">Ei tapahtumia.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tapahtumat.map((ev) => (
              <label
                key={ev.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                  tapahtumaPaasy.includes(ev.id)
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={tapahtumaPaasy.includes(ev.id)}
                  onChange={() => onTapahtumaPaasy(ev.id)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                {ev.name}
                {ev.archived && <span className="text-xs text-slate-400">(arkistoitu)</span>}
              </label>
            ))}
          </div>
        )}
      </div>
      </>
    )}

    {tallennus.virhe && <p className="text-sm text-rose-600 mt-4">{tallennus.virhe}</p>}

    <div className="pt-6 mt-2 flex justify-end gap-3 border-t border-slate-100">
      <button
        type="button"
        onClick={() => onPeruuta()}
        className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
      >
        Peruuta
      </button>
      <button
        type="button"
        disabled={tallennus.kesken}
        onClick={tallennus.onTallenna}
        className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
      >
        <CheckCircle size={18} />
        {tallennus.kesken ? 'Tallennetaan…' : 'Tallenna oikeudet'}
      </button>
    </div>
  </div>
);
