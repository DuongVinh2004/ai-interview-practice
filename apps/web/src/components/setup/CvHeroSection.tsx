import React, { useState, useRef } from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  FileText,
  Upload,
  Briefcase,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Eye,
  ChevronRight,
  FileCheck,
} from 'lucide-react';

export interface ExtractedProfileData {
  documentId?: string;
  fullName?: string;
  targetRole?: string;
  seniorityLevel?: string;
  skills: string[];
  matchedJobRoleId?: string;
  matchedSeniorityLevelId?: string;
  matchedTechnologyIds: string[];
  unmatchedSkills?: string[];
  summary?: string;
}

interface CvHeroSectionProps {
  extractedProfile: ExtractedProfileData | null;
  isParsing: boolean;
  onUploadCvFile: (file: File) => void;
  onOpenJdInput: () => void;
  onSelectExistingProfile: () => void;
  onSkipCv: () => void;
  onResetCv: () => void;
  onViewDetails?: () => void;
  onProceedToPresets?: () => void;
}

export const CvHeroSection: React.FC<CvHeroSectionProps> = ({
  extractedProfile,
  isParsing,
  onUploadCvFile,
  onOpenJdInput,
  onSelectExistingProfile,
  onSkipCv,
  onResetCv,
  onViewDetails,
  onProceedToPresets,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUploadCvFile(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadCvFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/40 p-4 sm:p-5 shadow-sm dark:border-indigo-950/50 dark:from-indigo-950/20 dark:via-neutral-900 dark:to-neutral-900 flex flex-col justify-between h-full"
      aria-label="Khu vực hồ sơ ứng viên"
    >
      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex-shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 bg-indigo-100/70 dark:bg-indigo-950/80 px-2 py-0.2 rounded-full">
                  Bước 1
                </span>
                <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Hồ Sơ Cho Buổi Phỏng Vấn (CV / JD)
                </h2>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
                Tải CV/JD để AI tự động trích xuất vai trò, cấp bậc và kỹ năng
              </p>
            </div>
          </div>

          {extractedProfile && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetCv}
              className="text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 gap-1 h-7 px-2"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Đổi CV</span>
            </Button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* State A: Parsing in progress */}
        {isParsing && (
          <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl border border-indigo-200/80 bg-white/80 dark:border-indigo-900/60 dark:bg-neutral-900/80">
            <div className="relative mb-2.5">
              <div className="h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
            </div>
            <h3 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              AI đang phân tích và trích xuất hồ sơ ứng viên...
            </h3>
            <p className="text-[11px] text-neutral-500 mt-0.5 text-center">
              Đang đối chiếu vị trí, cấp bậc và công nghệ cốt lõi
            </p>
          </div>
        )}

        {/* State B: Extracted Profile Summary Card */}
        {!isParsing && extractedProfile && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/20 animate-fade-in space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                  Đã nhận diện hồ sơ thành công
                </span>
              </div>
              {extractedProfile.fullName && (
                <span className="text-[11px] text-neutral-500 font-medium">
                  {extractedProfile.fullName}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {extractedProfile.targetRole || 'Software Engineer'}
              </span>
              <span className="text-neutral-300 dark:text-neutral-700">•</span>
              <Badge
                variant="success"
                className="bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 text-[11px] px-2 py-0.5"
              >
                {extractedProfile.seniorityLevel || 'Mid-Level'}
              </Badge>
            </div>

            {/* Skills Chips */}
            <div className="flex flex-wrap gap-1">
              {extractedProfile.skills.slice(0, 6).map((skill, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center text-[11px] bg-white border border-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md dark:bg-neutral-800 dark:border-emerald-900/80 dark:text-emerald-300"
                >
                  {skill}
                </span>
              ))}
              {extractedProfile.skills.length > 6 && (
                <span className="text-[10px] text-neutral-500 self-center">
                  +{extractedProfile.skills.length - 6} kỹ năng
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-100 dark:border-emerald-900/40">
              {onViewDetails && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onViewDetails}
                  className="text-xs h-7 px-2.5 gap-1 border-neutral-300 dark:border-neutral-700"
                >
                  <Eye className="h-3 w-3" />
                  <span>Xem chi tiết</span>
                </Button>
              )}

              {onProceedToPresets && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={onProceedToPresets}
                  className="text-xs h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                >
                  <span>Tiếp tục bước 2</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* State C: Empty State (Upload or Skip) */}
        {!isParsing && !extractedProfile && (
          <div
            onClick={e => {
              const target = e.target as HTMLElement;
              if (!target.closest('button')) {
                fileInputRef.current?.click();
              }
            }}
            onDragOver={e => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center p-4 sm:p-5 text-center rounded-xl border-2 border-dashed transition-all cursor-pointer ${
              dragOver
                ? 'border-indigo-500 bg-indigo-50/50 dark:border-indigo-400 dark:bg-indigo-950/30'
                : 'border-indigo-200/90 bg-white/70 hover:border-indigo-400 hover:bg-indigo-50/20 dark:border-neutral-800 dark:bg-neutral-900/50'
            }`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-2 dark:bg-indigo-950 dark:text-indigo-400">
              <Upload className="h-4 w-4" />
            </div>

            <h3 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Kéo thả file CV vào đây, hoặc chọn
            </h3>
            <p className="text-[11px] text-neutral-500 mt-0.5 mb-3">
              Hỗ trợ PDF, DOCX (tối đa 10MB)
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-7 px-2.5 gap-1 shadow-sm"
              >
                <Upload className="h-3 w-3" />
                <span>Tải Lên CV Của Bạn</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  onOpenJdInput();
                }}
                className="text-xs h-7 px-2.5 gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/50 bg-white"
              >
                <Briefcase className="h-3 w-3" />
                <span>Nhập JD Công Việc</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  onSelectExistingProfile();
                }}
                className="text-xs h-7 px-2.5 gap-1 border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 bg-white"
              >
                <FileText className="h-3 w-3" />
                <span>Dùng Hồ Sơ Đã Có</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Skip link */}
      {!extractedProfile && !isParsing && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={onSkipCv}
            className="text-[11px] font-medium text-neutral-500 hover:text-indigo-600 dark:text-neutral-400 dark:hover:text-indigo-300 transition-colors inline-flex items-center gap-0.5"
          >
            <span>Tiếp tục không dùng CV / Luyện tập tự do</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
};
