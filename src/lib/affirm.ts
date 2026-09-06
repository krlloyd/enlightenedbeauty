export const AFFIRM_MIN_DEFAULT = 50;
export const AFFIRM_PLANS = [3, 6, 12] as const;

export function affirmMonthly(amount: number, months = 3) {
  if (amount <= 0 || months <= 0) return 0;
  return Math.ceil((amount / months) * 100) / 100;
}

export function affirmEligible(amount: number, enabled: boolean, min: number) {
  return enabled && amount >= min;
}
