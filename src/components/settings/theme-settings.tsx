"use client";

import { Moon, Sun } from "lucide-react";
import { useAppTheme } from "@/components/app/theme-provider";
import { SettingsSection } from "@/components/settings/settings-section";

export function ThemeSettings() {
  const { setTheme, theme } = useAppTheme();

  return (
    <SettingsSection
      description={"Elige la apariencia que te resulte m\u00e1s c\u00f3moda para usar el panel."}
      icon={<Sun className="h-5 w-5" />}
      title={"Tema de la aplicaci\u00f3n"}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={`flex min-h-24 items-center gap-4 rounded-xl border p-4 text-left transition ${
            theme === "light"
              ? "border-pink-400 bg-pink-50 text-pink-950"
              : "border-white/10 bg-black/20 text-neutral-300 hover:border-pink-300/40"
          }`}
          aria-pressed={theme === "light"}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
            <Sun className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-semibold">Claro</span>
            <span className="mt-1 block text-sm opacity-75">
              {"Fondo blanco y lectura c\u00f3moda de d\u00eda."}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={`flex min-h-24 items-center gap-4 rounded-xl border p-4 text-left transition ${
            theme === "dark"
              ? "border-pink-300/40 bg-pink-300/10 text-pink-100"
              : "border-white/10 bg-black/20 text-neutral-300 hover:border-pink-300/40"
          }`}
          aria-pressed={theme === "dark"}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-indigo-200 shadow-sm">
            <Moon className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-semibold">Oscuro</span>
            <span className="mt-1 block text-sm opacity-75">
              Fondo oscuro para usarlo con menos luz.
            </span>
          </span>
        </button>
      </div>
    </SettingsSection>
  );
}
