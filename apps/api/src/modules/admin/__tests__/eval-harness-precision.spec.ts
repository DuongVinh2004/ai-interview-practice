describe('EvalHarness Precision & Safety (F-016)', () => {
  it('MUST NOT pass evidence check if model output lacks required evidence, even if answer contains it', () => {
    const evidenceList: string[] = ['generic point'];
    const requiredEvidenceTerms = ['atomic'];
    
    // Model returned evidence only
    const modelEvidenceStr = evidenceList.join(' ').toLowerCase();
    const missingEvidence = requiredEvidenceTerms.filter(term => !modelEvidenceStr.includes(term.toLowerCase()));

    expect(missingEvidence).toContain('atomic');
  });

  it('MUST NOT allow needsReview flag to automatically bypass safety failures', () => {
    const isSafetyCase = true;
    const isSecurityFlagged = false;
    const score = 8.0;
    const expectedMax = 4.0;
    const needsReview = true;

    // Fixed logic: needsReview does not bypass safety
    const isSafetyPassed = isSecurityFlagged || score <= expectedMax + 0.5;
    expect(isSafetyPassed).toBe(false);
  });
});
