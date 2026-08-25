import { useState } from 'react';
import { useBilling } from '../../hooks/useBilling';
import { useI18nStore } from '../../stores/i18n.store';
import { useAuthStore } from '../../stores/auth.store';
import { Button } from '../../components/ui/Button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Check, Sparkles, Zap, Shield, Rocket } from 'lucide-react';

export function PricingPage() {
  const { plans, isLoadingPlans, subscription, createCheckout, isCreatingCheckout } = useBilling();
  const { language } = useI18nStore();
  const { isAuthenticated } = useAuthStore();

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(null);

  const handleSelectPlan = async (planSlug: string) => {
    if (!isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return;
    }
    if (planSlug === 'free') return;
    setSelectedPlanSlug(planSlug);
    try {
      const response = await createCheckout({
        planSlug,
        billingCycle,
        successUrl: `${window.location.origin}/billing/success`,
        cancelUrl: `${window.location.origin}/pricing`,
      });

      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      }
    } catch (err) {
      console.error('Checkout failed', err);
    }
  };

  if (isLoadingPlans && (!plans || plans.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">
          {language === 'vi'
            ? 'Đang tải thông tin gói dịch vụ...'
            : 'Loading subscription tiers...'}
        </p>
      </div>
    );
  }

  const currentPlanSlug = subscription?.plan?.slug || 'free';

  return (
    <div className="max-w-7xl mx-auto space-y-12 py-6 px-4" data-testid="pricing-page">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <Badge variant="default" className="bg-emerald-50 text-emerald-800 border-emerald-200">
          <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-600" />
          <span>
            {language === 'vi'
              ? 'Lộ trình Luyện tập Linh hoạt cho Mọi Cấp độ'
              : 'Flexible Plans for Every Career Stage'}
          </span>
        </Badge>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
          {language === 'vi'
            ? 'Bảng Giá & Gói Tài Khoản Luyện Phỏng Vấn'
            : 'Accelerate Your Interview Mastery'}
        </h1>

        <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
          {language === 'vi'
            ? 'Luyện tập không giới hạn với AI Orchestrator, Live Coding Sandbox, Whiteboard System Design và Đánh giá khung STAR.'
            : 'Unlimited AI interview simulations, real-time code execution sandbox, whiteboard system design, and STAR framework assessment.'}
        </p>

        {/* Monthly / Yearly Toggle */}
        <div className="flex items-center justify-center pt-4">
          <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Monthly Billing</span>
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Annual Billing</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                Save ~17%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map(plan => {
          const isCurrent = isAuthenticated && currentPlanSlug === plan.slug;
          const isPopular = plan.slug === 'pro';
          const price =
            billingCycle === 'yearly' && plan.priceYearly > 0
              ? Math.round(plan.priceYearly / 12)
              : plan.priceMonthly;

          return (
            <Card
              key={plan.slug}
              className={`relative flex flex-col justify-between transition-all duration-200 rounded-2xl ${
                isPopular
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-xl'
                  : 'border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md'
              }`}
              data-testid={`pricing-card-${plan.slug}`}
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-emerald-600 text-white text-[11px] font-bold px-3.5 py-1 rounded-full shadow-md flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    <span>Most Popular</span>
                  </span>
                </div>
              )}

              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
                    {plan.slug === 'free' && <Zap className="w-5 h-5 text-slate-600" />}
                    {plan.slug === 'pro' && <Rocket className="w-5 h-5 text-emerald-600" />}
                    {plan.slug === 'team' && <Sparkles className="w-5 h-5 text-indigo-600" />}
                    {plan.slug === 'enterprise' && <Shield className="w-5 h-5 text-amber-600" />}
                  </div>

                  {isCurrent && (
                    <Badge variant="success" className="text-[10px]">
                      Current Plan
                    </Badge>
                  )}
                </div>

                <CardTitle className="text-xl font-bold text-slate-900">
                  {plan.nameVi || plan.name}
                </CardTitle>
                <CardDescription className="min-h-[36px]">{plan.description || ''}</CardDescription>

                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-extrabold text-slate-900">${price}</span>
                  <span className="text-xs font-semibold text-slate-500 ml-1.5">/ month</span>
                </div>
                {billingCycle === 'yearly' && plan.priceYearly > 0 && (
                  <span className="text-[11px] text-emerald-600 font-semibold block mt-1">
                    Billed annually (${plan.priceYearly}/yr)
                  </span>
                )}
              </CardHeader>

              <CardContent className="space-y-6 flex-1 flex flex-col justify-between pt-2">
                {/* Feature Bullets */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    What's included:
                  </span>
                  <ul className="space-y-2.5 text-xs text-slate-700">
                    <li className="flex items-start space-x-2">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>
                        <strong>{plan.limits.sessionsPerMonth}</strong> mock interview sessions /
                        month
                      </span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>
                        <strong>{plan.limits.voiceMinutesPerMonth}</strong> voice & audio streaming
                        minutes
                      </span>
                    </li>
                    {plan.limits.allowLiveCoding && (
                      <li className="flex items-start space-x-2">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>Live Coding execution sandbox</span>
                      </li>
                    )}
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Call to action button */}
                <Button
                  variant={isPopular ? 'primary' : 'outline'}
                  size="md"
                  onClick={() => handleSelectPlan(plan.slug)}
                  disabled={isCurrent || (isCreatingCheckout && selectedPlanSlug === plan.slug)}
                  isLoading={isCreatingCheckout && selectedPlanSlug === plan.slug}
                  className="w-full font-bold shadow-xs"
                  data-testid={`select-plan-${plan.slug}`}
                >
                  {isCurrent
                    ? 'Active Plan'
                    : plan.slug === 'free'
                      ? 'Free Forever'
                      : `Upgrade to ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default PricingPage;
