"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus, Save, Tags, Trash2 } from "lucide-react";
import { SettingsSection } from "@/components/settings/settings-section";
import { supabase } from "@/lib/supabase/client";
import { normalizeSpanishLabel } from "@/lib/text/spanish-labels";

type IncomeCategory = {
  color: string;
  id: string;
  name: string;
};

const inputClass =
  "h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-pink-300/70 focus:ring-2 focus:ring-pink-300/15";

export function IncomeCategorySettings() {
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#22c55e");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from("income_categories")
      .select("id, name, color")
      .order("name", { ascending: true });

    if (error) {
      setMessage("No se pudieron cargar las categorías de ingreso.");
      setIsLoading(false);
      return;
    }

    setCategories((data ?? []) as IncomeCategory[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCategories();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadCategories]);

  function updateCategory(categoryId: string, changes: Partial<IncomeCategory>) {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId ? { ...category, ...changes } : category,
      ),
    );
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();

    if (!name) {
      setMessage("Escribe el nombre de la categoría.");
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

    const { error } = await supabase.from("income_categories").insert({
      color: newColor,
      name,
      user_id: userId,
    });

    if (error) {
      setMessage("No se pudo crear la categoría. Revisa si ya existe.");
      setIsSaving(false);
      return;
    }

    setNewName("");
    setMessage("Categoría de ingreso creada correctamente.");
    setIsSaving(false);
    await loadCategories();
  }

  async function saveCategory(category: IncomeCategory) {
    const name = category.name.trim();

    if (!name) {
      setMessage("El nombre de la categoría no puede quedar vacío.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    const { error } = await supabase
      .from("income_categories")
      .update({ color: category.color, name })
      .eq("id", category.id);

    setIsSaving(false);
    setMessage(
      error
        ? "No se pudo guardar la categoría."
        : "Categoría de ingreso guardada correctamente.",
    );

    if (!error) {
      await loadCategories();
    }
  }

  async function deleteCategory(categoryId: string) {
    setIsSaving(true);
    setMessage("");
    const { error } = await supabase
      .from("income_categories")
      .delete()
      .eq("id", categoryId);

    setIsSaving(false);
    setMessage(
      error
        ? "No se pudo eliminar la categoría."
        : "Categoría eliminada. Los ingresos anteriores quedarán sin categoría.",
    );

    if (!error) {
      await loadCategories();
    }
  }

  return (
    <SettingsSection
      description="Crea y organiza las fuentes con las que registras tus ingresos."
      icon={<Tags className="h-5 w-5" />}
      title="Categorías de ingresos"
      trailing={
        <div className="rounded-xl border border-pink-300/25 bg-pink-300/10 px-4 py-3 text-sm font-semibold text-pink-200">
          {categories.length} categorías
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-neutral-300">Cargando categorías...</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <form
            onSubmit={createCategory}
            className="rounded-2xl border border-white/10 bg-black/20 p-5"
          >
            <h3 className="text-base font-semibold text-white">Nueva categoría</h3>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-neutral-300">Nombre</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Ej. Consulta"
                  className={`${inputClass} mt-2`}
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-neutral-300">Color</span>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="color"
                    value={newColor}
                    onChange={(event) => setNewColor(event.target.value)}
                    className="h-11 w-14 rounded-lg border border-white/10 bg-black/35 p-1"
                    aria-label="Color de categoría de ingreso"
                  />
                  <span className="text-sm text-neutral-400">{newColor}</span>
                </div>
              </label>
              <button
                type="submit"
                disabled={isSaving}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-pink-300 px-4 text-sm font-bold text-neutral-950 transition hover:-translate-y-0.5 hover:bg-pink-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Crear categoría
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {categories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-neutral-300">
                Aún no hay categorías de ingresos.
              </div>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id}
                  className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-[1fr_140px_104px]"
                >
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Categoría
                    </span>
                    <input
                      type="text"
                      value={normalizeSpanishLabel(category.name)}
                      onChange={(event) =>
                        updateCategory(category.id, { name: event.target.value })
                      }
                      className={`${inputClass} mt-2`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Color
                    </span>
                    <div className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-black/35 px-2">
                      <input
                        type="color"
                        value={category.color}
                        onChange={(event) =>
                          updateCategory(category.id, { color: event.target.value })
                        }
                        className="h-8 w-10 rounded border border-white/10 bg-transparent"
                        aria-label={`Color de ${category.name}`}
                      />
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                    </div>
                  </label>
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => void saveCategory(category)}
                      disabled={isSaving}
                      className="flex h-11 flex-1 items-center justify-center rounded-lg border border-pink-300/25 bg-pink-300/10 text-pink-100 transition hover:bg-pink-300/15 disabled:opacity-60"
                      aria-label={`Guardar ${category.name}`}
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteCategory(category.id)}
                      disabled={isSaving}
                      className="flex h-11 flex-1 items-center justify-center rounded-lg border border-red-300/20 bg-red-300/10 text-red-100 transition hover:bg-red-300/15 disabled:opacity-60"
                      aria-label={`Eliminar ${category.name}`}
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
