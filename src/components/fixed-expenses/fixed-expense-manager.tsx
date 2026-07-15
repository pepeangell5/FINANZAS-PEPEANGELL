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
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  ClockAlert,
  Pencil,
  Plus,
  ReceiptText,
  Repeat2,
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

type FixedExpense = {
  id: string;
  category_id: string | null;
  concept: string;
  amount: number;
  due_date: string;
  expense_id: string | null;
  is_recurring: boolean;
  note: string | null;
  paid_at: string | null;
  recurring_parent_id: string | null;
  status: "pending" | "paid";
};

type FixedExpenseRow = Omit<
  FixedExpense,
  "amount" | "is_recurring" | "recurring_parent_id"
> & {
  amount: number | string;
  is_recurring?: boolean | null;
  recurring_parent_id?: string | null;
};

type ViewMode = "all" | "pending" | "overdue" | "paid";

type PendingConfirmation = {
  action: "delete" | "mark-paid" | "reopen";
  payment: FixedExpense;
} | null;

const inputClass =
  "h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/15";

const basePaymentSelect =
  "id, category_id, concept, amount, due_date, expense_id, note, paid_at, status";

const recurringPaymentSelect = `${basePaymentSelect}, is_recurring, recurring_parent_id`;

const paymentConcepts = [
  "Renta",
  "Luz",
  "Agua",
  "Internet",
  "Nómina",
  "Tarjeta de crédito",
  "Préstamo",
  "Proveedor",
  "Suscripción",
  "Otro pago",
];

const viewOptions: Array<{ label: string; value: ViewMode }> = [
  { label: "Todos", value: "all" },
  { label: "Pendientes", value: "pending" },
  { label: "Atrasados", value: "overdue" },
  { label: "Pagados", value: "paid" },
];

function getDayDifference(dueDate: string, today: string) {
  const due = new Date(`${dueDate}T00:00:00`).getTime();
  const current = new Date(`${today}T00:00:00`).getTime();

  return Math.round((due - current) / 86_400_000);
}

function getPaymentStatus(payment: FixedExpense, today: string) {
  if (payment.status === "paid") {
    return {
      className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
      label: "Pagado",
      tone: "paid",
    };
  }

  const days = getDayDifference(payment.due_date, today);

  if (days < 0) {
    const count = Math.abs(days);

    return {
      className: "border-red-400/35 bg-red-500/15 text-red-100",
      label: `-${count} ${count === 1 ? "día" : "días"} atrasado`,
      tone: "overdue",
    };
  }

  if (days === 0) {
    return {
      className: "border-red-400/35 bg-red-500/15 text-red-100",
      label: "Vence hoy",
      tone: "today",
    };
  }

  if (days <= 3) {
    return {
      className: "border-yellow-300/35 bg-yellow-300/15 text-yellow-100",
      label: `Faltan ${days} ${days === 1 ? "día" : "días"}`,
      tone: "warning",
    };
  }

  return {
    className: "border-white/10 bg-white/[0.04] text-neutral-200",
    label: `Faltan ${days} días`,
    tone: "pending",
  };
}

function sortPayments(items: FixedExpense[], today: string) {
  return [...items].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "pending" ? -1 : 1;
    }

    const aDays = getDayDifference(a.due_date, today);
    const bDays = getDayDifference(b.due_date, today);

    return aDays - bDays;
  });
}

function buildGeneratedExpenseNote(note: string | null) {
  const suffix = "Generado desde pagos pendientes.";
  const cleanNote = note?.trim();

  return cleanNote ? `${cleanNote} | ${suffix}` : suffix;
}

function getNextMonthlyDueDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const nextMonth = new Date(year, month, 1);
  const lastDay = new Date(
    nextMonth.getFullYear(),
    nextMonth.getMonth() + 1,
    0,
  ).getDate();

  nextMonth.setDate(Math.min(day, lastDay));

  return formatDateInput(nextMonth);
}

function isMissingRecurringColumnsError(message: string) {
  return (
    message.includes("is_recurring") ||
    message.includes("recurring_parent_id")
  );
}

