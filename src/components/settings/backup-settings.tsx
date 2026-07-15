"use client";

import { useEffect, useState } from "react";
import { Download, HardDriveDownload } from "lucide-react";
import { SettingsSection } from "@/components/settings/settings-section";
import { supabase } from "@/lib/supabase/client";

export function BackupSettings() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setIsAdmin(data.session?.user.app_metadata?.role === "admin");
      setIsCheckingRole(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function exportBackup() {
    setIsExportingBackup(true);
    setMessage("");

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Sesión no válida.");
      }

      const response = await fetch("/finanzas/api/admin/backup", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);

        throw new Error(data?.error || "No se pudo generar el respaldo.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] || "esp32-tools-finanzas-backup.sql";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Respaldo descargado correctamente.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo descargar el respaldo.",
      );
    } finally {
      setIsExportingBackup(false);
    }
  }

  if (isCheckingRole || !isAdmin) {
    return null;
  }

  return (
    <SettingsSection
      title="Respaldo de datos"
      description="Descarga un archivo SQL con las tablas principales para guardarlo fuera de Supabase."
      icon={<HardDriveDownload className="h-5 w-5" />}
      trailing={
        <span className="rounded-full border border-pink-300/25 bg-pink-300/10 px-3 py-1 text-xs font-bold text-pink-200">
          Admin
        </span>
      }
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={exportBackup}
          disabled={isExportingBackup}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-pink-300 px-4 text-sm font-bold text-neutral-950 shadow-lg shadow-pink-950/30 transition hover:bg-pink-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <Download className="h-4 w-4" />
          {isExportingBackup ? "Exportando..." : "Exportar respaldo"}
        </button>

        {message ? (
          <p className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-neutral-200">
            {message}
          </p>
        ) : null}
      </div>
    </SettingsSection>
  );
}
