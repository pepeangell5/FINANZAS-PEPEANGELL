import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";
import { BRAND_MASCOT } from "@/lib/app-path";

export default function LoginPage() {
  return (
    <main className="min-h-[100svh] bg-[#050606] px-5 py-6 text-neutral-50 sm:px-8">
      <section className="mx-auto grid min-h-[calc(100svh-3rem)] w-full max-w-6xl items-center gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12">
        <div className="flex min-h-0 flex-col items-center justify-center text-center lg:items-start lg:text-left">
          <p className="font-mono text-xs font-semibold uppercase text-pink-400">/private/finance</p>
          <h1 className="mt-3 text-4xl font-bold leading-none text-white sm:text-6xl">
            ESP32-TOOLS
            <span className="mt-2 block text-pink-400">Finanzas</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-neutral-400">
            Panel personal protegido. Inicia sesión para continuar.
          </p>
          <Image
            src={BRAND_MASCOT}
            alt="Mascota ajolote de ESP32-TOOLS"
            width={1200}
            height={1200}
            priority
            className="mt-3 h-auto w-[220px] object-contain drop-shadow-[0_0_28px_rgba(255,44,169,0.24)] sm:w-[290px] lg:ml-auto lg:mr-10 lg:w-[380px]"
          />
        </div>

        <div className="w-full">
          <LoginForm />
          <div className="mt-5 flex items-center justify-between gap-4 text-xs text-neutral-500">
            <span>Acceso privado</span>
            <a className="text-pink-400 hover:text-pink-300" href="https://www.pepeangell.dev/">
              Volver a ESP32-TOOLS
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
