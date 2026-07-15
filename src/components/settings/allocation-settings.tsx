"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { SettingsSection } from "@/components/settings/settings-section";
import { normalizeSpanishLabel } from "@/lib/text/spanish-labels";

type AllocationBucket = {
  id: string;
  name: string;
  percentage: number;
  color: string;
  sort_order: number;
};

const defaultBuckets = [
  { name: "Ahorro", percentage: 25, color: "#22c55e", sort_order: 1 },
  { name: "Reinversión", percentage: 15, color: "#16a34a", sort_order: 2 },
  {
    name: "Operación del negocio",
    percentage: 10,
    color: "#15803d",
    sort_order: 3,
  },
  {
    name: "Gastos fijos personales",
    percentage: 30,
    color: "#6b7280",
    sort_order: 4,
  },
  {
    name: "Gastos personales",
    percentage: 15,
    color: "#9ca3af",
    sort_order: 5,
  },
  {
    name: "Oportunidad / Imprevistos",
    percentage: 5,
    color: "#84cc16",
    sort_order: 6,
  },
];

export function AllocationSettings() {
  const [buckets, setBuckets] = useState<AllocationBucket[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const totalPercentage = useMemo(
    () =>
      buckets.reduce(
        (total, bucket) => total + Number(bucket.percentage || 0),
        0,
      ),
    [buckets],
  );

  const totalDifference = Number((100 - totalPercentage).toFixed(2));
  const canSave = buckets.length > 0 && Math.abs(totalDifference) < 0.01;

  useEffect(() => {
    async function createDefaultBuckets(userId: string) {
      const { error } = await supabase.from("allocation_buckets").upsert(
        defaultBuckets.map((bucket) => ({
          ...bucket,
          user_id: userId,
        })),
        { onConflict: "user_id,name" },
      );

      if (error) {
        throw error;
      }
    }

    async function loadBuckets() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("allocation_buckets")
        .select("id, name, percentage, color, sort_order")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Error loading allocation buckets", error);
        setMessage("No se pudieron cargar los porcentajes. Intenta recargar la página.");
        setIsLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        try {
          await createDefaultBuckets(userId);

          const { data: seededData, error: seededError } = await supabase
            .from("allocation_buckets")
            .select("id, name, percentage, color, sort_order")
            .eq("user_id", userId)
            .order("sort_order", { ascending: true });

          if (seededError) {
            throw seededError;
          }

          setBuckets(
            (seededData ?? []).map((bucket) => ({
              ...bucket,
              percentage: Number(bucket.percentage),
            })),
          );
        } catch (seedError) {
          console.error("Error creating allocation buckets", seedError);
          setMessage("No se pudieron crear los porcentajes iniciales.");
        }

        setIsLoading(false);
        return;
      }

      setBuckets(
        data.map((bucket) => ({
          ...bucket,
          percentage: Number(bucket.percentage),
        })),
      );

      setIsLoading(false);
    }

    loadBuckets();
  }, []);

  function handlePercentageChange(
    bucketId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const parsedValue = Number(event.target.value.trim().replace(",", "."));
    const value = Number.isFinite(parsedValue)
      ? Math.min(Math.max(parsedValue, 0), 100)
      : 0;

    setBuckets((currentBuckets) =>
      currentBuckets.map((bucket) =>
        bucket.id === bucketId ? { ...bucket, percentage: value } : bucket,
      ),
    );
  }

  async function handleSave() {
    setIsSaving(true);
    setMessage("");

    if (!canSave) {
      setMessage("Los porcentajes deben sumar 100% antes de guardar.");
      setIsSaving(false);
      return;
    }

    for (const bucket of buckets) {
      const { error } = await supabase
        .from("allocation_buckets")
        .update({ percentage: bucket.percentage })
        .eq("id", bucket.id);

      if (error) {
        setMessage("No se pudieron guardar los cambios.");
        setIsSaving(false);
        return;
      }
    }

    setMessage("Porcentajes guardados correctamente.");
    setIsSaving(false);
  }

  if (isLoading) {
    return (
      <SettingsSection
        description="Ajusta cómo se divide cada ingreso. La suma debe quedar en 100%."
        icon={<SlidersHorizontal className="h-5 w-5" />}
        title="Porcentajes de distribución"
      >
        <p className="text-sm text-neutral-300">Cargando porcentajes...</p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      description="Ajusta cómo se divide cada ingreso. La suma debe quedar en 100%."
      icon={<SlidersHorizontal className="h-5 w-5" />}
      title="Porcentajes de distribución"
      trailing={
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
            canSave
              ? "border-pink-300/25 bg-pink-300/10 text-pink-200"
              : "border-yellow-300/25 bg-yellow-300/10 text-yellow-100"
          }`}
        >
          Total: {totalPercentage.toFixed(2)}%
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div>
        <div className="space-y-3">
          {buckets.map((bucket) => (
            <div
              key={bucket.id}
              className="grid gap-3 rounded-xl border border-white/10 bg-black/25 p-4 sm:grid-cols-[1fr_150px]"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: bucket.color }}
                />
                <div>
                  <p className="font-medium text-white">
                    {normalizeSpanishLabel(bucket.name)}
                  </p>
                  <p className="text-sm text-neutral-500">
                    Disponible para reportes visuales
                  </p>
                </div>
              </div>

              <label className="block">
                <span className="sr-only">
                  Porcentaje de {normalizeSpanishLabel(bucket.name)}
                </span>
                <div className="flex h-11 items-center rounded-lg border border-white/10 bg-neutral-950/70 px-3 focus-within:border-pink-300/70 focus-within:ring-2 focus-within:ring-pink-300/15">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={bucket.percentage}
                    onChange={(event) =>
                      handlePercentageChange(bucket.id, event)
                    }
                    className="w-full bg-transparent text-right text-sm text-white outline-none"
                  />
                  <span className="ml-2 text-sm text-neutral-400">%</span>
                </div>
              </label>
            </div>
          ))}
        </div>

        {message ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-neutral-200">
            {message}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-500">
            {canSave
              ? "Listo para guardar."
              : `Ajusta ${Math.abs(totalDifference).toFixed(2)}% para llegar a 100%.`}
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="h-11 rounded-lg bg-pink-300 px-5 text-sm font-bold text-neutral-950 shadow-lg shadow-pink-950/40 transition hover:-translate-y-0.5 hover:bg-pink-200 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
        </div>

      <aside className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl shadow-black/20">
        <h3 className="text-base font-semibold text-white">Resumen</h3>
        <div className="mt-5 space-y-4">
          {buckets.map((bucket) => (
            <div key={bucket.id}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-neutral-300">
                  {normalizeSpanishLabel(bucket.name)}
                </span>
                <span className="font-medium text-white">
                  {Number(bucket.percentage).toFixed(2)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-neutral-800">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.min(Number(bucket.percentage), 100)}%`,
                    backgroundColor: bucket.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
    </SettingsSection>
  );
}
