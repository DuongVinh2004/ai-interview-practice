import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  InterviewConfigurationPresetDto,
  RecentInterviewConfigurationDto,
  SessionMode,
  CompetencyArea,
} from '@ai-interview/contracts';
import { apiClient } from '../../lib/api-client';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import {
  Bookmark,
  Pin,
  Clock,
  Trash2,
  Edit2,
  AlertTriangle,
  Plus,
  ArrowRight,
  History,
  ShieldAlert,
} from 'lucide-react';

interface SavedConfigurationsSectionProps {
  currentConfig: {
    jobRoleId: string;
    seniorityLevelId: string;
    technologyIds: string[];
    sessionMode: SessionMode;
    competencyArea?: CompetencyArea;
    language: string;
    totalTurns: number;
    isSandbox: boolean;
    blueprintId?: string;
  };
  onApplyConfig: (config: {
    jobRoleId: string;
    seniorityLevelId: string;
    technologyIds: string[];
    sessionMode: SessionMode;
    competencyArea?: CompetencyArea;
    language: string;
    totalTurns: number;
    isSandbox: boolean;
    blueprintId?: string;
    presetId?: string;
    source: 'PRESET' | 'RECENT';
    presetName?: string;
  }) => void;
  onSelectPreset?: (preset: InterviewConfigurationPresetDto) => void;
}

