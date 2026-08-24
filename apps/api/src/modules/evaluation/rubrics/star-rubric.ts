import { StarRubricScores } from '@ai-interview/contracts';

export interface StarExtractedComponents {
  situationText?: string;
  taskText?: string;
  actionText?: string;
  resultText?: string;
  missingComponents: Array<'situation' | 'task' | 'action' | 'result'>;
}

export class StarRubric {
  /**
   * Evaluates text based on the 5-dimension STAR rubric:
   * - Situation (0-4)
   * - Task (0-4)
   * - Action (0-4)
   * - Result (0-4)
   * - Structure (0-2)
   * Total score normalized to 0.0 - 10.0 scale.
   */
  static evaluate(answerText: string): {
    scores: StarRubricScores;
    extracted: StarExtractedComponents;
    feedback: string;
    strengths: string[];
    improvements: string[];
  } {
    const text = answerText.trim();
    const lower = text.toLowerCase();

    // 1. Situation Analysis (Context, Team, Challenge)
    let situationScore = 1.0;
    const situationKeywords = ['project', 'team', 'company', 'when i was', 'at the time', 'dự án', 'công ty', 'khi tôi', 'thời điểm'];
    const hasSituation = situationKeywords.some(k => lower.includes(k)) || text.length > 50;
    if (hasSituation) {
      situationScore = text.length > 150 ? 3.5 : 2.5;
    }

    // 2. Task Analysis (Responsibility, Goals)
    let taskScore = 1.0;
    const taskKeywords = ['responsibility', 'goal', 'assigned to', 'objective', 'nhiệm vụ', 'mục tiêu', 'trách nhiệm', 'cần phải'];
    const hasTask = taskKeywords.some(k => lower.includes(k));
    if (hasTask) {
      taskScore = 3.5;
    } else if (text.length > 100) {
      taskScore = 2.5;
    }

    // 3. Action Analysis (Specific Technical & Leadership Actions Taken)
    let actionScore = 1.5;
    const actionKeywords = ['i implemented', 'i designed', 'i decided', 'i created', 'tôi đã', 'tôi triển khai', 'tôi xây dựng', 'tôi đề xuất'];
    const hasAction = actionKeywords.some(k => lower.includes(k));
    if (hasAction) {
      actionScore = 4.0;
    } else if (lower.includes('we') || lower.includes('chúng tôi')) {
      actionScore = 3.0; // Point out individual vs team contribution
    }

    // 4. Result Analysis (Quantifiable Outcomes, Metrics, Learnings)
    let resultScore = 1.0;
    const resultKeywords = ['%', 'percent', 'increased', 'reduced', 'improved', 'ms', 'tăng', 'giảm', 'cải thiện', 'kết quả', 'tiết kiệm'];
    const hasResult = resultKeywords.some(k => lower.includes(k));
    if (hasResult) {
      resultScore = 4.0;
    } else if (lower.includes('finally') || lower.includes('cuối cùng') || lower.includes('success')) {
      resultScore = 2.5;
    }

    // 5. Structure (STAR flow & conciseness)
    const structureScore = hasSituation && hasAction ? (hasResult ? 2.0 : 1.5) : 1.0;

    // Total normalization: max raw = 18 -> scaled to 10
    const rawTotal = situationScore + taskScore + actionScore + resultScore + structureScore;
    const totalScore = parseFloat(Math.min(10, Math.max(0, (rawTotal / 18) * 10)).toFixed(1));

    // Extract segments
    const missing: Array<'situation' | 'task' | 'action' | 'result'> = [];
    if (!hasSituation) missing.push('situation');
    if (!hasTask) missing.push('task');
    if (!hasAction) missing.push('action');
    if (!hasResult) missing.push('result');

    const strengths: string[] = [];
    const improvements: string[] = [];

    if (actionScore >= 3.5) strengths.push('Clear personal ownership and proactive execution steps described.');
    if (situationScore >= 3.0) strengths.push('Good contextual backdrop highlighting key problem constraints.');
    if (resultScore >= 3.5) strengths.push('Compelling quantifiable metrics demonstrating tangible business impact.');

    if (missing.includes('result')) {
      improvements.push('Quantify the final outcome with measurable business or technical metrics (e.g. latency reduced by X%, revenue boosted).');
    }
    if (!hasAction) {
      improvements.push('Focus more on your specific personal contributions rather than general team activities ("I did" vs "We did").');
    }
    if (missing.includes('task')) {
      improvements.push('Clarify the specific objective and your personal responsibility in the situation.');
    }

    if (strengths.length === 0) strengths.push('Articulated an authentic professional experience.');
    if (improvements.length === 0) improvements.push('Maintain high storytelling precision and concise delivery.');

    return {
      scores: {
        situationScore,
        taskScore,
        actionScore,
        resultScore,
        structureScore,
        totalScore,
      },
      extracted: {
        situationText: hasSituation ? text.slice(0, Math.min(200, Math.floor(text.length * 0.35))) : undefined,
        taskText: hasTask ? text.slice(Math.floor(text.length * 0.25), Math.floor(text.length * 0.5)) : undefined,
        actionText: hasAction ? text.slice(Math.floor(text.length * 0.45), Math.floor(text.length * 0.8)) : undefined,
        resultText: hasResult ? text.slice(Math.floor(text.length * 0.75)) : undefined,
        missingComponents: missing,
      },
      feedback: `Candidate demonstrated ${totalScore >= 7.5 ? 'strong' : 'moderate'} behavioral competence using the STAR methodology.`,
      strengths,
      improvements,
    };
  }
}
