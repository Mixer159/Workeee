import { toast } from "sonner";

/**
 * Copy with a toast either way. The clipboard API needs a secure context and a
 * user gesture, so failure is a normal outcome, not an exception to swallow.
 */
export async function copyToClipboard(
  text: string,
  successMessage: string,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error("Zkopírování se nepovedlo. Zkopírujte text ručně.");
  }
}
