import React, { useState } from 'react';
import { Briefcase, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';

interface JdInputCardProps {
  onAnalyzed: (analyzedData: any) => void;
  isAnalyzing: boolean;
  onAnalyzeJd: (jdText: string, roleTitle?: string) => Promise<any>;
}

export const JdInputCard: React.FC<JdInputCardProps> = ({
  onAnalyzed,
  isAnalyzing,
  onAnalyzeJd,
}) => {
  const [roleTitle, setRoleTitle] = useState('');
  const [jdText, setJdText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jdText.trim().length < 20) {
      setError('Vui lòng nhập mô tả công việc ít nhất 20 ký tự.');
      return;
    }
    setError(null);
    try {
      const res = await onAnalyzeJd(jdText, roleTitle || undefined);
      onAnalyzed(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Không thể phân tích Job Description');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4" data-testid="jd-input-card">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <Briefcase className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-800">2. Job Description (Mô tả công việc mục tiêu)</h3>
        </div>
      </div>

      {error && (
        <div className="flex items-center space-x-2 p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Vị trí tuyển dụng (Tùy chọn)
          </label>
          <input
            type="text"
            value={roleTitle}
            onChange={e => setRoleTitle(e.target.value)}
            placeholder="Ví dụ: Senior Backend Engineer, Tech Lead..."
            className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Nội dung Job Description (Yêu cầu kỹ năng, trách nhiệm)
          </label>
          <textarea
            value={jdText}
            onChange={e => setJdText(e.target.value)}
            rows={5}
            placeholder="Dán toàn bộ nội dung tuyển dụng hoặc danh sách yêu cầu kỹ thuật của công ty..."
            className="w-full text-xs font-mono p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            isLoading={isAnalyzing}
            disabled={isAnalyzing || jdText.trim().length < 20}
          >
            Phân tích yêu cầu JD
          </Button>
        </div>
      </form>
    </div>
  );
};
