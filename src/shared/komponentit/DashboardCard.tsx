// Tilannekuvan lukukortti. Jaettu: GUARD-puolen tilannekuva käyttää samaa korttia,
// ja värit tulevat teemasta (ks. src/TEEMA.md) joten kortti näyttää kummallakin
// puolella oman ilmeensä mukaiselta.

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type DashboardCardProps = {
  title: string;
  icon: LucideIcon;
  value: ReactNode;
  subtitle?: ReactNode;
  // trend/trendUp ovat valinnaisia: yksikään nykyinen kortti ei käytä niitä, ja
  // ilman oletusarvoja TypeScript vaatisi ne jokaiselta kutsupaikalta.
  trend?: ReactNode;
  trendUp?: boolean;
};

export const DashboardCard = ({ title, icon: Icon, value, subtitle, trend = null, trendUp = false }: DashboardCardProps) => (
  <div className="bg-surface p-6 rounded-xl shadow-sm border border-line-soft flex flex-col justify-between">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 rounded-lg bg-sunken text-ink-body">
        <Icon size={24} />
      </div>
      {trend && (
        <span className={`text-sm font-medium ${trendUp ? 'text-success' : 'text-danger'} flex items-center`}>
          {trend}
        </span>
      )}
    </div>
    <div>
      <h3 className="text-3xl font-bold text-ink mb-1">{value}</h3>
      <p className="text-sm font-medium text-ink-muted">{title}</p>
      {subtitle && <p className="text-xs text-ink-subtle mt-1">{subtitle}</p>}
    </div>
  </div>
);
