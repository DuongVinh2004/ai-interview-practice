export type PlanTierSlug = 'free' | 'pro' | 'team' | 'enterprise';

export interface PlanTierConfig {
  slug: PlanTierSlug;
  rank: number;
  nameVi: string;
  nameEn: string;
  badgeLabel: string;
}

export const PLAN_TIERS: Record<PlanTierSlug, PlanTierConfig> = {
  free: {
    slug: 'free',
    rank: 0,
    nameVi: 'Gói Miễn Phí (Free)',
    nameEn: 'Free Plan',
    badgeLabel: 'FREE',
  },
  pro: {
    slug: 'pro',
    rank: 1,
    nameVi: 'Gói Pro AI Mastery',
    nameEn: 'Pro AI Mastery',
    badgeLabel: 'PRO',
  },
  team: {
    slug: 'team',
    rank: 2,
    nameVi: 'Gói Team Đội Nhóm',
    nameEn: 'Team / B2B Plan',
    badgeLabel: 'TEAM',
  },
  enterprise: {
    slug: 'enterprise',
    rank: 3,
    nameVi: 'Gói Doanh Nghiệp (Enterprise)',
    nameEn: 'Enterprise Plan',
    badgeLabel: 'ENTERPRISE',
  },
};

export interface UpgradeSuggestion {
  targetPlanSlug: PlanTierSlug | '';
  buttonLabel: string;
  headerPillLabel: string;
  boxTitle: string;
  boxDescription: string;
  boxBadge: string;
  ctaText: string;
  hasHigherPlan: boolean;
  currentRank: number;
}

export function getNextUpgradePlan(
  currentPlanSlug?: string | null,
  isAdmin?: boolean,
  isVi: boolean = true,
): UpgradeSuggestion {
  if (isAdmin) {
    return {
      targetPlanSlug: '',
      buttonLabel: '',
      headerPillLabel: '',
      boxTitle: isVi ? 'Quyền Lợi Quản Trị Viên (Admin)' : 'Administrator Access',
      boxDescription: isVi
        ? 'Tài khoản của bạn có toàn quyền quản trị và không giới hạn mọi tính năng.'
        : 'Your account has full administrative privileges and unlimited access to all features.',
      boxBadge: 'ADMIN',
      ctaText: '',
      hasHigherPlan: false,
      currentRank: 99,
    };
  }

  const rawSlug = currentPlanSlug?.toLowerCase() || 'free';
  const slug: PlanTierSlug = rawSlug === 'b2b' ? 'team' : (rawSlug as PlanTierSlug);

  switch (slug) {
    case 'enterprise':
      return {
        targetPlanSlug: '',
        buttonLabel: '',
        headerPillLabel: '',
        boxTitle: isVi ? 'Gói Doanh Nghiệp (Enterprise)' : 'Enterprise Plan',
        boxDescription: isVi
          ? 'Bạn đang sở hữu gói dịch vụ cao cấp nhất với mọi tính năng và lượt phỏng vấn không giới hạn.'
          : 'You are currently on the highest tier with all features and unlimited mock sessions.',
        boxBadge: 'VIP',
        ctaText: '',
        hasHigherPlan: false,
        currentRank: 3,
      };

    case 'team':
      return {
        targetPlanSlug: 'enterprise',
        buttonLabel: isVi ? 'Nâng cấp Enterprise' : 'Upgrade Enterprise',
        headerPillLabel: isVi ? 'Nâng cấp Gói Enterprise' : 'Upgrade to Enterprise',
        boxTitle: isVi ? 'Gói Enterprise Tùy Chỉnh' : 'Enterprise Custom Plan',
        boxDescription: isVi
          ? 'Tùy biến bộ câu hỏi nội bộ, mô hình AI riêng biệt, SSO & hỗ trợ kỹ thuật 24/7.'
          : 'Dedicated AI models, custom question banks, enterprise SSO, and 24/7 priority support.',
        boxBadge: 'ENTERPRISE',
        ctaText: isVi ? 'Khám Phá Gói Enterprise' : 'Explore Enterprise',
        hasHigherPlan: true,
        currentRank: 2,
      };

    case 'pro':
      return {
        targetPlanSlug: 'team',
        buttonLabel: isVi ? 'Nâng cấp Team' : 'Upgrade Team',
        headerPillLabel: isVi ? 'Nâng cấp Gói Team' : 'Upgrade to Team',
        boxTitle: isVi ? 'Gói Team Đội Nhóm' : 'Team / B2B Plan',
        boxDescription: isVi
          ? 'Thêm thành viên luyện tập chung, gán bài tập phỏng vấn và quản trị tập trung.'
          : 'Add team members, assign practice tracks, and track aggregate competency analytics.',
        boxBadge: 'TEAM',
        ctaText: isVi ? 'Khám Phá Gói Team' : 'Explore Team Plan',
        hasHigherPlan: true,
        currentRank: 1,
      };

    case 'free':
    default:
      return {
        targetPlanSlug: 'pro',
        buttonLabel: isVi ? 'Nâng cấp Pro' : 'Upgrade Pro',
        headerPillLabel: isVi ? 'Nâng cấp Gói Pro' : 'Upgrade to Pro',
        boxTitle: isVi ? 'Gói Pro AI Mastery' : 'Pro AI Mastery',
        boxDescription: isVi
          ? '50+ lượt phỏng vấn, Mock Voice AI trực tiếp & phân tích khung STAR chi tiết.'
          : '50+ mock sessions, Voice AI streaming & in-depth STAR feedback.',
        boxBadge: 'PRO',
        ctaText: isVi ? 'Khám Phá Gói Pro' : 'Explore Pro Plan',
        hasHigherPlan: true,
        currentRank: 0,
      };
  }
}
