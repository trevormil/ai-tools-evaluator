import Link from "next/link";

/** A link that opens a DM thread with the given user. Server-safe (no client JS). */
export function MessageButton({
  userId,
  className = "btn-ghost",
}: {
  userId: string;
  className?: string;
}) {
  return (
    <Link href={`/messages/${userId}`} className={className}>
      Message
    </Link>
  );
}
