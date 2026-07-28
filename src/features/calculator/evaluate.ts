/**
 * Count calculator (client request, June 2026). The operator builds a small
 * expression that mirrors how stock is physically stacked — e.g.
 * `12×12×5+10` = "12 per case × 12 cases per layer × 5 layers, plus an open
 * case of 10" → 730 — and the evaluated total becomes the saved quantity.
 *
 * Only `+` and `×` are supported, with standard precedence (× binds tighter
 * than +). Integers only — no decimals, no parentheses. Kept pure so it can be
 * unit-tested in isolation.
 */

export const MULTIPLY = '×';
export const ADD = '+';

/** Largest sensible count — guards against runaway input. */
const MAX_TOTAL = 1_000_000;

/**
 * Evaluate an expression to a positive integer, or return null if it's empty or
 * malformed. Tolerates a trailing operator (mid-typing), e.g. `12×`.
 */
export function evaluateExpression(expression: string): number | null {
  if (!expression) return null;

  // Accept a lowercase/uppercase 'x' or '*' as multiply too, for safety.
  const normalised = expression.replace(/[x*]/gi, MULTIPLY);

  let sum = 0;
  let sawNumber = false;

  for (const term of normalised.split(ADD)) {
    let product = 1;
    let termHasNumber = false;

    for (const factor of term.split(MULTIPLY)) {
      const token = factor.trim();
      if (token === '') continue; // tolerate trailing/leading operators
      if (!/^\d+$/.test(token)) return null; // anything non-numeric is invalid
      product *= Number.parseInt(token, 10);
      termHasNumber = true;
    }

    if (termHasNumber) {
      sum += product;
      sawNumber = true;
    }
  }

  if (!sawNumber) return null;
  if (sum < 1 || sum > MAX_TOTAL) return null;
  return sum;
}
