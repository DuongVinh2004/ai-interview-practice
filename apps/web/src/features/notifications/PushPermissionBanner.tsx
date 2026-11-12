import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { apiClient } from '../../lib/api-client';

const DISMISS_STORAGE_KEY = 'ai_interview_push_banner_dismissed_at';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export function PushPermissionBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    if (Notification.permission !== 'default') {
      return;
    }

    try {
      const dismissedAt = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (dismissedAt) {
        const timeElapsed = Date.now() - parseInt(dismissedAt, 10);
        if (timeElapsed < SEVEN_DAYS_MS) {
          return;
        }
      }
    } catch {
      // Storage unavailable
    }

    setIsVisible(true);
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
    } catch {
      // Storage unavailable
    }
    setIsVisible(false);
  };

  const handleEnablePush = async () => {
    setIsSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        let endpoint = '';
        let keys = { p256dh: '', auth: '' };

        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          let sub = await reg.pushManager.getSubscription();

          if (!sub) {
            const vapidKey =
              (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY ||
              'BHzqXbiPKRK7M7L7imPhPBA6UOXlZ9SuYVJt5HerKrGUn2G1QqpvnP91V7biQhQDwTWBBwQ4JzXjabWPeXWtaMA';
            const convertedKey = urlBase64ToUint8Array(vapidKey);
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedKey,
            });
          }

          if (sub) {
            const subJson = sub.toJSON();
            endpoint = subJson.endpoint || '';
            keys = {
              p256dh: subJson.keys?.p256dh || '',
              auth: subJson.keys?.auth || '',
            };
          }
        }

        const payload = {
          endpoint: endpoint || 'https://push.placeholder.local',
          keys: keys.p256dh ? keys : { p256dh: 'placeholder_p256dh', auth: 'placeholder_auth' },
          device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
        };

        try {
          await apiClient.post('/notifications/subscribe', payload);
        } catch {
          // Fallback to /notifications/push/subscribe if /notifications/subscribe fails
          await apiClient.post('/notifications/push/subscribe', payload).catch(() => {});
        }

        setIsVisible(false);
      } else {
        setIsVisible(false);
      }
    } catch (err) {
      console.warn('Failed to enable push notification:', err);
      setIsVisible(false);
    } finally {
      setIsSubscribing(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Push Notification Permission Banner"
      className="bg-emerald-600 text-white px-4 py-3 shadow-md border-b border-emerald-700 animate-in fade-in slide-in-from-top duration-300"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-emerald-500 rounded-full">
            <Bell className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-semibold">Nhận thông báo nhắc nhở phỏng vấn:</span>{' '}
            <span className="text-emerald-100">
              Nhận nhắc nhở lịch luyện tập hàng ngày và cảnh báo bảo vệ chuỗi Streak học tập.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleEnablePush}
            disabled={isSubscribing}
            className="px-3.5 py-1.5 rounded-lg bg-white text-emerald-800 font-semibold text-xs hover:bg-emerald-50 active:scale-95 transition-all shadow-sm disabled:opacity-75"
          >
            {isSubscribing ? 'Đang kích hoạt...' : 'Bật thông báo'}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-emerald-700/60 font-medium text-xs transition-colors"
          >
            Để sau
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Đóng banner"
            className="p-1 text-emerald-200 hover:text-white rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
