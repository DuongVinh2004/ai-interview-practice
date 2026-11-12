import { useState, useEffect } from 'react';
import { Bell, Flame, Sparkles, Clock, Check } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { NotificationPreferenceDto } from '@ai-interview/contracts';

const REMINDER_HOURS = Array.from({ length: 16 }, (_, i) => {
  const hour = i + 7;
  return `${hour.toString().padStart(2, '0')}:00`;
});

export function NotificationSettingsPanel() {
  const [preferences, setPreferences] = useState<NotificationPreferenceDto>({
    dailyReminder: true,
    streakWarning: true,
    newFeatures: false,
    reminderTime: '19:00',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadPreferences() {
      try {
        const res = await apiClient.get<NotificationPreferenceDto>('/notifications/preferences');
        if (isMounted && res.data) {
          setPreferences({
            dailyReminder: res.data.dailyReminder ?? true,
            streakWarning: res.data.streakWarning ?? true,
            newFeatures: res.data.newFeatures ?? false,
            reminderTime: res.data.reminderTime ?? '19:00',
          });
        }
      } catch {
        // Use default preferences if fetch fails
      }
    }
    loadPreferences();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdate = async (patch: Partial<NotificationPreferenceDto>) => {
    const updated = { ...preferences, ...patch };
    setPreferences(updated);
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      try {
        await apiClient.patch('/notifications/preferences', updated);
      } catch {
        // Fallback to PUT if backend only has PUT endpoint
        await apiClient.put('/notifications/preferences', updated);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.warn('Failed to save notification preferences:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-600" />
            Cài đặt thông báo (Notification Settings)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Quản lý thông báo đẩy và nhắc nhở ôn luyện kỹ năng phỏng vấn
          </p>
        </div>

        {isSaving ? (
          <span className="text-xs text-slate-400 font-medium">Đang lưu...</span>
        ) : saveSuccess ? (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold animate-in fade-in">
            <Check className="w-3.5 h-3.5" /> Đã lưu
          </span>
        ) : null}
      </div>

      <div className="space-y-5">
        {/* Toggle 1: Daily Reminder */}
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <label
                htmlFor="toggle-daily-reminder"
                className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                Nhắc nhở hàng ngày (Daily reminder)
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nhận thông báo nhắc bạn luyện tập phỏng vấn theo lịch định kỳ.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="toggle-daily-reminder"
              type="checkbox"
              checked={preferences.dailyReminder}
              onChange={e => handleUpdate({ dailyReminder: e.target.checked })}
              className="sr-only peer"
              aria-label="Nhắc nhở hàng ngày (Daily reminder)"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
          </label>
        </div>

        {/* Dropdown: Reminder Time */}
        <div className="flex items-center justify-between pl-11">
          <div>
            <label
              htmlFor="select-reminder-time"
              className="text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Giờ nhắc (Reminder hour):
            </label>
            <p className="text-[11px] text-slate-400">
              Chọn khung giờ thuận tiện nhất trong ngày (7:00 – 22:00)
            </p>
          </div>

          <select
            id="select-reminder-time"
            value={preferences.reminderTime}
            onChange={e => handleUpdate({ reminderTime: e.target.value })}
            disabled={!preferences.dailyReminder}
            aria-label="Giờ nhắc (Reminder hour)"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 cursor-pointer"
          >
            {REMINDER_HOURS.map(hour => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
        </div>

        {/* Toggle 2: Streak Warning */}
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-lg">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <label
                htmlFor="toggle-streak-warning"
                className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                Cảnh báo chuỗi Streak (Streak warning)
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nhận cảnh báo gấp trước khi chuỗi ngày luyện tập liên tục bị đóng băng hoặc mất.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="toggle-streak-warning"
              type="checkbox"
              checked={preferences.streakWarning}
              onChange={e => handleUpdate({ streakWarning: e.target.checked })}
              className="sr-only peer"
              aria-label="Cảnh báo chuỗi Streak (Streak warning)"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
          </label>
        </div>

        {/* Toggle 3: New Features */}
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <label
                htmlFor="toggle-new-features"
                className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                Tính năng mới (New features)
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Thông báo khi có bộ câu hỏi mới, bài toán Engineering Arena mới hoặc cập nhật mô
                phỏng AI.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="toggle-new-features"
              type="checkbox"
              checked={preferences.newFeatures}
              onChange={e => handleUpdate({ newFeatures: e.target.checked })}
              className="sr-only peer"
              aria-label="Tính năng mới (New features)"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
          </label>
        </div>
      </div>
    </div>
  );
}
