import { Filter, RotateCcw, Search } from 'lucide-react';
import { useI18nStore } from '../../../stores/i18n.store';

interface QuestionFilterSidebarProps {
  search: string;
  onSearchChange: (val: string) => void;
  role: string;
  onRoleChange: (val: string) => void;
  seniority: string;
  onSeniorityChange: (val: string) => void;
  difficulty: number | undefined;
  onDifficultyChange: (val: number | undefined) => void;
  questionType: string;
  onQuestionTypeChange: (val: string) => void;
  language: string;
  onLanguageChange: (val: string) => void;
  onReset: () => void;
  roles?: Array<{ id: string; slug: string; name: string }>;
  seniorities?: Array<{ id: string; slug: string; name: string }>;
}

export function QuestionFilterSidebar({
  search,
  onSearchChange,
  role,
  onRoleChange,
  seniority,
  onSeniorityChange,
  difficulty,
  onDifficultyChange,
  questionType,
  onQuestionTypeChange,
  language,
  onLanguageChange,
  onReset,
  roles = [],
  seniorities = [],
}: QuestionFilterSidebarProps) {
  const { language: uiLang } = useI18nStore();
  const isVi = uiLang === 'vi';

  const hasActiveFilters =
    !!search ||
    !!role ||
    !!seniority ||
    difficulty !== undefined ||
    !!questionType ||
    (!!language && language !== 'vi');

  return (
    <aside
      aria-label={isVi ? 'Bộ lọc câu hỏi phỏng vấn' : 'Interview question filters'}
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Filter className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          {isVi ? 'Bộ lọc tìm kiếm' : 'Search Filters'}
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
          >
            <RotateCcw className="h-3 w-3" />
            {isVi ? 'Đặt lại' : 'Reset'}
          </button>
        )}
      </div>

      {/* Search Input */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          {isVi ? 'Từ khóa' : 'Keywords'}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={isVi ? 'Tìm câu hỏi, khái niệm...' : 'Search questions, concepts...'}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
          />
        </div>
      </div>

      {/* Role Filter */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          {isVi ? 'Vị trí tuyển dụng (Role)' : 'Job Role'}
        </label>
        <select
          value={role}
          onChange={e => onRoleChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">{isVi ? 'Tất cả vị trí' : 'All Roles'}</option>
          {roles.map(r => (
            <option key={r.id} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {/* Seniority Filter */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          {isVi ? 'Cấp bậc (Seniority)' : 'Seniority Level'}
        </label>
        <select
          value={seniority}
          onChange={e => onSeniorityChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">{isVi ? 'Tất cả cấp bậc' : 'All Levels'}</option>
          {seniorities.map(s => (
            <option key={s.id} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Difficulty Rating */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          {isVi ? 'Độ khó (1 - 5)' : 'Difficulty (1 - 5)'}
        </label>
        <div className="grid grid-cols-6 gap-1">
          <button
            type="button"
            onClick={() => onDifficultyChange(undefined)}
            className={`rounded py-1.5 text-xs font-medium transition-colors ${
              difficulty === undefined
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {isVi ? 'Tất cả' : 'All'}
          </button>
          {[1, 2, 3, 4, 5].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => onDifficultyChange(d)}
              className={`rounded py-1.5 text-xs font-medium transition-colors ${
                difficulty === d
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              L{d}
            </button>
          ))}
        </div>
      </div>

      {/* Question Type / Format */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          {isVi ? 'Dạng câu hỏi' : 'Question Type'}
        </label>
        <select
          value={questionType}
          onChange={e => onQuestionTypeChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">{isVi ? 'Tất cả dạng câu hỏi' : 'All Types'}</option>
          <option value="conceptual">
            {isVi ? 'Lý thuyết / Khái niệm' : 'Conceptual / Theory'}
          </option>
          <option value="coding">{isVi ? 'Lập trình & Thuật toán' : 'Coding & Algorithms'}</option>
          <option value="system_design">
            {isVi ? 'Thiết kế hệ thống (System Design)' : 'System Design'}
          </option>
          <option value="behavioral">
            {isVi ? 'Phỏng vấn hành vi (STAR)' : 'Behavioral (STAR)'}
          </option>
          <option value="scenario">{isVi ? 'Tình huống thực tế' : 'Practical Scenario'}</option>
          <option value="debugging">
            {isVi ? 'Gỡ lỗi / Tối ưu mã nguồn' : 'Debugging / Optimization'}
          </option>
        </select>
      </div>

      {/* Language Filter */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          {isVi ? 'Ngôn ngữ câu hỏi' : 'Question Content Language'}
        </label>
        <select
          value={language}
          onChange={e => onLanguageChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">{isVi ? 'Tất cả ngôn ngữ' : 'All Languages'}</option>
          <option value="vi">Tiếng Việt (vi)</option>
          <option value="en">English (en)</option>
        </select>
      </div>
    </aside>
  );
}
