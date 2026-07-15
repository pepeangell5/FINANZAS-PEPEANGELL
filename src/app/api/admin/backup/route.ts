import { formatDateInput } from "@/lib/format";
import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BackupTable = {
  columns: string[];
  name: string;
  orderBy: string;
};

type BackupRow = Record<string, boolean | number | string | null>;

const backupTables: BackupTable[] = [
  {
    columns: ["id", "full_name", "username", "role", "created_at", "updated_at"],
    name: "profiles",
    orderBy: "created_at",
  },
  {
    columns: [
      "id",
      "user_id",
      "name",
      "percentage",
      "color",
      "sort_order",
      "created_at",
      "updated_at",
    ],
    name: "allocation_buckets",
    orderBy: "sort_order",
  },
  {
    columns: [
      "id",
      "user_id",
      "allocation_bucket_id",
      "name",
      "color",
      "created_at",
      "updated_at",
    ],
    name: "categories",
    orderBy: "created_at",
  },
  {
    columns: ["id", "user_id", "name", "color", "created_at", "updated_at"],
    name: "income_categories",
    orderBy: "created_at",
  },
  {
    columns: [
      "id",
      "user_id",
      "income_category_id",
      "income_date",
      "concept",
      "amount",
      "note",
      "created_at",
      "updated_at",
    ],
    name: "incomes",
    orderBy: "income_date",
  },
  {
    columns: [
      "id",
      "user_id",
      "category_id",
      "expense_date",
      "concept",
      "amount",
      "note",
      "created_at",
      "updated_at",
    ],
    name: "expenses",
    orderBy: "expense_date",
  },
  {
    columns: [
      "id",
      "user_id",
      "category_id",
      "concept",
      "amount",
      "due_date",
      "note",
      "status",
      "paid_at",
      "expense_id",
      "is_recurring",
      "recurring_parent_id",
      "created_at",
      "updated_at",
    ],
    name: "fixed_expenses",
    orderBy: "due_date",
  },
];

function sqlIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function sqlValue(value: BackupRow[string]) {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

function buildUpsert(table: BackupTable, rows: BackupRow[]) {
  if (rows.length === 0) {
    return `-- finance.${table.name}: sin registros\n`;
  }

  const columns = table.columns.map(sqlIdentifier).join(", ");
  const updates = table.columns
    .filter((column) => column !== "id")
    .map((column) => `${sqlIdentifier(column)} = excluded.${sqlIdentifier(column)}`)
    .join(", ");
  const values = rows
    .map((row) => {
      const rowValues = table.columns.map((column) => sqlValue(row[column]));

      return `  (${rowValues.join(", ")})`;
    })
    .join(",\n");

  return [
    `insert into finance.${sqlIdentifier(table.name)} (${columns})`,
    `values`,
    values,
    `on conflict ("id") do update set ${updates};`,
    "",
  ].join("\n");
}

function getBackupFileName() {
  const date = formatDateInput(new Date());
  const time = new Date()
    .toLocaleTimeString("es-MX", {
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
    })
    .replace(":", "");

  return `esp32-tools-finanzas-backup-${date}-${time}.sql`;
}

async function fetchTableRows(
  supabaseAdmin: SupabaseAdminClient,
  table: BackupTable,
) {
  const { data, error } = await supabaseAdmin
    .from(table.name)
    .select(table.columns.join(", "))
    .order(table.orderBy, { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as unknown as BackupRow[];
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);

  if (admin.response) {
    return admin.response;
  }

  const { supabaseAdmin } = admin.context;
  const createdAt = new Date().toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const sections = [
    "-- ESP32-TOOLS FINANZAS - respaldo SQL",
    `-- Generado: ${createdAt}`,
    "-- Este archivo respalda el esquema finance. Las cuentas de Auth se administran en Supabase Authentication.",
    "-- Restaurar en el orden incluido para respetar relaciones entre tablas.",
    "",
    "begin;",
    "",
  ];

  try {
    for (const table of backupTables) {
      const rows = await fetchTableRows(supabaseAdmin, table);

      sections.push(`-- Tabla finance.${table.name}`);
      sections.push(buildUpsert(table, rows));
    }
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo generar el respaldo.",
      },
      { status: 500 },
    );
  }

  sections.push("commit;", "");

  return new Response(sections.join("\n"), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${getBackupFileName()}"`,
      "Content-Type": "application/sql; charset=utf-8",
    },
  });
}
