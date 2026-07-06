export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: "Remote" | "Hybrid" | "In-Person";
  salary: string;
  posted: string;
  description: string;
  url: string;
  source: string;
}

export interface CVAnalytics {
  metadata: {
    name: string;
    contact: string;
  };
  skills: string[];
  certificates: string[];
  projects: {
    title: string;
    description: string;
  }[];
}

export interface JobMatch extends Job {
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  analysisSummary: string;
}

export interface TailorResult {
  tailoredResume: string; // Markdown text
  keyChanges: string[]; // List of specific improvements made
  skillGapFilled: string[]; // List of skills integrated
  interviewTips: string[]; // Custom tips for this job
}

export interface MockQuestion {
  id: number;
  question: string;
  rationale: string;
  idealOutline: string[];
}

export interface InterviewEvaluation {
  score: number;
  strengths: string[];
  gaps: string[];
  feedbackText: string;
  improvedAnswerExample: string;
}
