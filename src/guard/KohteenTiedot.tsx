import { useState } from 'react';
import {
  MapPin, Phone, FileText, Download, GraduationCap, ClipboardList,
  Check, X, Eye, EyeOff, ShieldAlert, Route,
} from 'lucide-react';
import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { Kartta } from '../shared/komponentit/Kartta';
import { Vyohykekirjaukset, type AlueKirjaus } from '../shared/komponentit/Vyohykekirjaukset';
import { tila as kirjauksenTila } from '../shared/kirjaukset';
import { muotoileTunniste } from '../shared/tunnisteet';
import { muotoileTavut } from '../shared/muotoilu';
import type { GuardRaportti, Kohde, KohteenTiedosto, TehtavaSuoritus, Kierros } from './tyypit';

// Kohteen tiedot: koottu näkymä siitä mitä kohteessa on ja mitä siellä on tapahtunut.
// EI kohteen perustietojen muokkausnäkymä — se on KohteenHallinta, ja tämä on
// tarkoituksella erillisen oikeuden (guard_site_info) takana, jotta koosteen lukeminen ei
// edellytä oikeutta muuttaa kohdetta.

const muotoileAika = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fi-FI', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Henkilötunnus peitetään myös koosteessa, samoin kuin tapahtumapuolen raporttinäkymässä:
// suora tunniste ei saa näkyä sivusilmällä silloin kun raporttia selataan muiden läsnä
// ollessa tai ruutu on jaettuna. Arvo on jo haettu palvelimelta, joten tämä on
// näkyvyyssuoja eikä pääsynhallintaa.
const Peitetty = ({ arvo }: { arvo: string }) => {
  const [nakyy, setNakyy] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <span className={nakyy ? '' : 'tracking-widest'}>{nakyy ? arvo : '•••••••••••'}</span>
      <button
        type="button"
        onClick={() => setNakyy((n) => !n)}
        className="text-ink-subtle hover:text-ink-body transition-colors"
        title={nakyy ? 'Piilota' : 'Näytä'}
      >
        {nakyy ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </span>
  );
};

type Props = {
  kohde: Kohde;
  tiedostot: KohteenTiedosto[];
  suoritukset: TehtavaSuoritus[];
  raportit: GuardRaportti[];
  // Kierrokset ovat koosteessa mukana, koska "mita kohteessa on tapahtunut" on juuri se
  // kysymys johon kierroslokilla vastataan: kuka kavi, milloin ja kaytiinko kaikki pisteet.
  kierrokset: Kierros[];
  onTakaisin: () => void;
};

