import React from 'react';

export interface SkillDimension {
  key: string;
  name: string;
  score: number; // 0 - 100
  level: string;
  challengesCompleted: number;
}

interface ArenaSkillRadarViewProps {
  skills?: SkillDimension[];
  onSelectRecommendedChallenge?: (slug: string) => void;
}

const DEFAULT_SKILLS: SkillDimension[] = [
  { key: 'security', name: 'Security & Auth (BOLA, JWT)', score: 85, level: 'Senior', challengesCompleted: 2 },
  { key: 'performance', name: 'Query & Memory Performance', score: 78, level: 'Mid-Senior', challengesCompleted: 1 },
  { key: 'concurrency', name: 'Concurrency & Race Invariants', score: 92, level: 'Staff', challengesCompleted: 3 },
  { key: 'idempotency', name: 'Queue & Webhook Idempotency', score: 88, level: 'Senior', challengesCompleted: 2 },
  { key: 'architecture', name: 'Refactoring & Clean Architecture', score: 70, level: 'Mid', challengesCompleted: 1 },
];

export const ArenaSkillRadarView: React.FC<ArenaSkillRadarViewProps> = ({
  skills = DEFAULT_SKILLS,
  onSelectRecommendedChallenge,
}) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Engineering Skill Radar & Mastery Growth
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Evidence-backed competency matrix computed from multi-file arena evaluations and hidden test verifications.
        </p>
      </div>

      {/* Grid: Radar Dimensions & Growth Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {skills.map((skill) => (
          <div
            key={skill.key}
            className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800">
                  {skill.level}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {skill.challengesCompleted} challenges
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
                {skill.name}
              </h3>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden mb-2">
                <div
                  className="bg-primary-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${skill.score}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Mastery</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{skill.score}%</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <span className="text-[11px] text-slate-400">
                Evidence count: {skill.challengesCompleted * 3} verified checks
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Target Growth Recommendation Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-primary-950/60 via-slate-900 to-slate-900 border border-primary-800/40 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary-400">
            Recommended Focus
          </span>
          <h3 className="text-lg font-bold mt-1">Refactoring & Clean Architecture</h3>
          <p className="text-xs text-slate-400 max-w-xl mt-1">
            Your lowest evaluated dimension is currently 70%. Solving an intermediate architecture challenge will boost your Staff Readiness score by +8%.
          </p>
        </div>
        {onSelectRecommendedChallenge && (
          <button
            onClick={() => onSelectRecommendedChallenge('optimize-graphql-n-plus-one')}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-xs font-semibold shadow transition-colors whitespace-nowrap"
          >
            Start Recommended Challenge
          </button>
        )}
      </div>
    </div>
  );
};
