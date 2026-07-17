"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CalendarRange,
  ChartColumn,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClockAlert,
  ReceiptText,
  Scale,
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

type Income = {
  amount: number;
  concept: string;
  id: string;
  income_category_id: string | null;
  income_date: string;
};

type IncomeCategory = {
  color: string;
  id: string;
  name: string;
};

type Expense = {
  amount: number;
  category_id: string | null;
  concept: string;
  expense_date: string;
};

type Category = {
  id: string;
  allocation_bucket_id: string | null;
  color: string;
  name: string;
};

type AllocationBucket = {
  id: string;
  color: string;
  name: string;
  sort_order: number;
};

type FixedPayment = {
  amount: number;
  category_id: string | null;
  concept: string;
  due_date: string;
  id: string;
  paid_at: string | null;
  status: "pending" | "paid";
};

type ReportView =
  | "summary"
  | "reading"
  | "daily"
  | "pending"
  | "paid-pending"
  | "categories"
  | "income-categories"
  | "buckets";

type PeriodMode = "month" | "range";

const inputClass =
  "h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/15";

const reportOptions: Array<{ label: string; value: ReportView }> = [
  { label: "Lectura del período", value: "reading" },
  { label: "Ingresos vs gastos por día", value: "daily" },
  { label: "Pagos pendientes", value: "pending" },
  { label: "Pagos pendientes ya pagados", value: "paid-pending" },
  { label: "Gastos por categoría", value: "categories" },
  { label: "Ingresos por categoría", value: "income-categories" },
  { label: "Gastos por bolsa", value: "buckets" },
];

function getCurrentMonthInput() {
  return getTodayDateInput().slice(0, 7);
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = formatDateInput(new Date(year, monthNumber, 0));

  return { end, start };
}

function getCurrentYearRange() {
  const year = getTodayDateInput().slice(0, 4);

  return { end: `${year}-12-31`, start: `${year}-01-01` };
}

