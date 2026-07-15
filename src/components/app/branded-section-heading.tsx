import Image from "next/image";
import { ReactNode } from "react";
import { BRAND_MASCOT } from "@/lib/app-path";

type BrandedSectionHeadingProps = {
  description?: string;
  title: string;
  trailing?: ReactNode;
};

export function BrandedSectionHeading({
  description,
  title,
  trailing,
}: BrandedSectionHeadingProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <Image
          src={BRAND_MASCOT}
          alt="ESP32-TOOLS"
          width={64}
          height={64}
          className="mt-0.5 h-9 w-9 shrink-0 object-contain"
        />
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {trailing ? <div className="sm:ml-4">{trailing}</div> : null}
    </div>
  );
}
