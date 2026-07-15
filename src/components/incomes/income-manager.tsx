"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { BrandedSectionHeading } from "@/components/app/branded-section-heading";
import { supabase } from "@/lib/supabase/client";
import {
  formatCurrency,
  formatDate,
  formatDateInput,
  getTodayDateInput,
} from "@/lib/format";
import { parseMoneyInput } from "@/lib/money";

type Income = {
  income_category_id: string | null;
  id: string;
  income_date: string;
  concept: string;
  amount: number;
  note: string | null;
};

type IncomeCategory = {
  color: string;
  id: string;
  name: string;
};

type ViewMode = "recent" | "date" | "high" | "low" | "chart";

const inputClass =
  "h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/15";

const incomeConcepts = [
  "Ingreso en efectivo",
  "Run + nutrición",
  "Consulta",
  "Running",
  "Venta",
  "Sueldo",
  "Depósito",
  "Transferencia",
  "Pago de cliente",
  "Comisión",
  "Servicio",
  "Renta",
  "Reembolso",
  "Otro ingreso",
];

const viewOptions: Array<{ label: string; value: ViewMode }> = [
  { label: "Recientes", value: "recent" },
  { label: "Por fecha", value: "date" },
  { label: "Mayor a menor", value: "high" },
  { label: "Menor a mayor", value: "low" },
  { label: "Gráfica mensual", value: "chart" },
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

function sortByDateDesc(items: Income[]) {
  return [...items].sort((a, b) => {
    const dateComparison = b.income_date.localeCompare(a.income_date);

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return b.id.localeCompare(a.id);
  });
}

export function IncomeManager() {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const formSectionRef = useRef<HTMLElement>(null);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);
  const [incomeCategoryId, setIncomeCategoryId] = useState("");
  const [date, setDate] = useState(getTodayDateInput());
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthInput());
  const [viewMode, setViewMode] = useState<ViewMode>("recent");
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [incomeToDelete, setIncomeToDelete] = useState<Income | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const today = getTodayDateInput();

  const total = useMemo(
    () => incomes.reduce((sum, income) => sum + Number(income.amount), 0),
    [incomes],
  );

  const displayedIncomes = useMemo(() => {
    if (viewMode === "high") {
      return [...incomes].sort((a, b) => b.amount - a.amount);
    }

    if (viewMode === "low") {
      return [...incomes].sort((a, b) => a.amount - b.amount);
    }

    return sortByDateDesc(incomes);
  }, [incomes, viewMode]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, Income[]>();

    for (const income of sortByDateDesc(incomes)) {
      const group = groups.get(income.income_date) ?? [];
      group.push(income);
      groups.set(income.income_date, group);
    }

    return Array.from(groups.entries()).map(([incomeDate, items]) => ({
      incomeDate,
      items,
      total: items.reduce((sum, income) => sum + income.amount, 0),
    }));
  }, [incomes]);

  const chartData = useMemo(() => {
    const totals = new Map<string, number>();

    for (const income of incomes) {
      totals.set(
        income.income_date,
        (totals.get(income.income_date) ?? 0) + income.amount,
      );
    }

    const entries = Array.from(totals.entries())
      .map(([incomeDate, dayTotal]) => ({
        day: Number(incomeDate.slice(8, 10)),
        incomeDate,
        total: dayTotal,
      }))
      .sort((a, b) => a.incomeDate.localeCompare(b.incomeDate));

    const max = Math.max(...entries.map((entry) => entry.total), 0);
    const topDay = [...entries].sort((a, b) => b.total - a.total)[0];

    return { entries, max, topDay };
  }, [incomes]);

  const fetchIncomes = useCallback(async (month: string) => {
    const { start, end } = getMonthRange(month);
    const { data, error } = await supabase
      .from("incomes")
      .select("id, income_category_id, income_date, concept, amount, note")
      .gte("income_date", start)
      .lte("income_date", end)
      .order("income_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    return { data, error };
  }, []);

  const applyIncomeRows = useCallback((rows: Income[]) => {
    setIncomes(
      rows.map((income) => ({
        ...income,
        amount: Number(income.amount),
      })),
    );
  }, []);

  async function loadIncomes(month = selectedMonth) {
    setIsLoading(true);
    setMessage("");

    const { data, error } = await fetchIncomes(month);

    if (error) {
      setMessage("No se pudieron cargar los ingresos.");
      setIsLoading(false);
      return;
    }

    applyIncomeRows((data ?? []) as Income[]);
    setIsLoading(false);
  }

  useEffect(() => {
    let shouldIgnore = false;

    fetchIncomes(selectedMonth).then(({ data, error }) => {
      if (shouldIgnore) {
        return;
      }

      if (error) {
        setMessage("No se pudieron cargar los ingresos.");
        setIsLoading(false);
        return;
      }

      applyIncomeRows((data ?? []) as Income[]);
      setIsLoading(false);
    });

    return () => {
      shouldIgnore = true;
    };
  }, [applyIncomeRows, fetchIncomes, selectedMonth]);

  useEffect(() => {
    let shouldIgnore = false;

    supabase
      .from("income_categories")
      .select("id, name, color")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (shouldIgnore || error) {
          return;
        }

        setIncomeCategories((data ?? []) as IncomeCategory[]);
      });

    return () => {
      shouldIgnore = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    const parsedAmount = parseMoneyInput(amount);
    const cleanConcept = concept.trim();
    const cleanNote = note.trim();

    if (!cleanConcept) {
      setMessage("Escribe un concepto para identificar el ingreso.");
      setIsSaving(false);
      return;
    }

    if (!parsedAmount || parsedAmount <= 0) {
      setMessage("Escribe un monto mayor a cero.");
      setIsSaving(false);
      return;
    }

    if (date > today) {
      setMessage("No se pueden registrar ingresos en fechas futuras.");
      setIsSaving(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      setMessage("No se pudo validar la sesión actual.");
      setIsSaving(false);
      return;
    }

    const incomePayload = {
      amount: parsedAmount,
      concept: cleanConcept,
      income_category_id: incomeCategoryId || null,
      income_date: date,
      note: cleanNote || null,
    };

    const { error } = editingIncomeId
      ? await supabase
          .from("incomes")
          .update(incomePayload)
          .eq("id", editingIncomeId)
      : await supabase.from("incomes").insert({
          ...incomePayload,
          user_id: userId,
        });

    if (error) {
      setMessage("No se pudo guardar el ingreso.");
      setIsSaving(false);
      return;
    }

    setConcept("");
    setIncomeCategoryId("");
    setAmount("");
    setNote("");
    setEditingIncomeId(null);
    setIsFormOpen(false);
    setSelectedMonth(date.slice(0, 7));
    setMessage(
      editingIncomeId
        ? "Ingreso actualizado correctamente."
        : "Ingreso guardado correctamente.",
    );
    setIsSaving(false);
    await loadIncomes(date.slice(0, 7));
  }

  async function deleteIncome(income: Income) {
    const { error } = await supabase
      .from("incomes")
      .delete()
      .eq("id", income.id);

    if (error) {
      setMessage("No se pudo eliminar el ingreso.");
      return;
    }

    setIncomes((current) => current.filter((item) => item.id !== income.id));
    setIncomeToDelete(null);
  }

  function handleEdit(income: Income) {
    setIsFormOpen(true);
    setEditingIncomeId(income.id);
    setDate(income.income_date);
    setConcept(income.concept);
    setIncomeCategoryId(income.income_category_id ?? "");
    setAmount(String(income.amount));
    setNote(income.note ?? "");
    setMessage("Editando ingreso seleccionado.");
    window.setTimeout(() => {
      formSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function cancelEdit() {
    setEditingIncomeId(null);
    setDate(getTodayDateInput());
    setConcept("");
    setIncomeCategoryId("");
    setAmount("");
    setNote("");
    setMessage("");
    setIsFormOpen(false);
  }

  function toggleForm() {
    if (isFormOpen && editingIncomeId) {
      cancelEdit();
      return;
    }

    setIsFormOpen((current) => !current);
  }

  function renderIncomeRow(income: Income) {
    const category = income.income_category_id
      ? incomeCategories.find((item) => item.id === income.income_category_id)
      : null;

    return (
      <div
        key={income.id}
        className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-[120px_1fr_130px_88px] sm:items-center"
      >
        <span className="text-neutral-400">
          {formatDate(income.income_date)}
        </span>
        <div>
          <p className="font-medium text-white">{income.concept}</p>
          <p className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: category?.color ?? "#6b7280" }}
            />
            {category?.name ?? "Sin categoría"}
          </p>
          {income.note ? (
            <p className="mt-1 text-xs text-neutral-500">{income.note}</p>
          ) : null}
        </div>
        <span className="font-semibold text-emerald-200 sm:text-right">
          {formatCurrency(income.amount)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleEdit(income)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-neutral-400 transition hover:border-emerald-300/40 hover:bg-emerald-300/10 hover:text-emerald-200"
            aria-label={`Editar ingreso ${income.concept}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setIncomeToDelete(income)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-neutral-400 transition hover:border-red-300/40 hover:bg-red-300/10 hover:text-red-200"
            aria-label={`Eliminar ingreso ${income.concept}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section
        ref={formSectionRef}
        className="entry-card entry-card-income scroll-mt-6 rounded-2xl border p-5 shadow-xl shadow-black/20"
      >
        <div className={isFormOpen || message ? "mb-6" : ""}>
          <BrandedSectionHeading
            title={editingIncomeId ? "Editar ingreso" : "Nuevo ingreso"}
            description="Captura rápida: fecha, concepto y monto."
            trailing={
              <button
                type="button"
                onClick={toggleForm}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold text-neutral-200 transition hover:border-emerald-300/40 hover:bg-emerald-300/10 hover:text-emerald-100"
                aria-expanded={isFormOpen}
              >
                {isFormOpen ? "Ocultar" : "Abrir"}
                {isFormOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            }
          />
        </div>

        {message ? (
          <p className="mb-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-neutral-200">
            {message}
          </p>
        ) : null}

        {isFormOpen ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-neutral-300">
                Fecha
              </span>
              <div className="mt-2 flex gap-2">
                <input
                  ref={dateInputRef}
                  type="date"
                  value={date}
                  max={today}
                  onChange={(event) => setDate(event.target.value)}
                  required
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => dateInputRef.current?.showPicker?.()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/35 text-neutral-300 transition hover:border-emerald-300/60 hover:text-emerald-200"
                  aria-label="Abrir calendario"
                >
                  <CalendarDays className="h-4 w-4" />
                </button>
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-neutral-300">
                Categoría de ingreso
              </span>
              <select
                value={incomeCategoryId}
                onChange={(event) => {
                  const nextCategoryId = event.target.value;
                  const nextCategory = incomeCategories.find(
                    (item) => item.id === nextCategoryId,
                  );
                  setIncomeCategoryId(nextCategoryId);
                  setConcept((current) => current || nextCategory?.name || "");
                }}
                className={`${inputClass} mt-2`}
              >
                <option value="">Sin categoría</option>
                {incomeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-neutral-300">
                Concepto
              </span>
              <input
                type="text"
                list="income-concepts"
                value={concept}
                onChange={(event) => setConcept(event.target.value)}
                placeholder="Selecciona o escribe un concepto"
                required
                className={`${inputClass} mt-2`}
              />
              <datalist id="income-concepts">
                {incomeConcepts.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-neutral-300">
                Monto
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                required
                className={`${inputClass} mt-2 text-lg font-semibold`}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-neutral-300">
                Nota opcional
              </span>
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Detalle corto"
                className={`${inputClass} mt-2`}
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={isSaving}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-bold text-neutral-950 shadow-lg shadow-emerald-950/40 transition hover:-translate-y-0.5 hover:bg-emerald-200 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {isSaving
                  ? "Guardando..."
                  : editingIncomeId
                    ? "Guardar cambios"
                    : "Guardar ingreso"}
              </button>
              {editingIncomeId ? (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex h-12 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-semibold text-neutral-200 transition hover:border-white/20 hover:bg-white/[0.04]"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20">
        <div className="mb-6 flex flex-col gap-4">
          <BrandedSectionHeading
            title="Ingresos registrados"
            description="Consulta movimientos por mes, fecha, monto o gráfica."
            trailing={
              <div className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3">
                <p className="text-xs text-emerald-100">Total del mes</p>
                <p className="mt-1 text-lg font-semibold text-emerald-200">
                  {formatCurrency(total)}
                </p>
              </div>
            }
          />

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Mes
              </span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(event) => {
                  setIsLoading(true);
                  setSelectedMonth(event.target.value);
                }}
                className={`${inputClass} mt-2 max-w-[220px]`}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {viewOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setViewMode(option.value)}
                  className={`h-10 rounded-lg border px-3 text-sm font-medium transition ${
                    viewMode === option.value
                      ? "border-emerald-300/30 bg-emerald-300 text-neutral-950"
                      : "border-white/10 bg-black/20 text-neutral-300 hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <p className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-neutral-300">
            Cargando ingresos...
          </p>
        ) : incomes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
            <p className="text-lg font-semibold text-white">
              Aún no hay ingresos en este mes.
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              Agrega un ingreso o cambia el mes consultado.
            </p>
            <button
              type="button"
              onClick={() => {
                setMessage("");
                setIsFormOpen(true);
              }}
              className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-bold text-neutral-950 transition hover:-translate-y-0.5 hover:bg-emerald-200"
            >
              <Plus className="h-4 w-4" />
              Registrar ingreso
            </button>
          </div>
        ) : viewMode === "chart" ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Gráfica mensual
                </h3>
                <p className="mt-1 text-sm text-neutral-400">
                  Días con ingresos registrados.
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
                <BarChart3 className="h-5 w-5" />
              </div>
            </div>

            <div className="space-y-4">
              {chartData.entries.map((entry) => (
                <div key={entry.incomeDate}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-neutral-300">Día {entry.day}</span>
                    <span className="font-semibold text-white">
                      {formatCurrency(entry.total)}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-neutral-800">
                    <div
                      className="h-3 rounded-full bg-emerald-300"
                      style={{
                        width: `${chartData.max ? (entry.total / chartData.max) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {chartData.topDay ? (
              <p className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
                Día con mayor ingreso: {formatDate(chartData.topDay.incomeDate)}{" "}
                · {formatCurrency(chartData.topDay.total)}
              </p>
            ) : null}
          </div>
        ) : viewMode === "date" ? (
          <div className="space-y-4">
            {groupedByDate.map((group) => (
              <div
                key={group.incomeDate}
                className="overflow-hidden rounded-2xl border border-white/10"
              >
                <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/30 px-4 py-3">
                  <h3 className="font-semibold text-white">
                    {formatDate(group.incomeDate)}
                  </h3>
                  <span className="text-sm font-semibold text-emerald-200">
                    {formatCurrency(group.total)}
                  </span>
                </div>
                <div className="divide-y divide-white/10">
                  {group.items.map((income) => renderIncomeRow(income))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="hidden grid-cols-[120px_1fr_130px_88px] gap-3 border-b border-white/10 bg-black/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 sm:grid">
              <span>Fecha</span>
              <span>Concepto</span>
              <span className="text-right">Monto</span>
              <span />
            </div>
            <div className="divide-y divide-white/10">
              {displayedIncomes.map((income) => renderIncomeRow(income))}
            </div>
          </div>
        )}
      </section>

      {incomeToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-white">
                  Confirmar eliminación
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-400">
                  Este ingreso se eliminará de la lista y ya no contará en los
                  reportes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIncomeToDelete(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-neutral-400 transition hover:bg-white/[0.04] hover:text-white"
                aria-label="Cerrar confirmación"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4">
              <p className="font-semibold text-white">
                {incomeToDelete.concept}
              </p>
              <p className="mt-1 text-sm text-neutral-400">
                {formatCurrency(incomeToDelete.amount)} ·{" "}
                {formatDate(incomeToDelete.income_date)}
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setIncomeToDelete(null)}
                className="flex h-11 flex-1 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-semibold text-neutral-200 transition hover:border-white/20 hover:bg-white/[0.04]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deleteIncome(incomeToDelete)}
                className="flex h-11 flex-1 items-center justify-center rounded-lg bg-red-300 px-4 text-sm font-bold text-red-950 transition hover:-translate-y-0.5 hover:bg-red-200"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
