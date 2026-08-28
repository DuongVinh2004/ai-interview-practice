import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SavedConfigurationsSection } from '../components/setup/SavedConfigurationsSection';
import { SessionMode } from '@ai-interview/contracts';
import * as apiClientModule from '../lib/api-client';

vi.mock('../lib/api-client', () => ({
  apiClient: vi.fn(),
}));

describe('SavedConfigurationsSection (F016)', () => {
  let queryClient: QueryClient;
  const mockOnApplyConfig = vi.fn();

  const mockPresets = [
    {
      id: 'preset-1',
      userId: 'user-1',
      name: 'Go Microservices Pro',
      description: 'Concurrency & distributed patterns',
      jobRoleId: 'role-be-id',
      seniorityLevelId: 'level-sr-id',
      technologyIds: ['tech-go-id', 'tech-k8s-id'],
      sessionMode: SessionMode.STANDARD,
      language: 'vi',
      totalTurns: 5,
      isSandbox: false,
      isPinned: true,
      useCount: 4,
      lastUsedAt: new Date().toISOString(),
      fingerprint: 'fp-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      jobRole: { id: 'role-be-id', name: 'Backend Engineer' },
      seniorityLevel: { id: 'level-sr-id', name: 'Senior' },
      technologies: [
        { id: 'tech-go-id', name: 'Go (Golang)' },
        { id: 'tech-k8s-id', name: 'Kubernetes (K8s)' },
      ],
      isCompatible: true,
    },
    {
      id: 'preset-2',
      userId: 'user-1',
      name: 'Deprecated Tech Stack',
      description: 'Has inactive taxonomy item',
      jobRoleId: 'role-old-id',
      seniorityLevelId: 'level-mid-id',
      technologyIds: ['tech-old-id'],
      sessionMode: SessionMode.STANDARD,
      language: 'vi',
      totalTurns: 5,
      isSandbox: false,
      isPinned: false,
      useCount: 1,
      lastUsedAt: null,
      fingerprint: 'fp-2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      jobRole: { id: 'role-old-id', name: 'Legacy Role' },
      seniorityLevel: { id: 'level-mid-id', name: 'Mid-Level' },
      technologies: [{ id: 'tech-old-id', name: 'Legacy Framework' }],
      isCompatible: false,
      incompatibilityReasons: ['Vị trí "Legacy Role" đã tạm ngưng'],
    },
  ];

  const mockRecent = [
    {
      id: 'recent-1',
      userId: 'user-1',
      fingerprint: 'fp-recent-1',
      jobRoleId: 'role-fe-id',
      seniorityLevelId: 'level-jr-id',
      technologyIds: ['tech-react-id', 'tech-ts-id'],
      sessionMode: SessionMode.CODING,
      language: 'en',
      totalTurns: 3,
      isSandbox: false,
      useCount: 2,
      lastUsedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      jobRole: { id: 'role-fe-id', name: 'Frontend Engineer' },
      seniorityLevel: { id: 'level-jr-id', name: 'Junior' },
      technologies: [
        { id: 'tech-react-id', name: 'React' },
        { id: 'tech-ts-id', name: 'TypeScript' },
      ],
      isCompatible: true,
    },
  ];

  const currentConfig = {
    jobRoleId: 'role-be-id',
    seniorityLevelId: 'level-sr-id',
    technologyIds: ['tech-go-id'],
    sessionMode: SessionMode.STANDARD,
    language: 'vi',
    totalTurns: 5,
    isSandbox: false,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();

    (apiClientModule.apiClient as any).mockImplementation((url: string) => {
      if (url === '/interview-configurations/presets') {
        return Promise.resolve(mockPresets);
      }
      if (url === '/interview-configurations/recent') {
        return Promise.resolve(mockRecent);
      }
      return Promise.resolve({});
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <SavedConfigurationsSection
          currentConfig={currentConfig}
          onApplyConfig={mockOnApplyConfig}
        />
      </QueryClientProvider>,
    );

  it('renders presets tab with saved items and displays pinned status', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Go Microservices Pro')).toBeInTheDocument();
      expect(screen.getByText('Deprecated Tech Stack')).toBeInTheDocument();
    });

    expect(screen.getByText('Kubernetes (K8s)')).toBeInTheDocument();
    expect(screen.getByText('Presets Đã Lưu')).toBeInTheDocument();
  });

  it('displays incompatibility warnings for presets with inactive taxonomy items', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Vị trí "Legacy Role" đã tạm ngưng')).toBeInTheDocument();
    });
  });

  it('calls onApplyConfig when clicking "Áp dụng" on a preset', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Go Microservices Pro')).toBeInTheDocument();
    });

    const applyButtons = screen.getAllByRole('button', { name: /Áp dụng/i });
    fireEvent.click(applyButtons[0]);

    expect(mockOnApplyConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        presetId: 'preset-1',
        jobRoleId: 'role-be-id',
        seniorityLevelId: 'level-sr-id',
        technologyIds: ['tech-go-id', 'tech-k8s-id'],
        source: 'PRESET',
        presetName: 'Go Microservices Pro',
      }),
    );
  });

  it('switches to Recent tab and allows applying recent configuration', async () => {
    renderComponent();

    const recentTab = screen.getByRole('tab', { name: /Gần Đây/i });
    fireEvent.click(recentTab);

    await waitFor(() => {
      expect(screen.getByText(/Junior Frontend Engineer/i)).toBeInTheDocument();
      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByText('Dùng 2x')).toBeInTheDocument();
    });

    const applyButtons = screen.getAllByRole('button', { name: /Áp dụng/i });
    fireEvent.click(applyButtons[0]);

    expect(mockOnApplyConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        jobRoleId: 'role-fe-id',
        seniorityLevelId: 'level-jr-id',
        technologyIds: ['tech-react-id', 'tech-ts-id'],
        source: 'RECENT',
      }),
    );
  });

  it('opens save modal when clicking "Lưu Cấu Hình Hiện Tại"', async () => {
    renderComponent();

    const saveButton = screen.getByRole('button', { name: /Lưu Cấu Hình Hiện Tại/i });
    fireEvent.click(saveButton);

    expect(screen.getByText('Lưu Cấu Hình Thành Preset')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ví dụ: Senior Go Backend/i)).toBeInTheDocument();
  });
});
