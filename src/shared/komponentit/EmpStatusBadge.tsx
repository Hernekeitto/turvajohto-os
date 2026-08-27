// Työntekijän kirjautumistila. Jaettu: työntekijäpankki on yhteinen, ja vartiovuoron
// sisään-/uloskirjaus on sama käsite kuin tapahtuman.

// Tapahtumaan merkityn työntekijän tila: pending = merkitty tapahtumaan mutta ei
// vielä sisäänkirjattu TIKE:llä, checked_in = TIKE:n sisäänkirjaus tehty,
// checked_out = TIKE:n uloskirjaus tehty. Puuttuva status (vanha data ennen tätä
// ominaisuutta) tulkitaan sisäänkirjatuksi, koska vanhassa mallissa listalla oleminen
// tarkoitti aina sisäänkirjausta.
export const EMP_STATUS_META = {
  pending: { dot: 'bg-danger', label: 'Ei sisäänkirjattu' },
  checked_in: { dot: 'bg-success', label: 'Sisäänkirjattu' },
  checked_out: { dot: 'bg-info', label: 'Uloskirjattu' },
};
export type EmpStatus = keyof typeof EMP_STATUS_META;

export const getEmpStatus = (emp: any): EmpStatus => emp.status || 'checked_in';

export const EmpStatusBadge = ({ emp }: { emp: any }) => {
  const status = getEmpStatus(emp);
  const meta = EMP_STATUS_META[status];
  const time = status === 'checked_in' ? emp.checkInTime : status === 'checked_out' ? emp.checkOutTime : '';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} title={meta.label} />
      <span className="text-xs text-ink-body whitespace-nowrap">{meta.label}{time ? ` · ${time}` : ''}</span>
    </span>
  );
};