export const SavedConfigurationsSection: React.FC<SavedConfigurationsSectionProps> = ({
  currentConfig,
  onApplyConfig,
  onSelectPreset,
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'presets' | 'recent'>('presets');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [presetToSaveConfig, setPresetToSaveConfig] = useState<any>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [presetToEdit, setPresetToEdit] = useState<InterviewConfigurationPresetDto | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<InterviewConfigurationPresetDto | null>(
    null,
  );

  // Form states for Create / Edit Modal
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [presetIsPinned, setPresetIsPinned] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: rawPresets, isLoading: loadingPresets } = useQuery<
    InterviewConfigurationPresetDto[]
  >({
    queryKey: ['interview-configurations', 'presets'],
    queryFn: () => apiClient('/interview-configurations/presets'),
  });

  const { data: rawRecent, isLoading: loadingRecent } = useQuery<RecentInterviewConfigurationDto[]>(
    {
      queryKey: ['interview-configurations', 'recent'],
      queryFn: () => apiClient('/interview-configurations/recent'),
    },
  );

  const presets = Array.isArray(rawPresets) ? rawPresets : [];
  const recentConfigs = Array.isArray(rawRecent) ? rawRecent : [];

  // Mutations
  const createPresetMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string;
      isPinned?: boolean;
      config: any;
    }) =>
      apiClient('/interview-configurations/presets', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interview-configurations', 'presets'] });
      setSaveModalOpen(false);
      setPresetName('');
      setPresetDescription('');
      setPresetIsPinned(false);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Không thể lưu preset. Vui lòng kiểm tra lại.');
    },
  });

  const updatePresetMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      apiClient(`/interview-configurations/presets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interview-configurations', 'presets'] });
      setEditModalOpen(false);
      setPresetToEdit(null);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Không thể cập nhật preset.');
    },
  });

  const deletePresetMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/interview-configurations/presets/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interview-configurations', 'presets'] });
      setDeleteModalOpen(false);
      setPresetToDelete(null);
    },
  });

  const togglePin = (preset: InterviewConfigurationPresetDto, e: React.MouseEvent) => {
    e.stopPropagation();
    updatePresetMutation.mutate({
      id: preset.id,
      payload: { isPinned: !preset.isPinned },
    });
  };

  const handleOpenSaveCurrent = () => {
    setPresetToSaveConfig(currentConfig);
    setPresetName('');
    setPresetDescription('');
    setPresetIsPinned(false);
    setFormError(null);
    setSaveModalOpen(true);
  };

  const handleOpenSaveRecent = (recent: RecentInterviewConfigurationDto, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresetToSaveConfig({
      jobRoleId: recent.jobRoleId,
      seniorityLevelId: recent.seniorityLevelId,
      technologyIds: recent.technologyIds,
      sessionMode: recent.sessionMode,
      competencyArea: recent.competencyArea,
      language: recent.language,
      totalTurns: recent.totalTurns,
      isSandbox: recent.isSandbox,
      blueprintId: recent.blueprintId,
    });
    setPresetName(
      `${recent.seniorityLevel?.name || ''} ${recent.jobRole?.name || 'Phỏng vấn'}`.trim(),
    );
    setPresetDescription('');
    setPresetIsPinned(false);
    setFormError(null);
    setSaveModalOpen(true);
  };

  const handleOpenEdit = (preset: InterviewConfigurationPresetDto, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresetToEdit(preset);
    setPresetName(preset.name);
    setPresetDescription(preset.description || '');
    setPresetIsPinned(preset.isPinned);
    setFormError(null);
    setEditModalOpen(true);
  };

  const handleOpenDelete = (preset: InterviewConfigurationPresetDto, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresetToDelete(preset);
    setDeleteModalOpen(true);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) {
      setFormError('Vui lòng nhập tên preset.');
      return;
    }
    if (
      !presetToSaveConfig?.jobRoleId ||
      !presetToSaveConfig?.seniorityLevelId ||
      !presetToSaveConfig?.technologyIds?.length
    ) {
      setFormError('Vui lòng chọn Vị trí, Cấp bậc và ít nhất 1 Công nghệ trước khi lưu preset.');
      return;
    }
    createPresetMutation.mutate({
      name: presetName.trim(),
      description: presetDescription.trim() || undefined,
      isPinned: presetIsPinned,
      config: presetToSaveConfig,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetToEdit) return;
    if (!presetName.trim()) {
      setFormError('Vui lòng nhập tên preset.');
      return;
    }
    updatePresetMutation.mutate({
      id: presetToEdit.id,
      payload: {
        name: presetName.trim(),
        description: presetDescription.trim() || undefined,
        isPinned: presetIsPinned,
      },
    });
  };

  const formatRelativeTime = (isoString?: string | null) => {
    if (!isoString) return 'Chưa dùng';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };

  const isCurrentConfigValid =
    !!currentConfig.jobRoleId &&
    !!currentConfig.seniorityLevelId &&
    (currentConfig.technologyIds?.length || 0) > 0;

  return (
    <div
      className="rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/40 via-white to-white p-4 sm:p-5 shadow-sm dark:border-emerald-950/40 dark:from-emerald-950/10 dark:via-neutral-900 dark:to-neutral-900 flex flex-col justify-between h-full"
      aria-label="Khu vực Dùng lại cấu hình"
    >
      <div>
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex-shrink-0">
              <Bookmark className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/80 px-2 py-0.2 rounded-full">
                  Bước 2
                </span>
                <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Cấu Hình Đã Lưu (Presets)
                </h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
                Điền nhanh thiết lập phỏng vấn đã lưu hoặc tái sử dụng gần đây
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenSaveCurrent}
            disabled={!isCurrentConfigValid}
            title={
              !isCurrentConfigValid
                ? 'Hãy chọn vị trí, cấp bậc và công nghệ trước khi lưu'
                : 'Lưu cấu hình hiện tại thành Preset'
            }
            className="text-xs h-7 px-2.5 gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/50 flex-shrink-0"
          >
            <Plus className="h-3 w-3" />
            <span>Lưu Cấu Hình Hiện Tại</span>
          </Button>
        </div>

        {/* Tabs */}
        <div
          className="flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-2.5 mb-3"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'presets'}
            onClick={() => setActiveTab('presets')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all ${
              activeTab === 'presets'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
            }`}
          >
            <Pin className="h-3 w-3" />
            <span>Presets Đã Lưu</span>
            <span
              className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === 'presets'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
              }`}
            >
              {presets.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'recent'}
            onClick={() => setActiveTab('recent')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all ${
              activeTab === 'recent'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
            }`}
          >
            <History className="h-3 w-3" />
            <span>Gần Đây (Recent)</span>
            <span
              className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === 'recent'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
              }`}
            >
              {recentConfigs.length}
            </span>
          </button>
        </div>

        {/* Content */}
        {activeTab === 'presets' && (
          <div>
            {loadingPresets ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[1, 2].map(i => (
                  <div
                    key={i}
                    className="h-28 rounded-xl border border-neutral-100 bg-neutral-50/50 p-3 animate-pulse dark:border-neutral-800 dark:bg-neutral-900"
                  />
                ))}
              </div>
            ) : presets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-5 px-3 text-center rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800">
                <Bookmark className="h-6 w-6 text-neutral-400 mb-1.5 opacity-60" />
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Chưa có Preset cấu hình nào được lưu
                </p>
                <p className="text-[11px] text-neutral-500 max-w-xs mt-0.5">
                  Sau khi chọn vị trí & công nghệ, bấm "Lưu Cấu Hình" để dùng lại bất cứ lúc nào.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                {presets.map(preset => {
                  const isCompatible = preset.isCompatible !== false;
                  return (
                    <div
                      key={preset.id}
                      className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 ${
                        preset.isPinned
                          ? 'border-amber-200/80 bg-amber-50/20 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/10'
                          : 'border-neutral-200/80 bg-white hover:border-emerald-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-emerald-800'
                      }`}
                    >
                      <div>
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {preset.isPinned && (
                              <Pin
                                className="h-3.5 w-3.5 flex-shrink-0 text-amber-500 fill-amber-500"
                                aria-label="Ghim"
                              />
                            )}
                            <h4
                              className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate"
                              title={preset.name}
                            >
                              {preset.name}
                            </h4>
                          </div>

                          {/* Top quick actions */}
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={e => togglePin(preset, e)}
                              className={`p-1 rounded-md transition-colors ${
                                preset.isPinned
                                  ? 'text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-950'
                                  : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                              }`}
                              title={preset.isPinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                              aria-label={preset.isPinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                            >
                              <Pin className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={e => handleOpenEdit(preset, e)}
                              className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                              title="Đổi tên / Sửa mô tả"
                              aria-label="Đổi tên"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={e => handleOpenDelete(preset, e)}
                              className="p-1 rounded-md text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                              title="Xóa preset"
                              aria-label="Xóa preset"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        {preset.description && (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mb-2">
                            {preset.description}
                          </p>
                        )}

                        {/* Role & Level Pill */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                          <span className="inline-flex items-center text-xs font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md dark:bg-emerald-950/60 dark:text-emerald-300">
                            {preset.jobRole?.name || 'Vị trí'}
                          </span>
                          <span className="inline-flex items-center text-xs text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md dark:bg-neutral-800 dark:text-neutral-300">
                            {preset.seniorityLevel?.name || 'Cấp bậc'}
                          </span>
                          {preset.sessionMode && preset.sessionMode !== SessionMode.STANDARD && (
                            <span className="inline-flex items-center text-[11px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded dark:bg-purple-950 dark:text-purple-300">
                              {preset.sessionMode}
                            </span>
                          )}
                        </div>

                        {/* Tech Chips */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {(preset.technologies || []).map(tech => (
                            <span
                              key={tech.id}
                              className="text-[11px] bg-neutral-50 border border-neutral-200/60 text-neutral-700 px-1.5 py-0.5 rounded dark:bg-neutral-800/80 dark:border-neutral-700 dark:text-neutral-300"
                            >
                              {tech.name}
                            </span>
                          ))}
                        </div>

                        {/* Incompatibility Warning */}
                        {!isCompatible && (
                          <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-800 text-[11px] mb-3 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                            <span>
                              {preset.incompatibilityReasons?.join('; ') ||
                                'Cấu hình cần cập nhật lại taxonomy'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Footer / Apply Action */}
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800/60 mt-1">
                        <span
                          className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-neutral-500"
                          title={`Dùng ${preset.useCount} lần`}
                        >
                          <Clock className="h-3 w-3" />
                          <span>{formatRelativeTime(preset.lastUsedAt)}</span>
                        </span>

                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            if (onSelectPreset) {
                              onSelectPreset(preset);
                            } else {
                              onApplyConfig({
                                jobRoleId: preset.jobRoleId,
                                seniorityLevelId: preset.seniorityLevelId,
                                technologyIds: preset.technologyIds,
                                sessionMode: preset.sessionMode,
                                competencyArea: preset.competencyArea || undefined,
                                language: preset.language,
                                totalTurns: preset.totalTurns,
                                isSandbox: preset.isSandbox,
                                blueprintId: preset.blueprintId || undefined,
                                presetId: preset.id,
                                source: 'PRESET',
                                presetName: preset.name,
                              });
                            }
                          }}
                          className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        >
                          <span>Áp dụng</span>
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'recent' && (
          <div>
            {loadingRecent ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[1, 2].map(i => (
                  <div
                    key={i}
                    className="h-28 rounded-xl border border-neutral-100 bg-neutral-50/50 p-3 animate-pulse dark:border-neutral-800 dark:bg-neutral-900"
                  />
                ))}
              </div>
            ) : recentConfigs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-5 px-3 text-center rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800">
                <History className="h-6 w-6 text-neutral-400 mb-1.5 opacity-60" />
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Chưa có cấu hình phỏng vấn gần đây
                </p>
                <p className="text-[11px] text-neutral-500 max-w-xs mt-0.5">
                  Khi bắt đầu phỏng vấn, cấu hình sẽ tự động được lưu lại tại đây.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                {recentConfigs.map(recent => {
                  const title = `${recent.seniorityLevel?.name || ''} ${recent.jobRole?.name || 'Phỏng vấn'}`;
                  return (
                    <div
                      key={recent.id}
                      className="flex flex-col justify-between rounded-xl border border-neutral-200/80 bg-white p-4 transition-all duration-200 hover:border-emerald-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-emerald-800"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4
                            className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate"
                            title={title}
                          >
                            {title}
                          </h4>
                          <span className="inline-flex items-center text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded dark:bg-emerald-950 dark:text-emerald-300">
                            Dùng {recent.useCount}x
                          </span>
                        </div>

                        {/* Tech Chips */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {(recent.technologies || []).map(tech => (
                            <span
                              key={tech.id}
                              className="text-[11px] bg-neutral-50 border border-neutral-200/60 text-neutral-700 px-1.5 py-0.5 rounded dark:bg-neutral-800/80 dark:border-neutral-700 dark:text-neutral-300"
                            >
                              {tech.name}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-neutral-500 mb-2">
                          <span>{recent.totalTurns} câu hỏi</span>
                          <span>•</span>
                          <span>{recent.language === 'en' ? 'English' : 'Tiếng Việt'}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800/60 mt-1">
                        <button
                          type="button"
                          onClick={e => handleOpenSaveRecent(recent, e)}
                          className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-emerald-600 dark:text-neutral-400 dark:hover:text-emerald-400"
                          title="Lưu cấu hình này thành Preset"
                        >
                          <Bookmark className="h-3.5 w-3.5" />
                          <span>Lưu preset</span>
                        </button>

                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          onClick={() =>
                            onApplyConfig({
                              jobRoleId: recent.jobRoleId,
                              seniorityLevelId: recent.seniorityLevelId,
                              technologyIds: recent.technologyIds,
                              sessionMode: recent.sessionMode,
                              competencyArea: recent.competencyArea || undefined,
                              language: recent.language,
                              totalTurns: recent.totalTurns,
                              isSandbox: recent.isSandbox,
                              blueprintId: recent.blueprintId || undefined,
                              source: 'RECENT',
                            })
                          }
                          className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        >
                          <span>Áp dụng</span>
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save Preset Modal */}
      <Modal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Lưu Cấu Hình Thành Preset"
      >
        <form onSubmit={handleSaveSubmit} className="space-y-4 pt-1">
          <p className="text-xs text-neutral-500">
            Đặt tên cho cấu hình này để dễ dàng tải lại và luyện tập trong các buổi phỏng vấn sau.
          </p>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Tên Preset <span className="text-rose-500">*</span>
            </label>
            <Input
              type="text"
              required
              maxLength={100}
              placeholder="ví dụ: Senior Go Backend & Concurrency"
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Mô tả ngắn (tùy chọn)
            </label>
            <Input
              type="text"
              maxLength={255}
              placeholder="ví dụ: Chuyên sâu goroutines, channels và distributed locks"
              value={presetDescription}
              onChange={e => setPresetDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="pin-checkbox"
              checked={presetIsPinned}
              onChange={e => setPresetIsPinned(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label
              htmlFor="pin-checkbox"
              className="text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
            >
              Ghim lên đầu danh sách Presets
            </label>
          </div>

          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSaveModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createPresetMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {createPresetMutation.isPending ? 'Đang lưu...' : 'Lưu Preset'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Preset Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Chỉnh Sửa Preset Cấu Hình"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Tên Preset <span className="text-rose-500">*</span>
            </label>
            <Input
              type="text"
              required
              maxLength={100}
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Mô tả ngắn
            </label>
            <Input
              type="text"
              maxLength={255}
              value={presetDescription}
              onChange={e => setPresetDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="edit-pin-checkbox"
              checked={presetIsPinned}
              onChange={e => setPresetIsPinned(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label
              htmlFor="edit-pin-checkbox"
              className="text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
            >
              Ghim lên đầu danh sách Presets
            </label>
          </div>

          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={updatePresetMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {updatePresetMutation.isPending ? 'Đang lưu...' : 'Lưu Thay Đổi'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Xác Nhận Xóa Preset"
      >
        <div className="space-y-4 pt-1">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Bạn có chắc chắn muốn xóa preset{' '}
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              "{presetToDelete?.name}"
            </span>{' '}
            không?
          </p>
          <p className="text-xs text-neutral-500">
            Thao tác này sẽ xóa preset khỏi danh sách của bạn nhưng <strong>không ảnh hưởng</strong>{' '}
            đến các session phỏng vấn đã hoàn thành trong lịch sử.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={deletePresetMutation.isPending}
              onClick={() => presetToDelete && deletePresetMutation.mutate(presetToDelete.id)}
            >
              {deletePresetMutation.isPending ? 'Đang xóa...' : 'Xóa Preset'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
