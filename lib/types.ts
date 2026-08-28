export interface StudentMetric {
  studentId: number;
  name: string;
  dailyAccuracy: { day: string; accuracy: number }[];
  recentAccuracy: number;
  baselineAccuracy: number;
  flagged: boolean;
  readingLessOften: boolean;
  intervention: {
    bookId: number;
    bookTitle: string;
    note: string | null;
    createdAt: string;
  } | null;
}

export interface BookCandidate {
  bookId: number;
  title: string;
  topicTags: string[];
  readingLevel: number;
  distance: number;
}

export interface AgentAlert {
  studentId: number;
  alertText: string;
  recommendedBookId: number;
  recommendedBook: {
    title: string;
    readingLevel: number;
    topicTags: string[];
  } | null;
  reason: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type Proposal =
  | { type: 'intervention'; studentId: number; bookId: number; bookTitle: string | null; note: string }
  | { type: 'reassignment'; studentId: number; newBookId: number; bookTitle: string | null; reason: string }
  | { type: 'followup'; studentId: number; reason: string };

export interface WeeklyDigestInput {
  classTrend: { recentWeekAvg: number; priorWeekAvg: number };
  newlyFlagged: { name: string; recentAccuracy: number; baselineAccuracy: number }[];
  stillFlagged: { name: string; recentAccuracy: number; baselineAccuracy: number }[];
  recovered: { name: string; beforeAccuracy: number; afterAccuracy: number; bookTitle: string }[];
}

export interface BookEffectiveness {
  book_id: number;
  title: string;
  reading_level: number;
  topic_tags: string[];
  avg_first_week_accuracy: number;
  avg_recent_accuracy: number;
  recovery_delta: number;
}
