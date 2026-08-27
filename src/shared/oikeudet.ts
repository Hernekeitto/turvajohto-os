// Sivukartta-oikeuksien mekanismi. Jaettu: EVENT- ja GUARD-puolella on omat
// sivukarttansa, mutta oikeuksien rakenne ja tarkistuslogiikka ovat samat.
//
// findAncestorIds ei enää oleta EVENTin sivukarttaa vaan vaatii sen parametrina —
// GUARD tuo oman puunsa, ja väärän puun käyttö olisi hiljainen bugi.

// Sivukartan solmu. Sama muoto molemmilla puolilla — vain sisältö vaihtuu.
export type SivukarttaSolmu = {
  id: string;
  label: string;
  children?: SivukarttaSolmu[];
};

export function collectDescendantIds(node: SivukarttaSolmu, out: string[] = []): string[] {
  if (node.children) {
    for (const child of node.children) {
      out.push(child.id);
      collectDescendantIds(child, out);
    }
  }
  return out;
}

// Etsii solmun esi-isien id:t (ei sisällä solmua itseään) — käytetään siihen että
// näkyvyysoikeuden myöntäminen alasivulle myöntää automaattisesti näkyvyyden myös
// sen yläsivuille, muuten se ei koskaan näy valikoissa.
export function findAncestorIds(nodeId: string, nodes: SivukarttaSolmu[], path: string[] = []): string[] | null {
  for (const node of nodes) {
    if (node.id === nodeId) return path;
    if (node.children) {
      const found = findAncestorIds(nodeId, node.children, [...path, node.id]);
      if (found) return found;
    }
  }
  return null;
}

// Oikeudet tallennetaan kaksitasoisena: { __default__: {node:{view,edit}}, [eventId]:
// {node:{view,edit}} } — sama muoto kuin server/permissions.js:ssä (pidettävä synkassa).
// __default__ on aina läsnä ja toimii oletuksena tapahtumille joilla ei ole omaa
// erillistä asetusta (ks. Käyttöoikeudet-näkymä).
export const DEFAULT_BUCKET = '__default__';

// Nämä solmut EIVÄT ole sidottu yhteen tapahtumaan — haetaan aina __default__-asetuksesta
// riippumatta mille tapahtumalle tarkistus muuten tehtäisiin (sama lista kuin
// server/permissions.js:n GLOBAL_NODES, ks. sen kommentti täydestä perustelusta).
// Nämä solmut ratkaisevat myös sen, mitkä painikkeet etusivulla näkyvät.
// HUOM: lista on toistaiseksi EVENT-puolen solmuja. GUARD-solmut lisätään tähän kun
// vartiointipuolen sivukartta tulee, ja lista on pidettävä synkassa
// server/permissions.js:n GLOBAL_NODES-listan kanssa.
export const GLOBAL_NODES = new Set([
  'landing',
  'settings',
  'global_reports',
  'global_archived_events',
  'global_employee_bank',
  'quickactions',
]);

export function bucketFor(permissions: any, eventId: string | null | undefined, nodeId: string) {
  const perms = permissions || {};
  if (!GLOBAL_NODES.has(nodeId) && eventId && perms[eventId]) return perms[eventId];
  return perms[DEFAULT_BUCKET] || {};
}

// perms[bucket]['*'] on admin-oikotie kyseisessä bucketissa: kaikki näkyy ja on
// muokattavissa riippumatta yksittäisistä solmumerkinnöistä. eventId kertoo minkä
// tapahtuman kontekstissa tarkistus tehdään (globaaleille solmuille sillä ei ole väliä).
export function canView(permissions: any, eventId: string | null | undefined, nodeId: string) {
  const bucket = bucketFor(permissions, eventId, nodeId);
  if (bucket['*']?.view) return true;
  return !!bucket[nodeId]?.view;
}
export function canEdit(permissions: any, eventId: string | null | undefined, nodeId: string) {
  const bucket = bucketFor(permissions, eventId, nodeId);
  if (bucket['*']?.edit) return true;
  return !!bucket[nodeId]?.edit;
}

// "Lisää tapahtumaan työntekijä" ei ole oma sivukartta-solmu — se kuuluu samaan
// oikeuteen kuin "Tapahtuman työntekijät" (planning_employees), josta se avataan.
export function sitemapIdForTab(tab: string) {
  return tab === 'planning_employee_add' ? 'planning_employees' : tab;
}
