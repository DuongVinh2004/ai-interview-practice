import { Filter, RotateCcw, Search } from 'lucide-react';

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
  const hasActiveFilters =
    !!search ||
    !!role ||
    !!seniority ||
    difficulty !== undefined ||
    !!questionType ||
    (!!language && language !== 'vi');

  return (
    <aside
      aria-label="Bộ lọc câu hỏi phỏng vấn"
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Filter className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          Bộ lọc tìm kiếm
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
          >
            <RotateCcw className="h-3 w-3" />
            Đặt lại
          </button>
        )}
      </div>

      {/* Search Input */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          Từ khóa
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Tìm câu hỏi, khái niệm..."
            className="w-full rounded-lg border border-slate-300 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
          />
        </div>
      </div>

      {/* Role Filter */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          Vị trí tuyển dụng (Role)
        </label>
        <select
          value={role}
          onChange={e => onRoleChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">Tất cả vị trí</option>
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
          Cấp bậc (Seniority)
        </label>
        <select
          value={seniority}
          onChange={e => onSeniorityChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">Tất cả cấp bậc</option>
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
          Độ khó (1 - 5)
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
            All
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
          Dạng câu hỏi
        </label>
        <select
          value={questionType}
          onChange={e => onQuestionTypeChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">Tất cả dạng câu hỏi</option>
          <option value="conceptual">Lý thuyết / Khái niệm</option>
          <option value="coding">Lập trình & Thuật toán</option>
          <option value="system_design">Thiết kế hệ thống (System Design)</option>
          <option value="behavioral">Phỏng vấn hành vi (STAR)</option>
          <option value="scenario">Tình huống thực tế</option>
          <option value="debugging">Gỡ lỗi / Tối ưu mã nguồn</option>
        </select>
      </div>

      {/* Language Filter */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
          Ngôn ngữ
        </label>
        <select
          value={language}
          onChange={e => onLanguageChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">Tất cả ngôn ngữ</option>
          <option value="vi">Tiếng Việt (vi)</option>
          <option value="en">English (en)</option>
        </select>
      </div>
    </aside>
  );
}
