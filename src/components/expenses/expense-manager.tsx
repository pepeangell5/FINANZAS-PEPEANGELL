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
import {
  formatCurrency,
  formatDate,
  formatDateInput,
  getTodayDateInput,
} from "@/lib/format";
import { parseMoneyInput } from "@/lib/money";
import { supabase } from "@/lib/supabase/client";
import { normalizeSpanishLabel } from "@/lib/text/spanish-labels";

type Category = {
  id: string;
  name: string;
  color: string;
};

type Expense = {
  id: string;
  expense_date: string;
  category_id: string | null;
  concept: string;
  amount: number;
  note: string | null;
  payment_method_id: string | null;
};

type PaymentMethod = {
  id: string;
  name: string;
};

type ViewMode = "recent" | "date" | "high" | "low" | "category" | "chart";

const inputClass =
  "h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/15";

const expenseConcepts = [
  "Gasto en efectivo",
  "Renta",
  "Comida",
  "Gasolina",
  "Medicina",
  "Ahorro",
  "Luz",
  "Agua",
  "Internet",
  "Nómina",
  "Proveedor",
  "Publicidad",
  "Materiales",
  "Otro gasto",
];

const defaultCategories = [
  { name: "Operación del negocio", color: "#15803d" },
  { name: "Gastos fijos personales", color: "#6b7280" },
  { name: "Gastos personales", color: "#9ca3af" },
  { name: "Oportunidad / Imprevistos", color: "#84cc16" },
  { name: "Reinversión", color: "#16a34a" },
];

