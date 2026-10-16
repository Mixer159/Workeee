import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { userInitials } from "@/lib/user";

/**
 * A bot's face: the avatar it pushed, or its initials. The image is an
 * external `https:` URL the bot chose (`normalizeAvatarUrl` on the server), so
 * it is rendered with no referrer.
 */
export function BotAvatar({
  name,
  image,
  size,
  className = size ? undefined : "size-8",
}: {
  name: string;
  image: string | undefined;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {image ? <AvatarImage src={image} alt="" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback>{userInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
