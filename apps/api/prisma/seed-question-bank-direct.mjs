import { randomUUID } from 'node:crypto';
import { questionBankDrafts } from './question-bank-draft-data.ts';

const upgradeContent = process.argv.includes('--upgrade-content');

const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => literal(JSON.stringify(value));

function statement(question) {
  const questionId = randomUUID();
  const answerId = randomUUID();
  const technologies = question.technologies.map(literal).join(', ');
  const technologyArray = technologies ? `ARRAY[${technologies}]` : 'ARRAY[]::text[]';

  return `DO $$
DECLARE
  seeded_author_id UUID;
  seeded_question_id UUID;
  seeded_answer_id UUID;
BEGIN
  SELECT id INTO seeded_author_id
  FROM users
  WHERE role = 'ADMIN' AND status = 'ACTIVE'
  ORDER BY created_at
  LIMIT 1;

  IF seeded_author_id IS NULL THEN
    RAISE EXCEPTION 'An active admin is required to seed Question Bank content';
  END IF;

  SELECT id INTO seeded_question_id
  FROM question_bank_questions
  WHERE slug = ${literal(question.slug)};

  IF seeded_question_id IS NULL THEN
    INSERT INTO question_bank_questions (
      id, slug, title, question_body, question_type, difficulty, language,
      status, published_at, created_by_id, job_role_id, seniority_level_id,
      created_at, updated_at
    ) VALUES (
      ${literal(questionId)}::uuid,
      ${literal(question.slug)},
      ${literal(question.title)},
      ${literal(question.questionBody)},
      ${literal(question.questionType)},
      ${question.difficulty},
      'vi',
      'PUBLISHED'::"QuestionPublicationStatus",
      NOW(),
      seeded_author_id,
      (SELECT id FROM job_roles WHERE slug = ${literal(question.role)}),
      (SELECT id FROM seniority_levels WHERE slug = ${literal(question.seniority)}),
      NOW(), NOW()
    ) RETURNING id INTO seeded_question_id;
  END IF;

  SELECT id INTO seeded_answer_id
  FROM question_bank_answers
  WHERE question_id = seeded_question_id
  ORDER BY version DESC
  LIMIT 1;

  IF seeded_answer_id IS NULL THEN
    INSERT INTO question_bank_answers (
      id, question_id, version, authority, answer_body, explanation_body,
      rubric, common_mistakes, source_type, is_published, created_at, updated_at
    ) VALUES (
      ${literal(answerId)}::uuid,
      seeded_question_id,
      1,
      ${literal(question.authority)}::"QuestionAnswerAuthority",
      ${literal(question.answerBody)},
      ${literal(question.explanationBody)},
      ${json(question.rubric)}::jsonb,
      ${json(question.commonMistakes)}::jsonb,
      'seed-curated',
      true,
      NOW(), NOW()
    ) RETURNING id INTO seeded_answer_id;
  ELSIF ${upgradeContent ? 'TRUE' : 'FALSE'} THEN
    UPDATE question_bank_answers
    SET authority = ${literal(question.authority)}::"QuestionAnswerAuthority",
        answer_body = ${literal(question.answerBody)},
        explanation_body = ${literal(question.explanationBody)},
        rubric = ${json(question.rubric)}::jsonb,
        common_mistakes = ${json(question.commonMistakes)}::jsonb,
        source_type = 'seed-curated',
        is_published = true,
        updated_at = NOW()
    WHERE id = seeded_answer_id
      AND source_type = 'seed-curated';
  ELSE
    UPDATE question_bank_answers
    SET is_published = true
    WHERE id = seeded_answer_id;
  END IF;

  INSERT INTO question_bank_technologies (question_id, technology_id, created_at)
  SELECT seeded_question_id, id, NOW()
  FROM technologies
  WHERE slug = ANY(${technologyArray})
  ON CONFLICT (question_id, technology_id) DO NOTHING;

  UPDATE question_bank_questions
  SET status = 'PUBLISHED'::"QuestionPublicationStatus",
      current_answer_id = seeded_answer_id,
      published_at = COALESCE(published_at, NOW()),
      updated_at = NOW()
  WHERE id = seeded_question_id;
END $$;`;
}

process.stdout.write(`BEGIN;\n${questionBankDrafts.map(statement).join('\n')}\nCOMMIT;\n`);