const viewOptions: Array<{ label: string; value: ViewMode }> = [
  { label: "Recientes", value: "recent" },
  { label: "Por fecha", value: "date" },
  { label: "Mayor a menor", value: "high" },
  { label: "Menor a mayor", value: "low" },
  { label: "Por categoría", value: "category" },
  { label: "Gráfica", value: "chart" },
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

function sortByDateDesc(items: Expense[]) {
  return [...items].sort((a, b) => {
    const dateComparison = b.expense_date.localeCompare(a.expense_date);

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return b.id.localeCompare(a.id);
  });
}

export function ExpenseManager() {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const formSectionRef = useRef<HTMLElement>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [date, setDate] = useState(getTodayDateInput());
  const [concept, setConcept] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthInput());
  const [viewMode, setViewMode] = useState<ViewMode>("recent");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const today = getTodayDateInput();

  const categoryById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category]));
  }, [categories]);

  const total = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.amount), 0),
    [expenses],
  );

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const categoryMatches =
        !categoryFilter ||
        (categoryFilter === "sin-categoria"
          ? !expense.category_id
          : expense.category_id === categoryFilter);
      const paymentMethodMatches =
        !paymentMethodFilter ||
        (paymentMethodFilter === "sin-metodo"
          ? !expense.payment_method_id
          : expense.payment_method_id === paymentMethodFilter);

      return categoryMatches && paymentMethodMatches;
    });
  }, [categoryFilter, expenses, paymentMethodFilter]);

  const displayedExpenses = useMemo(() => {
    if (viewMode === "high") {
      return [...filteredExpenses].sort((a, b) => b.amount - a.amount);
    }

    if (viewMode === "low") {
      return [...filteredExpenses].sort((a, b) => a.amount - b.amount);
    }

    return sortByDateDesc(filteredExpenses);
  }, [filteredExpenses, viewMode]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, Expense[]>();

    for (const expense of sortByDateDesc(filteredExpenses)) {
      const group = groups.get(expense.expense_date) ?? [];
      group.push(expense);
      groups.set(expense.expense_date, group);
    }

    return Array.from(groups.entries()).map(([expenseDate, items]) => ({
      expenseDate,
      items,
      total: items.reduce((sum, expense) => sum + expense.amount, 0),
    }));
  }, [filteredExpenses]);

  const groupedByCategory = useMemo(() => {
    const groups = new Map<
      string,
      { category: Category | null; items: Expense[]; total: number }
    >();

    for (const expense of filteredExpenses) {
      const category = expense.category_id
        ? (categoryById.get(expense.category_id) ?? null)
        : null;
      const key = category?.id ?? "sin-categoria";
      const group = groups.get(key) ?? { category, items: [], total: 0 };

      group.items.push(expense);
      group.total += expense.amount;
      groups.set(key, group);
    }

    return Array.from(groups.values()).sort((a, b) => b.total - a.total);
  }, [categoryById, filteredExpenses]);

  const chartData = useMemo(() => {
    const max = Math.max(...groupedByCategory.map((group) => group.total), 0);

    return { entries: groupedByCategory, max };
  }, [groupedByCategory]);

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, color")
      .order("name", { ascending: true });

    return { data, error };
  }, []);

  const ensureCategories = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      return [];
    }

    const categoriesResult = await fetchCategories();

    if (categoriesResult.error) {
      return [];
    }

    if ((categoriesResult.data ?? []).length > 0) {
      return (categoriesResult.data ?? []) as Category[];
    }

    await supabase.from("categories").upsert(
      defaultCategories.map((category) => ({
        ...category,
        user_id: userId,
      })),
      { onConflict: "user_id,name" },
    );

    const refreshedResult = await fetchCategories();

    return (refreshedResult.data ?? []) as Category[];
  }, [fetchCategories]);

  const fetchExpenses = useCallback(async (month: string) => {
    const { start, end } = getMonthRange(month);
    const { data, error } = await supabase
      .from("expenses")
      .select("id, expense_date, category_id, payment_method_id, concept, amount, note")
      .gte("expense_date", start)
      .lte("expense_date", end)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    return { data, error };
  }, []);

  const applyExpenseRows = useCallback((rows: Expense[]) => {
    setExpenses(
      rows.map((expense) => ({
        ...expense,
        amount: Number(expense.amount),
      })),
    );
  }, []);

  async function loadExpenses(month = selectedMonth) {
    setIsLoading(true);
    setMessage("");

    const [{ data, error }, loadedCategories] = await Promise.all([
      fetchExpenses(month),
      ensureCategories(),
    ]);

    setCategories(loadedCategories);

    if (loadedCategories[0]) {
      setCategoryId((current) => current || loadedCategories[0].id);
    }

    if (error) {
      setMessage("No se pudieron cargar los gastos.");
      setIsLoading(false);
      return;
    }

    applyExpenseRows((data ?? []) as Expense[]);
    setIsLoading(false);
  }

  useEffect(() => {
    let shouldIgnore = false;

    Promise.all([fetchExpenses(selectedMonth), ensureCategories()]).then(
      ([expensesResult, loadedCategories]) => {
        if (shouldIgnore) {
          return;
        }

        setCategories(loadedCategories);

        if (loadedCategories[0]) {
          setCategoryId((current) => current || loadedCategories[0].id);
        }

        if (expensesResult.error) {
          setMessage("No se pudieron cargar los gastos.");
          setIsLoading(false);
          return;
        }

        applyExpenseRows((expensesResult.data ?? []) as Expense[]);
        setIsLoading(false);
      },
    );

    return () => {
      shouldIgnore = true;
    };
  }, [applyExpenseRows, ensureCategories, fetchExpenses, selectedMonth]);

  useEffect(() => {
    let shouldIgnore = false;

    supabase
      .from("payment_methods")
      .select("id, name")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (shouldIgnore || error) {
          return;
        }

        const methods = (data ?? []) as PaymentMethod[];
        setPaymentMethods(methods);
        setPaymentMethodId((current) => current || methods[0]?.id || "");
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
      setMessage("Escribe un concepto para identificar el gasto.");
      setIsSaving(false);
      return;
    }

    if (!categoryId) {
      setMessage("Selecciona una categoría.");
      setIsSaving(false);
      return;
    }

    if (!paymentMethodId) {
      setMessage("Selecciona cómo pagaste este gasto.");
      setIsSaving(false);
      return;
    }

    if (!parsedAmount || parsedAmount <= 0) {
      setMessage("Escribe un monto mayor a cero.");
      setIsSaving(false);
      return;
    }

    if (date > today) {
      setMessage("No se pueden registrar gastos en fechas futuras.");
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

    const expensePayload = {
      amount: parsedAmount,
      category_id: categoryId,
      concept: cleanConcept,
      expense_date: date,
      note: cleanNote || null,
      payment_method_id: paymentMethodId,
    };

    const { error } = editingExpenseId
      ? await supabase
          .from("expenses")
          .update(expensePayload)
          .eq("id", editingExpenseId)
      : await supabase.from("expenses").insert({
          ...expensePayload,
          user_id: userId,
        });

    if (error) {
      setMessage("No se pudo guardar el gasto.");
      setIsSaving(false);
      return;
    }

    setConcept("");
    setAmount("");
    setNote("");
    setPaymentMethodId(paymentMethods[0]?.id ?? "");
    setEditingExpenseId(null);
    setIsFormOpen(false);
    setSelectedMonth(date.slice(0, 7));
    setMessage(
      editingExpenseId
        ? "Gasto actualizado correctamente."
        : "Gasto guardado correctamente.",
    );
    setIsSaving(false);
    await loadExpenses(date.slice(0, 7));
  }

  async function deleteExpense(expense: Expense) {
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expense.id);

    if (error) {
      setMessage("No se pudo eliminar el gasto.");
      return;
    }

    setExpenses((current) => current.filter((item) => item.id !== expense.id));
    setExpenseToDelete(null);
  }

  function handleEdit(expense: Expense) {
    setIsFormOpen(true);
    setEditingExpenseId(expense.id);
    setDate(expense.expense_date);
    setCategoryId(expense.category_id ?? "");
    setPaymentMethodId(expense.payment_method_id ?? paymentMethods[0]?.id ?? "");
    setConcept(expense.concept);
    setAmount(String(expense.amount));
    setNote(expense.note ?? "");
    setMessage("Editando gasto seleccionado.");
    window.setTimeout(() => {
      formSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function cancelEdit() {
    setEditingExpenseId(null);
    setDate(getTodayDateInput());
    setCategoryId((current) => current || categories[0]?.id || "");
    setPaymentMethodId(paymentMethods[0]?.id ?? "");
    setConcept("");
    setAmount("");
    setNote("");
    setMessage("");
    setIsFormOpen(false);
  }

  function toggleForm() {
    if (isFormOpen && editingExpenseId) {
      cancelEdit();
      return;
    }

    setIsFormOpen((current) => !current);
  }

  function getCategory(expense: Expense) {
    if (!expense.category_id) {
      return null;
    }

    return categoryById.get(expense.category_id) ?? null;
  }

  function renderExpenseRow(expense: Expense) {
    const category = getCategory(expense);
    const paymentMethod = expense.payment_method_id
      ? paymentMethods.find((item) => item.id === expense.payment_method_id)
      : null;

    return (
      <div
        key={expense.id}
        className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-[120px_1fr_140px_130px_88px] sm:items-center"
      >
        <span className="text-neutral-400">
          {formatDate(expense.expense_date)}
        </span>
        <div>
          <p className="font-medium text-white">{expense.concept}</p>
          <p className="mt-1 text-xs text-neutral-500">
            Método: {paymentMethod?.name ?? "Sin método"}
          </p>
          {expense.note ? (
            <p className="mt-1 text-xs text-neutral-500">{expense.note}</p>
          ) : null}
        </div>
        <span className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-neutral-300">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: category?.color ?? "#6b7280" }}
          />
          {normalizeSpanishLabel(category?.name ?? "Sin categoría")}
        </span>
        <span className="font-semibold text-red-100 sm:text-right">
          {formatCurrency(expense.amount)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleEdit(expense)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-neutral-400 transition hover:border-emerald-300/40 hover:bg-emerald-300/10 hover:text-emerald-200"
            aria-label={`Editar gasto ${expense.concept}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setExpenseToDelete(expense)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-neutral-400 transition hover:border-red-300/40 hover:bg-red-300/10 hover:text-red-200"
            aria-label={`Eliminar gasto ${expense.concept}`}
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
        className="entry-card entry-card-expense scroll-mt-6 rounded-2xl border p-5 shadow-xl shadow-black/20"
      >
        <div className={isFormOpen || message ? "mb-6" : ""}>
          <BrandedSectionHeading
            title={editingExpenseId ? "Editar gasto" : "Nuevo gasto"}
            description="Captura rápida: fecha, categoría, concepto y monto."
            trailing={
              <button
                type="button"
                onClick={toggleForm}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-red-300/50 px-3 text-sm font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-100 hover:text-red-800"
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
                Categoría
              </span>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
                className={`${inputClass} mt-2`}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {normalizeSpanishLabel(category.name)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-neutral-300">
                Método de pago
              </span>
              <select
                value={paymentMethodId}
                onChange={(event) => setPaymentMethodId(event.target.value)}
                required
                className={`${inputClass} mt-2`}
              >
                <option value="">Selecciona un método</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
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
                list="expense-concepts"
                value={concept}
                onChange={(event) => setConcept(event.target.value)}
                placeholder="Selecciona o escribe un concepto"
                required
                className={`${inputClass} mt-2`}
              />
              <datalist id="expense-concepts">
                {expenseConcepts.map((item) => (
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
                disabled={isSaving || categories.length === 0}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-bold text-neutral-950 shadow-lg shadow-emerald-950/40 transition hover:-translate-y-0.5 hover:bg-emerald-200 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {isSaving
                  ? "Guardando..."
                  : editingExpenseId
                    ? "Guardar cambios"
                    : "Guardar gasto"}
              </button>
              {editingExpenseId ? (
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
            title="Gastos registrados"
            description="Consulta movimientos por mes, fecha, monto, categoría o gráfica."
            trailing={
              <div className="rounded-xl border border-red-300/25 bg-red-300/10 px-4 py-3">
                <p className="text-xs text-red-100">Total del mes</p>
                <p className="mt-1 text-lg font-semibold text-red-100">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Filtrar categoría
              </span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className={`${inputClass} mt-2`}
              >
                <option value="">Todas las categorías</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {normalizeSpanishLabel(category.name)}
                  </option>
                ))}
                <option value="sin-categoria">Sin categoría</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Filtrar método
              </span>
              <select
                value={paymentMethodFilter}
                onChange={(event) => setPaymentMethodFilter(event.target.value)}
                className={`${inputClass} mt-2`}
              >
                <option value="">Todos los métodos</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
                <option value="sin-metodo">Sin método</option>
              </select>
            </label>
          </div>
        </div>

        {isLoading ? (
          <p className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-neutral-300">
            Cargando gastos...
          </p>
        ) : expenses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
            <p className="text-lg font-semibold text-white">
              Aún no hay gastos en este mes.
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              Agrega un gasto o cambia el mes consultado.
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
              Registrar gasto
            </button>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-sm text-neutral-300">
            No hay gastos que coincidan con los filtros seleccionados.
          </p>
        ) : viewMode === "chart" ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="mb-6 flex items-center justify-between gap-4">
              <BrandedSectionHeading
                title="Gráfica por categoría"
                description="Categorías con más gasto en el mes."
                trailing={
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-300/25 bg-red-300/10 text-red-100">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                }
              />
            </div>

            <div className="space-y-4">
              {chartData.entries.map((entry) => (
                <div key={entry.category?.id ?? "sin-categoria"}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-neutral-300">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: entry.category?.color ?? "#6b7280",
                        }}
                      />
                      {normalizeSpanishLabel(
                        entry.category?.name ?? "Sin categoría",
                      )}
                    </span>
                    <span className="font-semibold text-white">
                      {formatCurrency(entry.total)}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-neutral-800">
                    <div
                      className="h-3 rounded-full"
                      style={{
                        backgroundColor: entry.category?.color ?? "#ef4444",
                        width: `${chartData.max ? (entry.total / chartData.max) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : viewMode === "date" ? (
          <div className="space-y-4">
            {groupedByDate.map((group) => (
              <div
                key={group.expenseDate}
                className="overflow-hidden rounded-2xl border border-white/10"
              >
                <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/30 px-4 py-3">
                  <h3 className="font-semibold text-white">
                    {formatDate(group.expenseDate)}
                  </h3>
                  <span className="text-sm font-semibold text-red-100">
                    {formatCurrency(group.total)}
                  </span>
                </div>
                <div className="divide-y divide-white/10">
                  {group.items.map((expense) => renderExpenseRow(expense))}
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === "category" ? (
          <div className="space-y-4">
            {groupedByCategory.map((group) => (
              <div
                key={group.category?.id ?? "sin-categoria"}
                className="overflow-hidden rounded-2xl border border-white/10"
              >
                <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/30 px-4 py-3">
                  <h3 className="flex items-center gap-2 font-semibold text-white">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: group.category?.color ?? "#6b7280",
                      }}
                    />
                    {normalizeSpanishLabel(
                      group.category?.name ?? "Sin categoría",
                    )}
                  </h3>
                  <span className="text-sm font-semibold text-red-100">
                    {formatCurrency(group.total)}
                  </span>
                </div>
                <div className="divide-y divide-white/10">
                  {sortByDateDesc(group.items).map((expense) =>
                    renderExpenseRow(expense),
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="hidden grid-cols-[120px_1fr_140px_130px_88px] gap-3 border-b border-white/10 bg-black/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 sm:grid">
              <span>Fecha</span>
              <span>Concepto</span>
              <span>Categoría</span>
              <span className="text-right">Monto</span>
              <span />
            </div>
            <div className="divide-y divide-white/10">
              {displayedExpenses.map((expense) => renderExpenseRow(expense))}
            </div>
          </div>
        )}
      </section>

      {expenseToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-white">
                  Confirmar eliminación
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-400">
                  Este gasto se eliminará de la lista y ya no contará en los
                  reportes. Si proviene de un pago pendiente, también se
                  eliminará ese pago asociado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-neutral-400 transition hover:bg-white/[0.04] hover:text-white"
                aria-label="Cerrar confirmación"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4">
              <p className="font-semibold text-white">
                {expenseToDelete.concept}
              </p>
              <p className="mt-1 text-sm text-neutral-400">
                {formatCurrency(expenseToDelete.amount)} ·{" "}
                {formatDate(expenseToDelete.expense_date)}
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="flex h-11 flex-1 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-semibold text-neutral-200 transition hover:border-white/20 hover:bg-white/[0.04]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deleteExpense(expenseToDelete)}
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
