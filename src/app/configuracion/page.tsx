import { AppShell } from "@/components/app/app-shell";
import { AllocationSettings } from "@/components/settings/allocation-settings";
import { BackupSettings } from "@/components/settings/backup-settings";
import { CategorySettings } from "@/components/settings/category-settings";
import { IncomeCategorySettings } from "@/components/settings/income-category-settings";
import { PaymentMethodSettings } from "@/components/settings/payment-method-settings";
import { PasswordSettings } from "@/components/settings/password-settings";
import { ThemeSettings } from "@/components/settings/theme-settings";

export default function ConfiguracionPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <ThemeSettings />
        <AllocationSettings />
        <CategorySettings />
        <IncomeCategorySettings />
        <PaymentMethodSettings />
        <PasswordSettings />
        <BackupSettings />
      </div>
    </AppShell>
  );
}
