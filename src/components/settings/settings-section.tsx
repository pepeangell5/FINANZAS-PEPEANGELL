"use client";

import Image from "next/image";
import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import { BRAND_MASCOT } from "@/lib/app-path";

type SettingsSectionProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  description: string;
  icon: ReactNode;
  title: string;
  trailing?: ReactNode;
};

export function SettingsSection({
  children,
  defaultOpen = false,
  description,
  icon,
  title,
  trailing,
}: SettingsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-xl shadow-black/20">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between"
        aria-expanded={isOpen}
      >
        <div className="flex gap-3">
          <Image
            src={BRAND_MASCOT}
            alt="ESP32-TOOLS"
            width={64}
            height={64}
            className="mt-1 h-9 w-9 shrink-0 object-contain"
          />
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-pink-300/25 bg-pink-300/10 text-pink-200">
            {icon}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {trailing}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-neutral-300">
            <ChevronDown
              className={`h-5 w-5 transition ${isOpen ? "rotate-180" : ""}`}
            />
          </div>
        </div>
      </button>

      {isOpen ? (
        <div className="border-t border-white/10 p-5">{children}</div>
      ) : null}
    </section>
  );
}
