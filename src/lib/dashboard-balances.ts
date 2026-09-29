export type ReserveBucketBalance = {
  id: string;
  name: string;
  remainingAmount: number;
};

const RESERVED_BUCKET_NAMES = new Set(["ahorro", "operacion del negocio"]);

function normalizeBucketName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function calculateMonthlyBalance(
  monthlyIncome: number,
  monthlyExpense: number,
) {
  return monthlyIncome - monthlyExpense;
}

export function calculateGeneralAvailableBalance(
  carriedBalance: number,
  monthlyBalance: number,
) {
  return carriedBalance + monthlyBalance;
}

export function isReserveBucket(name: string) {
  return RESERVED_BUCKET_NAMES.has(normalizeBucketName(name));
}

export function getReserveBreakdown(buckets: ReserveBucketBalance[]) {
  return buckets.filter((bucket) => isReserveBucket(bucket.name)).map((bucket) => ({
    ...bucket,
    availableAmount: Math.max(Number(bucket.remainingAmount) || 0, 0),
  }));
}

export function calculateReservedMoney(buckets: ReserveBucketBalance[]) {
  return getReserveBreakdown(buckets).reduce(
    (sum, bucket) => sum + bucket.availableAmount,
    0,
  );
}

export function calculateFreeAvailable(
  generalAvailableBalance: number,
  reservedMoney: number,
) {
  return generalAvailableBalance - reservedMoney;
}