export function FixedExpenseManager() {
  const dueDateInputRef = useRef<HTMLInputElement>(null);
  const paidDateInputRef = useRef<HTMLInputElement>(null);
  const [payments, setPayments] = useState<FixedExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dueDate, setDueDate] = useState(getTodayDateInput());
  const [paidDate, setPaidDate] = useState(getTodayDateInput());
  const [isRecurring, setIsRecurring] = useState(false);
  const [note, setNote] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("pending");
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<PendingConfirmation>(null);
  const [confirmationError, setConfirmationError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [hasRecurringColumns, setHasRecurringColumns] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const today = getTodayDateInput();

  const categoryById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category]));
  }, [categories]);

  const summary = useMemo(() => {
    return payments.reduce(
      (result, payment) => {
        if (payment.status === "paid") {
          result.paid += 1;
          result.paidTotal += payment.amount;
          return result;
        }

        const days = getDayDifference(payment.due_date, today);

        result.pending += 1;
        result.pendingTotal += payment.amount;

        if (payment.is_recurring) {
          result.recurring += 1;
          result.recurringTotal += payment.amount;
        }

        if (days < 0) {
          result.overdue += 1;
          result.overdueTotal += payment.amount;
        } else if (days <= 3) {
          result.warning += 1;
          result.warningTotal += payment.amount;
        }

        return result;
      },
      {
        overdue: 0,
        overdueTotal: 0,
        paid: 0,
        paidTotal: 0,
        pending: 0,
        pendingTotal: 0,
        recurring: 0,
        recurringTotal: 0,
        warning: 0,
        warningTotal: 0,
      },
    );
  }, [payments, today]);

  const displayedPayments = useMemo(() => {
    const sorted = sortPayments(payments, today);

    if (viewMode === "pending") {
      return sorted.filter((payment) => payment.status === "pending");
    }

    if (viewMode === "paid") {
      return sorted.filter((payment) => payment.status === "paid");
    }

    if (viewMode === "overdue") {
      return sorted.filter(
        (payment) =>
          payment.status === "pending" &&
          getDayDifference(payment.due_date, today) < 0,
      );
    }

    return sorted;
  }, [payments, today, viewMode]);

  const fetchData = useCallback(async () => {
    const [paymentsResult, categoriesResult] = await Promise.all([
      supabase
        .from("fixed_expenses")
        .select(recurringPaymentSelect)
        .order("due_date", { ascending: true }),
      supabase.from("categories").select("id, name, color").order("name"),
    ]);

    if (
      paymentsResult.error &&
      isMissingRecurringColumnsError(paymentsResult.error.message)
    ) {
      const fallbackPaymentsResult = await supabase
        .from("fixed_expenses")
        .select(basePaymentSelect)
        .order("due_date", { ascending: true });

      return {
        categoriesData: (categoriesResult.data ?? []) as Category[],
        hasRecurringColumns: false,
        paymentsData: (fallbackPaymentsResult.data ?? []) as FixedExpenseRow[],
        paymentsError: fallbackPaymentsResult.error?.message ?? null,
      };
    }

    return {
      categoriesData: (categoriesResult.data ?? []) as Category[],
      hasRecurringColumns: true,
      paymentsData: (paymentsResult.data ?? []) as FixedExpenseRow[],
      paymentsError: paymentsResult.error?.message ?? null,
    };
  }, []);

  const applyData = useCallback(
    (paymentsData: FixedExpenseRow[] | null, categoriesData: Category[]) => {
      setPayments(
        (paymentsData ?? []).map((payment) => ({
          ...payment,
          amount: Number(payment.amount),
          is_recurring: Boolean(payment.is_recurring),
          recurring_parent_id: payment.recurring_parent_id ?? null,
        })),
      );
      setCategories(categoriesData);
    },
    [],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    const result = await fetchData();
    setHasRecurringColumns(result.hasRecurringColumns);

    if (result.paymentsError) {
      setCategories(result.categoriesData);
      setMessage("No se pudieron cargar los pagos pendientes.");
      setIsLoading(false);
      return;
    }

    applyData(result.paymentsData, result.categoriesData);
    if (!result.hasRecurringColumns) {
      setMessage("Los pagos se cargaron. Falta correr el SQL mensual en Supabase.");
    }
    setIsLoading(false);
  }, [applyData, fetchData]);

  useEffect(() => {
    let shouldIgnore = false;

    fetchData().then((result) => {
      if (shouldIgnore) {
        return;
      }

      setHasRecurringColumns(result.hasRecurringColumns);

      if (result.paymentsError) {
        setCategories(result.categoriesData);
        setMessage("No se pudieron cargar los pagos pendientes.");
        setIsLoading(false);
        return;
      }

      applyData(result.paymentsData, result.categoriesData);
      if (!result.hasRecurringColumns) {
        setMessage(
          "Los pagos se cargaron. Falta correr el SQL mensual en Supabase.",
        );
      }
      setIsLoading(false);
    });

    return () => {
      shouldIgnore = true;
    };
  }, [applyData, fetchData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    const parsedAmount = parseMoneyInput(amount);
    const cleanConcept = concept.trim();
    const cleanNote = note.trim();

    if (!cleanConcept) {
      setMessage("Escribe un concepto para identificar el pago.");
      setIsSaving(false);
      return;
    }

    if (!parsedAmount || parsedAmount <= 0) {
      setMessage("Escribe un monto mayor a cero.");
      setIsSaving(false);
      return;
    }

    if (!dueDate) {
      setMessage("Selecciona la fecha de pago.");
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

    const paymentPayload = {
      amount: parsedAmount,
      category_id: categoryId || null,
      concept: cleanConcept,
      due_date: dueDate,
      note: cleanNote || null,
    };

    const recurringPaymentPayload = hasRecurringColumns
      ? {
          ...paymentPayload,
          is_recurring: isRecurring,
        }
      : paymentPayload;

    const { error } = editingPaymentId
      ? await supabase
          .from("fixed_expenses")
          .update(recurringPaymentPayload)
          .eq("id", editingPaymentId)
      : await supabase.from("fixed_expenses").insert({
          ...recurringPaymentPayload,
          status: "pending",
          user_id: userId,
        });

    if (error) {
      setMessage("No se pudo guardar el pago pendiente.");
      setIsSaving(false);
      return;
    }

    const currentPayment = payments.find(
      (payment) => payment.id === editingPaymentId,
    );

    if (currentPayment?.expense_id) {
      const { error: expenseError } = await supabase
        .from("expenses")
        .update({
          amount: parsedAmount,
          category_id: categoryId || null,
          concept: cleanConcept,
          note: buildGeneratedExpenseNote(cleanNote),
        })
        .eq("id", currentPayment.expense_id);

      if (expenseError) {
        setMessage(
          "El pago se guardó, pero no se pudo actualizar el gasto ligado.",
        );
        setIsSaving(false);
        await loadData();
        return;
      }
    }

    cancelEdit();
    setIsFormOpen(false);
    setMessage(
      editingPaymentId
        ? "Pago pendiente actualizado correctamente."
        : "Pago pendiente guardado correctamente.",
    );
    setIsSaving(false);
    await loadData();
  }

  function handleEdit(payment: FixedExpense) {
    setIsFormOpen(true);
    setEditingPaymentId(payment.id);
    setConcept(payment.concept);
    setAmount(String(payment.amount));
    setCategoryId(payment.category_id ?? "");
    setDueDate(payment.due_date);
    setIsRecurring(hasRecurringColumns ? payment.is_recurring : false);
    setNote(payment.note ?? "");
    setMessage("Editando pago pendiente seleccionado.");
  }

  function cancelEdit() {
    setEditingPaymentId(null);
    setConcept("");
    setAmount("");
    setCategoryId("");
    setDueDate(getTodayDateInput());
    setIsRecurring(false);
    setNote("");
    setIsFormOpen(false);
  }

  function toggleForm() {
    if (isFormOpen && editingPaymentId) {
      cancelEdit();
      return;
    }

    setIsFormOpen((current) => !current);
  }

  function requestDelete(payment: FixedExpense) {
    setConfirmationError("");
    setConfirmation({ action: "delete", payment });
  }

  function requestPaidChange(payment: FixedExpense) {
    setConfirmationError("");
    setPaidDate(getTodayDateInput());
    setConfirmation({
      action: payment.status === "paid" ? "reopen" : "mark-paid",
      payment,
    });
  }

  function closeConfirmation() {
    setConfirmation(null);
    setConfirmationError("");
    setPaidDate(getTodayDateInput());
  }

  async function deletePayment(payment: FixedExpense) {
    if (payment.expense_id) {
      const { error: deleteExpenseError } = await supabase
        .from("expenses")
        .delete()
        .eq("id", payment.expense_id);

      if (deleteExpenseError) {
        setMessage("No se pudo eliminar el gasto ligado a este pago.");
        return;
      }
    }

    const { error } = await supabase
      .from("fixed_expenses")
      .delete()
      .eq("id", payment.id);

    if (error) {
      setMessage("No se pudo eliminar el pago pendiente.");
      return;
    }

    setPayments((current) => current.filter((item) => item.id !== payment.id));
    setMessage(
      payment.expense_id
        ? "Pago pendiente y gasto ligado eliminados."
        : "Pago pendiente eliminado.",
    );
  }

  async function handleConfirmedAction() {
    if (!confirmation) {
      return;
    }

    const { action, payment } = confirmation;

    if (action === "delete") {
      closeConfirmation();
      await deletePayment(payment);
      return;
    }

    if (action === "mark-paid") {
      if (!paidDate) {
        setConfirmationError("Selecciona la fecha real de pago.");
        return;
      }

      if (paidDate > today) {
        setConfirmationError("La fecha de pago no puede ser futura.");
        return;
      }

      closeConfirmation();
      await togglePaid(payment, paidDate);
      return;
    }

    closeConfirmation();
    await togglePaid(payment);
  }

  async function togglePaid(payment: FixedExpense, selectedPaidDate = today) {
    const nextStatus = payment.status === "paid" ? "pending" : "paid";

    if (nextStatus === "paid") {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        setMessage("No se pudo validar la sesión actual.");
        return;
      }

      const { data: expenseData, error: expenseError } = await supabase
        .from("expenses")
        .insert({
          amount: payment.amount,
          category_id: payment.category_id,
          concept: payment.concept,
          expense_date: selectedPaidDate,
          note: buildGeneratedExpenseNote(payment.note),
          user_id: userId,
        })
        .select("id")
        .single();

      if (expenseError || !expenseData?.id) {
        setMessage("No se pudo registrar este pago como gasto.");
        return;
      }

      const { error } = await supabase
        .from("fixed_expenses")
        .update({
          expense_id: expenseData.id,
          paid_at: selectedPaidDate,
          status: "paid",
        })
        .eq("id", payment.id);

      if (error) {
        await supabase.from("expenses").delete().eq("id", expenseData.id);
        setMessage("No se pudo actualizar el estado del pago.");
        return;
      }

      let nextPaymentCreated = false;

      if (payment.is_recurring && hasRecurringColumns) {
        const nextDueDate = getNextMonthlyDueDate(payment.due_date);
        const { data: existingNextPayment } = await supabase
          .from("fixed_expenses")
          .select("id")
          .eq("recurring_parent_id", payment.id)
          .eq("status", "pending")
          .maybeSingle();

        if (!existingNextPayment?.id) {
          const { error: recurringError } = await supabase
            .from("fixed_expenses")
            .insert({
              amount: payment.amount,
              category_id: payment.category_id,
              concept: payment.concept,
              due_date: nextDueDate,
              is_recurring: true,
              note: payment.note,
              recurring_parent_id: payment.id,
              status: "pending",
              user_id: userId,
            });

          if (recurringError) {
            setMessage(
              "El pago se marcó como pagado, pero no se pudo preparar el siguiente mes.",
            );
            await loadData();
            return;
          }

          nextPaymentCreated = true;
        }
      }

      await loadData();
      setMessage(
        nextPaymentCreated
          ? "Pago marcado como pagado y siguiente mes preparado."
          : "Pago marcado como pagado y registrado en gastos.",
      );
      return;
    }

    if (payment.is_recurring && hasRecurringColumns) {
      const { error: childDeleteError } = await supabase
        .from("fixed_expenses")
        .delete()
        .eq("recurring_parent_id", payment.id)
        .eq("status", "pending");

      if (childDeleteError) {
        setMessage("No se pudo retirar el pago generado del siguiente mes.");
        return;
      }
    }

    const { error } = await supabase
      .from("fixed_expenses")
      .update({
        expense_id: null,
        paid_at: null,
        status: "pending",
      })
      .eq("id", payment.id);

    if (error) {
      setMessage("No se pudo reabrir el pago.");
      return;
    }

    if (payment.expense_id) {
      const { error: deleteExpenseError } = await supabase
        .from("expenses")
        .delete()
        .eq("id", payment.expense_id);

      if (deleteExpenseError) {
        await supabase
          .from("fixed_expenses")
          .update({
            expense_id: payment.expense_id,
            paid_at: payment.paid_at,
            status: "paid",
          })
          .eq("id", payment.id);
        setMessage("No se pudo quitar el gasto ligado a este pago.");
        return;
      }
    }

    await loadData();
    setMessage("Pago reabierto y gasto ligado retirado.");
  }

  function renderPaymentCard(payment: FixedExpense) {
    const category = payment.category_id
      ? (categoryById.get(payment.category_id) ?? null)
      : null;
    const paymentStatus = getPaymentStatus(payment, today);

    return (
      <div
        key={payment.id}
        className={`rounded-2xl border p-4 transition ${
          paymentStatus.tone === "overdue" || paymentStatus.tone === "today"
            ? "border-red-400/25 bg-red-500/[0.06]"
            : "border-white/10 bg-black/20"
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-white">
                {payment.concept}
              </h3>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${paymentStatus.className}`}
              >
                {paymentStatus.label}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-sm text-neutral-400">
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                Pago: {formatDate(payment.due_date)}
              </span>
              {category ? (
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {normalizeSpanishLabel(category.name)}
                </span>
              ) : null}
              {payment.paid_at ? (
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-emerald-100">
                  Pagado el {formatDate(payment.paid_at)}
                </span>
              ) : null}
              {payment.is_recurring ? (
                <span className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-emerald-100">
                  <Repeat2 className="h-3.5 w-3.5" />
                  Mensual
                </span>
              ) : null}
            </div>

            {payment.note ? (
              <p className="mt-3 text-sm text-neutral-400">{payment.note}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <p className="text-2xl font-bold text-white">
              {formatCurrency(payment.amount)}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => requestPaidChange(payment)}
                className={`flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
                  payment.status === "paid"
                    ? "border-white/10 text-neutral-300 hover:bg-white/[0.04]"
                    : "border-emerald-300/30 bg-emerald-300 text-neutral-950 hover:bg-emerald-200"
                }`}
              >
                <Check className="h-4 w-4" />
                {payment.status === "paid" ? "Reabrir" : "Marcar pagado"}
              </button>
              <button
                type="button"
                onClick={() => handleEdit(payment)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-neutral-400 transition hover:border-emerald-300/40 hover:bg-emerald-300/10 hover:text-emerald-200"
                aria-label={`Editar pago ${payment.concept}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => requestDelete(payment)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-neutral-400 transition hover:border-red-300/40 hover:bg-red-300/10 hover:text-red-200"
                aria-label={`Eliminar pago ${payment.concept}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20">
        <div className={isFormOpen || message ? "mb-6" : ""}>
          <BrandedSectionHeading
            title={editingPaymentId ? "Editar pago" : "Nuevo pago pendiente"}
            description="Registra deudas, servicios o compromisos con fecha de pago."
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
                Concepto
              </span>
              <input
                type="text"
                list="fixed-payment-concepts"
                value={concept}
                onChange={(event) => setConcept(event.target.value)}
                placeholder="Ej. Tarjeta, renta, proveedor"
                required
                className={`${inputClass} mt-2`}
              />
              <datalist id="fixed-payment-concepts">
                {paymentConcepts.map((item) => (
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
                Fecha de pago
              </span>
              <div className="mt-2 flex gap-2">
                <input
                  ref={dueDateInputRef}
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  required
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => dueDateInputRef.current?.showPicker?.()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/35 text-neutral-300 transition hover:border-emerald-300/60 hover:text-emerald-200"
                  aria-label="Abrir calendario"
                >
                  <CalendarDays className="h-4 w-4" />
                </button>
              </div>
            </label>

            {hasRecurringColumns ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/25 p-4 transition hover:border-emerald-300/30 hover:bg-emerald-300/[0.04]">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(event) => setIsRecurring(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-emerald-300"
                />
                <span>
                  <span className="block text-sm font-semibold text-white">
                    Repetir cada mes
                  </span>
                  <span className="mt-1 block text-sm text-neutral-400">
                    Al marcarlo pagado, se preparará automáticamente el pago del
                    siguiente mes.
                  </span>
                </span>
              </label>
            ) : (
              <p className="rounded-xl border border-yellow-300/20 bg-yellow-300/10 px-4 py-3 text-sm text-yellow-100">
                Para activar pagos mensuales, primero corre el SQL mensual en
                Supabase. Los pagos normales seguirán funcionando.
              </p>
            )}

            <label className="block">
              <span className="text-sm font-medium text-neutral-300">
                Categoría opcional
              </span>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className={`${inputClass} mt-2`}
              >
                <option value="">Sin categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {normalizeSpanishLabel(category.name)}
                  </option>
                ))}
              </select>
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
                  : editingPaymentId
                    ? "Guardar cambios"
                    : "Guardar pago"}
              </button>
              {editingPaymentId ? (
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

      <section className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <button
            type="button"
            onClick={() => setViewMode("pending")}
            className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
              viewMode === "pending"
                ? "border-emerald-300/30 bg-emerald-300/10"
                : "border-white/10 bg-white/[0.035]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-neutral-400">Pendiente total</p>
              <ReceiptText className="h-5 w-5 text-emerald-200" />
            </div>
            <p className="mt-3 text-2xl font-bold text-white">
              {formatCurrency(summary.pendingTotal)}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {summary.pending} pagos abiertos
            </p>
            <p className="mt-3 text-xs font-semibold text-emerald-100">
              Ver pendientes
            </p>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("paid")}
            className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
              viewMode === "paid"
                ? "border-emerald-300/30 bg-emerald-300/10"
                : "border-white/10 bg-white/[0.035]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-neutral-400">Pagado total</p>
              <Check className="h-5 w-5 text-emerald-200" />
            </div>
            <p className="mt-3 text-2xl font-bold text-white">
              {formatCurrency(summary.paidTotal)}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {summary.paid} pagos cubiertos
            </p>
            <p className="mt-3 text-xs font-semibold text-emerald-100">
              Ver pagados
            </p>
          </button>

          <div className="rounded-2xl border border-yellow-300/25 bg-yellow-300/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-yellow-100">Próximos</p>
              <CalendarClock className="h-5 w-5 text-yellow-100" />
            </div>
            <p className="mt-3 text-2xl font-bold text-yellow-50">
              {summary.warning}
            </p>
            <p className="mt-1 text-sm text-yellow-100/75">
              {formatCurrency(summary.warningTotal)}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-emerald-100">Mensuales</p>
              <Repeat2 className="h-5 w-5 text-emerald-100" />
            </div>
            <p className="mt-3 text-2xl font-bold text-emerald-50">
              {summary.recurring}
            </p>
            <p className="mt-1 text-sm text-emerald-100/75">
              {formatCurrency(summary.recurringTotal)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setViewMode("overdue")}
            className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
              viewMode === "overdue"
                ? "border-red-300/40 bg-red-500/15"
                : "border-red-400/25 bg-red-500/10"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-red-100">Atrasados</p>
              <ClockAlert className="h-5 w-5 text-red-100" />
            </div>
            <p className="mt-3 text-2xl font-bold text-red-50">
              {summary.overdue}
            </p>
            <p className="mt-1 text-sm text-red-100/75">
              {formatCurrency(summary.overdueTotal)}
            </p>
            <p className="mt-3 text-xs font-semibold text-red-100">
              Ver atrasados
            </p>
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20">
          <div className="mb-6 flex flex-col gap-4">
            <BrandedSectionHeading
              title="Pagos registrados"
              description="Semáforo automático: amarillo cuando se acerca, rojo cuando vence o se atrasa."
            />

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

          {isLoading ? (
            <p className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-neutral-300">
              Cargando pagos pendientes...
            </p>
          ) : displayedPayments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
              <p className="text-lg font-semibold text-white">
                No hay pagos en esta vista.
              </p>
              <p className="mt-2 text-sm text-neutral-400">
                {viewMode === "paid"
                  ? "Aún no hay pagos marcados como pagados."
                  : "Agrega un pago pendiente o cambia el filtro."}
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
                Registrar pago pendiente
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedPayments.map((payment) => renderPaymentCard(payment))}
            </div>
          )}
        </div>
      </section>

      {confirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-white">
                  {confirmation.action === "delete"
                    ? "Confirmar eliminación"
                    : confirmation.action === "reopen"
                      ? "Confirmar reapertura"
                      : "Confirmar pago"}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-400">
                  {confirmation.action === "delete"
                    ? confirmation.payment.expense_id
                      ? "Este pago ya fue cubierto. Al eliminarlo también se eliminará el gasto ligado."
                      : "Este pago pendiente se eliminará de la lista."
                    : confirmation.action === "reopen"
                      ? "Este pago volverá a quedar pendiente y se retirará el gasto ligado."
                      : "Este pago se marcará como pagado y se registrará como gasto en la fecha que selecciones."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeConfirmation}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-neutral-400 transition hover:bg-white/[0.04] hover:text-white"
                aria-label="Cerrar confirmación"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4">
              <p className="font-semibold text-white">
                {confirmation.payment.concept}
              </p>
              <p className="mt-1 text-sm text-neutral-400">
                {formatCurrency(confirmation.payment.amount)} · Pago:{" "}
                {formatDate(confirmation.payment.due_date)}
              </p>
            </div>

            {confirmation.action === "mark-paid" ? (
              <label className="mt-5 block">
                <span className="text-sm font-medium text-neutral-300">
                  Fecha real de pago
                </span>
                <div className="mt-2 flex gap-2">
                  <input
                    ref={paidDateInputRef}
                    type="date"
                    value={paidDate}
                    max={today}
                    onChange={(event) => {
                      setPaidDate(event.target.value);
                      setConfirmationError("");
                    }}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => paidDateInputRef.current?.showPicker?.()}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/35 text-neutral-300 transition hover:border-emerald-300/60 hover:text-emerald-200"
                    aria-label="Abrir calendario de fecha real de pago"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </button>
                </div>
                {confirmationError ? (
                  <span className="mt-2 block text-sm text-red-200">
                    {confirmationError}
                  </span>
                ) : (
                  <span className="mt-2 block text-xs text-neutral-500">
                    Usa la fecha en que realmente se pagó.
                  </span>
                )}
              </label>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={closeConfirmation}
                className="flex h-11 flex-1 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-semibold text-neutral-200 transition hover:border-white/20 hover:bg-white/[0.04]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmedAction}
                className={`flex h-11 flex-1 items-center justify-center rounded-lg px-4 text-sm font-bold transition hover:-translate-y-0.5 ${
                  confirmation.action === "delete"
                    ? "bg-red-300 text-red-950 hover:bg-red-200"
                    : "bg-emerald-300 text-neutral-950 hover:bg-emerald-200"
                }`}
              >
                {confirmation.action === "delete"
                  ? "Sí, eliminar"
                  : confirmation.action === "reopen"
                    ? "Sí, reabrir"
                    : "Sí, marcar pagado"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
