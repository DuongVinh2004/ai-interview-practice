import { MockVisionProvider } from '../providers/mock-vision.provider';

describe('MockVisionProvider (Module B5)', () => {
  let provider: MockVisionProvider;

  beforeEach(() => {
    provider = new MockVisionProvider();
  });

  it('evaluates diagram and returns detailed rubric, strengths, bottlenecks, and visual annotations', async () => {
    const result = await provider.evaluateDiagram({
      imageBase64: 'data:image/png;base64,mockImage',
      problemTitle: 'Design Distributed Cache',
      requirements: ['Sub-millisecond latency', 'High availability'],
      language: 'vi',
    });

    expect(result.overallScore).toBeGreaterThanOrEqual(7.0);
    expect(result.requirementsScore).toBeDefined();
    expect(result.detectedComponents.length).toBeGreaterThan(0);
    expect(result.strengths.length).toBeGreaterThan(0);
    expect(result.bottlenecks.length).toBeGreaterThan(0);
    expect(result.annotations.length).toBeGreaterThan(0);

    const firstAnnotation = result.annotations[0];
    expect(firstAnnotation.x).toBeDefined();
    expect(firstAnnotation.y).toBeDefined();
    expect(firstAnnotation.width).toBeDefined();
    expect(firstAnnotation.height).toBeDefined();
    expect(firstAnnotation.label).toBeDefined();
    expect(firstAnnotation.severity).toBeDefined();
  });
});
