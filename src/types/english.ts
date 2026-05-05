export type Lesson = {
  id: string;
  title: string;
  createdAt: string;
};

export type Word = {
  id: string;
  lessonId: string;
  english: string;
  translation: string | null;
  transcription: string | null;
  exampleEn: string | null;
  distractors: string[] | null;
  srsBox: number;
  nextReviewAt: string | null;
  createdAt: string;
};
