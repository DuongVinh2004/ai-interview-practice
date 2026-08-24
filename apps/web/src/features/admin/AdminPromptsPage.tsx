import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useI18nStore } from '../../stores/i18n.store';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { FileText, CheckCircle2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

export function AdminPromptsPage() {
  const { t } = useI18nStore();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: prompts, isLoading } = useQuery<any[]>({
    queryKey: ['admin-prompts'],
    queryFn: () => apiClient('/admin/ai/prompts'),
  });

  const handleActivate = async (versionId: string, slug: string, version: number) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setActivatingId(versionId);

    try {
      await apiClient(`/admin/ai/prompts/${versionId}/activate`, {
        method: 'POST',
      });
      setSuccessMessage(`Activated ${slug} v${version} successfully.`);
      queryClient.invalidateQueries({ queryKey: ['admin-prompts'] });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to activate prompt version.');
    } finally {
      setActivatingId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-purple-100 text-purple-700 p-2.5 rounded-xl">
          <FileText className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t.admin.promptsTitle}</h1>
          <p className="text-sm text-slate-500">{t.admin.promptsSubtitle}</p>
        </div>
      </div>

      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      {isLoading ? (
        <div className="py-16 text-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          {prompts?.map(p => {
            const isExpanded = expandedId === p.id;
            const isActivating = activatingId === p.id;

            return (
              <Card
                key={p.id}
                className={`transition-all ${p.isActive ? 'border-purple-300 ring-1 ring-purple-200' : 'border-slate-200'}`}
              >
                <CardHeader className="bg-slate-50/60 pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className={`h-4 w-4 ${p.isActive ? 'text-purple-600' : 'text-slate-400'}`} />
                      <span className="font-bold text-sm text-slate-900 font-mono">
                        {p.slug} <span className="text-xs text-purple-700 font-bold">v{p.version}</span>
                      </span>
                      {p.isActive && (
                        <Badge variant="info" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{t.admin.activeBadge}</span>
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!p.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActivate(p.id, p.slug, p.version)}
                          isLoading={isActivating}
                          className="text-xs gap-1 text-purple-700 hover:text-purple-800 hover:bg-purple-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{t.admin.activate}</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(p.id)}
                        className="text-slate-500"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      System Prompt
                    </span>
                    <p
                      className={`text-xs text-slate-800 font-mono bg-slate-50 p-3 rounded-lg border border-slate-200 whitespace-pre-wrap ${
                        !isExpanded ? 'line-clamp-2' : ''
                      }`}
                    >
                      {p.systemPrompt}
                    </p>
                  </div>

                  {isExpanded && p.userPromptTemplate && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        User Prompt Template
                      </span>
                      <p className="text-xs text-slate-800 font-mono bg-slate-50 p-3 rounded-lg border border-slate-200 whitespace-pre-wrap">
                        {p.userPromptTemplate}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>Created: {new Date(p.createdAt).toLocaleString()}</span>
                    <span>Schema: {p.schemaVersion || 'v1'}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
