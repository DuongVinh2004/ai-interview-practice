import { useState, useEffect } from 'react';
import { useI18nStore } from '../../../stores/i18n.store';
import { Button } from '../../../components/ui/Button';
import { Download, X, Smartphone } from 'lucide-react';

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const { language } = useI18nStore();

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if dismissed before
    try {
      const dismissed = localStorage.getItem('ai-interview-pwa-dismissed');
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    } catch {
      // Ignore
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem('ai-interview-pwa-dismissed', 'true');
    } catch {
      // Ignore
    }
  };

  if (!deferredPrompt || isDismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-40 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-emerald-500/30 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold text-white">
            {language === 'vi' ? 'Cài đặt AI Interview Practice' : 'Install AI Interview Practice'}
          </h4>
          <p className="text-[11px] text-slate-300">
            {language === 'vi'
              ? 'Luyện phỏng vấn mượt mà & ôn flashcards không cần mạng'
              : 'Practice offline with quick home screen access'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={handleInstallClick}
          className="text-xs font-bold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500"
          leftIcon={<Download className="w-3.5 h-3.5" />}
        >
          <span>{language === 'vi' ? 'Cài đặt' : 'Install'}</span>
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
