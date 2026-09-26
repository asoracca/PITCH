import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRating } from '../backend/ratings.ts';

const player = (id, rating = 1000, games = 0) => ({ playerId: id, rating, games });

test('opponent strength, draws and placement status control point changes', () => {
  const a = player('a'), b = player('b');
  assert.equal(calculateRating(a, b, 'a').delta, 20);
  assert.equal(calculateRating(a, b, 'b').delta, -20);
  assert.equal(calculateRating(a, b, null).delta, 0);
  assert.equal(calculateRating(player('a', 1000, 5), b, 'a').delta, 12);
  const underdog = player('a', 800), favorite = player('b', 1200);
  assert.equal(calculateRating(underdog, favorite, 'a').delta, 36);
  assert.equal(calculateRating(favorite, underdog, 'b').delta, 4);
  assert.equal(calculateRating(underdog, favorite, null).delta, 16);
  assert.equal(calculateRating(favorite, underdog, null).delta, -16);
});

test('the minimum holds and exchanging contestants preserves equivalent outcomes', () => {
  assert.equal(calculateRating(player('a', 100), player('b', 100), 'b').after, 100);
  for (const aRating of [100, 700, 1000, 1300, 1800, 2500]) {
    for (const bRating of [100, 700, 1000, 1300, 1800, 2500]) {
      for (const games of [0, 4, 5, 100]) {
        const a = player('a', aRating, games), b = player('b', bRating, games);
        for (const winner of ['a', 'b', null]) {
          const first = calculateRating(a, b, winner), second = calculateRating(b, a, winner);
          assert.ok(first.after >= 100 && second.after >= 100);
          assert.ok(Math.abs(first.delta) <= first.k);
          if (first.after > 100 && second.after > 100) assert.equal(first.delta + second.delta, 0);
          assert.equal(first.gamesAfter, games + 1);
        }
      }
    }
  }
});
