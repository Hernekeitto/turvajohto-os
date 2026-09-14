// Työntekijäpankin datamalli ja lomakepohja — JAETTU EVENT- ja GUARD-puolen kesken.
//
// Työntekijäpankki on yhden yrityksen rekisteri eikä kummankaan tuotteen oma: sama
// henkilö on sama tietue riippumatta siitä kummalta puolelta häntä katsotaan, ja
// palvelimella se on yksi kokoelma yhden globaalin solmun takana
// (server/permissions.js: employees / global_employee_bank, ei tuoteporttia).
//
// Siirretty tänne src/event/tyontekijat.ts:stä kun GUARD sai oman pankkinäkymänsä.
// EVENT-puolen siemendata, sisäänkirjaukset ja kirjausten kommentit jäivät sinne —
// ne ovat tapahtuman rosteria eivätkä työntekijän tietoja.

import { splitFullName } from './nimet';

// Kielitaito. Taso 1–5, sama asteikko kuin lomakkeen valikossa.
export type Kielitaito = { language: string; level: number };

// Työntekijän lomaketila. Kenttien ryhmittely vastaa lomakkeen osioita, jotta lomaketta
// ja tyyppiä voi lukea rinnakkain.
export type TyontekijaLomake = {
  // Pysyvä tunnistenumero (#1000 →). Annetaan automaattisesti tallennettaessa eikä sitä
  // muuteta jälkikäteen — ks. seuraavaTunnisteNumero.
  displayId: number | null;

  // 1. Henkilötiedot
  firstName: string; lastName: string; personalId: string; birthDate: string; nationality: string;

  // 2. Yhteystiedot
  address: string; postalCode: string; postalCity: string; email: string; phone: string;

  // 3. Pankkitiedot
  iban: string; bic: string; bankName: string;
  // Veronumero on rakennusalan veronumerorekisterin 12-numeroinen tunniste. Salataan
  // levylle henkilötunnuksen tapaan (ks. server/store.js ENCRYPTED_FIELDS).
  taxNumber: string;

  // 4. Työsuhdetiedot. Työsopimuksen ehdot kerätään samaan lomakkeeseen, koska
  // työntekijäpankki on ainoa paikka jossa työntekijän tiedot ovat kokonaisuutena.
  employmentStart: string;
  // 'permanent' = toistaiseksi voimassa oleva, 'fixed' = määräaikainen (jolloin
  // employmentFixedFrom/To kertovat jakson).
  employmentType: string;
  employmentFixedFrom: string; employmentFixedTo: string;
  workLocation: string;
  // 'monthly' = kuukausipalkka 120 h / 3 vk, 'parttime' = osa-aikainen tuntipalkka
  // (alle 112 h 30 min / 3 vk), 'oncall' = erikseen työhön kutsuttava (työvoimareservi).
  workTimeType: string;
  minHoursPer3Weeks: string;
  // Palkkaus. Tasopalkan euromäärä syötetään käsin: TES:n palkkataulukko muuttuu
  // sopimuskausittain eikä sitä ole sovelluksessa, joten taso ja paikkakuntaluokka
  // kirjataan dokumentoinniksi ja euromäärä sen viereen.
  payLevel: string; municipalityClass: string; basePay: string;
  personalPayPart: string; personalPayBasis: string;
  personalPay: string;
  otherPay: string; otherPayBasis: string;
  // Kuukausipalkan jakaja tuntipalkaksi. Oletus 173.33 = 120 h / 3 vk eli 40 h/vk
  // kuukausikeskiarvona — muutettavissa, koska oikea jakaja riippuu sopimuksesta.
  hourDivisor: string;
  otherTerms: string;
  // Vartijan peruskurssin sitoutumisehto (ks. Koulutus-tekstiruutu lomakkeessa).
  trainingCommitmentMonths: string; trainingCourseCost: string;

  // 5. Ajokortti ja yleiset luvat
  hasDrivingLicense: boolean;
  drivingLicense: string;
  adrPermit: boolean; alcoholPass: boolean; hygienePass: boolean;
  craneCard: boolean; craneCardUntil: string;
  electricalWorkCard: boolean; electricalWorkCardUntil: string;
  firstAidEA1: boolean; firstAidEA1Until: string;
  firstAidEA2: boolean; firstAidEA2Until: string;
  firstAidEA3: boolean; firstAidEA3Until: string;

  // 6. Turvallisuusalan kortit (kyllä/ei + numero + voimassa kuukausi/vuosi)
  hasJvCard: boolean; jvCard: string; jvCardValidUntil: string;
  hasGuardCard: boolean; guardCard: string; guardCardValidUntil: string;
  hasGasPermit: boolean; gasPermit: string; gasPermitValidUntil: string;
  // Voimankäyttövälineiden kertauskoulutus kuuluu turvallisuusalan pätevyyksiin, ei
  // yleisiin työturvallisuuskortteihin — siirretty tänne osiosta 7.
  trainingRefresher: boolean; trainingRefresherUntil: string;

  // 7. Työturvallisuuskortit (kyllä/ei + voimassa pvm)
  roadSafetyCard: boolean; roadSafetyCardUntil: string;
  forkliftCard: boolean; forkliftCardUntil: string;
  hotWorkCard: boolean; hotWorkCardUntil: string;
  safetyCard: boolean; safetyCardUntil: string;

  // 8. Erityiskoulutukset (kyllä/ei)
  trainingForce: boolean; trainingGas: boolean; trainingBaton: boolean; firearmTraining: boolean;

  // 9. Kielitaito
  languages: Kielitaito[];
};

