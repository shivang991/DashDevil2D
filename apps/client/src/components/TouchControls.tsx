import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Zap } from "lucide-react";

type Control = 1 | 2 | 3;
export function TouchControls({
  disabled = false,
  onControl,
}: {
  disabled?: boolean;
  onControl: (control: Control, down: boolean) => void;
}) {
  const [touch, setTouch] = useState(() => navigator.maxTouchPoints > 0);
  const [held, setHeld] = useState<Control[]>([]);
  const pointers = useRef(new Map<number, Control>());
  const callback = useRef(onControl);
  useEffect(() => {
    callback.current = onControl;
  }, [onControl]);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia("(any-pointer: coarse)");
    const update = () => setTouch(query.matches || navigator.maxTouchPoints > 0);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const release = () => {
      for (const control of new Set(pointers.current.values())) callback.current(control, false);
      pointers.current.clear();
      setHeld([]);
    };
    const keyUp = (event: KeyboardEvent) => {
      const id = event.key === " " ? -1 : event.key === "Enter" ? -2 : 0;
      const control = pointers.current.get(id);
      if (!control) return;
      pointers.current.delete(id);
      if (![...pointers.current.values()].includes(control)) callback.current(control, false);
      setHeld([...pointers.current.values()]);
    };
    if (disabled) release();
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
      release();
    };
  }, [disabled]);
  const release = (id: number) => {
    const control = pointers.current.get(id);
    pointers.current.delete(id);
    if (control && ![...pointers.current.values()].includes(control))
      callback.current(control, false);
    setHeld([...pointers.current.values()]);
  };
  if (!touch) return null;
  return (
    <div className="touch-controls" aria-label="Driving controls">
      {([1, 2, 3] as const).map((control) => {
        const Icon = control === 1 ? ArrowLeft : control === 2 ? ArrowRight : Zap;
        return (
          <button
            key={control}
            type="button"
            disabled={disabled}
            aria-label={control === 1 ? "Steer left" : control === 2 ? "Steer right" : "Accelerate"}
            aria-pressed={held.includes(control)}
            className={control === 3 ? "touch-pedal" : ""}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              if (event.button !== 0 || disabled) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              const alreadyHeld = [...pointers.current.values()].includes(control);
              pointers.current.set(event.pointerId, control);
              if (!alreadyHeld) callback.current(control, true);
              setHeld([...pointers.current.values()]);
            }}
            onPointerUp={(event) => release(event.pointerId)}
            onPointerCancel={(event) => release(event.pointerId)}
            onLostPointerCapture={(event) => release(event.pointerId)}
            onKeyDown={(event) => {
              if ((event.key === " " || event.key === "Enter") && !event.repeat) {
                event.preventDefault();
                callback.current(control, true);
                pointers.current.set(event.key === " " ? -1 : -2, control);
                setHeld([...pointers.current.values()]);
              }
            }}
          >
            <Icon size={26} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
