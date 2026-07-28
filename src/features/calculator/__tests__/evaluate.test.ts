/// <reference types="jest" />
import { evaluateExpression } from '../evaluate';

describe('evaluateExpression', () => {
  it("handles the client's worked examples", () => {
    expect(evaluateExpression('12×12×5+10')).toBe(730);
    expect(evaluateExpression('6+6+6+6+3')).toBe(27);
    expect(evaluateExpression('187')).toBe(187);
  });

  it('applies standard precedence (× before +)', () => {
    expect(evaluateExpression('10+12×12')).toBe(154); // 10 + 144, not 264
    expect(evaluateExpression('2×3+4×5')).toBe(26); // 6 + 20
  });

  it('accepts x or * as multiply', () => {
    expect(evaluateExpression('12x12x5+10')).toBe(730);
    expect(evaluateExpression('12*12*5+10')).toBe(730);
  });

  it('tolerates a trailing operator while typing', () => {
    expect(evaluateExpression('12×')).toBe(12);
    expect(evaluateExpression('6+6+')).toBe(12);
  });

  it('returns null for empty or malformed input', () => {
    expect(evaluateExpression('')).toBeNull();
    expect(evaluateExpression('+')).toBeNull();
    expect(evaluateExpression('12++')).toBe(12); // empty middle term ignored
    expect(evaluateExpression('12.5')).toBeNull(); // no decimals
    expect(evaluateExpression('abc')).toBeNull();
  });

  it('rejects non-positive totals', () => {
    expect(evaluateExpression('0')).toBeNull();
    expect(evaluateExpression('0+0')).toBeNull();
  });
});
