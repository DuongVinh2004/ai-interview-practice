import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useI18nStore } from '../../stores/i18n.store';
import { Compass, Home, History } from 'lucide-react';

export function NotFoundPage() {
  const { language } = useI18nStore();

  return (
    <div className="min-h-[500px] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="h-16 w-16 rounded-3xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200 shadow-sm">
          <Compass className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 uppercase">
            Error 404
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {language === 'vi' ? 'Trang không tồn tại' : 'Page Not Found'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
            {language === 'vi'
              ? 'Đường dẫn bạn truy cập có thể đã thay đổi hoặc không còn tồn tại trên hệ thống.'
              : 'The page you requested might have been moved or is no longer available.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link to="/">
            <Button variant="primary" size="md" leftIcon={<Home className="h-4 w-4" />}>
              <span>{language === 'vi' ? 'Về Trang chủ' : 'Return Home'}</span>
            </Button>
          </Link>
          <Link to="/history">
            <Button variant="outline" size="md" leftIcon={<History className="h-4 w-4" />}>
              <span>{language === 'vi' ? 'Xem Lịch sử' : 'View History'}</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
