// Kameraskanneri: QR-tarrat ja viivakoodit sovelluksen sisällä.
//
// Kierrosten QR-tarrat on tähän asti luettu puhelimen omalla kamerasovelluksella, joka
// avaa osoitteen /guard?piste=<token>. Se toimii, mutta se vie vartijan ulos
// sovelluksesta ja takaisin sisään jokaisella pisteellä — ja katvealueella takaisin
// tuleminen tarkoittaa uutta sivunlatausta ilman verkkoa. Sovelluksen oma kamera lukee
// koodin ilman navigointia.
//
// SELAIMEN OMA TUNNISTIN. Koodi luetaan BarcodeDetector-rajapinnalla eikä kirjastolla:
// se on natiivi Chromessa Androidilla (eli juuri siinä laitteessa jolle mobiiliversio on
// tehty), ja kirjaston lisääminen tarkoittaisi satojen kilotavujen wasm-nipun
// tarjoilemista kentälle. Jos rajapintaa ei ole, näkymä sanoo sen suoraan ja neuvoo
// puhelimen oman kameran — se on yhä olemassa oleva, toimiva reitti.
//
// Kuva ei mene mihinkään: video on vain elementissä, eikä ruutukaappauksia tallenneta
// eikä lähetetä. Palvelimelle menee vain luettu koodi.
import { useEffect, useRef, useState } from 'react';
import { CameraOff, X } from 'lucide-react';

// Minimaalinen tyyppi selaimen rajapinnalle: sitä ei ole lib.dom:issa.
type Tunnistin = {
  detect: (lahde: CanvasImageSource) => Promise<{ rawValue: string; format?: string }[]>;
};
type TunnistinRakentaja = new (asetukset?: { formats?: string[] }) => Tunnistin;

// Kuinka usein kuvaa katsotaan. Neljä kertaa sekunnissa riittää tarraan jota pidetään
// kädessä, eikä lämmitä puhelinta kuten joka ruudun tutkiminen.
const VALI_MS = 250;

type Props = {
  onLoytyi: (arvo: string) => void;
  onSulje: () => void;
};

export const Skanneri = ({ onLoytyi, onSulje }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  // Löytö kelpaa vain kerran: sama tarra näkyy kymmenessä peräkkäisessä ruudussa, ja
  // ilman tätä sama piste kuitattaisiin kymmenen kertaa.
  const loytynyt = useRef(false);
  const loytyiRef = useRef(onLoytyi);
  loytyiRef.current = onLoytyi;

  useEffect(() => {
    const Rakentaja = (window as unknown as { BarcodeDetector?: TunnistinRakentaja }).BarcodeDetector;
    if (!Rakentaja) {
      setVirhe(
        'Tämä selain ei osaa lukea koodeja. Käytä puhelimen omaa kamerasovellusta — '
        + 'QR-tarra avaa saman kuittauksen.'
      );
      return;
    }

    let virta: MediaStream | null = null;
    let ajastin: number | null = null;
    let purettu = false;

    const kaynnista = async () => {
      try {
        virta = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        // Kieltäytyminen ja puuttuva kamera ovat käyttäjälle sama tilanne: koodia ei
        // voi lukea tällä laitteella nyt.
        if (!purettu) setVirhe('Kamera ei ole käytettävissä. Salli kameran käyttö selaimen asetuksista.');
        return;
      }
      if (purettu) {
        virta.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      if (video) {
        video.srcObject = virta;
        await video.play().catch(() => { /* autoplay estetty: kuva jää mustaksi, virhe näkyy alla */ });
      }
      const tunnistin = new Rakentaja();
      ajastin = window.setInterval(async () => {
        const elementti = videoRef.current;
        if (!elementti || elementti.readyState < 2 || loytynyt.current) return;
        try {
          const osumat = await tunnistin.detect(elementti);
          const arvo = osumat[0]?.rawValue;
          if (arvo && !loytynyt.current) {
            loytynyt.current = true;
            loytyiRef.current(arvo);
          }
        } catch {
          // Yksittäinen epäonnistunut ruutu ei ole virhe: seuraava luetaan normaalisti.
        }
      }, VALI_MS);
    };

    kaynnista();

    return () => {
      purettu = true;
      if (ajastin) window.clearInterval(ajastin);
      virta?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col">
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <p className="text-sm font-medium">Lue QR- tai viivakoodi</p>
        <button
          type="button"
          onClick={onSulje}
          aria-label="Sulje kamera"
          className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {virhe ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <CameraOff className="w-10 h-10 text-white/60 mb-4" strokeWidth={1.5} />
            <p className="text-sm text-white/80 leading-relaxed">{virhe}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Kohdistusalue. Ei rajaa lukualuetta — tunnistin katsoo koko ruudun —
                mutta kertoo mihin tarra kannattaa asettaa. */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 rounded-2xl border-2 border-white/80" />
            </div>
          </>
        )}
      </div>

      <p className="shrink-0 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-white/60">
        Kierrospisteen tarra kuitataan heti kun koodi on luettu.
      </p>
    </div>
  );
};
