import { useState, useEffect } from 'react';
import { useI18nStore } from '../../stores/i18n.store';
import {
  isPushSupported,
  getNotificationPermission,
  requestPushSubscription,
  triggerTestPush,
} from '../../lib/push-notifications';
import { Button } from '../../components/ui/Button';
import { Bell, BellRing, Check, X } from 'lucide-react';
import { playSFX } from '../../lib/sfx-engine';

export function PushNotificationPrompt() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestSent, setIsTestSent] = useState(false);
  const { language } = useI18nStore();

  useEffect(() => {
    if (isPushSupported()) {
      setPermission(getNotificationPermission());
    }

    try {
      const dismissed = localStorage.getItem('ai-interview-push-prompt-dismissed');
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleEnablePush = async () => {
    setIsLoading(true);
    const success = await requestPushSubscription();
    setIsLoading(false);

    if (success) {
      playSFX('success');
      setPermission('granted');
      setIsDismissed(true);
    } else {
      setPermission(getNotificationPermission());
    }
  };

  const handleSendTest = async () => {
    setIsTestSent(true);
    playSFX('click');
    await triggerTestPush();
    setTimeout(() => setIsTestSent(false), 3000);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem('ai-interview-push-prompt-dismissed', 'true');
    } catch {
      // Ignore
    }
  };

  if (!isPushSupported() || permission === 'denied' || (permission === 'granted' && isDismissed)) {
    return null;
  }

  if (isDismissed) return null;

  return (
    <div
      className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 max-w-sm w-full bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 animate-in slide-in-from-bottom-5 duration-300"
      data-testid="push-notification-prompt"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl shrink-0">
          <BellRing className="w-6 h-6 animate-pulse" />
        </div>

        <div className="flex-1 space-y-1">
          <h4 className="text-sm font-bold text-slate-900">
            {language === 'vi' ? 'Nhắc Nhở Duy Trì Chuỗi Học Tập' : 'Maintain Practice Streaks'}
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            {language === 'vi'
              ? 'Nhận thông báo nhắc nhở vào lúc 20:00 tối để không bị mất chuỗi Streak học tập quý giá của bạn.'
              : 'Get gentle reminders at 8:00 PM to protect your active daily practice streak.'}
          </p>

          <div className="flex items-center gap-2 pt-3">
            {permission === 'granted' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSendTest}
                disabled={isTestSent}
                className="text-xs w-full"
              >
                {isTestSent ? (
                  <span className="flex items-center gap-1 text-emerald-700 font-bold">
                    <Check className="w-3.5 h-3.5" />
                    <span>{language === 'vi' ? 'Đã gửi test' : 'Test Sent'}</span>
                  </span>
                ) : (
                  <span>{language === 'vi' ? 'Gửi thông báo thử' : 'Send Test Push'}</span>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                onClick={handleEnablePush}
                isLoading={isLoading}
                leftIcon={<Bell className="w-3.5 h-3.5" />}
                className="text-xs w-full font-bold shadow-xs bg-emerald-600 hover:bg-emerald-700"
              >
                <span>{language === 'vi' ? 'Bật Thông Báo' : 'Enable Notifications'}</span>
              </Button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default PushNotificationPrompt;
