import { CompetencyArea } from '@ai-interview/contracts';

export const COMPETENCY_OPTIONS = [
  {
    area: CompetencyArea.SYSTEM_DESIGN,
    label: 'Thiết Kế Hệ Thống & Khả Năng Mở Rộng',
    labelEn: 'System Design & Scalability',
  },
  {
    area: CompetencyArea.LANGUAGE_CORE,
    label: 'Nền Tảng Ngôn Ngữ & Cốt Lõi',
    labelEn: 'Core Language & Fundamentals',
  },
  {
    area: CompetencyArea.DATABASE_CONCURRENCY,
    label: 'Cơ Sở Dữ Liệu & Xử Lý Đồng Thời',
    labelEn: 'Databases & Concurrency',
  },
  {
    area: CompetencyArea.ARCHITECTURE_PATTERNS,
    label: 'Kiến Trúc & Mẫu Thiết Kế',
    labelEn: 'Architecture & Patterns',
  },
  {
    area: CompetencyArea.RESILIENCE_SECURITY,
    label: 'Độ Tin Cậy & Bảo Mật',
    labelEn: 'Resilience & Security',
  },
];

export const TECH_CATEGORIES = [
  { key: 'ALL', labelVi: 'Tất cả', labelEn: 'All' },
  { key: 'Language', labelVi: 'Ngôn ngữ', labelEn: 'Languages' },
  { key: 'Frontend', labelVi: 'Frontend', labelEn: 'Frontend' },
  { key: 'Mobile', labelVi: 'Mobile', labelEn: 'Mobile' },
  { key: 'Backend', labelVi: 'Backend', labelEn: 'Backend' },
  { key: 'Database', labelVi: 'Database & Cache', labelEn: 'Databases' },
  { key: 'API', labelVi: 'API & Streaming', labelEn: 'API & Streaming' },
  { key: 'DevOps', labelVi: 'Cloud & DevOps', labelEn: 'Cloud & DevOps' },
  { key: 'AI/Data', labelVi: 'AI & Data', labelEn: 'AI & Data' },
  { key: 'Testing', labelVi: 'Kiểm thử', labelEn: 'Testing' },
  { key: 'Security', labelVi: 'Bảo mật', labelEn: 'Security' },
];
