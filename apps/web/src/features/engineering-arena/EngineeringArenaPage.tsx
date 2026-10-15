import { useState } from 'react';
import { ChallengeCatalogView } from './ChallengeCatalogView';
import { ArenaWorkspaceView } from './ArenaWorkspaceView';
import { useEngineeringArena } from './useEngineeringArena';
import { Spinner } from '../../components/ui/Spinner';
import { useI18nStore } from '../../stores/i18n.store';

export function EngineeringArenaPage() {
  const { session, startSession, isLoading, error, resetSession } = useEngineeringArena();
  const { language } = useI18nStore();
  const isVi = language === 'vi';
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const handleSelectChallenge = async (slug: string) => {
    setSelectedSlug(slug);
    try {
      await startSession(slug);
    } catch (err) {
      console.error('Failed to start arena session:', err);
    }
  };

  const handleBackToCatalog = () => {
    setSelectedSlug(null);
    resetSession();
  };

  if (isLoading && selectedSlug) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">
          {isVi
            ? `Đang khởi tạo không gian làm việc cô lập cho thử thách '${selectedSlug}'...`
            : `Provisioning isolated workspace for challenge '${selectedSlug}'...`}
        </p>
      </div>
    );
  }

  if (session) {
    return <ArenaWorkspaceView onBackToCatalog={handleBackToCatalog} />;
  }

  return (
    <div>
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            {error}
          </div>
        </div>
      )}
      <ChallengeCatalogView onSelectChallenge={handleSelectChallenge} />
    </div>
  );
}

export default EngineeringArenaPage;
