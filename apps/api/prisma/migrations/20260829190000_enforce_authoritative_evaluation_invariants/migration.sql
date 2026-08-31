-- Fail closed when historical rows cannot prove that they came from a real,
-- evidence-bearing provider execution. Operators must explicitly triage those
-- rows as NEEDS_REVIEW or repair their provenance before this gate can pass.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "evaluations"
    WHERE "authority_state" = 'AUTHORITATIVE'
      AND (
        "needs_review" = true
        OR "provider" IS NULL
        OR lower("provider") NOT IN ('gemini', 'openai', 'anthropic', 'mentor-review')
        OR jsonb_array_length(
          CASE WHEN jsonb_typeof("evidence") = 'array' THEN "evidence" ELSE '[]'::jsonb END
        ) = 0
      )
  ) THEN
    RAISE EXCEPTION 'authoritative evaluation provenance audit failed; triage historical evaluations before deployment';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "evaluation_runs"
    WHERE "authority_state" = 'AUTHORITATIVE'
      AND (
        "needs_review" = true
        OR "provider" IS NULL
        OR lower("provider") NOT IN ('gemini', 'openai', 'anthropic', 'mentor-review')
        OR jsonb_array_length(
          CASE WHEN jsonb_typeof("evidence") = 'array' THEN "evidence" ELSE '[]'::jsonb END
        ) = 0
      )
  ) THEN
    RAISE EXCEPTION 'authoritative evaluation-run provenance audit failed; triage historical runs before deployment';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "interview_sessions" s
    LEFT JOIN LATERAL (
      SELECT ROUND(AVG(e."score")::numeric, 1)::double precision AS authoritative_score
      FROM "interview_turns" t
      JOIN "answers" a ON a."turn_id" = t."id"
      JOIN "evaluations" e ON e."answer_id" = a."id"
      WHERE t."session_id" = s."id"
        AND e."authority_state" = 'AUTHORITATIVE'
        AND e."needs_review" = false
    ) scores ON true
    WHERE s."overall_score" IS DISTINCT FROM scores.authoritative_score
      AND s."overall_score" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'session score provenance audit failed; reconcile overall scores from authoritative evaluations before deployment';
  END IF;
END $$;

ALTER TABLE "evaluations"
  ADD CONSTRAINT "evaluations_authoritative_provenance_check"
  CHECK (
    "authority_state" <> 'AUTHORITATIVE'
    OR (
      "needs_review" = false
      AND "provider" IS NOT NULL
      AND lower("provider") IN ('gemini', 'openai', 'anthropic', 'mentor-review')
      AND jsonb_array_length(
        CASE WHEN jsonb_typeof("evidence") = 'array' THEN "evidence" ELSE '[]'::jsonb END
      ) > 0
    )
  ) NOT VALID;

ALTER TABLE "evaluations"
  VALIDATE CONSTRAINT "evaluations_authoritative_provenance_check";

ALTER TABLE "evaluation_runs"
  ADD CONSTRAINT "evaluation_runs_authoritative_provenance_check"
  CHECK (
    "authority_state" <> 'AUTHORITATIVE'
    OR (
      "needs_review" = false
      AND "provider" IS NOT NULL
      AND lower("provider") IN ('gemini', 'openai', 'anthropic', 'mentor-review')
      AND jsonb_array_length(
        CASE WHEN jsonb_typeof("evidence") = 'array' THEN "evidence" ELSE '[]'::jsonb END
      ) > 0
    )
  ) NOT VALID;

ALTER TABLE "evaluation_runs"
  VALIDATE CONSTRAINT "evaluation_runs_authoritative_provenance_check";