// Tallennettu työntekijä: lomakkeen kentät sekä rekisterin omat. `name` on koottu
// koko nimi, joka on olemassa myös siksi että vanhin data tunsi vain sen.
export type Tyontekija = TyontekijaLomake & {
  id: string;
  name?: string;
  // Vapaat kommentit ja muut kentät joita on kertynyt matkan varrella. Löyhä
  // tarkoituksella: rekisteriin on lisätty kenttiä useassa erässä, eikä jokaisen takia
  // haluta muuttaa tätä tyyppiä.
  [lisa: string]: unknown;
};

// Työntekijäpankin lomakkeen tyhjä pohja.
export const emptyEmpForm: TyontekijaLomake = {
  displayId: null,
  firstName: '', lastName: '', personalId: '', birthDate: '', nationality: '',
  address: '', postalCode: '', postalCity: '', email: '', phone: '',
  iban: '', bic: '', bankName: '',
  taxNumber: '',
  employmentStart: '',
  employmentType: '',
  employmentFixedFrom: '', employmentFixedTo: '',
  workLocation: '',
  workTimeType: '',
  minHoursPer3Weeks: '',
  payLevel: '', municipalityClass: '', basePay: '',
  personalPayPart: '', personalPayBasis: '',
  personalPay: '',
  otherPay: '', otherPayBasis: '',
  hourDivisor: '173.33',
  otherTerms: '',
  trainingCommitmentMonths: '', trainingCourseCost: '',
  hasDrivingLicense: false,
  drivingLicense: '',
  adrPermit: false, alcoholPass: false, hygienePass: false,
  craneCard: false, craneCardUntil: '',
  electricalWorkCard: false, electricalWorkCardUntil: '',
  firstAidEA1: false, firstAidEA1Until: '',
  firstAidEA2: false, firstAidEA2Until: '',
  firstAidEA3: false, firstAidEA3Until: '',
  hasJvCard: false, jvCard: '', jvCardValidUntil: '',
  hasGuardCard: false, guardCard: '', guardCardValidUntil: '',
  hasGasPermit: false, gasPermit: '', gasPermitValidUntil: '',
  trainingRefresher: false, trainingRefresherUntil: '',
  roadSafetyCard: false, roadSafetyCardUntil: '',
  forkliftCard: false, forkliftCardUntil: '',
  hotWorkCard: false, hotWorkCardUntil: '',
  safetyCard: false, safetyCardUntil: '',
  trainingForce: false, trainingGas: false, trainingBaton: false, firearmTraining: false,
  languages: [],
};

// Muodostaa lomaketilan olemassa olevasta rekisterimerkinnästä (tai pelkästä nimestä),
// ja täydentää etu-/sukunimen vanhasta datasta jos niitä ei ole vielä tallennettu erikseen.
export const employeeToFormState = (emp: any): TyontekijaLomake => {
  if (!emp) return emptyEmpForm;
  const needsSplit = emp.firstName === undefined && emp.name;
  const pohja = { ...emptyEmpForm, ...emp, ...(needsSplit ? splitFullName(emp.name) : {}) };
  // Kyllä-valinnat (hasJvCard, hasDrivingLicense, ...) lisättiin vasta jälkikäteen: ennen
  // niitä tallennetuilla työntekijöillä on pelkkä kortin numero tai ajo-oikeuden laatu.
  // Ilman tätä johtamista vanhan työntekijän kortti näyttäisi lomakkeella rastittamattomalta
  // ja sen kentät olisivat lukittuina — eli tiedot katoaisivat näkyvistä.
  return {
    ...pohja,
    hasDrivingLicense: !!(emp.hasDrivingLicense || emp.drivingLicense),
    hasJvCard: !!(emp.hasJvCard || emp.jvCard),
    hasGuardCard: !!(emp.hasGuardCard || emp.guardCard),
    hasGasPermit: !!(emp.hasGasPermit || emp.gasPermit),
  };
};

// Onko työntekijällä kyseinen turvallisuusalan kortti? Kyllä-valinta riittää, mutta
// pelkkä kortin numero kelpaa myös (ks. employeeToFormState: vanha data).
export const onKortti = (emp: any, boolKey: string, numKey: string) =>
  !!(emp?.[boolKey] || emp?.[numKey]);
