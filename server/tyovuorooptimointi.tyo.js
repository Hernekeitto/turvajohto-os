// Worker-säie työvuorolistan optimoinnille (ks. tyovuorooptimointi.js: optimoiTaustalla).

import { parentPort, workerData } from 'node:worker_threads';
import { laskeOptimi } from './tyovuorooptimointi.js';

laskeOptimi(workerData.syote, { aikarajaS: workerData.aikarajaS })
  .then((tulos) => parentPort.postMessage({ ok: true, tulos }))
  .catch((e) => parentPort.postMessage({ ok: false, virhe: String(e?.message || e) }));
