export function parseMoneyInput(value: string) {
  const normalizedValue = value.trim().replace(",", ".");
  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    return Number.NaN;
  }

  return Math.round(parsedValue * 100) / 100;
}
