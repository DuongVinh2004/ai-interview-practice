-- Ensure learning-path completion state exists in databases created from migrations.
ALTER TABLE "learning_path_items"
    ADD COLUMN IF NOT EXISTS "is_completed" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "learning_path_items_learning_path_id_order_idx"
    ON "learning_path_items"("learning_path_id", "order");

-- Repair historical sessions that were completed using only NEEDS_REVIEW evaluations.
WITH authoritative_scores AS (
    SELECT t."session_id", AVG(e."score") AS score
    FROM "evaluations" e
    JOIN "answers" a ON a."id" = e."answer_id"
    JOIN "interview_turns" t ON t."id" = a."turn_id"
    WHERE e."authority_state" = 'AUTHORITATIVE'
    GROUP BY t."session_id"
),
fallback_scores AS (
    SELECT t."session_id", AVG(e."score") AS score
    FROM "evaluations" e
    JOIN "answers" a ON a."id" = e."answer_id"
    JOIN "interview_turns" t ON t."id" = a."turn_id"
    GROUP BY t."session_id"
),
effective_scores AS (
    SELECT f."session_id", COALESCE(a.score, f.score) AS score
    FROM fallback_scores f
    LEFT JOIN authoritative_scores a ON a."session_id" = f."session_id"
)
UPDATE "interview_sessions" s
SET "overall_score" = ROUND(e.score::numeric, 1)::double precision
FROM effective_scores e
WHERE s."id" = e."session_id"
  AND (s."overall_score" IS NULL OR s."overall_score" = 0);

-- Keep previously generated English learning-path summaries consistent with the repaired score.
UPDATE "learning_paths" lp
SET "summary" = regexp_replace(
    lp."summary",
    'overall performance score of [0-9]+(\.[0-9]+)?/10',
    'overall performance score of ' || to_char(s."overall_score", 'FM999990.0') || '/10',
    'i'
)
FROM "interview_sessions" s
WHERE lp."session_id" = s."id"
  AND lp."summary" ~* 'overall performance score of [0-9]+(\.[0-9]+)?/10'
  AND s."overall_score" IS NOT NULL;
