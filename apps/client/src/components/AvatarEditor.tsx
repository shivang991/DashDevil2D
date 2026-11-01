import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";

export interface AvatarDraft {
  value?: string;
  reading: boolean;
}

/** Remount with a new key to reset the draft and invalidate pending reads. */
export function AvatarEditor({
  username,
  avatar,
  disabled,
  onChange,
  onError,
  onSelect,
}: {
  username: string;
  avatar?: string;
  disabled: boolean;
  onChange: (draft: AvatarDraft) => void;
  onError: (message: string) => void;
  onSelect?: () => void;
}) {
  const [draft, setDraft] = useState<string>();
  const [preview, setPreview] = useState<string>();
  const epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  async function read(file: File) {
    const current = ++epoch.current;
    onChange({ value: draft, reading: false });
    onSelect?.();
    onError("");
    if (
      file.size === 0 ||
      file.size > 2 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      onError("Choose a JPEG, PNG, or WebP up to 2 MB");
      return;
    }
    onChange({ value: draft, reading: true });
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Unable to read avatar"));
        reader.readAsDataURL(file);
      });
      if (epoch.current !== current) return;
      const value = data.split(",")[1];
      setDraft(value);
      setPreview(data);
      onChange({ value, reading: false });
    } catch {
      if (epoch.current !== current) return;
      onError("Unable to read avatar");
      onChange({ value: draft, reading: false });
    }
  }
  return (
    <>
      <Avatar username={username} avatar={draft === undefined ? avatar : ""} preview={preview} />
      <label className="text-sm">
        Avatar
        <input
          type="file"
          className="mt-2 block w-full text-xs"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void read(file);
          }}
        />
      </label>
      <p className="text-xs text-neutral-400">JPEG, PNG, WebP · up to 2 MB</p>
      {(avatar || draft) && (
        <button
          type="button"
          className="rounded-lg border border-neutral-600 px-4 py-3 disabled:opacity-50"
          disabled={disabled}
          onClick={() => {
            epoch.current++;
            setDraft("");
            setPreview(undefined);
            onChange({ value: "", reading: false });
          }}
        >
          Remove avatar
        </button>
      )}
    </>
  );
}
