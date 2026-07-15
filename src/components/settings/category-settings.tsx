"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Save, Tags, Trash2 } from "lucide-react";
import { SettingsSection } from "@/components/settings/settings-section";
import { supabase } from "@/lib/supabase/client";
import { normalizeSpanishLabel } from "@/lib/text/spanish-labels";

type AllocationBucket = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

type Category = {
  id: string;
  allocation_bucket_id: string | null;
  name: string;
  color: string;
};

type SettingsResult = {
  buckets: AllocationBucket[];
  categories: Category[];
  error: boolean;
};

const inputClass =
  "h-11 w-full rounded-lg border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-pink-300/70 focus:ring-2 focus:ring-pink-300/15";

async function fetchCategorySettings(): Promise<SettingsResult> {
  const [bucketResult, categoryResult] = await Promise.all([
    supabase
      .from("allocation_buckets")
      .select("id, name, color, sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("categories")
      .select("id, allocation_bucket_id, name, color")
      .order("name", { ascending: true }),
  ]);

  return {
    buckets: (bucketResult.data ?? []) as AllocationBucket[],
    categories: (categoryResult.data ?? []) as Category[],
    error: Boolean(bucketResult.error || categoryResult.error),
  };
}

export function CategorySettings() {
  const [buckets, setBuckets] = useState<AllocationBucket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [newBucketId, setNewBucketId] = useState("");
  const [newColor, setNewColor] = useState("#22c55e");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const bucketById = useMemo(() => {
    return new Map(buckets.map((bucket) => [bucket.id, bucket]));
  }, [buckets]);

  const applySettings = useCallback((result: SettingsResult) => {
    if (result.error) {
      setMessage("No se pudieron cargar las categorías.");
      setIsLoading(false);
      return;
    }

    setBuckets(result.buckets);
    setCategories(result.categories);

    if (result.buckets[0]) {
      setNewBucketId((current) => current || result.buckets[0].id);
      setNewColor((current) => current || result.buckets[0].color);
    }

    setIsLoading(false);
  }, []);

  async function reloadSettings(showLoading = true) {
    if (showLoading) {
      setIsLoading(true);
    }

    setMessage("");
    applySettings(await fetchCategorySettings());
  }

  useEffect(() => {
    let shouldIgnore = false;

    fetchCategorySettings().then((result) => {
      if (!shouldIgnore) {
        applySettings(result);
      }
    });

    return () => {
      shouldIgnore = true;
    };
  }, [applySettings]);

  function updateCategory(categoryId: string, changes: Partial<Category>) {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId ? { ...category, ...changes } : category,
      ),
    );
  }

  function handleNewBucketChange(bucketId: string) {
    const bucket = bucketById.get(bucketId);

    setNewBucketId(bucketId);

    if (bucket) {
      setNewColor(bucket.color);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    const cleanName = newName.trim();

    if (!cleanName) {
      setMessage("Escribe el nombre de la categoría.");
      setIsSaving(false);
      return;
    }

    if (!newBucketId) {
      setMessage("Selecciona la bolsa de distribución.");
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

    const { error } = await supabase.from("categories").insert({
      allocation_bucket_id: newBucketId,
      color: newColor,
      name: cleanName,
      user_id: userId,
    });

    if (error) {
      setMessage("No se pudo crear la categoría. Revisa si ya existe.");
      setIsSaving(false);
      return;
    }

    setNewName("");
    setMessage("Categoría creada correctamente.");
    setIsSaving(false);
    await reloadSettings(false);
  }

  async function handleSave(category: Category) {
    const cleanName = category.name.trim();

    if (!cleanName) {
      setMessage("El nombre de la categoría no puede quedar vacío.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("categories")
      .update({
        allocation_bucket_id: category.allocation_bucket_id,
        color: category.color,
        name: cleanName,
      })
      .eq("id", category.id);

    if (error) {
      setMessage("No se pudo guardar la categoría.");
      setIsSaving(false);
      return;
    }

    setMessage("Categoría guardada correctamente.");
    setIsSaving(false);
    await reloadSettings(false);
  }

  async function handleDelete(categoryId: string) {
    setIsSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryId);

    if (error) {
      setMessage("No se pudo eliminar la categoría.");
      setIsSaving(false);
      return;
    }

    setMessage("Categoría eliminada. Los gastos anteriores quedarán sin categoría.");
    setIsSaving(false);
    await reloadSettings(false);
  }

  if (isLoading) {
    return (
      <SettingsSection
        description="Crea y organiza categorías para clasificar los gastos."
        icon={<Tags className="h-5 w-5" />}
        title="Categorías de gastos"
      >
        <p className="text-sm text-neutral-300">Cargando categorías...</p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      description="Crea y organiza categorías para clasificar los gastos."
      icon={<Tags className="h-5 w-5" />}
      title="Categorías de gastos"
      trailing={
        <div className="rounded-xl border border-pink-300/25 bg-pink-300/10 px-4 py-3 text-sm font-semibold text-pink-200">
          {categories.length} categorías
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-white/10 bg-black/20 p-5"
        >
          <h3 className="text-base font-semibold text-white">
            Nueva categoría
          </h3>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-neutral-300">
                Nombre
              </span>
              <input
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Ej. Gasolina"
                className={`${inputClass} mt-2`}
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-neutral-300">
                Bolsa
              </span>
              <select
                value={newBucketId}
                onChange={(event) => handleNewBucketChange(event.target.value)}
                className={`${inputClass} mt-2`}
                required
              >
                {buckets.map((bucket) => (
                  <option key={bucket.id} value={bucket.id}>
                    {normalizeSpanishLabel(bucket.name)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-neutral-300">
                Color
              </span>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="color"
                  value={newColor}
                  onChange={(event) => setNewColor(event.target.value)}
                  className="h-11 w-14 rounded-lg border border-white/10 bg-black/35 p-1"
                  aria-label="Color de categoría"
                />
                <span className="text-sm text-neutral-400">{newColor}</span>
              </div>
            </label>

            <button
              type="submit"
              disabled={isSaving || buckets.length === 0}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-pink-300 px-4 text-sm font-bold text-neutral-950 shadow-lg shadow-pink-950/40 transition hover:-translate-y-0.5 hover:bg-pink-200 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Crear categoría
            </button>
          </div>
        </form>

        <div className="space-y-3">
          {categories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-neutral-300">
              Aún no hay categorías. Crea una para empezar a clasificar gastos.
            </div>
          ) : (
            categories.map((category) => {
              const bucket = category.allocation_bucket_id
                ? bucketById.get(category.allocation_bucket_id)
                : null;

              return (
                <div
                  key={category.id}
                  className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 lg:grid-cols-[1fr_220px_120px_104px]"
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
                      Bolsa
                    </span>
                    <select
                      value={category.allocation_bucket_id ?? ""}
                      onChange={(event) => {
                        const nextBucket = bucketById.get(event.target.value);

                        updateCategory(category.id, {
                          allocation_bucket_id: event.target.value,
                          color: nextBucket?.color ?? category.color,
                        });
                      }}
                      className={`${inputClass} mt-2`}
                    >
                      {buckets.map((item) => (
                        <option key={item.id} value={item.id}>
                          {normalizeSpanishLabel(item.name)}
                        </option>
                      ))}
                    </select>
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
                          updateCategory(category.id, {
                            color: event.target.value,
                          })
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
                      onClick={() => handleSave(category)}
                      disabled={isSaving}
                      className="flex h-11 flex-1 items-center justify-center rounded-lg border border-pink-300/25 bg-pink-300/10 text-pink-100 transition hover:border-pink-300/50 hover:bg-pink-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Guardar ${category.name}`}
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(category.id)}
                      disabled={isSaving}
                      className="flex h-11 flex-1 items-center justify-center rounded-lg border border-red-300/20 bg-red-300/10 text-red-100 transition hover:border-red-300/40 hover:bg-red-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Eliminar ${category.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-xs text-neutral-500 lg:col-span-4">
                    Se descuenta de:{" "}
                    {bucket ? normalizeSpanishLabel(bucket.name) : "Sin bolsa"}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {message ? (
        <p className="mt-5 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-neutral-200">
          {message}
        </p>
      ) : null}
    </SettingsSection>
  );
}
