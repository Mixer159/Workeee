import type { Metadata } from "next";
import { JoinScreen } from "@/components/join/join-screen";

export const metadata: Metadata = {
  title: "Pozvánka — Workeee",
};

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <JoinScreen code={decodeURIComponent(code)} />;
}
