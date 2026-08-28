import { Link } from 'react-router-dom';
import { QuestionBankQuestionDto } from '@ai-interview/contracts';
import { Bookmark, CheckCircle2, Lock, Eye, Layers } from 'lucide-react';

interface QuestionCardProps {
  question: QuestionBankQuestionDto;
  onToggleBookmark?: (id: string, currentlyBookmarked: boolean) => void;
  isBookmarkLoading?: boolean;
}

export function QuestionCard({ question, onToggleBookmark, isBookmarkLoading }: QuestionCardProps) {
  const getDifficultyColor = (difficulty: number) => {
    switch (difficulty) {
      case 1:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case 2:
        return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800';
      case 3:
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
      case 4:
        return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800';
      case 5:
      default:
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
    }
  };

  const getDifficultyLabel = (difficulty: number) => {
    switch (difficulty) {
      case 1:
        return 'Cơ bản (L1)';
      case 2:
        return 'Dễ (L2)';
      case 3:
        return 'Trung bình (L3)';
      case 4:
        return 'Khó (L4)';
      case 5:
      default:
        return 'Chuyên sâu (L5)';
    }
  };

  const formatTypeLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case 'conceptual':
        return 'Lý thuyết';
      case 'coding':
        return 'Lập trình';
      case 'system_design':
      case 'system-design':
        return 'Thiết kế hệ thống';
      case 'behavioral':
        return 'Hành vi (STAR)';
      case 'scenario':
        return 'Tình huống';
      case 'debugging':
        return 'Gỡ lỗi';
      default:
        return type;
    }
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700">
      <div>
        {/* Top Badges & Bookmark */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${getDifficultyColor(
                question.difficulty,
              )}`}
            >
              {getDifficultyLabel(question.difficulty)}
            </span>

            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
              <Layers className="h-3 w-3" />
              {formatTypeLabel(question.questionType)}
            </span>

            {question.jobRole && (
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {question.jobRole.name}
              </span>
            )}
          </div>

          {onToggleBookmark && (
            <button
              type="button"
              aria-label={question.isBookmarked ? 'Bỏ lưu câu hỏi' : 'Lưu câu hỏi'}
              disabled={isBookmarkLoading}
              onClick={e => {
                e.preventDefault();
                onToggleBookmark(question.id, !!question.isBookmarked);
              }}
              className={`rounded-lg p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                question.isBookmarked
                  ? 'bg-amber-50 text-amber-500 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Bookmark
                className="h-4 w-4"
                fill={question.isBookmarked ? 'currentColor' : 'none'}
              />
            </button>
          )}
        </div>

        {/* Title & Body */}
        <Link
          to={`/question-bank/${question.slug}`}
          className="mt-3 block group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
        >
          <h3 className="text-base font-semibold text-slate-900 line-clamp-2 dark:text-white">
            {question.title}
          </h3>
          <p className="mt-1.5 text-sm text-slate-600 line-clamp-2 dark:text-slate-400">
            {question.questionBody}
          </p>
        </Link>

        {/* Technology tags */}
        {question.technologies && question.technologies.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {question.technologies.slice(0, 4).map(tech => (
              <span
                key={tech.id}
                className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              >
                {tech.name}
              </span>
            ))}
            {question.technologies.length > 4 && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-500">
                +{question.technologies.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer / Status Indicator */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5 text-xs">
          {question.isRevealed ? (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Đã mở đáp án
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Lock className="h-3.5 w-3.5" />
              Chưa mở đáp án
            </span>
          )}
        </div>

        <Link
          to={`/question-bank/${question.slug}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          <Eye className="h-3.5 w-3.5" />
          Chi tiết & Đáp án
        </Link>
      </div>
    </div>
  );
}
