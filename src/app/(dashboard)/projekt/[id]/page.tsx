import { Suspense } from "react";
import { ProjectScreen } from "@/components/projects/project-screen";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    // The open task is read out of the address (`?ukol=`), which is what the
    // boundary is for. Keyed by the project so switching projects never carries
    // the previous board's open task over.
    <Suspense fallback={null}>
      <ProjectScreen key={id} projectId={id} />
    </Suspense>
  );
}
