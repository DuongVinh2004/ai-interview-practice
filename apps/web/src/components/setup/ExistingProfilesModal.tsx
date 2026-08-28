import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { FileText, CheckCircle2, User, Calendar, Briefcase, Plus } from 'lucide-react';

interface ExistingProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: any[];
  isLoading: boolean;
  onSelectProfile: (profile: any) => void;
  onUploadNew: () => void;
}

export const ExistingProfilesModal: React.FC<ExistingProfilesModalProps> = ({
  isOpen,
  onClose,
  profiles = [],
  isLoading,
  onSelectProfile,
  onUploadNew,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chọn Hồ Sơ / CV Đã Lưu Của Bạn"
      description="Chọn từ các CV và hồ sơ bạn đã từng tải lên để tái sử dụng ngay cho buổi phỏng vấn"
      maxWidth="lg"
    >
      <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="text-center py-10 text-xs text-slate-400">
            <div className="inline-block h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-2" />
            <p>Đang tải danh sách hồ sơ...</p>
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
            <div className="h-10 w-10 mx-auto rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Chưa có hồ sơ nào được lưu</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Hãy tải lên file CV hoặc nhập JD đầu tiên để hệ thống lưu hồ sơ cho bạn.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                onClose();
                onUploadNew();
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tải Lên CV Ngay</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {profiles.map((p: any) => {
              const skills: string[] = Array.isArray(p.skills) ? p.skills : [];
              const dateStr = p.createdAt
                ? new Date(p.createdAt).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                : '';

              return (
                <div
                  key={p.id}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs group"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
                        <Briefcase className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{p.targetRole || 'Software Engineer'}</span>
                      </div>
                      {p.seniorityLevel && (
                        <Badge
                          variant="default"
                          className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-700"
                        >
                          {p.seniorityLevel}
                        </Badge>
                      )}
                      {p.fullName && (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                          <User className="w-3 h-3 text-slate-400" />
                          {p.fullName}
                        </span>
                      )}
                    </div>

                    {skills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {skills.slice(0, 5).map((s, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-slate-50 text-slate-700 px-2 py-0.2 rounded border border-slate-200"
                          >
                            {s}
                          </span>
                        ))}
                        {skills.length > 5 && (
                          <span className="text-[10px] text-slate-400 self-center">
                            +{skills.length - 5}
                          </span>
                        )}
                      </div>
                    )}

                    {dateStr && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Tải lên ngày: {dateStr}</span>
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onSelectProfile(p);
                      onClose();
                    }}
                    className="text-xs h-8 px-3 border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-all shrink-0 w-full sm:w-auto"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    <span>Dùng hồ sơ này</span>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
