# Question generation specification

## Inputs

Generation consumes an approved interview blueprint: role, seniority, locale, duration, topic distribution, question types, difficulty curve, exclusions, and pinned taxonomy version. Candidate personal data is not required.

## Output schema

Each question includes a stable ID, locale, prompt, type, topic IDs, difficulty, estimated minutes, learning objective, expected concepts, follow-up policy, rubric reference, safety labels, provenance, and generator metadata.

## Quality constraints

- Match the requested role and seniority without assuming employer-specific knowledge.
- Avoid ambiguous trivia, leaked interview banks, copyrighted long-form content, discriminatory scenarios, and questions that require sensitive personal disclosure.
- Coding questions define inputs, outputs, constraints, examples, and evaluation boundaries.
- Behavioral questions evaluate answer structure and demonstrated reasoning, not personality.
- VI and EN versions are reviewed for semantic equivalence rather than literal translation.

## Pipeline

Retrieve only approved taxonomy/rubric context, render the versioned prompt, validate structured output, deduplicate semantically, run safety and difficulty checks, and persist a draft pack. AI-generated packs require reviewer approval before becoming reusable public content. A one-off practice session may use generated questions immediately only when all automatic gates pass and the content is labeled generated.
