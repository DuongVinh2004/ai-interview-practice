import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { UserRole } from '@ai-interview/contracts';
import { useAuthStore } from './stores/auth.store';

const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const RegisterPage = lazy(() => import('./features/auth/RegisterPage'));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const SetupInterviewPage = lazy(() => import('./features/setup/SetupInterviewPage'));
const InterviewRoomPage = lazy(() => import('./features/interview/InterviewRoomPage'));
const HistoryPage = lazy(() => import('./features/history/HistoryPage'));
const ResultDetailPage = lazy(() => import('./features/history/ResultDetailPage'));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage'));
const AdminAiEvalPage = lazy(() => import('./features/admin/AdminAiEvalPage'));
const PricingPage = lazy(() => import('./features/billing/PricingPage'));
const BillingDashboardPage = lazy(() => import('./features/billing/BillingDashboardPage'));
const BadgesShowcasePage = lazy(() => import('./features/gamification/BadgesShowcasePage'));
const LeaderboardPage = lazy(() => import('./features/gamification/LeaderboardPage'));
const NotFoundPage = lazy(() => import('./features/error/NotFoundPage'));
const ForbiddenPage = lazy(() => import('./features/error/ForbiddenPage'));
const PublicSharedResultPage = lazy(() =>
  import('./features/share/PublicSharedResultPage').then(module => ({
    default: module.PublicSharedResultPage,
  })),
);
const CheckoutSuccessPage = lazy(() =>
  import('./features/billing/CheckoutSuccessPage').then(module => ({
    default: module.CheckoutSuccessPage,
  })),
);
const FlashcardDecksPage = lazy(() =>
  import('./features/flashcards/FlashcardDecksPage').then(module => ({
    default: module.FlashcardDecksPage,
  })),
);
const FlashcardReviewPage = lazy(() =>
  import('./features/flashcards/FlashcardReviewPage').then(module => ({
    default: module.FlashcardReviewPage,
  })),
);
const SkillGraphPage = lazy(() =>
  import('./features/skills/SkillGraphPage').then(module => ({ default: module.SkillGraphPage })),
);
const ReadinessPage = lazy(() =>
  import('./features/readiness/ReadinessPage').then(module => ({ default: module.ReadinessPage })),
);
const PublicPortfolioPage = lazy(() =>
  import('./features/portfolio/PublicPortfolioPage').then(module => ({
    default: module.PublicPortfolioPage,
  })),
);
const PortfolioSettingsPage = lazy(() =>
  import('./features/portfolio/PortfolioSettingsPage').then(module => ({
    default: module.PortfolioSettingsPage,
  })),
);
const VerifyCertificatePage = lazy(() =>
  import('./features/portfolio/VerifyCertificatePage').then(module => ({
    default: module.VerifyCertificatePage,
  })),
);
const EngineeringArenaPage = lazy(() =>
  import('./features/engineering-arena/EngineeringArenaPage').then(module => ({
    default: module.EngineeringArenaPage,
  })),
);
const MentorBookingPage = lazy(() =>
  import('./features/mentor/MentorBookingPage').then(module => ({
    default: module.MentorBookingPage,
  })),
);
const MentorAvailabilityPage = lazy(() =>
  import('./features/mentor/MentorAvailabilityPage').then(module => ({
    default: module.MentorAvailabilityPage,
  })),
);
const MentorLiveRoom = lazy(() =>
  import('./features/mentor/MentorLiveRoom').then(module => ({ default: module.MentorLiveRoom })),
);
const TenantDashboardPage = lazy(() =>
  import('./features/b2b/TenantDashboardPage').then(module => ({
    default: module.TenantDashboardPage,
  })),
);
const CohortListPage = lazy(() =>
  import('./features/b2b/CohortListPage').then(module => ({ default: module.CohortListPage })),
);
const CohortDetailPage = lazy(() =>
  import('./features/b2b/CohortDetailPage').then(module => ({ default: module.CohortDetailPage })),
);
const QuestionBankLandingPage = lazy(() =>
  import('./features/question-bank/QuestionBankLandingPage').then(module => ({
    default: module.QuestionBankLandingPage,
  })),
);
const QuestionDetailPage = lazy(() =>
  import('./features/question-bank/QuestionDetailPage').then(module => ({
    default: module.QuestionDetailPage,
  })),
);
const BookmarkedQuestionsPage = lazy(() =>
  import('./features/question-bank/BookmarkedQuestionsPage').then(module => ({
    default: module.BookmarkedQuestionsPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import('./features/admin/AdminUsersPage').then(module => ({ default: module.AdminUsersPage })),
);
const AdminAiRunsPage = lazy(() =>
  import('./features/admin/AdminAiRunsPage').then(module => ({ default: module.AdminAiRunsPage })),
);
const AdminPromptsPage = lazy(() =>
  import('./features/admin/AdminPromptsPage').then(module => ({
    default: module.AdminPromptsPage,
  })),
);
const AdminQuestionBankPage = lazy(() =>
  import('./features/question-bank/AdminQuestionBankPage').then(module => ({
    default: module.AdminQuestionBankPage,
  })),
);

export function App() {
  const restoreSession = useAuthStore(state => state.restoreSession);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense
          fallback={
            <div role="status" aria-live="polite" className="p-6 text-center text-slate-600">
              Loading page…
            </div>
          }
        >
          <Routes>
            {/* Public Standalone Share & Verification Routes */}
            <Route path="/share/:token" element={<PublicSharedResultPage />} />
            <Route path="/u/:username" element={<PublicPortfolioPage />} />
            <Route path="/verify/:certId" element={<VerifyCertificatePage />} />

            <Route element={<AppLayout />}>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/question-bank" element={<QuestionBankLandingPage />} />
              <Route path="/question-bank/:slug" element={<QuestionDetailPage />} />
              <Route path="/403" element={<ForbiddenPage />} />

              {/* Protected Candidate Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/interviews/new" element={<SetupInterviewPage />} />
                <Route path="/interviews/:id" element={<InterviewRoomPage />} />
                <Route path="/interviews/:id/result" element={<ResultDetailPage />} />
                <Route path="/skills" element={<SkillGraphPage />} />
                <Route path="/skills/benchmark" element={<SkillGraphPage />} />
                <Route path="/skills/progress" element={<SkillGraphPage />} />
                <Route path="/readiness" element={<ReadinessPage />} />
                <Route path="/arena" element={<EngineeringArenaPage />} />
                <Route path="/gamification/badges" element={<BadgesShowcasePage />} />
                <Route path="/gamification/leaderboard" element={<LeaderboardPage />} />
                <Route path="/flashcards" element={<FlashcardDecksPage />} />
                <Route path="/flashcards/review" element={<FlashcardReviewPage />} />
                <Route path="/question-bank/bookmarks" element={<BookmarkedQuestionsPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/profile/portfolio-settings" element={<PortfolioSettingsPage />} />
                <Route path="/mentors" element={<MentorBookingPage />} />
                <Route path="/mentor/availability" element={<MentorAvailabilityPage />} />
                <Route path="/mentors/room/:sessionId" element={<MentorLiveRoom />} />
                <Route path="/b2b/dashboard" element={<TenantDashboardPage />} />
                <Route path="/b2b/cohorts" element={<CohortListPage />} />
                <Route path="/b2b/cohorts/:id" element={<CohortDetailPage />} />
                <Route path="/billing" element={<BillingDashboardPage />} />
                <Route path="/billing/success" element={<CheckoutSuccessPage />} />
              </Route>

              {/* Protected Admin Routes */}
              <Route element={<ProtectedRoute requiredRole={UserRole.ADMIN} />}>
                <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/ai-runs" element={<AdminAiRunsPage />} />
                <Route path="/admin/prompts" element={<AdminPromptsPage />} />
                <Route path="/admin/ai-eval" element={<AdminAiEvalPage />} />
                <Route path="/admin/question-bank" element={<AdminQuestionBankPage />} />
              </Route>

              {/* 404 Not Found Catch-All */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
