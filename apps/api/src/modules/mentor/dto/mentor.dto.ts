export class CreateMentorProfileDto {
  expertiseAreas!: string[];
  bio?: string;
  availabilities?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive?: boolean;
  }>;
}

export class SetAvailabilityDto {
  slots!: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive?: boolean;
  }>;
}

export class BookSessionDto {
  mentorId!: string;
  scheduledAt!: string;
}

export class MentorNotesDto {
  notes!: string;
}

export class ScoreOverrideDto {
  evaluationId!: string;
  newScore!: number;
  justification!: string;
}

export class CandidateRatingDto {
  rating!: number;
  feedback?: string;
}
