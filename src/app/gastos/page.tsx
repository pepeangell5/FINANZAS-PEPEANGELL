import { AppShell } from "@/components/app/app-shell";
import { ExpenseManager } from "@/components/expenses/expense-manager";

export default function GastosPage() {
  return (
    <AppShell>
      <ExpenseManager />
    </AppShell>
  );
}
