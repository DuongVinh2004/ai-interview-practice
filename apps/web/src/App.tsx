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
import { AdminUsersPage } from './features/admin/AdminUsersPage';
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
          <Route element={<AppLayout />}>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected Candidate Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/interviews/new" element={<SetupInterviewPage />} />
              <Route path="/interviews/:id" element={<InterviewRoomPage />} />
              <Route path="/interviews/:id/result" element={<ResultDetailPage />} />
              <Route path="/history" element={<HistoryPage />} />
            </Route>

            {/* Protected Admin Routes */}
            <Route element={<ProtectedRoute requiredRole={UserRole.ADMIN} />}>
              <Route path="/admin" element={<AdminUsersPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
