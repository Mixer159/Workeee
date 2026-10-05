import { ApiTokensPanel } from "@/components/connections/api-tokens-panel";
import { MyBotsList } from "@/components/connections/my-bots-list";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { mcpServerUrl } from "@/lib/mcp";

/**
 * Personal, like `/nastaveni/upozorneni`: a token is its owner's, so there is
 * no manager guard. Reached from the user menu.
 */
export default function ConnectionsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Propojení" />

      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>API tokeny</CardTitle>
          <CardDescription>
            S tokenem se k Workeee připojí váš bot přes MCP, třeba z Grok Bota
            nebo z Cursoru. Bot pak pracuje pod vlastním jménem a nikdy nesmí
            víc než vy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApiTokensPanel />
        </CardContent>
      </Card>

      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>Jak bota připojit</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
            <li>Vytvořte token a zkopírujte si ho.</li>
            <li>
              V klientovi přidejte MCP server s adresou{" "}
              <code className="font-mono text-xs break-all">{mcpServerUrl()}</code>{" "}
              a hlavičkou{" "}
              <code className="font-mono text-xs">
                Authorization: Bearer &lt;token&gt;
              </code>
              .
            </li>
            <li>
              Bot zavolá nástroj{" "}
              <code className="font-mono text-xs">sync_bot_identity</code> se
              svým jménem a avatarem. Tím se objeví níže.
            </li>
            <li>
              V nastavení organizace ho přidejte mezi členy. Dokud tam není,
              nevidí nic.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>Moji boti</CardTitle>
        </CardHeader>
        <CardContent>
          <MyBotsList />
        </CardContent>
      </Card>
    </div>
  );
}
