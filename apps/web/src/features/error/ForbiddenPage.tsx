import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useI18nStore } from '../../stores/i18n.store';
import { ShieldAlert, Home, CreditCard } from 'lucide-react';

export function ForbiddenPage() {
  const { language } = useI18nStore();

  return (
    <div className="min-h-[500px] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="h-16 w-16 rounded-3xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200 shadow-sm">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 uppercase">
            Error 403
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {language === 'vi' ? 'Không có quyền truy cập' : 'Access Restricted'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
            {language === 'vi'
              ? 'Tài khoản của bạn chưa được phân quyền để truy cập tài nguyên hoặc khu vực quản trị này.'
              : 'Your current account does not have permission to view or manage this administrative resource.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link to="/">
            <Button variant="primary" size="md" leftIcon={<Home className="h-4 w-4" />}>
              <span>{language === 'vi' ? 'Về Trang chủ' : 'Return Home'}</span>
            </Button>
          </Link>
          <Link to="/pricing">
            <Button variant="outline" size="md" leftIcon={<CreditCard className="h-4 w-4" />}>
              <span>{language === 'vi' ? 'Xem Gói Nâng cấp' : 'View Plans'}</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForbiddenPage;
