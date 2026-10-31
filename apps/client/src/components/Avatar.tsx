import { useEffect, useState } from "react";
import { connectionOptions } from "@/transport/account";

export function Avatar({
  username,
  avatar,
  preview,
}: {
  username: string;
  avatar?: string;
  preview?: string;
}) {
  const [server, setServer] = useState(import.meta.env.DEV ? "" : location.origin);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    let active = true;
    if (avatar && import.meta.env.DEV)
      void connectionOptions()
        .then(({ server }) => {
          if (active) setServer(server);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [avatar]);
  const source =
    preview ??
    (avatar && server ? `${server}/api/account/avatars/${encodeURIComponent(avatar)}` : "");
  const initials =
    username
      .split(/_+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  return (
    <span
      className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-600 bg-neutral-800 text-white"
      aria-label={`${username} avatar`}
    >
      {source && source !== failed ? (
        <img
          className="h-full w-full object-cover"
          src={source}
          alt=""
          onError={() => setFailed(source)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
