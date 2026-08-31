const MACHINE_AUTHORITY_PROVIDERS = new Set(['gemini', 'openai', 'anthropic']);
const PERSISTED_AUTHORITY_PROVIDERS = new Set([...MACHINE_AUTHORITY_PROVIDERS, 'mentor-review']);

interface EvaluationProvenance {
  authorityState?: string | null;
  needsReview?: boolean | null;
  provider?: string | null;
  evidence?: unknown;
}

function hasEvidence(evidence: unknown): boolean {
  return (
    Array.isArray(evidence) &&
    evidence.some(item => typeof item === 'string' && item.trim().length > 0)
  );
}

export function hasAuthoritativeMachineProvenance(evaluation: EvaluationProvenance): boolean {
  const provider = evaluation.provider?.trim().toLowerCase();
  return (
    evaluation.needsReview === false &&
    Boolean(provider && MACHINE_AUTHORITY_PROVIDERS.has(provider)) &&
    hasEvidence(evaluation.evidence)
  );
}

export function isPersistedAuthoritativeEvaluation(
  evaluation: EvaluationProvenance | null | undefined,
): boolean {
  if (!evaluation) return false;
  const provider = evaluation.provider?.trim().toLowerCase();
  return (
    evaluation.authorityState === 'AUTHORITATIVE' &&
    evaluation.needsReview === false &&
    Boolean(provider && PERSISTED_AUTHORITY_PROVIDERS.has(provider)) &&
    hasEvidence(evaluation.evidence)
  );
}
