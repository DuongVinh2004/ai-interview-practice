import { Outlet, Link } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Bot, Shield, CheckCircle2 } from 'lucide-react';
import { useI18nStore } from '../../stores/i18n.store';

export function AppLayout() {
  const { t } = useI18nStore();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fade-in">
        <Outlet />
      </main>
      <footer className="bg-white border-t border-slate-200 py-8 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold text-slate-700">
            <div className="bg-emerald-600 text-white p-1 rounded-md">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <span>{t.nav.brand}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400 font-normal">
              Production-Grade Mock Technical Interviews
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 text-[11px] font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>AI System Healthy</span>
            </div>
            <Link to="/pricing" className="hover:text-slate-800 transition-colors">
              {t.nav.pricing}
            </Link>
            <div className="flex items-center gap-1 hover:text-slate-800 transition-colors">
              <Shield className="h-3.5 w-3.5 text-slate-400" />
              <span>GDPR / 2FA</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
