import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import imageCompression from "browser-image-compression";
import compressionWorkerURL from "browser-image-compression/dist/browser-image-compression.js?url";
import { Avatar } from "./Avatar";
import { Button } from "./ui/button";

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
  const picker = useRef<HTMLInputElement>(null);
  const compression = useRef<AbortController>(undefined);
  const [processing, setProcessing] = useState(false);
  useEffect(
    () => () => {
      epoch.current++;
      compression.current?.abort();
    },
    [],
  );
  async function read(file: File) {
    const current = ++epoch.current;
    compression.current?.abort();
    setProcessing(false);
    onChange({ value: draft, reading: false });
    onSelect?.();
    onError("");
    if (file.size === 0 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      onError("Choose a valid JPEG, PNG, or WebP");
      return;
    }
    onChange({ value: draft, reading: true });
    setProcessing(true);
    const controller = new AbortController();
    compression.current = controller;
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 512,
        fileType: "image/png",
        useWebWorker: true,
        libURL: new URL(compressionWorkerURL, location.href).href,
        signal: controller.signal,
      });
      if (epoch.current !== current) return;
      if (!compressed.size || compressed.size > 512 * 1024) {
        throw new Error("Image could not be compressed");
      }
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Unable to read avatar"));
        reader.onabort = () => reject(new Error("Avatar read cancelled"));
        reader.readAsDataURL(compressed);
      });
      if (epoch.current !== current) return;
      const value = data.split(",")[1];
      setDraft(value);
      setPreview(data);
      onChange({ value, reading: false });
    } catch {
      if (epoch.current !== current) return;
      onError("Unable to process image. Choose another image");
      onChange({ value: draft, reading: false });
    } finally {
      if (epoch.current === current) setProcessing(false);
    }
  }
  return (
    <>
      <div className="relative self-center">
        <Avatar
          username={username}
          avatar={draft === undefined ? avatar : ""}
          preview={preview}
          className="size-20 text-xl"
        />
        <Button
          type="button"
          variant="multiplayer"
          size="icon"
          className="absolute -right-2 -top-2 rounded-full"
          aria-label="Change avatar"
          disabled={disabled}
          onClick={() => picker.current?.click()}
        >
          <Pencil aria-hidden="true" />
        </Button>
        <input
          ref={picker}
          type="file"
          className="hidden"
          aria-label="Avatar"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void read(file);
          }}
        />
      </div>
      {processing && (
        <p role="status" className="text-center text-sm text-neutral-400">
          Processing image…
        </p>
      )}
      {(draft === undefined ? avatar : draft) && (
        <Button
          type="button"
          variant="multiplayer"
          size="sm"
          className="self-center"
          disabled={disabled}
          onClick={() => {
            epoch.current++;
            compression.current?.abort();
            setProcessing(false);
            setDraft("");
            setPreview(undefined);
            onChange({ value: "", reading: false });
          }}
        >
          Remove avatar
        </Button>
      )}
    </>
  );
}
