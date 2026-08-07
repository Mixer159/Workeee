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
          <CardTitle>Úkoly a komentáře</CardTitle>
          <CardDescription>
            Dáme vědět, když vám někdo přiřadí úkol, přidá nový do projektu,
            který vidíte, zmíní vás přes @ nebo napíše pod úkol, který řešíte.
            Všechno se sbírá do jednoho souhrnu — když toho někdo nadělá osm za
            sebou, přijde jeden e-mail se vším.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationSettingsForm />
        </CardContent>
      </Card>
    </div>
  );
}
