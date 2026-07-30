import { redirect } from "next/navigation";

/**
 * The task detail used to be a page of its own. It is now a drawer on the
 * board, so this address only keeps older links working.
 */
export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;
  redirect(`/projekt/${id}?ukol=${encodeURIComponent(taskId)}`);
}
