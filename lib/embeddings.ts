// Fixed vocabulary used by BOTH students and books so their vectors are comparable.
// seed-books.ts and any student-embedding call must import this same list — if the
// two ever drift apart, cosineDistance silently compares vectors of different meaning.
export const TOPIC_VOCAB = [
  'dinosaurs', 'space', 'sports', 'animals',
  'fantasy', 'mystery', 'friendship', 'science',
];

export function tagsToVector(tags: string[]): number[] {
  return TOPIC_VOCAB.map((topic) => (tags.includes(topic) ? 1 : 0));
}

export function studentToEmbedding(interests: string[]): number[] {
  return tagsToVector(interests);
}
