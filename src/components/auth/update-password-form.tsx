"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, KeyRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const inputClass =
  "mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-pink-300/70 focus:ring-2 focus:ring-pink-300/15";

export function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepareRecoverySession() {
      const code = searchParams.get("code");

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      const { data } = await supabase.auth.getSession();
      setIsReady(Boolean(data.session));
    }

    prepareRecoverySession();
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    if (password.length < 6) {
      setMessage("La contraseña debe tener mínimo 6 caracteres.");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    setMessage("Contraseña actualizada correctamente.");
    setIsLoading(false);

    setTimeout(() => {
      router.replace("/dashboard");
    }, 900);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/80 p-5 shadow-2xl shadow-black/60 backdrop-blur sm:p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white">
          Actualizar acceso
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-400">
          Escribe una contraseña nueva para tu cuenta.
        </p>
      </div>

      {!isReady ? (
        <div className="rounded-xl border border-yellow-300/25 bg-yellow-300/10 px-4 py-3 text-sm leading-6 text-yellow-100">
          Abre esta pantalla desde el enlace que recibiste por correo.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-300">
              <KeyRound className="h-4 w-4 text-pink-300" />
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
            <span className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-300">
              <KeyRound className="h-4 w-4 text-pink-300" />
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
            <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-neutral-200">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-pink-300 px-4 text-sm font-bold text-neutral-950 shadow-lg shadow-pink-950/40 transition hover:-translate-y-0.5 hover:bg-pink-200 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Actualizando..." : "Guardar contraseña"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      )}

      <div className="mt-5 border-t border-white/10 pt-5">
        <Link
          href="/login"
          className="flex h-11 w-full items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-semibold text-neutral-200 transition hover:border-pink-300/50 hover:bg-white/[0.04] hover:text-pink-200"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
