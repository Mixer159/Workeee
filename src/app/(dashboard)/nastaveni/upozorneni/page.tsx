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
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Upozornění
      </h1>

      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>Nové úkoly</CardTitle>
          <CardDescription>
            Dáme vědět, když vám někdo přiřadí úkol nebo přidá nový do projektu,
            který vidíte. Úkoly se sbírají do jednoho souhrnu — když jich někdo
            zadá osm za sebou, přijde jeden e-mail se všemi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationSettingsForm />
        </CardContent>
      </Card>
    </div>
  );
}
