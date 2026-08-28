import { useI18nStore } from '../../stores/i18n.store';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatScore } from '../../lib/utils';
import { BookOpen, Quote, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';

export interface ScoreExplanationData {
  criterionName: string;
  criterionNameVi?: string;
  score: number;
  maxScore?: number;
  weight?: number;
  candidateQuote?: string;
  industryStandard?: string;
  penalties?: string[];
  positives?: string[];
  recommendation?: string;
}

interface ScoreExplanationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  data: ScoreExplanationData | null;
}

export function ScoreExplanationPopover({ isOpen, onClose, data }: ScoreExplanationPopoverProps) {
  const { language } = useI18nStore();

  if (!isOpen || !data) return null;

  const title = language === 'vi' ? data.criterionNameVi || data.criterionName : data.criterionName;
  const isHigh = data.score >= 7.5;
  const isMid = data.score >= 5.0 && data.score < 7.5;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={language === 'vi' ? `Giải thích Điểm số: ${title}` : `Score Explanation: ${title}`}
      description={
        language === 'vi'
          ? 'Minh bạch hóa cách AI chấm điểm dựa trên đối chiếu bằng chứng và chuẩn công nghệ.'
          : 'Transparent breakdown of AI scoring based on extracted evidence and industry standards.'
      }
      maxWidth="lg"
      className="p-0 overflow-hidden"
    >
      <div className="flex flex-col space-y-6 p-6 max-h-[80vh] overflow-y-auto">
        {/* Score Header Card */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {language === 'vi' ? 'Tiêu chí đánh giá' : 'Evaluation Dimension'}
            </span>
            <h4 className="text-base font-bold text-gray-900 dark:text-white">{title}</h4>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {formatScore(data.score)}
                <span className="text-sm font-normal text-gray-400">/{data.maxScore || 10}</span>
              </div>
              {data.weight && (
                <div className="text-[11px] text-gray-400">
                  {language === 'vi'
                    ? `Trọng số ${data.weight * 100}%`
                    : `Weight ${data.weight * 100}%`}
                </div>
              )}
            </div>
            <Badge variant={isHigh ? 'success' : isMid ? 'warning' : 'danger'}>
              {isHigh
                ? language === 'vi'
                  ? 'Tốt'
                  : 'Strong'
                : isMid
                  ? language === 'vi'
                    ? 'Trung bình'
                    : 'Average'
                  : language === 'vi'
                    ? 'Cần cải thiện'
                    : 'Needs Focus'}
            </Badge>
          </div>
        </div>

        {/* 1. What You Said (Candidate Quote) */}
        {data.candidateQuote && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              <Quote className="w-4 h-4 text-indigo-600" />
              {language === 'vi'
                ? 'Trích đoạn câu trả lời của bạn:'
                : 'Extracted Candidate Evidence:'}
            </div>
            <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 text-xs text-gray-800 dark:text-gray-200 italic font-mono leading-relaxed">
              "{data.candidateQuote}"
            </div>
          </div>
        )}

        {/* 2. Industry Standard Benchmark */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <BookOpen className="w-4 h-4 text-sky-600" />
            {language === 'vi'
              ? 'Đối chiếu chuẩn công nghệ chính thức:'
              : 'Official Industry Standard Benchmark:'}
          </div>
          <div className="p-3.5 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/50 text-xs text-gray-800 dark:text-gray-200 leading-relaxed">
            {data.industryStandard ||
              (language === 'vi'
                ? 'Được đối chiếu theo tài liệu chính thức (MDN Web Docs, RFC Specs, ISO/IEC 25010 và PostgreSQL Documentation).'
                : 'Benchmarked against official technology specifications, RFCs, and industry engineering standards.')}
          </div>
        </div>

        {/* 3. Deductions & Positives */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.positives && data.positives.length > 0 && (
            <div className="p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 space-y-2">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {language === 'vi' ? 'Điểm cộng (+)' : 'Points Awarded (+)'}
              </span>
              <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                {data.positives.map((p, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.penalties && data.penalties.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 space-y-2">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                {language === 'vi' ? 'Điểm trừ (-)' : 'Deductions (-)'}
              </span>
              <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                {data.penalties.map((p, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 4. Recommendation to Reach 10/10 */}
        {data.recommendation && (
          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
              <Sparkles className="w-4 h-4" />
              {language === 'vi'
                ? 'Cách trả lời để đạt điểm 10 tuyệt đối:'
                : 'How to Achieve a 10/10 Score:'}
            </div>
            <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed">
              {data.recommendation}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-6 py-3 flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {language === 'vi' ? 'Đóng' : 'Close'}
        </Button>
      </div>
    </Modal>
  );
}
