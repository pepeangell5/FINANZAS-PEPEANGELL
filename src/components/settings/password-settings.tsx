"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { SettingsSection } from "@/components/settings/settings-section";

const inputClass =
  "mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-pink-300/70 focus:ring-2 focus:ring-pink-300/15";

export function PasswordSettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    if (!currentPassword) {
      setMessage("Escribe tu contraseña actual.");
      setIsSaving(false);
      return;
    }

    if (password.length < 6) {
      setMessage("La contraseña debe tener mínimo 6 caracteres.");
      setIsSaving(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      setIsSaving(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user.email;

    if (!email) {
      setMessage("No se pudo validar la sesión actual.");
      setIsSaving(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      setMessage("La contraseña actual no es correcta.");
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage("No se pudo actualizar la contraseña.");
      setIsSaving(false);
      return;
    }

    setCurrentPassword("");
    setPassword("");
    setConfirmPassword("");
    setMessage("Contraseña actualizada correctamente.");
    setIsSaving(false);
  }

  return (
    <SettingsSection
      description="Por seguridad, confirma tu contraseña actual antes de cambiarla."
      icon={<LockKeyhole className="h-5 w-5" />}
      title="Cambiar contraseña"
    >
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-neutral-300">
            Contraseña actual
          </span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Escribe tu contraseña actual"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-neutral-300">
            Nueva contraseña
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
            minLength={6}
            required
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-neutral-300">
            Confirmar contraseña
          </span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repite la contraseña"
            autoComplete="new-password"
            minLength={6}
            required
            className={inputClass}
          />
        </label>

        {message ? (
          <p className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-neutral-200 md:col-span-2">
            {message}
          </p>
        ) : null}

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={isSaving}
            className="h-11 rounded-lg bg-pink-300 px-5 text-sm font-bold text-neutral-950 shadow-lg shadow-pink-950/40 transition hover:-translate-y-0.5 hover:bg-pink-200 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Guardando..." : "Guardar contraseña"}
          </button>
        </div>
      </form>
    </SettingsSection>
  );
}
