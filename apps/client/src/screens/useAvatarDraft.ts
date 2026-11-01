import { useEffect, useRef, useState } from "react";

// Shared player/admin upload draft; reset/removal/unmount invalidate pending reads.
export function useAvatarDraft(onError: (message: string) => void) {
  const [avatar, setAvatar] = useState<string>();
  const [preview, setPreview] = useState<string>();
  const [reading, setReading] = useState(false);
  const epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  function reset(value?: string) {
    epoch.current++;
    setReading(false);
    setAvatar(value);
    setPreview(undefined);
  }
  async function read(file: File) {
    const current = ++epoch.current;
    setReading(false);
    onError("");
    if (
      file.size === 0 ||
      file.size > 2 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      onError("Choose a JPEG, PNG, or WebP up to 2 MB");
      return;
    }
    setReading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Unable to read avatar"));
        reader.readAsDataURL(file);
      });
      if (epoch.current === current) {
        setAvatar(data.split(",")[1]);
        setPreview(data);
      }
    } catch {
      if (epoch.current === current) onError("Unable to read avatar");
    } finally {
      if (epoch.current === current) setReading(false);
    }
  }
  return { avatar, preview, reading, read, reset, remove: () => reset("") };
}
