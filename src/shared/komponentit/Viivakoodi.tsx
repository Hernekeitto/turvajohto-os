// Code-128-viivakoodi ruudulle.
//
// Piirtää saman kuvion kuin tulosteen SVG-merkkijono (shared/viivakoodi.ts) — sama
// koodaus ja samat mitat, kaksi ulostuloa. Ero on vain siinä, että tässä viivat ovat
// React-elementtejä, koska tulostedokumentti rakennetaan merkkijonona iframen sisään
// eikä siellä voi renderöidä komponenttia.
//
// SVG eikä canvas: viivakoodi on skaalattava kuvio, ja canvas antaisi sumean koodin heti
// kun tarra tulostetaan tai zoomataan. Sumea viivakoodi ei lue.
import { viivakoodiKuvio, viivakoodiMitat, type ViivakoodiAsetukset } from '../viivakoodi';

type Props = ViivakoodiAsetukset & {
  teksti: string;
  // Näytetään kun teksti ei kelpaa Code-128:ksi. Oletusteksti kertoo syyn, koska
  // tyhjä laatikko jättäisi käyttäjän arvaamaan miksi koodi ei ilmesty.
  virheteksti?: string;
  luokka?: string;
};

export function Viivakoodi({
  teksti,
  moduuli = 2,
  korkeus = 60,
  naytaTeksti = true,
  pysty = false,
  luokka,
  virheteksti = 'Koodissa on merkkejä joita viivakoodi ei koodaa (ääkköset eivät kelpaa).',
}: Props) {
  const kuvio = viivakoodiKuvio(teksti);
  if (!kuvio) {
    return (
      <p className="text-xs text-danger-ink bg-danger-soft border border-danger/30 rounded-md px-2 py-1.5">
        {virheteksti}
      </p>
    );
  }
  const mitat = viivakoodiMitat(kuvio, { moduuli, korkeus, naytaTeksti, pysty });
  const sisalto = (
    <>
      <g fill="#000">
        {kuvio.viivat.map((viiva) => (
          <rect
            key={viiva.x}
            x={viiva.x * moduuli}
            y={mitat.viivatY}
            width={viiva.leveys * moduuli}
            height={mitat.viivanKorkeus}
          />
        ))}
      </g>
      {naytaTeksti && (
        <text
          x={mitat.tekstiX}
          y={mitat.tekstiY}
          textAnchor="middle"
          fontFamily="monospace"
          fontSize={12}
          letterSpacing={1}
          fill="#000"
        >
          {teksti}
        </text>
      )}
    </>
  );
  return (
    <svg
      // Mitat skaalautuvat säiliöön mutta kuvasuhde pysyy: liian kapeaksi puristettu
      // viivakoodi ei lue, joten enimmäismitta on koodin oma luonnollinen koko.
      style={pysty ? { maxHeight: `${mitat.korkeus}px` } : { maxWidth: `${mitat.leveys}px` }}
      className={luokka ?? (pysty ? 'h-full w-auto' : 'w-full h-auto')}
      viewBox={`0 0 ${mitat.leveys} ${mitat.korkeus}`}
      role="img"
      aria-label={`Viivakoodi ${teksti}`}
    >
      <rect width={mitat.leveys} height={mitat.korkeus} fill="#fff" />
      {mitat.muunnos ? <g transform={mitat.muunnos}>{sisalto}</g> : sisalto}
    </svg>
  );
}
