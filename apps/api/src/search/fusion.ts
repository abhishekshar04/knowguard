/**
 * Reciprocal Rank Fusion (Cormack et al., 2009): merges ranked lists without needing their
 * scores to be comparable (cosine distances vs. ts_rank). Each list contributes 1/(k + rank).
 */
export const RRF_K = 60;

export function reciprocalRankFusion(
  lists: ReadonlyArray<readonly string[]>,
  k = RRF_K,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, index) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1)));
  }
  return scores;
}

/** Normalises an RRF score to [0, 1]: 1 = ranked first in every list. */
export function normalizeRrf(score: number, lists: number, k = RRF_K): number {
  return Math.min(1, score / (lists / (k + 1)));
}
