import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Target,
  HelpCircle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { InterviewBlueprintDto } from '@ai-interview/contracts';

interface GapAnalysisPreviewProps {
  blueprint: InterviewBlueprintDto;
  onProceed: (blueprintId: string) => void;
  isLoading?: boolean;
}

export const GapAnalysisPreview: React.FC<GapAnalysisPreviewProps> = ({
  blueprint,
  onProceed,
  isLoading,
}) => {
  return (
    <div
      className="bg-white rounded-xl border border-indigo-100 shadow-md p-6 space-y-6"
      data-testid="gap-analysis-preview"
    >
      {/* Header Match Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">
              Kịch bản phỏng vấn được may đo riêng (Tailored Blueprint)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Vị trí: <strong className="text-slate-800">{blueprint.targetRole}</strong> (
            {blueprint.targetLevel})
          </p>
        </div>

        <div className="flex items-center space-x-3 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
          <div className="text-right">
            <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">
              Độ phù hợp kỹ năng
            </p>
            <p className="text-xl font-extrabold text-indigo-950">{blueprint.matchPercentage}%</p>
          </div>
          <div className="w-12 h-12 rounded-full border-4 border-indigo-600 flex items-center justify-center font-bold text-xs text-indigo-900 bg-white">
            {blueprint.matchPercentage}%
          </div>
        </div>
      </div>

      {/* Skills Match & Gap Pills */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 space-y-2">
          <div className="flex items-center space-x-1.5 text-emerald-800 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Kỹ năng đáp ứng yêu cầu ({blueprint.matchedSkills.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {blueprint.matchedSkills.map(skill => (
              <span
                key={skill}
                className="px-2.5 py-1 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold shadow-xs"
              >
                {skill}
              </span>
            ))}
            {blueprint.matchedSkills.length === 0 && (
              <span className="text-xs text-slate-400 italic">
                Chưa phát hiện kỹ năng trùng khớp trực tiếp
              </span>
            )}
          </div>
        </div>

        <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-4 space-y-2">
          <div className="flex items-center space-x-1.5 text-amber-800 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Điểm cần cải thiện / Trọng tâm phỏng vấn ({blueprint.gapSkills.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {blueprint.gapSkills.map(skill => (
              <span
                key={skill}
                className="px-2.5 py-1 bg-white border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold shadow-xs"
              >
                {skill}
              </span>
            ))}
            {blueprint.gapSkills.length === 0 && (
              <span className="text-xs text-slate-400 italic">
                Hồ sơ đáp ứng đầy đủ các yêu cầu chính
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Topics Breakdown */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
          <Target className="w-4 h-4 text-primary-600" />
          <span>Cấu trúc buổi phỏng vấn & Câu hỏi trích xuất từ CV</span>
        </h4>

        <div className="space-y-3">
          {blueprint.topics.map((topic, idx) => (
            <div
              key={idx}
              className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">{topic.topic}</span>
                <span className="px-2 py-0.5 bg-primary-100 text-primary-800 text-[11px] font-bold rounded-full">
                  Tỷ trọng: {topic.weight}%
                </span>
              </div>
              <p className="text-xs text-slate-600">{topic.reason}</p>
              {topic.cvReference && (
                <p className="text-[11px] text-slate-500 italic">
                  📌 Đối chiếu CV: {topic.cvReference}
                </p>
              )}
              {topic.sampleQuestions && topic.sampleQuestions.length > 0 && (
                <div className="mt-2 space-y-1 bg-white p-2.5 rounded-lg border border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-700 flex items-center space-x-1">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Ví dụ câu hỏi AI sẽ đưa ra:</span>
                  </span>
                  <p className="text-xs text-slate-600 italic">"{topic.sampleQuestions[0]}"</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Proceed Button */}
      <div className="pt-2 flex justify-end">
        <Button
          size="lg"
          onClick={() => blueprint.id && onProceed(blueprint.id)}
          isLoading={isLoading}
          className="w-full sm:w-auto shadow-md"
        >
          <span>Bắt đầu phiên phỏng vấn may đo</span>
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