export function ReportManager() {
  const detailSectionRef = useRef<HTMLDivElement>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthInput());
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [rangeStart, setRangeStart] = useState(
    () => getCurrentYearRange().start,
  );
  const [rangeEnd, setRangeEnd] = useState(() => getCurrentYearRange().end);
  const [selectedReport, setSelectedReport] = useState<ReportView>("reading");
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fixedPayments, setFixedPayments] = useState<FixedPayment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);
  const [buckets, setBuckets] = useState<AllocationBucket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const categoryById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category]));
  }, [categories]);

  const bucketById = useMemo(() => {
    return new Map(buckets.map((bucket) => [bucket.id, bucket]));
  }, [buckets]);

  const incomeCategoryById = useMemo(() => {
    return new Map(
      incomeCategories.map((category) => [category.id, category]),
    );
  }, [incomeCategories]);

  const totalIncome = useMemo(
    () => incomes.reduce((sum, income) => sum + Number(income.amount), 0),
    [incomes],
  );

  const totalExpense = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.amount), 0),
    [expenses],
  );

  const balance = totalIncome - totalExpense;

  const activeRange =
    periodMode === "month"
      ? getMonthRange(selectedMonth)
      : { end: rangeEnd, start: rangeStart };

  const dailyReport = useMemo(() => {
    const byDate = new Map<
      string,
      { balance: number; date: string; day: number; expense: number; income: number }
    >();

    function getEntry(date: string) {
      const current = byDate.get(date);

      if (current) {
        return current;
      }

      const entry = {
        balance: 0,
        date,
        day: Number(date.slice(8, 10)),
        expense: 0,
        income: 0,
      };
      byDate.set(date, entry);

      return entry;
    }

    for (const income of incomes) {
      getEntry(income.income_date).income += income.amount;
    }

    for (const expense of expenses) {
      getEntry(expense.expense_date).expense += expense.amount;
    }

    return Array.from(byDate.values())
      .map((day) => ({ ...day, balance: day.income - day.expense }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [expenses, incomes]);

  const maxDailyAmount = useMemo(() => {
    return Math.max(
      ...dailyReport.flatMap((day) => [day.income, day.expense]),
      0,
    );
  }, [dailyReport]);

  const expensesByCategory = useMemo(() => {
    const groups = new Map<
      string,
      { color: string; id: string; items: Expense[]; name: string; total: number }
    >();

    for (const expense of expenses) {
      const category = expense.category_id
        ? categoryById.get(expense.category_id)
        : null;
      const key = category?.id ?? "sin-categoria";
      const current = groups.get(key) ?? {
        color: category?.color ?? "#6b7280",
        id: key,
        items: [],
        name: category?.name ?? "Sin categoría",
        total: 0,
      };

      current.items.push(expense);
      current.total += expense.amount;
      groups.set(key, current);
    }

    return Array.from(groups.values()).sort((a, b) => b.total - a.total);
  }, [categoryById, expenses]);

  const expensesByBucket = useMemo(() => {
    const groups = new Map<
      string,
      { color: string; name: string; total: number }
    >();

    for (const expense of expenses) {
      const category = expense.category_id
        ? categoryById.get(expense.category_id)
        : null;
      const bucket = category?.allocation_bucket_id
        ? bucketById.get(category.allocation_bucket_id)
        : null;
      const key = bucket?.id ?? "sin-bolsa";
      const current = groups.get(key) ?? {
        color: bucket?.color ?? category?.color ?? "#6b7280",
        name: bucket?.name ?? "Sin bolsa",
        total: 0,
      };

      current.total += expense.amount;
      groups.set(key, current);
    }

    return Array.from(groups.values()).sort((a, b) => b.total - a.total);
  }, [bucketById, categoryById, expenses]);

  const incomesByCategory = useMemo(() => {
    const groups = new Map<
      string,
      { color: string; id: string; items: Income[]; name: string; total: number }
    >();

    for (const income of incomes) {
      const category = income.income_category_id
        ? incomeCategoryById.get(income.income_category_id)
        : null;
      const key = category?.id ?? "sin-categoria";
      const current = groups.get(key) ?? {
        color: category?.color ?? "#6b7280",
        id: key,
        items: [],
        name: category?.name ?? "Sin categoría",
        total: 0,
      };

      current.items.push(income);
      current.total += income.amount;
      groups.set(key, current);
    }

    return Array.from(groups.values()).sort((a, b) => b.total - a.total);
  }, [incomeCategoryById, incomes]);

  const maxCategoryAmount = Math.max(
    ...expensesByCategory.map((item) => item.total),
    0,
  );
  const maxBucketAmount = Math.max(
    ...expensesByBucket.map((item) => item.total),
    0,
  );
  const maxIncomeCategoryAmount = Math.max(
    ...incomesByCategory.map((item) => item.total),
    0,
  );
  const totalMovements = incomes.length + expenses.length;
  const expenseRatio = totalIncome ? (totalExpense / totalIncome) * 100 : 0;

  const topExpenseCategory = expensesByCategory[0] ?? null;
  const topExpenseBucket = expensesByBucket[0] ?? null;

  const topIncomeDay = useMemo(() => {
    return [...dailyReport].sort((a, b) => b.income - a.income)[0] ?? null;
  }, [dailyReport]);

  const topExpenseDay = useMemo(() => {
    return [...dailyReport].sort((a, b) => b.expense - a.expense)[0] ?? null;
  }, [dailyReport]);

  const pendingPayments = useMemo(() => {
    return fixedPayments
      .filter((payment) => payment.status === "pending")
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [fixedPayments]);

  const paidPendingPayments = useMemo(() => {
    return fixedPayments
      .filter((payment) => payment.status === "paid")
      .sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""));
  }, [fixedPayments]);

  const pendingPaymentTotal = useMemo(() => {
    return pendingPayments.reduce((sum, payment) => sum + payment.amount, 0);
  }, [pendingPayments]);

  const paidPendingPaymentTotal = useMemo(() => {
    return paidPendingPayments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );
  }, [paidPendingPayments]);

  const monthInsights = useMemo(() => {
    const insights: Array<{
      description: string;
      title: string;
      tone: "danger" | "success" | "warning";
    }> = [];

    if (totalMovements === 0) {
      return [
        {
          description: "Aún no hay ingresos, gastos o pagos para analizar.",
          title: "Sin movimientos",
          tone: "warning" as const,
        },
      ];
    }

    if (totalIncome === 0 && totalExpense > 0) {
      insights.push({
        description: "Hay gastos registrados, pero todavía no hay ingresos en este período.",
        title: "Faltan ingresos",
        tone: "warning",
      });
    } else if (expenseRatio > 100) {
      insights.push({
        description: `Los gastos superan los ingresos por ${formatCurrency(
          Math.abs(balance),
        )}.`,
        title: "Gasto mayor al ingreso",
        tone: "danger",
      });
    } else if (expenseRatio >= 80) {
      insights.push({
        description: `Ya se usó el ${expenseRatio.toFixed(0)}% de los ingresos registrados.`,
        title: "Gasto alto",
        tone: "warning",
      });
    } else if (totalIncome > 0) {
      insights.push({
        description: `Se conserva un balance de ${formatCurrency(balance)} al cierre visual del período.`,
        title: "Balance saludable",
        tone: "success",
      });
    }

    if (topExpenseCategory) {
      insights.push({
        description: `${normalizeSpanishLabel(
          topExpenseCategory.name,
        )} concentra ${formatCurrency(topExpenseCategory.total)} en gastos.`,
        title: "Categoría principal",
        tone: "warning",
      });
    }

    if (pendingPaymentTotal > 0) {
      insights.push({
        description: `Quedan ${formatCurrency(pendingPaymentTotal)} en pagos pendientes abiertos.`,
        title: "Pagos pendientes",
        tone: "warning",
      });
    }

    if (paidPendingPaymentTotal > 0) {
      insights.push({
        description: `Ya se liquidaron ${formatCurrency(
          paidPendingPaymentTotal,
        )} desde Pendientes.`,
        title: "Pagos ya cubiertos",
        tone: "success",
      });
    }

    return insights.slice(0, 4);
  }, [
    balance,
    expenseRatio,
    paidPendingPaymentTotal,
    pendingPaymentTotal,
    topExpenseCategory,
    totalExpense,
    totalIncome,
    totalMovements,
  ]);

  const fetchReportData = useCallback(async (start: string, end: string) => {
    return Promise.all([
      supabase
        .from("incomes")
        .select("id, amount, concept, income_category_id, income_date")
        .gte("income_date", start)
        .lte("income_date", end),
      supabase
        .from("expenses")
        .select("amount, category_id, concept, expense_date")
        .gte("expense_date", start)
        .lte("expense_date", end),
      supabase
        .from("categories")
        .select("id, allocation_bucket_id, color, name"),
      supabase
        .from("income_categories")
        .select("id, color, name"),
      supabase
        .from("allocation_buckets")
        .select("id, color, name, sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("fixed_expenses")
        .select("id, category_id, concept, amount, due_date, paid_at, status")
        .or(
          `and(status.eq.pending,due_date.gte.${start},due_date.lte.${end}),and(status.eq.paid,paid_at.gte.${start},paid_at.lte.${end})`,
        )
        .order("due_date", { ascending: true }),
    ]);
  }, []);

  useEffect(() => {
    let shouldIgnore = false;

    fetchReportData(activeRange.start, activeRange.end).then(
      ([
        incomeResult,
        expenseResult,
        categoryResult,
        incomeCategoryResult,
        bucketResult,
        fixedPaymentResult,
      ]) => {
        if (shouldIgnore) {
          return;
        }

        if (
          incomeResult.error ||
          expenseResult.error ||
          categoryResult.error ||
          incomeCategoryResult.error ||
          bucketResult.error ||
          fixedPaymentResult.error
        ) {
          setMessage("No se pudo cargar el reporte.");
          setIsLoading(false);
          return;
        }

        setIncomes(
          ((incomeResult.data ?? []) as Income[]).map((income) => ({
            ...income,
            amount: Number(income.amount),
          })),
        );
        setExpenses(
          ((expenseResult.data ?? []) as Expense[]).map((expense) => ({
            ...expense,
            amount: Number(expense.amount),
          })),
        );
        setCategories((categoryResult.data ?? []) as Category[]);
        setIncomeCategories(
          (incomeCategoryResult.data ?? []) as IncomeCategory[],
        );
        setBuckets((bucketResult.data ?? []) as AllocationBucket[]);
        setFixedPayments(
          ((fixedPaymentResult.data ?? []) as FixedPayment[]).map(
            (payment) => ({
              ...payment,
              amount: Number(payment.amount),
            }),
          ),
        );
        setIsLoading(false);
      },
    );

    return () => {
      shouldIgnore = true;
    };
  }, [activeRange.end, activeRange.start, fetchReportData, periodMode]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <BrandedSectionHeading
            title={periodMode === "month" ? "Reporte mensual" : "Reporte por rango"}
            description="Resumen visual de ingresos, gastos, balance y destino del dinero."
          />

          <div className="w-full lg:max-w-[760px]">
            <div className="mb-4 flex flex-wrap gap-2" aria-label="Tipo de período">
              <button
                type="button"
                onClick={() => {
                  if (periodMode === "month") {
                    return;
                  }

                  setIsLoading(true);
                  setMessage("");
                  setPeriodMode("month");
                }}
                className={`flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
                  periodMode === "month"
                    ? "border-pink-300 bg-pink-300 text-neutral-950"
                    : "border-white/10 bg-black/20 text-neutral-300 hover:border-pink-300/50 hover:text-pink-100"
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                Por mes
              </button>
              <button
                type="button"
                onClick={() => {
                  if (periodMode === "range") {
                    return;
                  }

                  setIsLoading(true);
                  setMessage("");
                  setPeriodMode("range");
                }}
                className={`flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
                  periodMode === "range"
                    ? "border-pink-300 bg-pink-300 text-neutral-950"
                    : "border-white/10 bg-black/20 text-neutral-300 hover:border-pink-300/50 hover:text-pink-100"
                }`}
              >
                <CalendarRange className="h-4 w-4" />
                Rango de fechas
              </button>
            </div>

            <div
              className={`grid gap-3 sm:grid-cols-2 ${
                periodMode === "range" ? "xl:grid-cols-3" : ""
              }`}
            >
              {periodMode === "month" ? (
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Mes
                  </span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => {
                      if (!event.target.value) {
                        return;
                      }

                      setIsLoading(true);
                      setMessage("");
                      setSelectedMonth(event.target.value);
                    }}
                    className={`${inputClass} mt-2`}
                  />
                </label>
              ) : (
                <>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Fecha inicial
                    </span>
                    <input
                      type="date"
                      value={rangeStart}
                      max={rangeEnd}
                      onChange={(event) => {
                        if (!event.target.value) {
                          return;
                        }

                        setIsLoading(true);
                        setMessage("");
                        setRangeStart(event.target.value);
                      }}
                      className={`${inputClass} mt-2`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Fecha final
                    </span>
                    <input
                      type="date"
                      value={rangeEnd}
                      min={rangeStart}
                      onChange={(event) => {
                        if (!event.target.value) {
                          return;
                        }

                        setIsLoading(true);
                        setMessage("");
                        setRangeEnd(event.target.value);
                      }}
                      className={`${inputClass} mt-2`}
                    />
                  </label>
                </>
              )}

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Ver detalle
                </span>
                <select
                  value={selectedReport}
                  onChange={(event) => {
                    setSelectedReport(event.target.value as ReportView);
                    window.setTimeout(() => {
                      detailSectionRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }, 50);
                  }}
                  className={`${inputClass} mt-2`}
                >
                  {reportOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        {message ? (
          <p className="mt-5 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-neutral-200">
            {message}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20">
        <BrandedSectionHeading
          title="Panel ejecutivo"
          description="Vista general del período seleccionado antes de entrar al detalle."
          trailing={
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
              <ChartColumn className="h-5 w-5" />
            </div>
          }
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {[
            {
              icon: ArrowUpRight,
              label: "Ingresos",
              value: formatCurrency(totalIncome),
            },
            {
              icon: ArrowDownRight,
              label: "Gastos",
              value: formatCurrency(totalExpense),
              warning: totalExpense > totalIncome && totalIncome > 0,
            },
            {
              featured: true,
              icon: Wallet,
              label: "Balance",
              value: formatCurrency(balance),
              warning: balance < 0,
            },
            {
              icon: ClockAlert,
              label: "Pendientes",
              value: formatCurrency(pendingPaymentTotal),
              helper: `${pendingPayments.length} abiertos`,
              warning: pendingPaymentTotal > 0,
            },
            {
              icon: CheckCircle2,
              label: "Pagados",
              value: formatCurrency(paidPendingPaymentTotal),
              helper: `${paidPendingPayments.length} cubiertos`,
            },
            {
              icon: ChartColumn,
              label: "Movimientos",
              value: totalMovements.toString(),
              helper: `${incomes.length} ingresos · ${expenses.length} gastos`,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.label}
                className={`rounded-2xl border p-4 shadow-xl shadow-black/20 ${
                  item.warning
                    ? "border-red-400/25 bg-red-500/10"
                    : item.featured
                      ? "border-emerald-300/25 bg-emerald-300/[0.08]"
                      : "border-white/10 bg-black/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-400">{item.label}</p>
                    <p
                      className={`mt-3 whitespace-nowrap text-2xl font-semibold leading-tight tabular-nums ${
                        item.warning
                          ? "text-red-100"
                          : item.featured
                            ? "text-emerald-200"
                            : "text-white"
                      }`}
                    >
                      {item.value}
                    </p>
                    {"helper" in item && item.helper ? (
                      <p className="mt-2 text-sm text-neutral-500">
                        {item.helper}
                      </p>
                    ) : null}
                  </div>
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      item.warning
                        ? "border-red-400/25 bg-red-500/10 text-red-100"
                        : item.featured
                          ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
                          : "border-white/10 bg-white/[0.03] text-neutral-300"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20">
        <BrandedSectionHeading
          title="Interpretación rápida"
          description="Lectura automática del comportamiento del período."
          trailing={
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
              <Trophy className="h-5 w-5" />
            </div>
          }
        />

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {monthInsights.map((insight) => (
            <article
              key={`${insight.title}-${insight.description}`}
              className={`rounded-2xl border p-4 ${
                insight.tone === "danger"
                  ? "border-red-400/25 bg-red-500/10"
                  : insight.tone === "warning"
                    ? "border-yellow-300/25 bg-yellow-300/10"
                    : "border-emerald-300/20 bg-emerald-300/10"
              }`}
            >
              <p className="font-semibold text-white">{insight.title}</p>
              <p
                className={`mt-2 text-sm leading-6 ${
                  insight.tone === "danger"
                    ? "text-red-100/80"
                    : insight.tone === "warning"
                      ? "text-yellow-100/80"
                      : "text-emerald-100/75"
                }`}
              >
                {insight.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {selectedReport === "summary" ? (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: ArrowUpRight,
            label: "Ingresos",
            value: formatCurrency(totalIncome),
          },
          {
            icon: ArrowDownRight,
            label: "Gastos",
            value: formatCurrency(totalExpense),
          },
          {
            featured: true,
            icon: Wallet,
            label: "Balance",
            value: formatCurrency(balance),
          },
          {
            icon: ChartColumn,
            label: "Movimientos",
            value: totalMovements.toString(),
            helper: `${incomes.length} ingresos · ${expenses.length} gastos`,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.label}
              className={`rounded-2xl border p-5 shadow-xl shadow-black/20 ${
                item.featured
                  ? "border-emerald-300/25 bg-emerald-300/[0.08]"
                  : "border-white/10 bg-white/[0.035]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-400">{item.label}</p>
                  <p
                    className={`mt-3 whitespace-nowrap text-3xl font-semibold tabular-nums ${
                      item.featured ? "text-emerald-200" : "text-white"
                    }`}
                  >
                    {item.value}
                  </p>
                  {"helper" in item && item.helper ? (
                    <p className="mt-2 text-sm text-neutral-500">
                      {item.helper}
                    </p>
                  ) : null}
                </div>
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                    item.featured
                      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
                      : "border-white/10 bg-black/20 text-neutral-300"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </article>
          );
        })}
      </div>
      ) : null}

      <div ref={detailSectionRef} className="scroll-mt-6" />

      {selectedReport === "reading" ? (
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20">
        <BrandedSectionHeading
          title="Lectura del período"
          description="Indicadores rápidos para entender el comportamiento del período."
          trailing={
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
              <Trophy className="h-5 w-5" />
            </div>
          }
        />

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-neutral-400">Uso del ingreso</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {expenseRatio.toFixed(0)}%
            </p>
            <div className="mt-3 h-2 rounded-full bg-neutral-800">
              <div
                className={`h-2 rounded-full ${
                  expenseRatio > 100 ? "bg-red-300" : "bg-emerald-300"
                }`}
                style={{ width: `${Math.min(expenseRatio, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              {expenseRatio > 100
                ? "Los gastos superan los ingresos."
                : "Gastos contra ingresos registrados."}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-neutral-400">Categoría dominante</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {topExpenseCategory
                ? normalizeSpanishLabel(topExpenseCategory.name)
                : "Sin gastos"}
            </p>
            <p className="mt-3 text-2xl font-bold text-white">
              {formatCurrency(topExpenseCategory?.total ?? 0)}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-neutral-400">Bolsa más usada</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {topExpenseBucket
                ? normalizeSpanishLabel(topExpenseBucket.name)
                : "Sin gastos"}
            </p>
            <p className="mt-3 text-2xl font-bold text-white">
              {formatCurrency(topExpenseBucket?.total ?? 0)}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-neutral-400">Día más activo</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {topIncomeDay || topExpenseDay
                ? formatDate(
                    (topIncomeDay?.income ?? 0) >= (topExpenseDay?.expense ?? 0)
                      ? (topIncomeDay?.date ??
                          topExpenseDay?.date ??
                          selectedMonth)
                      : (topExpenseDay?.date ??
                          topIncomeDay?.date ??
                          selectedMonth),
                  )
                : "Sin movimientos"}
            </p>
            <p className="mt-3 text-sm text-neutral-500">
              Mayor ingreso: {formatCurrency(topIncomeDay?.income ?? 0)}
            </p>
          </article>
        </div>
      </section>
      ) : null}

      {selectedReport === "daily" ? (
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20">
        <BrandedSectionHeading
          title="Ingresos vs gastos por día"
          description="Días del período con movimientos registrados."
          trailing={
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
              <Scale className="h-5 w-5" />
            </div>
          }
        />

        {isLoading ? (
          <p className="mt-5 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-neutral-300">
            Cargando reporte...
          </p>
        ) : dailyReport.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
            <p className="text-lg font-semibold text-white">
              No hay movimientos en este período.
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              Agrega ingresos o gastos para ver el reporte visual.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-white">
                    Comparativo diario
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    Cada tarjeta muestra cuánto entró, cuánto salió y el
                    balance de ese día.
                  </p>
                </div>
                <CalendarDays className="h-5 w-5 text-emerald-200" />
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {dailyReport.map((day) => (
                  <article
                    key={day.date}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Día {day.day}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {formatDate(day.date)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          day.balance >= 0
                            ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                            : "border-red-300/25 bg-red-500/10 text-red-100"
                        }`}
                      >
                        Balance: {formatCurrency(day.balance)}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                          <span className="text-neutral-400">Ingresos</span>
                          <span className="font-semibold text-emerald-100">
                            {formatCurrency(day.income)}
                          </span>
                        </div>
                        <div className="h-3 rounded-full bg-neutral-800">
                          <div
                            className="h-3 rounded-full bg-emerald-300"
                            style={{
                              width: `${
                                maxDailyAmount
                                  ? Math.max(
                                      (day.income / maxDailyAmount) * 100,
                                      day.income > 0 ? 4 : 0,
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                          <span className="text-neutral-400">Gastos</span>
                          <span className="font-semibold text-red-100">
                            {formatCurrency(day.expense)}
                          </span>
                        </div>
                        <div className="h-3 rounded-full bg-neutral-800">
                          <div
                            className="h-3 rounded-full bg-red-300"
                            style={{
                              width: `${
                                maxDailyAmount
                                  ? Math.max(
                                      (day.expense / maxDailyAmount) * 100,
                                      day.expense > 0 ? 4 : 0,
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
      ) : null}

      {selectedReport === "pending" ? (
        <PaymentReport
          categories={categoryById}
          emptyText="No hay pagos pendientes para este período."
          icon={<ClockAlert className="h-5 w-5" />}
          payments={pendingPayments}
          total={pendingPaymentTotal}
          title="Pagos pendientes del período"
        />
      ) : null}

      {selectedReport === "paid-pending" ? (
        <PaymentReport
          categories={categoryById}
          emptyText="No hay pagos pendientes pagados en este período."
          icon={<CheckCircle2 className="h-5 w-5" />}
          payments={paidPendingPayments}
          showPaidDate
          total={paidPendingPaymentTotal}
          title="Pagos pendientes ya pagados"
        />
      ) : null}

      {selectedReport === "categories" ? (
        <CategoryExpenseReport
          items={expensesByCategory}
          maxAmount={maxCategoryAmount}
          title="Gastos por categoría"
          description="Categorías donde más se fue el dinero."
        />
      ) : null}

      {selectedReport === "income-categories" ? (
        <CategoryIncomeReport
          items={incomesByCategory}
          maxAmount={maxIncomeCategoryAmount}
          title="Ingresos por categoría"
          description="Fuentes desde donde entró el dinero durante el período."
        />
      ) : null}

      {selectedReport === "buckets" ? (
        <ReportBars
          items={expensesByBucket}
          maxAmount={maxBucketAmount}
          title="Gastos por bolsa"
          description="Agrupado por las bolsas de distribución."
        />
      ) : null}
    </div>
  );
}

function ReportBars({
  description,
  items,
  maxAmount,
  title,
}: {
  description: string;
  items: Array<{ color: string; name: string; total: number }>;
  maxAmount: number;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20">
      <BrandedSectionHeading title={title} description={description} />

      {items.length === 0 ? (
        <p className="mt-5 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-neutral-300">
          No hay gastos para mostrar.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <div key={item.name}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-neutral-300">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {normalizeSpanishLabel(item.name)}
                </span>
                <span className="font-semibold text-white">
                  {formatCurrency(item.total)}
                </span>
              </div>
              <div className="h-3 rounded-full bg-neutral-800">
                <div
                  className="h-3 rounded-full"
                  style={{
                    backgroundColor: item.color,
                    width: `${maxAmount ? (item.total / maxAmount) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryExpenseReport({
  description,
  items,
  maxAmount,
  title,
}: {
  description: string;
  items: Array<{
    color: string;
    id: string;
    items: Expense[];
    name: string;
    total: number;
  }>;
  maxAmount: number;
  title: string;
}) {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(
    items[0]?.id ?? null,
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20">
      <BrandedSectionHeading title={title} description={description} />

      {items.length === 0 ? (
        <p className="mt-5 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-neutral-300">
          No hay gastos para mostrar.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((item) => {
            const isOpen = openCategoryId === item.id;

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenCategoryId((current) =>
                      current === item.id ? null : item.id,
                    )
                  }
                  className="w-full text-left"
                  aria-expanded={isOpen}
                >
                  <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-neutral-300">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate">
                        {normalizeSpanishLabel(item.name)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 font-semibold text-white">
                      {formatCurrency(item.total)}
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-neutral-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-neutral-400" />
                      )}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-neutral-800">
                    <div
                      className="h-3 rounded-full"
                      style={{
                        backgroundColor: item.color,
                        width: `${
                          maxAmount ? (item.total / maxAmount) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                </button>

                {isOpen ? (
                  <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                    {item.items
                      .slice()
                      .sort((a, b) => b.amount - a.amount)
                      .map((expense, index) => (
                        <div
                          key={`${expense.expense_date}-${expense.concept}-${index}`}
                          className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-semibold text-white">
                              {expense.concept}
                            </p>
                            <p className="mt-1 text-xs text-neutral-500">
                              {formatDate(expense.expense_date)}
                            </p>
                          </div>
                          <p className="text-lg font-bold text-white">
                            {formatCurrency(expense.amount)}
                          </p>
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CategoryIncomeReport({
  description,
  items,
  maxAmount,
  title,
}: {
  description: string;
  items: Array<{
    color: string;
    id: string;
    items: Income[];
    name: string;
    total: number;
  }>;
  maxAmount: number;
  title: string;
}) {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(
    items[0]?.id ?? null,
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20">
      <BrandedSectionHeading title={title} description={description} />

      {items.length === 0 ? (
        <p className="mt-5 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-neutral-300">
          No hay ingresos para mostrar.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((item) => {
            const isOpen = openCategoryId === item.id;

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenCategoryId((current) =>
                      current === item.id ? null : item.id,
                    )
                  }
                  className="w-full text-left"
                  aria-expanded={isOpen}
                >
                  <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-neutral-300">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate">
                        {normalizeSpanishLabel(item.name)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 font-semibold text-white">
                      {formatCurrency(item.total)}
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-neutral-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-neutral-400" />
                      )}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-neutral-800">
                    <div
                      className="h-3 rounded-full"
                      style={{
                        backgroundColor: item.color,
                        width: `${maxAmount ? (item.total / maxAmount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </button>

                {isOpen ? (
                  <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                    {item.items
                      .slice()
                      .sort((a, b) => b.amount - a.amount)
                      .map((income) => (
                        <div
                          key={income.id}
                          className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-semibold text-white">{income.concept}</p>
                            <p className="mt-1 text-xs text-neutral-500">
                              {formatDate(income.income_date)}
                            </p>
                          </div>
                          <p className="text-lg font-bold text-emerald-200">
                            {formatCurrency(income.amount)}
                          </p>
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PaymentReport({
  categories,
  emptyText,
  icon,
  payments,
  showPaidDate = false,
  title,
  total,
}: {
  categories: Map<string, Category>;
  emptyText: string;
  icon: ReactNode;
  payments: FixedPayment[];
  showPaidDate?: boolean;
  title: string;
  total: number;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20">
      <BrandedSectionHeading
        title={title}
        description="Detalle visual de pagos registrados en Pendientes."
        trailing={
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
            {icon}
          </div>
        }
      />

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-neutral-400">Total</p>
            <ReceiptText className="h-5 w-5 text-emerald-200" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">
            {formatCurrency(total)}
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm text-neutral-400">Registros</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {payments.length}
          </p>
        </article>
      </div>

      {payments.length === 0 ? (
        <p className="mt-5 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-neutral-300">
          {emptyText}
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {payments.map((payment) => {
            const category = payment.category_id
              ? (categories.get(payment.category_id) ?? null)
              : null;

            return (
              <article
                key={payment.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-white">
                      {payment.concept}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-400">
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                        Vence: {formatDate(payment.due_date)}
                      </span>
                      {showPaidDate && payment.paid_at ? (
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-emerald-100">
                          Pagado: {formatDate(payment.paid_at)}
                        </span>
                      ) : null}
                      <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: category?.color ?? "#6b7280",
                          }}
                        />
                        {normalizeSpanishLabel(category?.name ?? "Sin categoría")}
                      </span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(payment.amount)}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
