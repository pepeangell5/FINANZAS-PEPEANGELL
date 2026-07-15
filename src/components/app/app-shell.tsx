"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { ThemeProvider, useAppTheme } from "@/components/app/theme-provider";
import { supabase } from "@/lib/supabase/client";
import { BRAND_MASCOT, BRAND_MASCOT_LIGHT } from "@/lib/app-path";

type Profile = {
  full_name: string | null;
  username: string | null;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ingresos", label: "Ingresos", icon: ArrowUpRight },
  { href: "/gastos", label: "Gastos", icon: ArrowDownRight },
  { href: "/pendientes", label: "Pendientes", icon: CalendarClock },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AppShellContent>{children}</AppShellContent>
    </ThemeProvider>
  );
}

function AppShellContent({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useAppTheme();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }

      setUser(data.session.user);
      supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", data.session.user.id)
        .single()
        .then(({ data: profileData }) => {
          setProfile(profileData);
          setIsLoading(false);
        });
    });
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 text-neutral-600">
        Cargando panel privado...
      </main>
    );
  }

  const currentPath = pathname.replace(/^\/finanzas/, "") || "/";
  const pageTitle =
    currentPath === "/configuracion"
      ? "Configuración"
      : currentPath === "/reportes"
        ? "Reportes"
        : currentPath === "/gastos"
          ? "Gastos"
          : currentPath === "/pendientes"
            ? "Pendientes"
            : currentPath === "/ingresos"
                ? "Ingresos"
                : "Dashboard";
  const displayName = profile?.username || profile?.full_name || user?.email;
  const isLightTheme = theme === "light";

  return (
    <main
      className={`flex min-h-screen flex-col bg-[#060607] text-neutral-50 ${
        theme === "light" ? "finance-light" : "finance-dark"
      }`}
    >
      <header className="border-b border-white/10 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src={isLightTheme ? BRAND_MASCOT_LIGHT : BRAND_MASCOT}
              alt="ESP32-TOOLS"
              width={96}
              height={96}
              priority
              className="h-14 w-14 shrink-0 object-contain drop-shadow-[0_0_16px_rgba(255,44,169,0.24)] sm:h-16 sm:w-16"
            />
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-semibold uppercase text-pink-400">Private ledger</p>
              <p className="truncate text-lg font-bold text-white sm:text-xl">ESP32-TOOLS Finanzas</p>
              <p className="truncate text-xs text-neutral-500">Sesión de {displayName}</p>
            </div>
          </div>

          <a
            href="https://www.pepeangell.dev/"
            className="shrink-0 border-b border-pink-400/50 pb-0.5 text-xs font-semibold text-pink-300 hover:text-pink-200"
          >
            pepeangell.dev
          </a>
        </div>
      </header>

      <div className="sticky top-0 z-50 border-y border-white/10 bg-neutral-950/90 shadow-lg shadow-black/25 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-stretch gap-3 px-5 py-3 sm:w-full sm:flex-row sm:items-center sm:justify-center sm:px-8 lg:px-10">
          <nav className="grid w-full grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.035] p-1 sm:flex sm:w-auto sm:flex-wrap sm:justify-center">
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex h-10 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium transition sm:px-3 ${
                      isActive
                        ? "bg-pink-400 text-neutral-950"
                        : "text-neutral-300 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
          </nav>

          <button
            type="button"
            onClick={handleSignOut}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-neutral-200 transition hover:border-white/20 hover:bg-white/[0.04] sm:w-auto"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </div>

      <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-7 sm:px-8 sm:py-8 lg:px-10">
        <div className="flex items-center gap-3 sm:gap-4">
          <Image
            src={isLightTheme ? BRAND_MASCOT_LIGHT : BRAND_MASCOT}
            alt="ESP32-TOOLS"
            width={64}
            height={64}
            className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
          />
          <div>
            <p className="text-sm text-neutral-500">Panel privado</p>
            <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
              {pageTitle}
            </h1>
          </div>
        </div>

        {children}
      </section>

      <footer className="border-t border-white/10 px-4 py-5 text-center text-xs font-medium uppercase tracking-[0.22em] text-neutral-600 sm:px-8">
        <span className="text-neutral-500">ESP32-TOOLS</span>
        <span className="mx-2 text-pink-300/50">·</span>
        <span>Finanzas privadas</span>
        <span className="mx-2 text-pink-300/50">·</span>
        <span className="text-pink-300">PepeAngell</span>
      </footer>
    </main>
  );
}
