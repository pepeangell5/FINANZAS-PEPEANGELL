"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { withBasePath } from "@/lib/app-path";

type AuthMode = "login" | "reset";

const emailTypoSuggestions: Record<string, string> = {
  "gmail.con": "gmail.com",
  "hotmail.con": "hotmail.com",
  "outlook.con": "outlook.com",
  "yahoo.con": "yahoo.com",
  "icloud.con": "icloud.com",
  "gmail.co": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "hotmai.com": "hotmail.com",
  "hotmil.com": "hotmail.com",
};

const inputClass =
  "h-11 w-full rounded-lg border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-pink-300/70 focus:bg-black/50 focus:ring-2 focus:ring-pink-300/15";

function validateEmail(value: string) {
  const cleanEmail = value.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (!emailPattern.test(cleanEmail)) {
    return {
      email: cleanEmail,
      error: "Escribe un correo válido, por ejemplo usuario@gmail.com.",
    };
  }

  const domain = cleanEmail.split("@")[1];
  const suggestion = emailTypoSuggestions[domain];

  if (suggestion) {
    return {
      email: cleanEmail,
      error: `El dominio parece estar mal escrito. ¿Quisiste decir ${suggestion}?`,
    };
  }

  return { email: cleanEmail, error: "" };
}

function removeWhitespace(value: string) {
  return value.replace(/\s/g, "");
}

function getFriendlyAuthError(message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }

  if (lowerMessage.includes("password")) {
    return "La contraseña debe tener mínimo 6 caracteres.";
  }

  return message;
}

function getAuthTitle(mode: AuthMode) {
  if (mode === "reset") {
    return "Recuperar contraseña";
  }

  return "Iniciar sesión";
}

function getAuthDescription(mode: AuthMode) {
  if (mode === "reset") {
    return "Te enviaremos un enlace para crear una contraseña nueva.";
  }

  return "Acceso privado. Las cuentas las crea el administrador.";
}

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isLogin = mode === "login";
  const isReset = mode === "reset";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    if (isReset) {
      const { email: cleanEmail, error: emailError } = validateEmail(email);

      if (emailError) {
        setMessage(emailError);
        setIsLoading(false);
        return;
      }

      const redirectTo = `${window.location.origin}${withBasePath("/actualizar-contrasena")}`;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      });

      if (error) {
        setMessage(getFriendlyAuthError(error.message));
        setIsLoading(false);
        return;
      }

      setMessage("Te enviamos un enlace de recuperación a tu correo.");
      setIsLoading(false);
      return;
    }

    const { email: loginEmail, error: emailError } =
      validateEmail(loginIdentifier);

    if (emailError) {
      setMessage(emailError);
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error) {
      setMessage(getFriendlyAuthError(error.message));
      setIsLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/80 p-4 shadow-2xl shadow-black/60 backdrop-blur sm:p-5">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white">
          {getAuthTitle(mode)}
        </h2>
        <p className="mt-1.5 text-sm leading-5 text-neutral-400">
          {getAuthDescription(mode)}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {isLogin ? (
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-300">
              <Mail className="h-4 w-4 text-pink-300" />
              Correo
            </span>
            <input
              type="email"
              value={loginIdentifier}
              onChange={(event) =>
                setLoginIdentifier(removeWhitespace(event.target.value))
              }
              placeholder="tu-correo@ejemplo.com"
              autoComplete="username"
              required
              className={inputClass}
            />
          </label>
        ) : null}

        {isReset ? (
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-300">
              <Mail className="h-4 w-4 text-pink-300" />
              Correo
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu-correo@ejemplo.com"
              autoComplete="email"
              required
              className={inputClass}
            />
          </label>
        ) : null}

        {isLogin ? (
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-300">
              <KeyRound className="h-4 w-4 text-pink-300" />
              Contraseña
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="current-password"
              minLength={6}
              required
              className={inputClass}
            />
          </label>
        ) : null}

        {message ? (
          <p className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-neutral-200">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-pink-300 px-4 text-sm font-bold text-neutral-950 shadow-lg shadow-pink-950/40 transition hover:-translate-y-0.5 hover:bg-pink-200 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Procesando..." : isReset ? "Enviar enlace" : "Entrar"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      {isLogin ? (
        <button
          type="button"
          onClick={() => {
            setMode("reset");
            setLoginIdentifier("");
            setPassword("");
            setMessage("");
          }}
          className="mt-3 w-full text-center text-sm font-medium text-pink-300 transition hover:text-pink-200"
        >
          Olvidé mi contraseña
        </button>
      ) : (
        <div className="mt-4 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setLoginIdentifier("");
              setEmail("");
              setPassword("");
              setMessage("");
            }}
            className="h-10 w-full rounded-lg border border-white/10 px-4 text-sm font-semibold text-neutral-200 transition hover:border-pink-300/50 hover:bg-white/[0.04] hover:text-pink-200"
          >
            Volver a iniciar sesión
          </button>
        </div>
      )}
    </div>
  );
}
