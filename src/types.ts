export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  syllabus?: Record<string, number>;
  createdAt: string;
}

export interface StudyNote {
  id?: string;
  userId: string;
  title: string;
  content: string;
  summary?: string;
  examQuestions?: string[];
  type: 'lecture' | 'reading' | 'summary';
  createdAt: string;
}

export interface StudyPlan {
  id?: string;
  userId: string;
  date: string;
  schedule: { hour: string; task: string; type: string }[];
  motivation: string;
  createdAt: string;
}

export interface PerformanceAnalysis {
  id?: string;
  userId: string;
  analysis: string;
  readiness: number;
  createdAt: string;
}
