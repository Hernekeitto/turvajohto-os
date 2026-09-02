// Liitteiden valinta ja lista. Jaettu komponentti: sama kehikko on EVENT-puolen
// TIKE-lomakkeilla, tapahtumailmoituksessa ja GUARD-puolen raporteissa.
//
// Kaksi painiketta eikä yhtä: "Ota kuva" avaa kameran suoraan (capture="environment"),
// "Liitä tiedosto" avaa tiedostovalitsimen. Yhdistettynä ne olisivat puhelimessa
// valikko, jossa kamera on toinen vaihtoehto kolmesta — ja kamera on se jota kentällä
// tarvitaan. Työpöydällä capture-attribuutti jätetään huomiotta, joten sama painike
// toimii siellä tavallisena tiedostovalitsimena.
import { useRef, useState } from 'react';
import { Camera, Paperclip, MapPin, X, Loader } from 'lucide-react';

import {
  type Liite, MAX_LIITTEITA, TIEDOSTOVALITSIMEN_SUODATIN, lahetaLiite, kokoTekstina,
} from '../liitteet';

type Props = {
  liitteet: Liite[];
  onMuutos: (liitteet: Liite[]) => void;
  // Lukittu kirjaus: liitteen saa LISÄTÄ mutta ei poistaa. Sama sääntö kuin
  // palvelimella (server/kirjaukset.js: LISATTAVAT_LISTAT) — todistekuva ladataan usein
  // vasta jälkikäteen, mutta sen poistaminen olisi todisteen hävittämistä.
  vainLisays?: boolean;
  saaMuokata?: boolean;
  // Kerrotaan ylöspäin kun lähetys on kesken, jotta tallennuspainike voi odottaa.
  // Ilman tätä kirjaus tallentuisi ilman juuri valittua liitettä.
  onLatausTila?: (kesken: boolean) => void;
};

export function Liitteet({ liitteet, onMuutos, vainLisays = false, saaMuokata = true, onLatausTila }: Props) {
  const [lahetetaan, setLahetetaan] = useState(0);
  const [virheet, setVirheet] = useState<string[]>([]);
  // Peräkkäisten lähetysten laskuri erikseen refissä: kaksi rinnakkaista valintaa
  // päivittäisi tilaa toistensa yli, ja "kesken" jäisi päälle tai katoaisi liian aikaisin.
  const kesken = useRef(0);

  const paivitaKesken = (muutos: number) => {
    kesken.current += muutos;
    setLahetetaan(kesken.current);
    onLatausTila?.(kesken.current > 0);
  };

  const valittu = async (lista: FileList | null, syote: HTMLInputElement) => {
    const tiedostot = Array.from(lista || []);
    // Valitsin nollataan heti: muuten saman tiedoston valitseminen uudelleen ei
    // laukaise change-tapahtumaa lainkaan.
    syote.value = '';
    if (tiedostot.length === 0) return;

    const tilaa = MAX_LIITTEITA - liitteet.length;
    if (tilaa <= 0) {
      setVirheet([`Kirjaukseen mahtuu enintään ${MAX_LIITTEITA} liitettä.`]);
      return;
    }
    const otetaan = tiedostot.slice(0, tilaa);
    const uudetVirheet = tiedostot.length > tilaa
      ? [`Vain ${tilaa} liitettä mahtui vielä mukaan (enintään ${MAX_LIITTEITA}).`]
      : [];

    paivitaKesken(otetaan.length);
    // Lähetetään rinnakkain: kentällä valitaan kolme kuvaa kerralla, ja peräkkäin
    // odottaminen kolminkertaistaisi odotusajan ilman mitään hyötyä.
    const tulokset = await Promise.all(otetaan.map((t) => lahetaLiite(t)));
    paivitaKesken(-otetaan.length);

    const onnistuneet: Liite[] = [];
    for (const tulos of tulokset) {
      if (tulos.ok) onnistuneet.push(tulos.liite);
      else uudetVirheet.push(tulos.virhe);
    }
    setVirheet(uudetVirheet);
    // Luetaan propsista eikä kaapatusta muuttujasta: lista on voinut muuttua
    // lähetyksen aikana, jos käyttäjä valitsi toisen erän kesken kaiken.
    if (onnistuneet.length > 0) onMuutos([...liitteet, ...onnistuneet]);
  };

  const poista = (id: string) => onMuutos(liitteet.filter((l) => l.id !== id));

  const tayn = liitteet.length >= MAX_LIITTEITA;

  return (
    <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/50 space-y-3">
      {saaMuokata && (
        <div className="flex flex-wrap gap-3 justify-center">
          <label className={`flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm rounded-lg transition-all text-sm font-medium text-slate-700 ${tayn ? 'opacity-50 cursor-default' : 'cursor-pointer hover:bg-slate-50 hover:border-indigo-300'}`}>
            <Camera size={18} className="text-indigo-500" />
            Ota kuva
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              disabled={tayn}
              className="hidden"
              onChange={(e) => valittu(e.target.files, e.target)}
            />
          </label>

          <label className={`flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm rounded-lg transition-all text-sm font-medium text-slate-700 ${tayn ? 'opacity-50 cursor-default' : 'cursor-pointer hover:bg-slate-50 hover:border-indigo-300'}`}>
            <Paperclip size={18} className="text-indigo-500" />
            Liitä tiedosto
            <input
              type="file"
              accept={TIEDOSTOVALITSIMEN_SUODATIN}
              multiple
              disabled={tayn}
              className="hidden"
              onChange={(e) => valittu(e.target.files, e.target)}
            />
          </label>
        </div>
      )}

      {lahetetaan > 0 && (
        <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader size={16} className="animate-spin" />
          {lahetetaan === 1 ? 'Lähetetään liitettä…' : `Lähetetään ${lahetetaan} liitettä…`}
        </p>
      )}

      {liitteet.length > 0 && (
        <ul className="space-y-1.5">
          {liitteet.map((liite) => (
            <li
              key={liite.id}
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <Paperclip size={14} className="text-slate-400 shrink-0" />
              <a
                href={`/api/uploads/${liite.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-slate-700 hover:text-indigo-700 hover:underline"
              >
                {liite.name}
              </a>
              {liite.gps && (
                // Kuvan oma sijainti. Näytetään koordinaatteina eikä karttalinkkinä:
                // liite voi olla kirjauksessa jolla ei ole karttaa lainkaan.
                <span
                  className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 shrink-0"
                  title={`Kuvan sijainti: ${liite.gps.lat.toFixed(5)}, ${liite.gps.lon.toFixed(5)}`}
                >
                  <MapPin size={11} />
                  sijainti
                </span>
              )}
              <span className="text-xs text-slate-400 shrink-0">{kokoTekstina(liite.size)}</span>
              {saaMuokata && !vainLisays && (
                <button
                  type="button"
                  onClick={() => poista(liite.id)}
                  title={`Poista liite ${liite.name}`}
                  className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded p-1 transition-colors shrink-0"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {liitteet.length === 0 && lahetetaan === 0 && (
        <p className="text-center text-xs text-slate-400">
          Ei liitteitä. Kuvia voi lisätä {MAX_LIITTEITA} kappaletta.
        </p>
      )}

      {vainLisays && liitteet.length > 0 && (
        <p className="text-center text-xs text-slate-500">
          Kirjaus on lukittu: liitteitä voi lisätä, mutta jo tallennettua ei voi poistaa.
        </p>
      )}

      {virheet.map((virhe, i) => (
        <p key={i} className="text-sm text-rose-600 text-center">{virhe}</p>
      ))}
    </div>
  );
}
