import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Sparkles, AlertCircle } from 'lucide-react';

interface JdInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyzeJd: (jdText: string, roleTitle?: string) => Promise<any>;
  isAnalyzing: boolean;
}

export const JdInputModal: React.FC<JdInputModalProps> = ({
  isOpen,
  onClose,
  onAnalyzeJd,
  isAnalyzing,
}) => {
  const [roleTitle, setRoleTitle] = useState('');
  const [jdText, setJdText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jdText.trim().length < 20) {
      setError('Vui lòng nhập nội dung mô tả công việc (tối thiểu 20 ký tự).');
      return;
    }
    setError(null);
    try {
      await onAnalyzeJd(jdText.trim(), roleTitle.trim() || undefined);
      setRoleTitle('');
      setJdText('');
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Không thể phân tích Job Description. Vui lòng thử lại.',
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nhập Mô Tả Công Việc (Job Description)"
      description="Dán nội dung JD tuyển dụng để AI tự động bóc tách kỹ năng, vị trí và đề xuất cấu hình phỏng vấn tối ưu"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">
            Tên vị trí tuyển dụng (Tùy chọn)
          </label>
          <input
            type="text"
            value={roleTitle}
            onChange={e => setRoleTitle(e.target.value)}
            placeholder="Ví dụ: Senior Fullstack Engineer, Backend Team Lead..."
            className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none placeholder:text-slate-400 font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">
            Nội dung Job Description (JD) <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={jdText}
            onChange={e => setJdText(e.target.value)}
            rows={7}
            placeholder="Dán toàn bộ yêu cầu tuyển dụng, danh sách công nghệ, trách nhiệm hoặc tiêu chí của nhà tuyển dụng tại đây..."
            className="w-full text-xs font-sans p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none placeholder:text-slate-400 leading-relaxed"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Độ dài: {jdText.length} ký tự (Tối thiểu 20 ký tự)
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isAnalyzing}
            className="text-xs"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isAnalyzing}
            disabled={isAnalyzing || jdText.trim().length < 20}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Phân tích JD bằng AI</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
