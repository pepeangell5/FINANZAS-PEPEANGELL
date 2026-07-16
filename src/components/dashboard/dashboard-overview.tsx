"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CircleAlert,
  CircleDollarSign,
  ClockAlert,
  PiggyBank,
  Trophy,
  Wallet,
} from "lucide-react";
import { BrandedSectionHeading } from "@/components/app/branded-section-heading";
import {
  formatCurrency,
  formatDate,
  formatDateInput,
  getTodayDateInput,
} from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import { normalizeSpanishLabel } from "@/lib/text/spanish-labels";

type AllocationBucket = {
  id: string;
  name: string;
  percentage: number;
  color: string;
  sort_order: number;
};

type Income = {
  amount: number;
  income_date: string;
};

type Category = {
  id: string;
  allocation_bucket_id: string | null;
  color: string;
  name: string;
};

type Expense = {
  amount: number;
  category_id: string | null;
  expense_date: string;
};

type FixedExpense = {
  amount: number;
  concept: string;
  due_date: string;
  id: string;
  status: "pending" | "paid";
};

function getCurrentMonthRange() {
  const now = new Date();
  const start = formatDateInput(
    new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const end = formatDateInput(
    new Date(now.getFullYear(), now.getMonth() + 1, 0),
  );

  return { start, end };
}

function getDayDifference(dueDate: string, today: string) {
  const due = new Date(`${dueDate}T00:00:00`).getTime();
  const current = new Date(`${today}T00:00:00`).getTime();

  return Math.round((due - current) / 86_400_000);
}

function getPendingPaymentLabel(days: number) {
  if (days < 0) {
    const count = Math.abs(days);

    return `-${count} ${count === 1 ? "día" : "días"}`;
  }

  if (days === 0) {
    return "Vence hoy";
  }

  return `Faltan ${days} ${days === 1 ? "día" : "días"}`;
}

export function DashboardOverview() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [buckets, setBuckets] = useState<AllocationBucket[]>([]);
  const [pendingPayments, setPendingPayments] = useState<FixedExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const monthlyIncome = useMemo(
    () => incomes.reduce((sum, income) => sum + Number(income.amount), 0),
    [incomes],
  );

  const monthlyExpense = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.amount), 0),
    [expenses],
  );

  const balance = monthlyIncome - monthlyExpense;
  const today = getTodayDateInput();

  const categoryBucketById = useMemo(() => {
    return new Map(
      categories.map((category) => [
        category.id,
        category.allocation_bucket_id,
      ]),
    );
  }, [categories]);

  const categoryById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category]));
  }, [categories]);

  const spentByBucketId = useMemo(() => {
    const totals = new Map<string, number>();

    for (const expense of expenses) {
      if (!expense.category_id) {
        continue;
      }

      const bucketId = categoryBucketById.get(expense.category_id);

      if (!bucketId) {
        continue;
      }

      totals.set(bucketId, (totals.get(bucketId) ?? 0) + expense.amount);
    }

    return totals;
  }, [categoryBucketById, expenses]);

  const bucketSummaries = useMemo(() => {
    return buckets.map((item) => {
      const allocatedAmount = monthlyIncome * (item.percentage / 100);
      const spentAmount = spentByBucketId.get(item.id) ?? 0;
      const remainingAmount = allocatedAmount - spentAmount;
      const spentPercentage = allocatedAmount
        ? Math.min((spentAmount / allocatedAmount) * 100, 100)
        : spentAmount > 0
          ? 100
          : 0;

      return {
        ...item,
        allocatedAmount,
        isOverBudget: remainingAmount < 0,
        remainingAmount,
        spentAmount,
        spentPercentage,
      };
    });
  }, [buckets, monthlyIncome, spentByBucketId]);

  const bestExpenseCategory = useMemo(() => {
    const totals = new Map<
      string,
      { color: string; count: number; name: string; total: number }
    >();

    for (const expense of expenses) {
      const category = expense.category_id
        ? (categoryById.get(expense.category_id) ?? null)
        : null;
      const key = category?.id ?? "sin-categoria";
      const current = totals.get(key) ?? {
        color: category?.color ?? "#6b7280",
        count: 0,
        name: category?.name ?? "Sin categoría",
        total: 0,
      };

      current.count += 1;
      current.total += expense.amount;
      totals.set(key, current);
    }

    return [...totals.values()].sort((a, b) => b.total - a.total)[0] ?? null;
  }, [categoryById, expenses]);

  const topIncomeDay = useMemo(() => {
    const totals = new Map<
      string,
      { count: number; incomeDate: string; total: number }
    >();

    for (const income of incomes) {
      const current = totals.get(income.income_date) ?? {
        count: 0,
        incomeDate: income.income_date,
        total: 0,
      };

      current.count += 1;
      current.total += income.amount;
      totals.set(income.income_date, current);
    }

    return [...totals.values()].sort((a, b) => b.total - a.total)[0] ?? null;
  }, [incomes]);

  const availableTotal = useMemo(() => {
    return bucketSummaries.reduce((sum, item) => {
      if (item.remainingAmount <= 0) {
        return sum;
      }

      return sum + item.remainingAmount;
    }, 0);
  }, [bucketSummaries]);

  const overBudgetBuckets = useMemo(() => {
    return bucketSummaries.filter((item) => item.isOverBudget);
  }, [bucketSummaries]);

  const mostAvailableBucket = useMemo(() => {
    return (
      [...bucketSummaries]
        .filter((item) => item.remainingAmount > 0)
        .sort((a, b) => b.remainingAmount - a.remainingAmount)[0] ?? null
    );
  }, [bucketSummaries]);

  const pendingPaymentTotal = useMemo(() => {
    return pendingPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
  }, [pendingPayments]);

  const currentMonthKey = today.slice(0, 7);
  const currentMonthName = new Intl.DateTimeFormat("es-MX", {
    month: "long",
  }).format(new Date(`${currentMonthKey}-01T00:00:00`));
  const currentMonthPendingPayments = useMemo(() => {
    return pendingPayments.filter((payment) =>
      payment.due_date.startsWith(currentMonthKey),
    );
  }, [currentMonthKey, pendingPayments]);
  const currentMonthPendingTotal = useMemo(() => {
    return currentMonthPendingPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
  }, [currentMonthPendingPayments]);

  const pendingPaymentSummary = useMemo(() => {
    return pendingPayments.reduce(
      (result, payment) => {
        const days = getDayDifference(payment.due_date, today);

        if (days < 0) {
          result.overdue += 1;
        } else if (days <= 3) {
          result.upcoming += 1;
        }

        return result;
      },
      { overdue: 0, upcoming: 0 },
    );
  }, [pendingPayments, today]);

  const dashboardAlerts = useMemo(() => {
    const alerts: Array<{
      description: string;
      href?: string;
      title: string;
      tone: "danger" | "success" | "warning";
    }> = [];

    if (pendingPaymentSummary.overdue > 0) {
      alerts.push({
        description: `${pendingPaymentSummary.overdue} pago${
          pendingPaymentSummary.overdue === 1 ? "" : "s"
        } vencido${pendingPaymentSummary.overdue === 1 ? "" : "s"} por revisar.`,
        href: "/pendientes",
        title: "Pagos vencidos",
        tone: "danger",
      });
    } else if (pendingPaymentSummary.upcoming > 0) {
      alerts.push({
        description: `${pendingPaymentSummary.upcoming} pago${
          pendingPaymentSummary.upcoming === 1 ? "" : "s"
        } cerca${pendingPaymentSummary.upcoming === 1 ? "" : "s"} de vencer.`,
        href: "/pendientes",
        title: "Pagos próximos",
        tone: "warning",
      });
    }

    for (const bucket of overBudgetBuckets.slice(0, 2)) {
      alerts.push({
        description: `Excedido por ${formatCurrency(
          Math.abs(bucket.remainingAmount),
        )}.`,
        href: "/gastos",
        title: `Te pasaste en ${normalizeSpanishLabel(bucket.name)}`,
        tone: "danger",
      });
    }

    if (balance < 0) {
      alerts.push({
        description: `Los gastos superan los ingresos por ${formatCurrency(
          Math.abs(balance),
        )}.`,
        href: "/gastos",
        title: "Balance negativo",
        tone: "danger",
      });
    } else if (mostAvailableBucket) {
      alerts.push({
        description: `Aún quedan ${formatCurrency(
          mostAvailableBucket.remainingAmount,
        )} disponibles.`,
        href: "/gastos",
        title: `Margen en ${normalizeSpanishLabel(mostAvailableBucket.name)}`,
        tone: "success",
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        description: "No hay pagos vencidos ni bolsas excedidas este mes.",
        title: "Todo en orden",
        tone: "success",
      });
    }

    return alerts.slice(0, 4);
  }, [
    balance,
    mostAvailableBucket,
    overBudgetBuckets,
    pendingPaymentSummary.overdue,
    pendingPaymentSummary.upcoming,
  ]);

  useEffect(() => {
    async function loadDashboard() {
      const { start, end } = getCurrentMonthRange();

      const [
        incomesResult,
        expensesResult,
        categoriesResult,
        bucketsResult,
        pendingPaymentsResult,
      ] = await Promise.all([
        supabase
          .from("incomes")
          .select("amount, income_date")
          .gte("income_date", start)
          .lte("income_date", end),
        supabase
          .from("expenses")
          .select("amount, expense_date, category_id")
          .gte("expense_date", start)
          .lte("expense_date", end),
        supabase
          .from("categories")
          .select("id, allocation_bucket_id, name, color"),
        supabase
          .from("allocation_buckets")
          .select("id, name, percentage, color, sort_order")
          .order("sort_order", { ascending: true }),
        supabase
          .from("fixed_expenses")
          .select("id, concept, amount, due_date, status")
          .eq("status", "pending")
          .order("due_date", { ascending: true }),
      ]);

      if (!incomesResult.error) {
        setIncomes(
          (incomesResult.data ?? []).map((income) => ({
            ...income,
            amount: Number(income.amount),
          })),
        );
      }

      if (!expensesResult.error) {
        setExpenses(
          (expensesResult.data ?? []).map((expense) => ({
            ...expense,
            amount: Number(expense.amount),
          })),
        );
      }

      if (!categoriesResult.error) {
        setCategories((categoriesResult.data ?? []) as Category[]);
      }

      if (!bucketsResult.error) {
        setBuckets(
          (bucketsResult.data ?? []).map((bucket) => ({
            ...bucket,
            percentage: Number(bucket.percentage),
          })),
        );
      }

      if (!pendingPaymentsResult.error) {
        setPendingPayments(
          ((pendingPaymentsResult.data ?? []) as FixedExpense[]).map(
            (payment) => ({
              ...payment,
              amount: Number(payment.amount),
            }),
          ),
        );
      }

      setIsLoading(false);
    }

    loadDashboard();
  }, []);

  const stats = [
    {
      label: "Ingresos del mes",
      value: formatCurrency(monthlyIncome),
      helper: isLoading ? "Cargando..." : `${incomes.length} registros`,
      href: "/ingresos",
      icon: ArrowUpRight,
      tone: "income",
    },
    {
      label: "Gastos del mes",
      value: formatCurrency(monthlyExpense),
      helper: isLoading ? "Cargando..." : `${expenses.length} registros`,
      href: "/gastos",
      icon: ArrowDownRight,
      tone: "expense",
    },
    {
      label: "Balance",
      value: formatCurrency(balance),
      helper: balance >= 0 ? "Disponible estimado" : "Gasto mayor al ingreso",
      icon: Wallet,
      featured: true,
      warning: balance < 0,
    },
    {
      label: `Pendientes de ${currentMonthName}`,
      value: formatCurrency(currentMonthPendingTotal),
      helper: isLoading
        ? "Cargando..."
        : currentMonthPendingPayments.length > 0
          ? `${currentMonthPendingPayments.length} por pagar este mes`
          : "Mes cubierto",
      href: "/pendientes",
      icon: CalendarDays,
      tone: "pending",
    },
    {
      label: "Pendientes totales",
      value: formatCurrency(pendingPaymentTotal),
      helper: isLoading
        ? "Cargando..."
        : pendingPaymentSummary.overdue > 0
          ? `${pendingPaymentSummary.overdue} vencidos`
          : pendingPaymentSummary.upcoming > 0
            ? `${pendingPaymentSummary.upcoming} próximos`
            : `${pendingPayments.length} por pagar`,
      href: "/pendientes",
      icon: CalendarClock,
      warning: pendingPaymentSummary.overdue > 0,
    },
  ];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              key={stat.label}
              className={`rounded-2xl border p-5 shadow-xl shadow-black/20 ${
                stat.tone === "income"
                  ? "border-emerald-300 bg-emerald-50"
                  : stat.tone === "expense"
                    ? "border-red-300 bg-red-50"
                    : stat.tone === "pending"
                      ? "border-yellow-300/40 bg-yellow-300/10"
                    : stat.warning
                      ? "border-red-400/25 bg-red-500/10"
                      : stat.featured
                        ? "border-emerald-300/25 bg-emerald-300/[0.08]"
                        : "border-white/10 bg-white/[0.035]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p
                    className={`text-sm ${
                      stat.tone === "income"
                        ? "text-emerald-800"
                        : stat.tone === "expense"
                          ? "text-red-800"
                          : stat.tone === "pending"
                            ? "text-yellow-100"
                        : stat.warning
                          ? "text-red-100"
                          : stat.featured
                            ? "text-emerald-100"
                            : "text-neutral-400"
                    }`}
                  >
                    {stat.label}
                  </p>
                  <p
                    className={`mt-3 text-3xl font-semibold ${
                      stat.tone === "income"
                        ? "text-emerald-900"
                        : stat.tone === "expense"
                          ? "text-red-900"
                          : stat.tone === "pending"
                            ? "text-yellow-100"
                        : stat.warning
                          ? "text-red-100"
                          : stat.featured
                            ? "text-emerald-200"
                            : "text-white"
                    }`}
                  >
                    {stat.value}
                  </p>
                </div>
                {stat.href ? (
                  <Link
                    href={stat.href}
                    aria-label={`Ver ${stat.label.toLowerCase()}`}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border transition hover:-translate-y-0.5 hover:border-emerald-300/40 hover:bg-emerald-300/10 hover:text-emerald-200 ${
                      stat.tone === "income"
                        ? "border-emerald-300 bg-white text-emerald-800"
                        : stat.tone === "expense"
                          ? "border-red-300 bg-white text-red-800"
                          : stat.tone === "pending"
                            ? "border-yellow-300/40 bg-yellow-300/10 text-yellow-100"
                        : stat.warning
                          ? "border-red-400/25 bg-red-500/10 text-red-100"
                          : stat.featured
                            ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
                            : "border-white/10 bg-black/20 text-neutral-300"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                ) : (
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                      stat.tone === "income"
                        ? "border-emerald-300 bg-white text-emerald-800"
                        : stat.tone === "expense"
                          ? "border-red-300 bg-white text-red-800"
                          : stat.tone === "pending"
                            ? "border-yellow-300/40 bg-yellow-300/10 text-yellow-100"
                        : stat.warning
                          ? "border-red-400/25 bg-red-500/10 text-red-100"
                          : stat.featured
                            ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
                            : "border-white/10 bg-black/20 text-neutral-300"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                )}
              </div>
              <p className="mt-4 text-sm text-neutral-500">{stat.helper}</p>
            </article>
          );
        })}
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20">
        <BrandedSectionHeading
          title="Avisos del mes"
          description="Señales rápidas para saber qué atender primero."
          trailing={
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
              <CircleAlert className="h-5 w-5" />
            </div>
          }
        />

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {dashboardAlerts.map((alert) => {
            const content = (
              <article
                className={`h-full rounded-2xl border p-4 transition ${
                  alert.tone === "danger"
                    ? "border-red-400/25 bg-red-500/10"
                    : alert.tone === "warning"
                      ? "border-yellow-300/25 bg-yellow-300/10"
                      : "border-emerald-300/20 bg-emerald-300/10"
                } ${alert.href ? "hover:-translate-y-0.5 hover:border-emerald-300/35" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <CircleAlert
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                      alert.tone === "danger"
                        ? "text-red-100"
                        : alert.tone === "warning"
                          ? "text-yellow-100"
                          : "text-emerald-100"
                    }`}
                  />
                  <div>
                    <p className="font-semibold text-white">{alert.title}</p>
                    <p
                      className={`mt-1 text-sm ${
                        alert.tone === "danger"
                          ? "text-red-100/80"
                          : alert.tone === "warning"
                            ? "text-yellow-100/80"
                            : "text-emerald-100/75"
                      }`}
                    >
                      {alert.description}
                    </p>
                  </div>
                </div>
              </article>
            );

            return alert.href ? (
              <Link key={`${alert.title}-${alert.description}`} href={alert.href}>
                {content}
              </Link>
            ) : (
              <div key={`${alert.title}-${alert.description}`}>{content}</div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20">
          <BrandedSectionHeading
            title="Distribución y uso del ingreso"
            description="Compara lo sugerido por porcentaje contra los gastos reales del mes."
            trailing={
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
                <CircleDollarSign className="h-5 w-5" />
              </div>
            }
          />

          <div className="mt-6 space-y-4">
            {bucketSummaries.map((item) => {
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-white">
                        {normalizeSpanishLabel(item.name)}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Sugerido: {item.percentage.toFixed(2)}%
                      </p>
                    </div>
                    <div className="text-sm sm:text-right">
                      <p className="font-semibold text-white">
                        {formatCurrency(item.allocatedAmount)}
                      </p>
                      <p
                        className={`mt-1 text-xs ${
                          item.isOverBudget
                            ? "text-red-200"
                            : "text-emerald-200"
                        }`}
                      >
                        {item.isOverBudget ? "Excedido" : "Disponible"}:{" "}
                        {formatCurrency(Math.abs(item.remainingAmount))}
                      </p>
                    </div>
                  </div>

                  <div className="h-2 rounded-full bg-neutral-800">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        backgroundColor: item.isOverBudget
                          ? "#fca5a5"
                          : item.color,
                        width: `${item.spentPercentage}%`,
                      }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-neutral-500">
                    <span>Gastado: {formatCurrency(item.spentAmount)}</span>
                    <span>{item.spentPercentage.toFixed(0)}% usado</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20">
          <BrandedSectionHeading
            title="Lectura rápida"
            description="Puntos clave del mes actual."
            trailing={
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
                <Trophy className="h-5 w-5" />
              </div>
            }
          />

          <div className="mt-6 grid gap-3">
            <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-neutral-400">
                    Categoría con más gasto
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {bestExpenseCategory
                      ? normalizeSpanishLabel(bestExpenseCategory.name)
                      : "Sin gastos"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {bestExpenseCategory
                      ? `${bestExpenseCategory.count} movimientos`
                      : "Aún no hay movimientos este mes"}
                  </p>
                </div>
                <div
                  className="mt-1 h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: bestExpenseCategory?.color ?? "#6b7280",
                  }}
                />
              </div>
              <p className="mt-3 text-2xl font-bold text-white">
                {formatCurrency(bestExpenseCategory?.total ?? 0)}
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-neutral-400">
                    Día con más ingresos
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {topIncomeDay
                      ? formatDate(topIncomeDay.incomeDate)
                      : "Sin ingresos"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {topIncomeDay
                      ? `${topIncomeDay.count} registros`
                      : "Aún no hay ingresos este mes"}
                  </p>
                </div>
                <CalendarDays className="h-5 w-5 text-emerald-200" />
              </div>
              <p className="mt-3 text-2xl font-bold text-white">
                {formatCurrency(topIncomeDay?.total ?? 0)}
              </p>
            </article>

            <article className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-emerald-100">
                    Disponible por bolsas
                  </p>
                  <p className="mt-2 text-lg font-semibold text-emerald-50">
                    {formatCurrency(availableTotal)}
                  </p>
                  <p className="mt-1 text-sm text-emerald-100/70">
                    {mostAvailableBucket
                      ? `Mayor margen: ${normalizeSpanishLabel(
                          mostAvailableBucket.name,
                        )}`
                      : "Sin margen disponible"}
                  </p>
                </div>
                <PiggyBank className="h-5 w-5 text-emerald-100" />
              </div>
            </article>

            <article
              className={`rounded-2xl border p-4 ${
                overBudgetBuckets.length > 0
                  ? "border-red-400/25 bg-red-500/10"
                  : "border-white/10 bg-black/20"
              }`}
            >
              <div className="flex items-start gap-3">
                <CircleAlert
                  className={`mt-0.5 h-5 w-5 ${
                    overBudgetBuckets.length > 0
                      ? "text-red-100"
                      : "text-emerald-200"
                  }`}
                />
                <div>
                  <p
                    className={`font-semibold ${
                      overBudgetBuckets.length > 0
                        ? "text-red-50"
                        : "text-white"
                    }`}
                  >
                    {overBudgetBuckets.length > 0
                      ? "Hay bolsas excedidas"
                      : "Sin bolsas excedidas"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-400">
                    {overBudgetBuckets.length > 0
                      ? overBudgetBuckets
                          .map((item) => normalizeSpanishLabel(item.name))
                          .join(", ")
                      : "Los gastos se mantienen dentro de lo configurado."}
                  </p>
                </div>
              </div>
            </article>

            <article
              className={`rounded-2xl border p-4 ${
                pendingPaymentSummary.overdue > 0
                  ? "border-red-400/25 bg-red-500/10"
                  : pendingPaymentSummary.upcoming > 0
                    ? "border-yellow-300/25 bg-yellow-300/10"
                    : "border-white/10 bg-black/20"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-neutral-400">
                    Pendientes por pagar
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {formatCurrency(pendingPaymentTotal)}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {pendingPayments.length > 0
                      ? `${pendingPayments.length} pagos abiertos`
                      : "No hay pagos abiertos"}
                  </p>
                </div>
                <ClockAlert
                  className={`h-5 w-5 ${
                    pendingPaymentSummary.overdue > 0
                      ? "text-red-100"
                      : pendingPaymentSummary.upcoming > 0
                        ? "text-yellow-100"
                        : "text-emerald-200"
                  }`}
                />
              </div>

              {pendingPayments.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {pendingPayments.slice(0, 3).map((payment) => {
                    const days = getDayDifference(payment.due_date, today);

                    return (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {payment.concept}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {formatDate(payment.due_date)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-white">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p
                            className={`text-xs ${
                              days <= 0
                                ? "text-red-100"
                                : days <= 3
                                  ? "text-yellow-100"
                                  : "text-neutral-500"
                            }`}
                          >
                            {getPendingPaymentLabel(days)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <Link
                href="/pendientes"
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 text-sm font-semibold text-emerald-100 transition hover:-translate-y-0.5 hover:bg-emerald-300/15"
              >
                Ver pendientes
              </Link>
            </article>
          </div>
        </section>
      </div>
    </>
  );
}
