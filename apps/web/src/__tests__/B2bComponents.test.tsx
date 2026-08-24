import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AssignmentManager } from '../features/b2b/components/AssignmentManager';
import { CohortListPage } from '../features/b2b/CohortListPage';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Track F011: B2B Multi-Tenant Frontend Components', () => {
  it('renders AssignmentManager with creation trigger button', () => {
    render(<AssignmentManager cohortId="cohort-123" />, { wrapper: createWrapper() });

    expect(screen.getByTestId('assignment-manager')).toBeInTheDocument();
    expect(screen.getByText('Cohort Interview Assignments')).toBeInTheDocument();
    expect(screen.getByTestId('create-assignment-btn')).toBeInTheDocument();
  });

  it('renders CohortListPage with search and new cohort action', () => {
    render(<CohortListPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('cohort-list-page')).toBeInTheDocument();
    expect(screen.getByText(/Training Cohorts & Student Batches/i)).toBeInTheDocument();
    expect(screen.getByTestId('cohort-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('new-cohort-btn')).toBeInTheDocument();
  });
});
