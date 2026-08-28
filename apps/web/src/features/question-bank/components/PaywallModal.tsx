import { useNavigate } from 'react-router-dom';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Sparkles, Check, Lock, Calendar, ArrowRight } from 'lucide-react';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  resetsAt?: string;
  planSlug?: string;
}

export function PaywallModal({ isOpen, onClose, resetsAt }: PaywallModalProps) {
  const navigate = useNavigate();

  const formattedResetDate = resetsAt
    ? new Date(resetsAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'đầu tháng sau';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mở rộng quyền truy cập Ngân hàng câu hỏi"
      maxWidth="md"
    >
      <div className="space-y-5">
        {/* Warning Hero Box */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300">
            <Lock className="h-5 w-5" />
          </div>
          <h4 className="text-base font-semibold text-amber-900 dark:text-amber-200">
            Bạn đã dùng hết 5/5 lượt mở đáp án miễn phí
          </h4>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Lượt xem miễn phí tiếp theo sẽ được làm mới vào ngày {formattedResetDate}.
          </p>
        </div>

        {/* Benefits Comparison */}
        <div>
          <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Quyền lợi khi nâng cấp gói Pro
          </h5>
          <ul className="mt-3 space-y-2.5">
            {[
              '50 lượt mở đáp án có kiểm duyệt mỗi tháng',
              'Xem đầy đủ tiêu chí chấm điểm (Rubric) chi tiết',
              'Nhận diện các lỗi thường gặp (Common Mistakes) trong phỏng vấn',
              'Bộ lọc chuyên sâu theo Role, Seniority, Tech Stack & Difficulty',
              'Không giới hạn lưu câu hỏi Bookmark & Luyện tập mock interview',
            ].map((benefit, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onClose();
              navigate('/pricing');
            }}
            className="flex items-center justify-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Xem các gói Pro
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Modal>
  );
}
