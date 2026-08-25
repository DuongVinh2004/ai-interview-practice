import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { SetupInterviewPage } from './features/setup/SetupInterviewPage';
import { InterviewRoomPage } from './features/interview/InterviewRoomPage';
import { HistoryPage } from './features/history/HistoryPage';
import { ResultDetailPage } from './features/history/ResultDetailPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { AdminUsersPage } from './features/admin/AdminUsersPage';
import { AdminAiRunsPage } from './features/admin/AdminAiRunsPage';
import { AdminPromptsPage } from './features/admin/AdminPromptsPage';
import { AdminAiEvalPage } from './features/admin/AdminAiEvalPage';
import { PublicSharedResultPage } from './features/share/PublicSharedResultPage';
import { PricingPage } from './features/billing/PricingPage';
import { BillingDashboardPage } from './features/billing/BillingDashboardPage';
import { CheckoutSuccessPage } from './features/billing/CheckoutSuccessPage';
import { FlashcardDecksPage } from './features/flashcards/FlashcardDecksPage';
import { FlashcardReviewPage } from './features/flashcards/FlashcardReviewPage';
import { SkillGraphPage } from './features/skills/SkillGraphPage';
import { ReadinessPage } from './features/readiness/ReadinessPage';
import { PublicPortfolioPage } from './features/portfolio/PublicPortfolioPage';
import { PortfolioSettingsPage } from './features/portfolio/PortfolioSettingsPage';
import { VerifyCertificatePage } from './features/portfolio/VerifyCertificatePage';
import { MentorBookingPage } from './features/mentor/MentorBookingPage';
import { MentorAvailabilityPage } from './features/mentor/MentorAvailabilityPage';
import { MentorLiveRoom } from './features/mentor/MentorLiveRoom';
import { TenantDashboardPage } from './features/b2b/TenantDashboardPage';
import { CohortListPage } from './features/b2b/CohortListPage';
import { CohortDetailPage } from './features/b2b/CohortDetailPage';
import { BadgesShowcasePage } from './features/gamification/BadgesShowcasePage';
import { LeaderboardPage } from './features/gamification/LeaderboardPage';
import { NotFoundPage } from './features/error/NotFoundPage';
import { ForbiddenPage } from './features/error/ForbiddenPage';
import { UserRole } from '@ai-interview/contracts';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
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
              <Route path="/gamification/badges" element={<BadgesShowcasePage />} />
              <Route path="/gamification/leaderboard" element={<LeaderboardPage />} />
              <Route path="/flashcards" element={<FlashcardDecksPage />} />
              <Route path="/flashcards/review" element={<FlashcardReviewPage />} />
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
            </Route>

            {/* 404 Not Found Catch-All */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
