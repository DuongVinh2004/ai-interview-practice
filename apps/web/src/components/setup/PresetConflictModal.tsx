import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FileText, Bookmark, Sparkles, AlertTriangle } from 'lucide-react';

export interface ConflictDiffItem {
  field: string;
  label: string;
  cvValue: any;
  presetValue: any;
  resolvedValue: any;
  action: 'use_cv' | 'apply_preset' | 'merge' | 'manual' | 'custom';
  requiresConfirmation: boolean;
}

interface PresetConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetName: string;
  diffs: ConflictDiffItem[];
  onUseCv: () => void;
  onApplyPreset: () => void;
  onSmartMerge: () => void;
}

export const PresetConflictModal: React.FC<PresetConflictModalProps> = ({
  isOpen,
  onClose,
  presetName,
  diffs,
  onUseCv,
  onApplyPreset,
  onSmartMerge,
}) => {
  const renderValueDisplay = (val: any) => {
    if (val === null || val === undefined)
      return <span className="text-neutral-400 italic">Chưa chọn</span>;
    if (Array.isArray(val)) {
      return (
        <div className="flex flex-wrap gap-1">
          {val.map((item, idx) => (
            <span
              key={idx}
              className="text-[11px] bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 px-1.5 py-0.5 rounded"
            >
              {typeof item === 'object' ? item.name || item.id : item}
            </span>
          ))}
        </div>
      );
    }
    if (typeof val === 'object') {
      return <span>{val.name || JSON.stringify(val)}</span>;
    }
    return <span>{String(val)}</span>;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="So Sánh Cấu Hình: Gợi Ý CV vs Preset Đã Lưu"
      className="max-w-2xl"
    >
      <div className="space-y-4 pt-1">
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200/90 text-amber-900 text-xs dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">
              Phát hiện khác biệt giữa CV và Preset "{presetName}":
            </span>
            <p className="mt-0.5 text-neutral-600 dark:text-neutral-300">
              Vui lòng chọn cách thức hợp nhất dữ liệu để chuẩn bị phiên phỏng vấn chính xác nhất.
            </p>
          </div>
        </div>

        {/* Diff Comparison Table */}
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 font-semibold">
                <th className="py-2.5 px-3">Trường</th>
                <th className="py-2.5 px-3">
                  <div className="flex items-center gap-1 text-indigo-700 dark:text-indigo-400">
                    <FileText className="h-3 w-3" />
                    <span>Gợi ý từ CV</span>
                  </div>
                </th>
                <th className="py-2.5 px-3">
                  <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                    <Bookmark className="h-3 w-3" />
                    <span>Preset đã lưu</span>
                  </div>
                </th>
                <th className="py-2.5 px-3">
                  <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <Sparkles className="h-3 w-3" />
                    <span>Kết quả đề xuất</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {diffs.map((diff, idx) => (
                <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                  <td className="py-2.5 px-3 font-medium text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                    {diff.label}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-700 dark:text-neutral-300 max-w-[150px]">
                    {renderValueDisplay(diff.cvValue)}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-700 dark:text-neutral-300 max-w-[150px]">
                    {renderValueDisplay(diff.presetValue)}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-emerald-700 dark:text-emerald-400">
                    {diff.action === 'merge' ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded text-[11px] dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300">
                        Hợp nhất kỹ năng
                      </span>
                    ) : diff.action === 'use_cv' ? (
                      'Chọn theo CV'
                    ) : (
                      'Chọn Preset'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 3 Explicit Resolution Action Cards / Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
          <button
            type="button"
            onClick={onUseCv}
            className="flex flex-col items-start p-3 rounded-xl border border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-300 transition-all text-left dark:border-indigo-900 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40"
          >
            <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-800 dark:text-indigo-300 mb-1">
              <FileText className="h-3.5 w-3.5" />
              <span>Dùng Gợi Ý Từ CV</span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-tight">
              Giữ nguyên vị trí, cấp bậc và kỹ năng trích xuất từ hồ sơ
            </p>
          </button>

          <button
            type="button"
            onClick={onApplyPreset}
            className="flex flex-col items-start p-3 rounded-xl border border-amber-200 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-300 transition-all text-left dark:border-amber-900 dark:bg-amber-950/20 dark:hover:bg-amber-950/40"
          >
            <div className="flex items-center gap-1.5 font-bold text-xs text-amber-800 dark:text-amber-300 mb-1">
              <Bookmark className="h-3.5 w-3.5" />
              <span>Áp Dụng Preset</span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-tight">
              Ghi đè theo mục tiêu đã lưu trong preset "{presetName}"
            </p>
          </button>

          <button
            type="button"
            onClick={onSmartMerge}
            className="flex flex-col items-start p-3 rounded-xl border border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700 transition-all text-left shadow-sm dark:border-emerald-600"
          >
            <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Tự Điều Chỉnh (Hợp Nhất)</span>
            </div>
            <p className="text-[11px] text-emerald-100 leading-tight">
              Hợp nhất kỹ năng và tự do chỉnh sửa chi tiết ở bước sau
            </p>
          </button>
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
};
