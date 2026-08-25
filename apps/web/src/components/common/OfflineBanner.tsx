import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { useI18nStore } from '../../stores/i18n.store';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const { language } = useI18nStore();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md animate-slide-down"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        {language === 'vi'
          ? 'Mất kết nối mạng Internet. Tiến trình làm bài và bản nháp của bạn đang được lưu tạm trên thiết bị.'
          : 'You are currently offline. Your drafts and progress are safely cached in local storage.'}
      </span>
    </div>
  );
}
