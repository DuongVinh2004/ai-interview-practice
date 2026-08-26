import { apiClient } from './api-client';
import { PushSubscriptionDto, NotificationPreferenceDto } from '@ai-interview/contracts';

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

export const isPushSupported = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
};

export const getNotificationPermission = (): NotificationPermission => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'default';
  }
  return Notification.permission;
};

export const requestPushSubscription = async (): Promise<boolean> => {
  if (!isPushSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    const publicVapidKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY;
    if (!publicVapidKey) {
      console.warn('Web Push is disabled because VITE_VAPID_PUBLIC_KEY is not configured.');
      return false;
    }

    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      return false;
    }

    const payload: PushSubscriptionDto = {
      endpoint: subJson.endpoint,
      keys: {
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      },
      device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
    };

    await apiClient('/notifications/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return true;
  } catch (err) {
    console.warn('Failed to subscribe to Web Push:', err);
    return false;
  }
};

export const fetchNotificationPreferences = async (): Promise<NotificationPreferenceDto> => {
  return apiClient<NotificationPreferenceDto>('/notifications/preferences');
};

export const saveNotificationPreferences = async (
  dto: NotificationPreferenceDto,
): Promise<NotificationPreferenceDto> => {
  return apiClient<NotificationPreferenceDto>('/notifications/preferences', {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
};

export const triggerTestPush = async (): Promise<void> => {
  return apiClient<void>('/notifications/push/test', {
    method: 'POST',
  });
};
