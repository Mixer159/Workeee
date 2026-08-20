import { PageHeader } from "@/components/layout/page-header";
import { NotificationSettingsForm } from "@/components/notifications/notification-settings-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Personal settings, so unlike `/nastaveni/organizace` there is no manager
 * guard — everybody has their own. Reached from the user menu.
 */
export default function NotificationSettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Upozornění" />

      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>Úkoly a komentáře</CardTitle>
          <CardDescription>
            E-mail přijde, když vám někdo přiřadí úkol, zmíní vás přes @ nebo
            napíše komentář pod úkol, který řešíte. Nové úkoly v projektech
            uvidíte v aplikaci v Upozorněních. Když se toho sejde víc za sebou,
            přijde jeden souhrnný e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationSettingsForm />
        </CardContent>
      </Card>
    </div>
  );
}
