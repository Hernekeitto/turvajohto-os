import { SITEMAP } from './sivukartta';
import { SITEMAP_GUARD } from './guard/sivukartta';
import type { AsetusSivukartta } from './shared/asetukset/Kayttajatasot';

// Käyttäjätasojen editorille annettava kooste molempien puolien sivukartoista. Sama lista
// kummallakin puolella: taso on koko sovelluksen yhteinen, joten EVENT-puolelta avattuna
// on voitava myöntää GUARD-oikeuksia ja päinvastoin.
//
// Tämä tiedosto on src-juuressa eikä shared/-kansiossa tarkoituksella: se tuntee molemmat
// tuotteet, kun taas shared/ on se kerros joka ei saa riippua kummastakaan.
export const ASETUSTEN_SIVUKARTAT: AsetusSivukartta[] = [
  {
    otsikko: 'Turvajohto EVENT',
    solmut: SITEMAP,
    portti: {
      id: 'landing',
      sisaiset: ['overview', 'reporting', 'planning', 'postevent', 'documents', 'eventfiles'],
      varoitus: (
        <>
          Tasolla on tapahtuman sisäisiä oikeuksia, mutta ei oikeutta
          <strong> Tapahtumavalintaan</strong>. Tapahtumaan mennään aina sen kautta,
          joten käyttäjä ei pääse näille sivuille lainkaan. Lisää näkyvyys
          Tapahtumavalintaan tai poista tapahtuman sisäiset oikeudet.
        </>
      ),
    },
  },
  {
    otsikko: 'Turvajohto GUARD',
    solmut: SITEMAP_GUARD,
    portti: {
      id: 'guard_sites',
      sisaiset: [
        'guard_site_info', 'guard_tasks', 'guard_reporting',
        'guard_report_action', 'guard_report_jv',
      ],
      varoitus: (
        <>
          Tasolla on GUARD-puolen oikeuksia, mutta ei oikeutta
          <strong> Kohdevalintaan</strong>. Kohteeseen mennään aina sen kautta,
          joten käyttäjä ei pääse näille sivuille lainkaan.
        </>
      ),
    },
  },
];
