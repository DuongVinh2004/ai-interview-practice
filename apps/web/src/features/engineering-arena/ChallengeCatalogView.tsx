import React, { useEffect, useState } from 'react';
import { useEngineeringArena } from './useEngineeringArena';
import { ArenaSkillRadarView } from './ArenaSkillRadarView';
import { ChallengeDomain, ChallengeCategory } from '@ai-interview/contracts';

interface ChallengeCatalogViewProps {
  onSelectChallenge: (slug: string) => void;
}

export const ChallengeCatalogView: React.FC<ChallengeCatalogViewProps> = ({
  onSelectChallenge,
}) => {
  const { challenges, isLoading, error, fetchChallenges } = useEngineeringArena();
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'RADAR'>('CATALOG');
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    fetchChallenges({
      domain: selectedDomain || undefined,
      category: selectedCategory || undefined,
    });
  }, [fetchChallenges, selectedDomain, selectedCategory]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Engineering Arena
          </h1>
          <p className="mt-2 text-base text-slate-600 dark:text-slate-400 max-w-2xl">
            Solve real-world multi-file repository challenges: debug race conditions, fix memory
            leaks, and prove your skills with evidence-backed evaluation.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('CATALOG')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'CATALOG'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Challenges
          </button>
          <button
            onClick={() => setActiveTab('RADAR')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'RADAR'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Skill Radar
          </button>
        </div>
      </div>

      {activeTab === 'RADAR' ? (
        <ArenaSkillRadarView onSelectRecommendedChallenge={onSelectChallenge} />
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-8">
            <select
              value={selectedDomain}
              onChange={e => setSelectedDomain(e.target.value)}
              aria-label="Filter by domain"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="">All Domains</option>
              <option value={ChallengeDomain.BACKEND}>Backend</option>
              <option value={ChallengeDomain.FRONTEND}>Frontend</option>
              <option value={ChallengeDomain.FULLSTACK}>Fullstack</option>
              <option value={ChallengeDomain.DEVOPS}>DevOps</option>
              <option value={ChallengeDomain.SECURITY}>Security</option>
            </select>

            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              aria-label="Filter by category"
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="">All Categories</option>
              <option value={ChallengeCategory.BUG_FIX}>Bug Fix</option>
              <option value={ChallengeCategory.REFACTORING}>Refactoring</option>
              <option value={ChallengeCategory.FEATURE_IMPLEMENTATION}>
                Feature Implementation
              </option>
              <option value={ChallengeCategory.PERFORMANCE_OPTIMIZATION}>Performance</option>
              <option value={ChallengeCategory.SECURITY_REMEDIATION}>Security</option>
            </select>
          </div>

          {/* Content State */}
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          ) : challenges.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
              <p className="text-base text-slate-500 dark:text-slate-400">
                No engineering challenges found matching the selected filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {challenges.map(challenge => (
                <div
                  key={challenge.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-300">
                        {challenge.domain}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Difficulty {challenge.difficulty}/5
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">
                      {challenge.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Category:{' '}
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {challenge.category}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Estimated time: ~{challenge.estimatedMinutes} minutes
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => onSelectChallenge(challenge.slug)}
                      className="w-full inline-flex justify-center items-center px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      Start Challenge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
