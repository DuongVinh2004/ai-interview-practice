import { StarRubric } from './star-rubric';

describe('StarRubric (F007)', () => {
  it('should evaluate a complete STAR structured response with high score', () => {
    const answer = `When I was at TechCorp, our production microservice was experiencing 500ms latency spikes during peak load.
My responsibility as the lead engineer was to optimize database throughput and reduce p99 latency.
I implemented connection pooling with PgBouncer, redesigned slow indexing on audit logs, and introduced Redis caching.
As a result, we reduced p99 query latency by 65% and successfully handled 3x traffic without any downtime.`;

    const evalResult = StarRubric.evaluate(answer);

    expect(evalResult.scores.situationScore).toBeGreaterThanOrEqual(3.0);
    expect(evalResult.scores.taskScore).toBeGreaterThanOrEqual(3.0);
    expect(evalResult.scores.actionScore).toBeGreaterThanOrEqual(3.5);
    expect(evalResult.scores.resultScore).toBeGreaterThanOrEqual(3.5);
    expect(evalResult.scores.totalScore).toBeGreaterThanOrEqual(8.0);
    expect(evalResult.extracted.missingComponents.length).toBe(0);
    expect(evalResult.strengths.length).toBeGreaterThan(0);
  });

  it('should identify missing Result component and recommend metric quantification', () => {
    const answer = `In my previous project, the deployment process was manual and error-prone.
I was tasked with setting up CI/CD automation.
I built GitHub Actions workflows with automated Docker container builds and staging tests.`;

    const evalResult = StarRubric.evaluate(answer);

    expect(evalResult.extracted.missingComponents).toContain('result');
    expect(
      evalResult.improvements.some(
        i => i.toLowerCase().includes('result') || i.toLowerCase().includes('metric'),
      ),
    ).toBe(true);
  });

  it('should identify missing personal Action contribution when only generic "we" statements are made', () => {
    const answer = `Our company was migrating to AWS. We had to move 20 databases within two weeks. We finished the migration successfully.`;

    const evalResult = StarRubric.evaluate(answer);

    expect(evalResult.scores.actionScore).toBeLessThan(4.0);
    expect(evalResult.extracted.missingComponents).toContain('action');
  });
});
