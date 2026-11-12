import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Code, ShieldCheck, Play, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ValidatorStage {
  stage: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  message: string;
  durationMs: number;
}

interface ValidationReport {
  overallPass: boolean;
  totalStages: number;
  passedStages: number;
  failedStages: number;
  stages: ValidatorStage[];
}

interface CustomChallengeItem {
  id: string;
  slug: string;
  title: string;
  domain: string;
  category: string;
  difficulty: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
}

export const ChallengeAuthoringPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Form State
  const [slug, setSlug] = useState('acme-custom-challenge');
  const [title, setTitle] = useState('Fix SQL Injection in ACME Billing API');
  const [domain, setDomain] = useState('BACKEND');
  const [category, setCategory] = useState('SECURITY');
  const [difficulty, setDifficulty] = useState(3);
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [instructions, setInstructions] = useState(
    'Sanitize inputs in the repository to eliminate security vulnerabilities.',
  );

  // File Contents State
  const [activeTab, setActiveTab] = useState<'source' | 'visibleTest' | 'hiddenTest'>('source');
  const [sourceCode, setSourceCode] = useState(
    'export async function executeQuery(db: any, input: string) {\n  return db.query(input);\n}',
  );
  const [visibleTest, setVisibleTest] = useState(
    'import { executeQuery } from "./query";\ntest("basic execution", async () => {\n  expect(true).toBe(true);\n});',
  );
  const [hiddenTest, setHiddenTest] = useState(
    'import { executeQuery } from "./query";\ntest("rejects sql injection payload", async () => {\n  expect(true).toBe(true);\n});',
  );

  // Validation Report State
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // 1. Fetch Existing Custom Challenges
  const { data: challenges, isLoading: isLoadingChallenges } = useQuery<CustomChallengeItem[]>({
    queryKey: ['b2b-challenges'],
    queryFn: async () => {
      const res = await apiClient.get<CustomChallengeItem[]>('/b2b/challenges');
      return res.data;
    },
  });

  const buildPayload = () => ({
    manifest: {
      slug,
      title,
      schemaVersion: '1.0',
      domain,
      category,
      difficulty: Number(difficulty),
      estimatedMinutes: Number(estimatedMinutes),
      tags: ['enterprise', 'custom', category.toLowerCase()],
      instructionsMarkdown: instructions,
      workspaceTemplate: {
        allowedCommandIds: ['test'],
        readOnlyFiles: ['package.json'],
        hiddenFiles: ['test/hidden-exploit.spec.ts'],
      },
      commands: [
        {
          id: 'test',
          label: 'Run Tests',
          command: 'pnpm test',
          timeoutMs: 15000,
        },
      ],
      rubric: {
        version: '1.0',
        totalPoints: 100,
        criteria: [
          {
            id: 'crit-1',
            name: `${category} Verification`,
            maxPoints: 100,
            required: true,
            verificationType: 'TEST_CASE',
            targetRef: 'test/hidden-exploit.spec.ts',
          },
        ],
      },
    },
    visibleFilesContent: {
      'src/solution.ts': sourceCode,
      'test/visible.spec.ts': visibleTest,
    },
    hiddenFilesContent: {
      'test/hidden-exploit.spec.ts': hiddenTest,
    },
  });

  // 2. Validate Mutation
  const validateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ValidationReport>(
        '/b2b/challenges/validate',
        buildPayload(),
      );
      return res.data;
    },
    onSuccess: report => {
      setValidationReport(report);
      setActionMessage(
        report.overallPass
          ? `Validation Passed: ${report.passedStages}/${report.totalStages} Stages`
          : `Validation Failed: ${report.failedStages} Stages failed`,
      );
    },
  });

  // 3. Save Draft Mutation
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/b2b/challenges', buildPayload());
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b-challenges'] });
      setActionMessage('Challenge draft saved successfully!');
    },
  });

  // 4. Publish Mutation
  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/b2b/challenges/${id}/publish`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b-challenges'] });
      setActionMessage('Challenge published and activated successfully!');
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/b2b/dashboard"
            className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Tenant Dashboard
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            B2B Challenge Authoring Portal
          </h1>
          <p className="text-slate-600 mt-1">
            Author, validate, and publish custom coding benchmarks for your organization.
          </p>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center justify-between">
          <span>{actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs font-semibold text-emerald-600 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Manifest & Metadata Form */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center">
              <ShieldCheck className="w-5 h-5 mr-2 text-indigo-600" />
              Challenge Metadata
            </h2>

            <div>
              <label
                htmlFor="challenge-slug"
                className="block text-xs font-semibold text-slate-600 uppercase mb-1"
              >
                Challenge Slug
              </label>
              <Input
                id="challenge-slug"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder="e.g. acme-rate-limiter"
              />
            </div>

            <div>
              <label
                htmlFor="challenge-title"
                className="block text-xs font-semibold text-slate-600 uppercase mb-1"
              >
                Challenge Title
              </label>
              <Input
                id="challenge-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Fix SQL Injection in Billing API"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Domain
                </label>
                <select
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm border-slate-300 bg-white"
                >
                  <option value="BACKEND">Backend</option>
                  <option value="FRONTEND">Frontend</option>
                  <option value="FULLSTACK">Fullstack</option>
                  <option value="SYSTEM_DESIGN">System Design</option>
                  <option value="DEVOPS">DevOps</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm border-slate-300 bg-white"
                >
                  <option value="BUG_FIX">Bug Fix</option>
                  <option value="SECURITY">Security</option>
                  <option value="PERFORMANCE_OPTIMIZATION">Performance</option>
                  <option value="FEATURE_IMPLEMENTATION">Feature</option>
                  <option value="REFACTORING">Refactoring</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Difficulty (1-5)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={difficulty}
                  onChange={e => setDifficulty(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Duration (Mins)
                </label>
                <Input
                  type="number"
                  value={estimatedMinutes}
                  onChange={e => setEstimatedMinutes(Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                Instructions (Markdown)
              </label>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border rounded-md text-sm border-slate-300 font-mono text-xs"
              />
            </div>

            <div className="pt-4 flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => validateMutation.mutate()}
                disabled={validateMutation.isPending}
                className="w-full"
              >
                <Play className="w-4 h-4 mr-2" />
                {validateMutation.isPending ? 'Validating...' : 'Validate Challenge'}
              </Button>

              <Button
                onClick={() => saveDraftMutation.mutate()}
                disabled={saveDraftMutation.isPending}
                className="w-full"
              >
                {saveDraftMutation.isPending ? 'Saving...' : 'Save Challenge Draft'}
              </Button>
            </div>
          </Card>

          {/* Validation Report Card */}
          {validationReport && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">6-Stage Validation Report</h3>
                <Badge variant={validationReport.overallPass ? 'success' : 'danger'}>
                  {validationReport.overallPass ? 'PASS' : 'FAIL'}
                </Badge>
              </div>

              <div className="space-y-2">
                {validationReport.stages.map((stg, idx) => (
                  <div
                    key={idx}
                    className="p-2 border rounded text-xs flex items-center justify-between bg-slate-50"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">{stg.stage}</span>
                      <p className="text-slate-500 text-[10px]">{stg.message}</p>
                    </div>
                    <Badge variant={stg.status === 'PASS' ? 'success' : 'danger'}>
                      {stg.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Code Editor & Challenge Catalog */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center">
                <Code className="w-5 h-5 mr-2 text-indigo-600" />
                Challenge Workspace Files
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('source')}
                  className={`px-3 py-1 text-xs font-semibold rounded ${
                    activeTab === 'source'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  src/solution.ts
                </button>
                <button
                  onClick={() => setActiveTab('visibleTest')}
                  className={`px-3 py-1 text-xs font-semibold rounded ${
                    activeTab === 'visibleTest'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  test/visible.spec.ts
                </button>
                <button
                  onClick={() => setActiveTab('hiddenTest')}
                  className={`px-3 py-1 text-xs font-semibold rounded ${
                    activeTab === 'hiddenTest'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  test/hidden-exploit.spec.ts (Hidden)
                </button>
              </div>
            </div>

            {activeTab === 'source' && (
              <textarea
                value={sourceCode}
                onChange={e => setSourceCode(e.target.value)}
                rows={14}
                className="w-full p-4 border rounded-md font-mono text-xs bg-slate-900 text-slate-100"
              />
            )}

            {activeTab === 'visibleTest' && (
              <textarea
                value={visibleTest}
                onChange={e => setVisibleTest(e.target.value)}
                rows={14}
                className="w-full p-4 border rounded-md font-mono text-xs bg-slate-900 text-slate-100"
              />
            )}

            {activeTab === 'hiddenTest' && (
              <textarea
                value={hiddenTest}
                onChange={e => setHiddenTest(e.target.value)}
                rows={14}
                className="w-full p-4 border rounded-md font-mono text-xs bg-slate-900 text-slate-100"
              />
            )}
          </Card>

          {/* Existing Challenges Table */}
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Your Organization Challenges</h2>

            {isLoadingChallenges ? (
              <p className="text-sm text-slate-500">Loading custom challenges...</p>
            ) : !challenges || challenges.length === 0 ? (
              <p className="text-sm text-slate-500">No custom challenges created yet.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {challenges.map(item => (
                  <div key={item.id} className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                      <p className="text-xs text-slate-500">
                        {item.slug} • {item.domain} • Diff: {item.difficulty}/5
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={item.status === 'PUBLISHED' ? 'success' : 'default'}>
                        {item.status}
                      </Badge>
                      {item.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => publishMutation.mutate(item.id)}
                          disabled={publishMutation.isPending}
                        >
                          Publish
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
