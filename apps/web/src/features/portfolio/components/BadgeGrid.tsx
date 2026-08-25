import React from 'react';
import { BadgeProgressItemDto } from '@ai-interview/contracts';
import { BadgeCard } from './BadgeCard';

interface BadgeGridProps {
  badges: BadgeProgressItemDto[];
  isLoading?: boolean;
}

export const BadgeGrid: React.FC<BadgeGridProps> = ({ badges, isLoading }) => {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        data-testid="badge-grid-loading"
      >
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className="h-32 bg-slate-100 rounded-xl animate-pulse border border-slate-200"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="badge-grid">
      {badges.map(b => (
        <BadgeCard
          key={b.competencyArea}
          areaName={b.areaName}
          competencyArea={b.competencyArea}
          level={b.highestLevel}
          score={b.currentScore}
          evidenceCount={b.evidenceCount}
          progressPercentage={b.progressPercentage}
          nextBadgeLevel={b.nextBadgeLevel}
          requiredScore={b.requiredScore}
          requiredEvidence={b.requiredEvidence}
          isUnlocked={b.isUnlocked}
          earnedAt={b.earnedAt}
        />
      ))}
    </div>
  );
};
