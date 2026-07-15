import { AppShell } from "@/components/app/app-shell";
import { FixedExpenseManager } from "@/components/fixed-expenses/fixed-expense-manager";

export default function PendientesPage() {
  return (
    <AppShell>
      <FixedExpenseManager />
    </AppShell>
  );
}
