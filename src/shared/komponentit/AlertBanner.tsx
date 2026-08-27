// Hälytysbanneri. Jaettu: GUARD-puolen kohdehälytykset näytetään samalla bannerilla.
import { AlertTriangle } from 'lucide-react';

type AlertTyyppi = 'critical' | 'warning' | 'info';

type AlertBannerProps = {
  alert: {
    type: AlertTyyppi;
    location: string;
    time: string;
    message: string;
  };
};

export const AlertBanner = ({ alert }: AlertBannerProps) => {
  const colors: Record<AlertTyyppi, string> = {
    critical: 'bg-danger-soft border-danger/30 text-danger-ink',
    warning: 'bg-warning-soft border-warning/30 text-warning-ink',
    info: 'bg-info-soft border-info/30 text-info-ink'
  };
  
  const iconColors: Record<AlertTyyppi, string> = {
    critical: 'text-danger-ink',
    warning: 'text-warning',
    info: 'text-info'
  };

  return (
    <div className={`p-4 rounded-lg border flex items-start gap-4 mb-3 ${colors[alert.type]}`}>
      <AlertTriangle className={`mt-0.5 ${iconColors[alert.type]}`} size={20} />
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="font-semibold text-sm">{alert.location}</span>
          <span className="text-xs font-medium opacity-80">{alert.time}</span>
        </div>
        <p className="text-sm">{alert.message}</p>
      </div>
    </div>
  );
};
