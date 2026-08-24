import { Award, ShieldCheck, Zap, AlertCircle } from 'lucide-react';

interface TierBadgeProps {
  tierSlug: string;
  name: string;
  nameVi?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function TierBadge({ tierSlug, name, nameVi, size = 'md' }: TierBadgeProps) {
  const getStyles = () => {
    switch (tierSlug) {
      case 'tier-3':
        return {
          container: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20',
          icon: Award,
          iconColor: 'text-emerald-600',
        };
      case 'tier-2':
        return {
          container: 'bg-indigo-50 text-indigo-800 border-indigo-300 ring-2 ring-indigo-500/20',
          icon: ShieldCheck,
          iconColor: 'text-indigo-600',
        };
      case 'tier-1':
        return {
          container: 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-500/20',
          icon: Zap,
          iconColor: 'text-amber-600',
        };
      default:
        return {
          container: 'bg-rose-50 text-rose-800 border-rose-300',
          icon: AlertCircle,
          iconColor: 'text-rose-600',
        };
    }
  };

  const style = getStyles();
  const Icon = style.icon;

  const sizeClasses =
    size === 'lg'
      ? 'px-4 py-2 text-sm font-bold gap-2'
      : size === 'sm'
      ? 'px-2 py-0.5 text-[10px] font-semibold gap-1'
      : 'px-3 py-1.5 text-xs font-bold gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-xs select-none ${style.container} ${sizeClasses}`}
      data-testid="tier-badge"
    >
      <Icon className={`${size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} ${style.iconColor}`} />
      <span>{name}</span>
      {nameVi && size !== 'sm' && (
        <span className="text-[10px] font-normal opacity-80">({nameVi})</span>
      )}
    </span>
  );
}
