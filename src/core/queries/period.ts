const DATE_LITERAL = /^[A-Z][A-Z0-9_]*(?::\d+)?$/;

export function assertDateLiteral(value: string): string {
  if (!DATE_LITERAL.test(value)) {
    throw new Error(`Invalid SOQL date literal: ${value}`);
  }
  return value;
}

export function assertDays(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 365) {
    throw new Error('days must be an integer between 1 and 365');
  }
  return value;
}
