import React from 'react';
import { Button } from '../ui/Button';
import {
  SessionMode,
  CompetencyArea,
  JobRoleDto,
  SeniorityLevelDto,
  TechnologyDto,
} from '@ai-interview/contracts';
import { Play, FileText, Bookmark, Sparkles, Edit3, Clock, Globe, AlertCircle } from 'lucide-react';

export interface FieldSourceTracking {
  role?: 'cv' | 'preset' | 'manual' | 'default';
  level?: 'cv' | 'preset' | 'manual' | 'default';
  techs?: 'cv' | 'preset' | 'manual' | 'default';
  mode?: 'cv' | 'preset' | 'manual' | 'default';
  language?: 'cv' | 'preset' | 'manual' | 'default';
}

interface StickySetupSummaryProps {
  selectedRole?: JobRoleDto;
  selectedLevel?: SeniorityLevelDto;
  selectedTechObjects: TechnologyDto[];
  sessionMode: SessionMode;
  competencyArea?: CompetencyArea;
  interviewLanguage: string;
  totalTurns: number;
  fieldSources: FieldSourceTracking;
  activePresetName?: string;
  hasCvProfile: boolean;
  isSubmitting: boolean;
  validationErrors: {
    role?: string;
    level?: string;
    techs?: string;
  };
  onStartInterview: () => void;
}

export const StickySetupSummary: React.FC<StickySetupSummaryProps> = ({
  selectedRole,
  selectedLevel,
  selectedTechObjects,
  sessionMode,
  competencyArea: _competencyArea,
  interviewLanguage,
  totalTurns,
  fieldSources,
  activePresetName,
  hasCvProfile,
  isSubmitting,
  validationErrors,
  onStartInterview,
}) => {
  const renderSourceBadge = (source?: 'cv' | 'preset' | 'manual' | 'default') => {
    switch (source) {
      case 'cv':
        return (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.2 rounded dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300">
            <FileText className="h-2.5 w-2.5" />
            <span>từ CV</span>
          </span>
        );
      case 'preset':
        return (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300">
            <Bookmark className="h-2.5 w-2.5" />
            <span>từ preset</span>
          </span>
        );
      case 'manual':
        return (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 rounded dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300">
            <Edit3 className="h-2.5 w-2.5" />
            <span>đã chỉnh sửa</span>
          </span>
        );
      default:
        return null;
    }
  };

  const getModeLabel = (mode: SessionMode) => {
    switch (mode) {
      case SessionMode.STANDARD:
        return 'Tiêu Chuẩn (Adaptive)';
      case SessionMode.VOICE_LIVE:
        return 'Voice AI Trực Tiếp';
      case SessionMode.CODING:
        return 'Live Coding Sandbox';
      case SessionMode.SYSTEM_DESIGN:
        return 'System Design Whiteboard';
      case SessionMode.BEHAVIORAL:
        return 'Phỏng Vấn Hành Vi (STAR)';
      case SessionMode.FOCUSED_REMEDIATION:
        return 'Luyện Tập Trọng Tâm';
      case SessionMode.QUICK_PRACTICE:
        return 'Sandbox Thử Nghiệm';
      default:
        return mode;
    }
  };

  const hasErrors = !!validationErrors.role || !!validationErrors.level || !!validationErrors.techs;
  const approxMinutes = totalTurns * 5;

  return (
    <div
      className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Tóm tắt cấu hình phỏng vấn"
    >
      {/* Title */}
      <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
            Tóm Tắt Cấu Hình
          </h3>
        </div>

        {activePresetName ? (
          <span
            className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full dark:bg-amber-950 dark:text-amber-300 truncate max-w-[140px]"
            title={activePresetName}
          >
            {activePresetName}
          </span>
        ) : hasCvProfile ? (
          <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full dark:bg-indigo-950 dark:text-indigo-300">
            Theo CV
          </span>
        ) : null}
      </div>

      {/* Provenance Fields List */}
      <div className="py-3.5 space-y-3 text-xs">
        {/* Role & Level */}
        <div>
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-neutral-500 dark:text-neutral-400 font-medium">
              Vị trí & Cấp bậc:
            </span>
            <div className="flex items-center gap-1">
              {renderSourceBadge(fieldSources.role || fieldSources.level)}
            </div>
          </div>
          <p className="font-semibold text-neutral-900 dark:text-neutral-100">
            {selectedLevel?.name ? `${selectedLevel.name} ` : ''}
            {selectedRole?.name || (
              <span className="text-neutral-400 italic">Chưa chọn vị trí</span>
            )}
          </p>
        </div>

        {/* Selected Technologies */}
        <div>
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-neutral-500 dark:text-neutral-400 font-medium">
              Kỹ năng trọng tâm ({selectedTechObjects.length}/5):
            </span>
            {renderSourceBadge(fieldSources.techs)}
          </div>
          {selectedTechObjects.length === 0 ? (
            <p className="text-neutral-400 italic">Chưa chọn kỹ năng</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {selectedTechObjects.map(tech => (
                <span
                  key={tech.id}
                  className="text-[11px] bg-neutral-50 border border-neutral-200/80 text-neutral-800 px-2 py-0.5 rounded-md dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-200"
                >
                  {tech.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Mode */}
        <div className="pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-neutral-500 dark:text-neutral-400 font-medium">Chế độ:</span>
            {renderSourceBadge(fieldSources.mode)}
          </div>
          <p className="font-semibold text-neutral-900 dark:text-neutral-100">
            {getModeLabel(sessionMode)}
          </p>
        </div>

        {/* Language & Duration */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <span className="text-neutral-500 dark:text-neutral-400 font-medium block mb-0.5">
              Ngôn ngữ:
            </span>
            <div className="flex items-center gap-1 font-semibold text-neutral-900 dark:text-neutral-100">
              <Globe className="h-3 w-3 text-neutral-400" />
              <span>{interviewLanguage === 'en' ? 'English' : 'Tiếng Việt'}</span>
            </div>
          </div>
          <div>
            <span className="text-neutral-500 dark:text-neutral-400 font-medium block mb-0.5">
              Thời lượng:
            </span>
            <div className="flex items-center gap-1 font-semibold text-neutral-900 dark:text-neutral-100">
              <Clock className="h-3 w-3 text-neutral-400" />
              <span>
                {totalTurns} câu (~{approxMinutes}p)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Errors warning if any */}
      {hasErrors && (
        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] mb-3 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300">
          <div className="flex items-center gap-1.5 font-semibold mb-0.5">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Vui lòng hoàn tất:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-neutral-600 dark:text-neutral-300">
            {validationErrors.role && <li>Chọn vị trí công việc</li>}
            {validationErrors.level && <li>Chọn cấp bậc</li>}
            {validationErrors.techs && <li>Chọn ít nhất 1 kỹ năng (tối đa 5)</li>}
          </ul>
        </div>
      )}

      {/* Start Interview CTA Button */}
      <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onStartInterview}
          disabled={
            isSubmitting ||
            hasErrors ||
            !selectedRole ||
            !selectedLevel ||
            selectedTechObjects.length === 0
          }
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 text-sm shadow-md transition-all active:scale-[0.99] gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>Đang khởi tạo buổi phỏng vấn...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-white" />
              <span>Bắt Đầu Phỏng Vấn Ngay</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
