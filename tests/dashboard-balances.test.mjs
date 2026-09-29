import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateFreeAvailable,
  calculateGeneralAvailableBalance,
  calculateMonthlyBalance,
  calculateReservedMoney,
  getReserveBreakdown,
  isReserveBucket,
} from "../src/lib/dashboard-balances.ts";

function assertMoney(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 0.001,
    `Se esperaba ${expected}, se recibió ${actual}`,
  );
}

test("calcula el balance solo con ingresos y gastos registrados del mes", () => {
  assertMoney(calculateMonthlyBalance(21_244.62, 21_471.01), -226.39);
});

test("conserva el saldo acumulado anterior y suma el balance actual", () => {
  assertMoney(
    calculateGeneralAvailableBalance(2_959.42, -226.39),
    2_733.03,
  );
});

test("reconoce Ahorro y Operación del negocio aunque tengan acentos", () => {
  assert.equal(isReserveBucket("Ahorro"), true);
  assert.equal(isReserveBucket("Operación del negocio"), true);
  assert.equal(isReserveBucket("Gastos personales"), false);
});

test("suma únicamente saldos positivos de las reservas", () => {
  const buckets = [
    { id: "ahorro", name: "Ahorro", remainingAmount: 1_200 },
    {
      id: "operacion",
      name: "Operación del negocio",
      remainingAmount: -350,
    },
    { id: "personales", name: "Gastos personales", remainingAmount: 700 },
  ];

  assert.equal(calculateReservedMoney(buckets), 1_200);
  assert.deepEqual(
    getReserveBreakdown(buckets).map((bucket) => bucket.availableAmount),
    [1_200, 0],
  );
});

test("calcula el disponible libre sin tocar el saldo general", () => {
  assertMoney(calculateFreeAvailable(2_733.03, 1_500), 1_233.03);
  assertMoney(calculateFreeAvailable(900, 1_200), -300);
});
