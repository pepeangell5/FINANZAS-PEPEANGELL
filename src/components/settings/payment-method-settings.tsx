"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CreditCard, Plus, Save, Trash2 } from "lucide-react";
import { SettingsSection } from "@/components/settings/settings-section";
import { supabase } from "@/lib/supabase/client";

type PaymentMethod = {
  id: string;
  name: string;
};

const inputClass =
  "h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-pink-300/70 focus:ring-2 focus:ring-pink-300/15";

export function PaymentMethodSettings() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadMethods = useCallback(async () => {
    const { data, error } = await supabase
      .from("payment_methods")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      setMessage("No se pudieron cargar los métodos de pago.");
      setIsLoading(false);
      return;
    }

    setMethods((data ?? []) as PaymentMethod[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadMethods();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadMethods]);

  function updateMethod(methodId: string, name: string) {
    setMethods((current) =>
      current.map((method) =>
        method.id === methodId ? { ...method, name } : method,
      ),
    );
  }

  async function createMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();

    if (!name) {
      setMessage("Escribe el nombre del método de pago.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      setMessage("No se pudo validar la sesión actual.");
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.from("payment_methods").insert({
      name,
      user_id: userId,
    });

    if (error) {
      setMessage("No se pudo crear el método. Revisa si ya existe.");
      setIsSaving(false);
      return;
    }

    setNewName("");
    setMessage("Método de pago creado correctamente.");
    setIsSaving(false);
    await loadMethods();
  }

  async function saveMethod(method: PaymentMethod) {
    const name = method.name.trim();

    if (!name) {
      setMessage("El nombre del método no puede quedar vacío.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    const { error } = await supabase
      .from("payment_methods")
      .update({ name })
      .eq("id", method.id);

    setIsSaving(false);
    setMessage(
      error
        ? "No se pudo guardar el método de pago."
        : "Método de pago guardado correctamente.",
    );

    if (!error) {
      await loadMethods();
    }
  }

  async function deleteMethod(methodId: string) {
    setIsSaving(true);
    setMessage("");
    const { error } = await supabase
      .from("payment_methods")
      .delete()
      .eq("id", methodId);

    setIsSaving(false);
    setMessage(
      error
        ? "No se pudo eliminar el método de pago."
        : "Método eliminado. Los movimientos anteriores quedarán sin método.",
    );

    if (!error) {
      await loadMethods();
    }
  }

  return (
    <SettingsSection
      description="Una sola lista para ingresos, gastos y pagos pendientes."
      icon={<CreditCard className="h-5 w-5" />}
      title="Métodos de pago"
      trailing={
        <div className="rounded-xl border border-pink-300/25 bg-pink-300/10 px-4 py-3 text-sm font-semibold text-pink-200">
          {methods.length} métodos
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-neutral-300">Cargando métodos de pago...</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <form
            onSubmit={createMethod}
            className="rounded-2xl border border-white/10 bg-black/20 p-5"
          >
            <h3 className="text-base font-semibold text-white">Nuevo método</h3>
            <label className="mt-5 block">
              <span className="text-sm font-medium text-neutral-300">Nombre</span>
              <input
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Ej. PayPal"
                className={`${inputClass} mt-2`}
                required
              />
            </label>
            <button
              type="submit"
              disabled={isSaving}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-pink-300 px-4 text-sm font-bold text-neutral-950 transition hover:-translate-y-0.5 hover:bg-pink-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Crear método
            </button>
          </form>

          <div className="space-y-3">
            {methods.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-neutral-300">
                Crea al menos un método para registrar movimientos nuevos.
              </p>
            ) : (
              methods.map((method) => (
                <div
                  key={method.id}
                  className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-[1fr_104px]"
                >
                  <label className="block">
                    <span className="text-xs font-medium uppercase text-neutral-500">Método</span>
                    <input
                      type="text"
                      value={method.name}
                      onChange={(event) => updateMethod(method.id, event.target.value)}
                      className={`${inputClass} mt-2`}
                    />
                  </label>
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => saveMethod(method)}
                      disabled={isSaving}
                      className="flex h-11 flex-1 items-center justify-center rounded-lg border border-pink-300/25 bg-pink-300/10 text-pink-100 transition hover:border-pink-300/50 disabled:opacity-60"
                      aria-label={`Guardar ${method.name}`}
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMethod(method.id)}
                      disabled={isSaving}
                      className="flex h-11 flex-1 items-center justify-center rounded-lg border border-red-300/20 bg-red-300/10 text-red-100 transition hover:border-red-300/40 disabled:opacity-60"
                      aria-label={`Eliminar ${method.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {message ? (
        <p className="mt-5 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-neutral-200">
          {message}
        </p>
      ) : null}
    </SettingsSection>
  );
}
