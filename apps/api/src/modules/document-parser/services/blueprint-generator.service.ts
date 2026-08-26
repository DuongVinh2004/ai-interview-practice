import { Injectable, Logger } from '@nestjs/common';
import {
  ParsedProfileDto,
  JdAnalysisDto,
  InterviewBlueprintDto,
  BlueprintTopic,
} from '@ai-interview/contracts';

@Injectable()
export class BlueprintGeneratorService {
  private readonly logger = new Logger(BlueprintGeneratorService.name);

  /**
   * Generates gap analysis and tailored interview blueprint matching candidate profile against JD requirements.
   */
  generateBlueprint(
    profileId: string,
    jdId: string,
    profile: ParsedProfileDto,
    jd: JdAnalysisDto,
    targetRole?: string,
    targetLevel?: string,
  ): InterviewBlueprintDto {
    const candidateSkills = new Set((profile.skills || []).map(s => s.toLowerCase()));
    const jdRequired = jd.requiredSkills || [];
    const jdPreferred = jd.preferredSkills || [];
    const allJdSkills = [...jdRequired, ...jdPreferred];

    const matchedSkills: string[] = [];
    const gapSkills: string[] = [];

    // Find matched vs gap skills
    for (const skill of jdRequired) {
      if (candidateSkills.has(skill.toLowerCase())) {
        matchedSkills.push(skill);
      } else {
        gapSkills.push(skill);
      }
    }

    for (const skill of jdPreferred) {
      if (candidateSkills.has(skill.toLowerCase()) && !matchedSkills.includes(skill)) {
        matchedSkills.push(skill);
      }
    }

    // Calculate match percentage
    const denominator = Math.max(1, jdRequired.length);
    const matchPercentage = Math.min(100, Math.round((matchedSkills.length / denominator) * 100));

    // Formulate tailored topics
    const topics: BlueprintTopic[] = [];

    // 1. First topic: Gap Skills & Advanced Core
    const gapFocusList =
      gapSkills.length > 0 ? gapSkills.slice(0, 3) : ['High-throughput design', 'Resilience'];
    topics.push({
      topic: `Remediation & Deep Dive: ${gapFocusList.join(', ')}`,
      weight: 40,
      reason: `Address required competencies from JD not explicitly evidenced in candidate resume.`,
      sampleQuestions: gapFocusList.map(
        gap =>
          `The JD requires extensive hands-on experience with ${gap}. Can you walk us through how you would architect a production subsystem using ${gap}?`,
      ),
      cvReference: profile.experience?.[0]?.company
        ? `Comparison against ${profile.experience[0].company} tech stack`
        : 'General JD requirement',
    });

    // 2. Second topic: CV Project Verification & Scaling
    const topProject = profile.experience?.[0]?.projects?.[0] || {
      name: 'Core Services Platform',
      technologies: matchedSkills.slice(0, 3),
      description: 'Distributed microservices backend',
    };
    const matchedFocus = matchedSkills.slice(0, 3).join(', ') || 'System Design & APIs';

    topics.push({
      topic: `Project Deep Dive: ${topProject.name} (${matchedFocus})`,
      weight: 40,
      reason: `Validate claimed engineering depth and real-world trade-off decision making on resume project.`,
      sampleQuestions: [
        `In your work on "${topProject.name}", how did you handle data consistency and failure recovery under peak load?`,
        `Given the JD's focus on scalability, how would you redesign "${topProject.name}" to support 10x higher traffic volume?`,
      ],
      cvReference: `Project: ${topProject.name} at ${profile.experience?.[0]?.company || 'Prior Organization'}`,
    });

    // 3. Third topic: Architecture, Reliability & System Fit
    topics.push({
      topic: `Architectural Decisions & Operational Excellence`,
      weight: 20,
      reason: `Evaluate candidate alignment with ${jd.companyContext ? 'target company context' : 'production engineering standards'}.`,
      sampleQuestions: [
        `How do you establish automated monitoring, alerting, and SLA tracking for business-critical APIs?`,
        `Describe a challenging cross-service debugging incident you resolved and the preventative safeguards you introduced.`,
      ],
      cvReference: 'Role alignment and technical leadership',
    });

    // Generate actionable recommendations
    const recommendations: string[] = [];
    if (gapSkills.length > 0) {
      recommendations.push(
        `Review core principles and practical deployment scenarios for: ${gapSkills.join(', ')}.`,
      );
    }
    recommendations.push(
      `Prepare concrete metrics and architecture diagrams for project "${topProject.name}".`,
      `Be ready to discuss distributed caching, database indexing, and fault isolation in depth.`,
    );

    return {
      parsedProfileId: profileId,
      jdAnalysisId: jdId,
      matchedSkills,
      gapSkills,
      matchPercentage,
      topics,
      recommendations,
      targetRole: targetRole || jd.roleTitle || profile.targetRole || 'Software Engineer',
      targetLevel: targetLevel || jd.seniorityLevel || profile.seniorityLevel || 'SENIOR',
    };
  }
}
