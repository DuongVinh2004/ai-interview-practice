import React from 'react';
import { Wifi } from 'lucide-react';
import { NetworkQuality } from '../../hooks/useVoiceStreaming';

interface NetworkQualityBadgeProps {
  quality: NetworkQuality;
}

export const NetworkQualityBadge: React.FC<NetworkQualityBadgeProps> = ({ quality }) => {
  const getBadgeColor = () => {
    switch (quality.quality) {
      case 'EXCELLENT':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'GOOD':
        return 'text-sky-700 bg-sky-50 border-sky-200';
      case 'FAIR':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      default:
        return 'text-rose-700 bg-rose-50 border-rose-200';
    }
  };

  return (
    <div
      data-testid="network-quality-badge"
      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getBadgeColor()}`}
      title={`Độ trễ: ${quality.latencyMs}ms | Biến thiên: ${quality.jitterMs}ms`}
    >
      <Wifi className="w-3 h-3" />
      <span>{quality.latencyMs}ms</span>
    </div>
  );
};