export const KohteenTiedot = ({ kohde, tiedostot, suoritukset, raportit, kierrokset, onTakaisin }: Props) => {
  const [avattu, setAvattu] = useState<string | null>(null);
  const [karttaVyohyke, setKarttaVyohyke] = useState<string | null>(null);

  const omatSuoritukset = suoritukset
    .filter((s) => s.siteId === kohde.id)
    .sort((a, b) => (a.aika < b.aika ? 1 : -1));
  const omatRaportit = raportit
    .filter((r) => r.siteId === kohde.id)
    .sort((a, b) => ((a.luotu || a.date) < (b.luotu || b.date) ? 1 : -1));
  const omatKierrokset = kierrokset
    .filter((k) => k.siteId === kohde.id)
    .sort((a, b) => (a.alkoi < b.alkoi ? 1 : -1));
  const omatTiedostot = tiedostot.filter((t) => t.siteId === kohde.id);

  // Kartan kirjaustaso (erä 2). Merkkejä saavat vain ne kirjaukset joille on osoitettu
  // kohta kartalta; vyöhykelistassa ovat kaikki, koska vyöhyke on lomakkeella valittu
  // tieto eikä edellytä osoitettua pistettä.
  const merkit = omatRaportit
    .filter((r) => (r.location as { img?: { x: number; y: number } } | undefined)?.img)
    .map((r) => {
      const img = (r.location as { img: { x: number; y: number } }).img;
      return {
        id: r.id,
        x: img.x,
        y: img.y,
        vari: kirjauksenTila(r.status)?.merkki || '#64748b',
        otsikko: `${r.time || ''} ${r.type || ''}`.trim(),
        onKlikkaus: () => avaaRaportti(r.id),
      };
    });

  const kartanKirjaukset: AlueKirjaus[] = omatRaportit.map((r) => ({
    id: r.id,
    otsikko: `${r.time || ''} ${r.type || 'Kirjaus'}`.trim(),
    lisatieto: r.author || '',
    vari: kirjauksenTila(r.status)?.merkki || '#64748b',
    zoneId: r.zoneId || null,
  }));

  // Kartalta valittu kirjaus avataan siinä listassa jossa se muutenkin luetaan, eikä
  // omassa ikkunassaan: sama sisältö kahdessa esityksessä olisi kaksi paikkaa joita
  // pitää muistaa päivittää. Rivi tuodaan näkyviin, koska kartan alta se jää helposti
  // ruudun ulkopuolelle.
  //
  // Skrollaus tehdään heti eikä renderin jälkeen: rivin ankkuri on DOMissa riippumatta
  // siitä onko raportti auki. requestAnimationFrameen kääritty skrollaus ei tapahtuisi
  // lainkaan taustavälilehdellä, koska kehyksiä ei silloin piirretä.
  //
  // EI `behavior: 'smooth'`. Pehmeä vieritys jää joissakin selaintiloissa kokonaan
  // tekemättä (todettu tämän projektin esikatseluselaimessa), jolloin kartalta napsautettu
  // kirjaus avautuisi ruudun ulkopuolelle eikä käyttäjä näkisi mitään tapahtuvan.
  // Animaatio on koriste, kohtaan siirtyminen on toiminto.
  const avaaRaportti = (id: string) => {
    setAvattu(id);
    document.getElementById(`raportti-${id}`)?.scrollIntoView({ block: 'center' });
  };
  const perehdytykset = kohde.perehdytykset || [];

  return (
    <div className="max-w-4xl">
      <TakaisinLinkki onClick={onTakaisin}>Takaisin kohdelistaan</TakaisinLinkki>
      <h2 className="text-2xl font-bold text-ink-strong mb-1">{kohde.name}</h2>
      <div className="flex flex-wrap gap-4 text-sm text-ink-muted mb-8">
        {kohde.address && (
          <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{kohde.address}</span>
        )}
        {(kohde.contactName || kohde.contactPhone) && (
          <span className="inline-flex items-center gap-1.5">
            <Phone size={14} />
            {[kohde.contactName, kohde.contactPhone].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>

      {kohde.notes && (
        <div className="bg-surface border border-line rounded-xl p-5 mb-6">
          <h3 className="text-sm font-bold text-ink mb-2">Ohjeet vartijalle</h3>
          <p className="text-sm text-ink-body leading-relaxed whitespace-pre-line">{kohde.notes}</p>
        </div>
      )}

      {/* Pohjakartta. Kohteen hallinnassa sama kartta on editorina; tässä se on
          katsomista varten — vyöhykkeet, kirjausmerkit ja rajaus, ei piirtoa. */}
      {kohde.mapUploadId && (
        <div className="bg-surface border border-line rounded-xl p-5 mb-6">
          <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
            <MapPin size={16} className="text-accent" />
            Kohteen kartta
          </h3>
          <Kartta
            karttaId={kohde.mapUploadId}
            vyohykkeet={kohde.zones || []}
            merkit={merkit}
            korostettu={karttaVyohyke}
            onVyohykeKlikkaus={(id) => setKarttaVyohyke((edellinen) => (edellinen === id ? null : id))}
          />
          <Vyohykekirjaukset
            vyohykkeet={kohde.zones || []}
            kirjaukset={kartanKirjaukset}
            valittu={karttaVyohyke}
            onValitse={setKarttaVyohyke}
            onAvaa={avaaRaportti}
          />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <div className="bg-surface border border-line rounded-xl p-5">
          <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
            <GraduationCap size={16} className="text-accent" />
            Perehdytetyt ({perehdytykset.length})
          </h3>
          {perehdytykset.length === 0 ? (
            <p className="text-sm text-ink-muted">Ei perehdytysmerkintöjä.</p>
          ) : (
            <ul className="space-y-2">
              {perehdytykset.map((p) => (
                <li key={p.id} className="text-sm">
                  <span className="text-ink">{p.nimi}</span>
                  {p.displayId ? <span className="text-ink-subtle"> {muotoileTunniste(p.displayId)}</span> : null}
                  <span className="text-ink-muted"> · {p.pvm}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-surface border border-line rounded-xl p-5">
          <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
            <FileText size={16} className="text-accent" />
            Tiedostot ({omatTiedostot.length})
          </h3>
          {omatTiedostot.length === 0 ? (
            <p className="text-sm text-ink-muted">Ei liitettyjä tiedostoja.</p>
          ) : (
            <ul className="space-y-2">
              {omatTiedostot.map((t) => (
                <li key={t.id} className="text-sm flex items-center gap-2">
                  <a
                    href={`/api/uploads/${t.uploadId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink hover:text-accent transition-colors flex-1 truncate"
                  >
                    {t.name}
                  </a>
                  {typeof t.size === 'number' && (
                    <span className="text-xs text-ink-subtle shrink-0">{muotoileTavut(t.size)}</span>
                  )}
                  <Download size={13} className="text-ink-subtle shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-surface border border-line rounded-xl p-5 mb-6">
        <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
          <ClipboardList size={16} className="text-accent" />
          Suoritetut tehtävät ({omatSuoritukset.length})
        </h3>
        {omatSuoritukset.length === 0 ? (
          <p className="text-sm text-ink-muted">Tehtäviä ei ole vielä kuitattu.</p>
        ) : (
          <div className="divide-y divide-line-soft -mx-5">
            {omatSuoritukset.slice(0, 20).map((s) => (
              <div key={s.id} className="px-5 py-3 flex items-start gap-2">
                {s.suoritettu === false ? (
                  <X size={15} className="text-danger shrink-0 mt-0.5" />
                ) : (
                  <Check size={15} className="text-success shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{s.tehtavaNimi}</p>
                  <p className="text-xs text-ink-muted">
                    {muotoileAika(s.aika)} · {s.vartija}
                    {s.kuitatut ? ` · ${s.kuitatut.length} kohtaa kuitattu` : ''}
                  </p>
                  {s.huomiot && (
                    <p className="text-xs text-ink-body mt-1 leading-relaxed">{s.huomiot}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface border border-line rounded-xl p-5 mb-6">
        <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
          <Route size={16} className="text-accent" />
          Kierrokset ({omatKierrokset.length})
        </h3>
        {omatKierrokset.length === 0 ? (
          <p className="text-sm text-ink-muted">Kohteessa ei ole vielä kuljettu kierroksia.</p>
        ) : (
          <div className="divide-y divide-line-soft -mx-5">
            {omatKierrokset.slice(0, 20).map((k) => {
              const kuitatut = k.pisteet.filter((p) => p.kuitattu).length;
              return (
                <div key={k.id} className="px-5 py-3 flex items-start gap-2">
                  {k.tila === 'valmis' ? (
                    <Check size={15} className="text-success shrink-0 mt-0.5" />
                  ) : (
                    <X size={15} className={`shrink-0 mt-0.5 ${k.tila === 'kesken' ? 'text-warning' : 'text-danger'}`} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{k.templateNimi}</p>
                    <p className="text-xs text-ink-muted">
                      {muotoileAika(k.alkoi)} · {k.vartija} · {kuitatut}/{k.pisteet.length} pistettä
                      {k.tila === 'kesken' ? ' · kesken' : k.tila === 'keskeytetty' ? ' · keskeytetty' : ''}
                    </p>
                    {/* Keskeytyksen syy on koosteen olennaisin yksittäinen tieto: se
                        kertoo miksi kierros jäi vajaaksi, eikä sitä pidä joutua etsimään
                        toisesta näkymästä. */}
                    {k.keskeytysSyy && (
                      <p className="text-xs text-ink-body mt-1 leading-relaxed">Syy: {k.keskeytysSyy}</p>
                    )}
                    {k.huomiot && (
                      <p className="text-xs text-ink-body mt-1 leading-relaxed">{k.huomiot}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-surface border border-line rounded-xl p-5">
        <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
          <ShieldAlert size={16} className="text-accent" />
          Raportit ({omatRaportit.length})
        </h3>
        {omatRaportit.length === 0 ? (
          <p className="text-sm text-ink-muted">Kohteelle ei ole kirjattu raportteja.</p>
        ) : (
          <div className="divide-y divide-line-soft -mx-5">
            {omatRaportit.map((r) => {
              const auki = avattu === r.id;
              return (
                <div key={r.id} id={`raportti-${r.id}`} className="px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setAvattu(auki ? null : r.id)}
                    className="w-full text-left"
                  >
                    <p className="text-sm font-medium text-ink">{r.type}</p>
                    <p className="text-xs text-ink-muted">
                      {r.date} klo {r.time} · {r.author}
                    </p>
                    {r.summary && (
                      <p className="text-sm text-ink-body mt-1 leading-relaxed">{r.summary}</p>
                    )}
                  </button>

                  {auki && (
                    <div className="mt-3 pt-3 border-t border-line-soft space-y-2 text-sm">
                      {r.description && (
                        <p className="text-ink-body leading-relaxed whitespace-pre-line">{r.description}</p>
                      )}
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
                        {typeof r.denied === 'number' && r.denied > 0 && <span>Pääsy estetty: {r.denied}</span>}
                        {typeof r.removed === 'number' && r.removed > 0 && <span>Poistettu: {r.removed}</span>}
                        {typeof r.detained === 'number' && r.detained > 0 && <span>Kiinniotettu: {r.detained}</span>}
                        {r.force && <span>Voimakeinoja käytetty</span>}
                        {r.tools && <span>Voimankäyttövälineitä käytetty</span>}
                        {r.firearm && <span>Ampuma-asetta käytetty</span>}
                        {r.firstAid && <span>Ensiapua annettu</span>}
                      </div>
                      {(r.subjectLastName || r.subjectFirstNames || r.subjectPersonalId) && (
                        <div className="bg-sunken rounded-lg p-3 space-y-1 text-xs">
                          <p className="font-medium text-ink-body">Kohdehenkilö</p>
                          <p className="text-ink-muted">
                            {[r.subjectLastName, r.subjectFirstNames].filter(Boolean).join(' ')}
                          </p>
                          {r.subjectPersonalId && (
                            <p className="text-ink-muted">
                              Henkilötunnus: <Peitetty arvo={r.subjectPersonalId} />
                            </p>
                          )}
                          {r.subjectAddress && <p className="text-ink-muted">{r.subjectAddress}</p>}
                          {r.subjectFeatures && <p className="text-ink-muted">Tuntomerkit: {r.subjectFeatures}</p>}
                          {r.subjectObservations && (
                            <p className="text-ink-muted">Havainnot: {r.subjectObservations}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
