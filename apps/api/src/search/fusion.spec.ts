import { normalizeRrf, reciprocalRankFusion } from './fusion';

describe('reciprocalRankFusion', () => {
  it('rewards items ranked well in several lists', () => {
    const scores = reciprocalRankFusion([
      ['a', 'b', 'c'],
      ['b', 'a', 'd'],
    ]);
    const order = [...scores].sort((x, y) => y[1] - x[1]).map(([id]) => id);
    expect(order.slice(0, 2).sort()).toEqual(['a', 'b']);
    expect(order.at(-1)).toMatch(/[cd]/);
  });

  it('keeps items that appear in only one list', () => {
    expect(reciprocalRankFusion([['only-vector'], ['only-keyword']]).size).toBe(2);
  });

  it('normalises first place in every list to 1', () => {
    const scores = reciprocalRankFusion([['a'], ['a']]);
    expect(normalizeRrf(scores.get('a')!, 2)).toBeCloseTo(1, 10);
    expect(normalizeRrf(reciprocalRankFusion([['a']]).get('a')!, 2)).toBeCloseTo(0.5, 10);
  });
});
