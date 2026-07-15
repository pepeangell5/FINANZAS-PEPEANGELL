import { Suspense } from "react";
import Image from "next/image";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { BRAND_MASCOT } from "@/lib/app-path";

export default function ActualizarContrasenaPage() {
  return (
    <main className="min-h-screen bg-[#050606] px-5 py-8 text-neutral-50">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl flex-col justify-center">
        <div className="mb-8 text-center">
          <Image
            src={BRAND_MASCOT}
            alt="Mascota ajolote de ESP32-TOOLS"
            width={1200}
            height={1200}
            priority
            className="mx-auto mb-5 h-auto w-[150px] object-contain drop-shadow-[0_0_24px_rgba(255,44,169,0.25)] sm:w-[190px]"
          />
          <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Nueva contraseña
          </h1>
        </div>

        <Suspense
          fallback={
            <div className="rounded-2xl border border-white/10 bg-neutral-950/80 p-5 text-neutral-300 shadow-2xl shadow-black/60 backdrop-blur sm:p-6">
              Cargando...
            </div>
          }
        >
          <UpdatePasswordForm />
        </Suspense>
      </section>
    </main>
  );
}
