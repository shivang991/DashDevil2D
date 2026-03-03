import { useRef, useCallback, useEffect } from "react";

interface JoystickProps {
  onDirectionChange: (keys: {
    left: boolean;
    up: boolean;
    right: boolean;
  }) => void;
}

const DEAD_ZONE = 0.2; // fraction of radius

export function Joystick({ onDirectionChange }: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const tracking = useRef(false);
  const lastKeys = useRef({ left: false, up: false, right: false });

  const resetThumb = useCallback(() => {
    if (thumbRef.current) {
      thumbRef.current.style.transform = "translate(-50%, 0)";
    }
    const next = { left: false, up: false, right: false };
    lastKeys.current = next;
    onDirectionChange(next);
  }, [onDirectionChange]);

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      const thumb = thumbRef.current;
      if (!container || !thumb) return;

      const rect = container.getBoundingClientRect();
      // Origin is bottom-center of the semicircle
      const originX = rect.left + rect.width / 2;
      const originY = rect.top + rect.height; // bottom edge
      const radius = rect.width / 2;

      let dx = clientX - originX;
      let dy = clientY - originY;

      // Clamp dy to upper half only (dy <= 0)
      if (dy > 0) dy = 0;

      // Clamp to semicircle radius
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) {
        dx = (dx / dist) * radius;
        dy = (dy / dist) * radius;
      }

      // Position thumb relative to bottom-center
      // thumb is positioned at bottom: 0, left: 50% by default
      // translate moves from that anchor
      thumb.style.transform = `translate(calc(-50% + ${dx}px), ${dy}px)`;

      // Determine direction
      const normalizedDist = dist / radius;
      const next = { left: false, up: false, right: false };

      if (normalizedDist > DEAD_ZONE) {
        // Angle from positive X axis, in radians (0 = right, PI = left, PI/2 = up)
        const angle = Math.atan2(-dy, dx); // -dy because screen Y is inverted

        // Zones: right 0-45°, up 45-135°, left 135-180°
        const deg = (angle * 180) / Math.PI;
        if (deg >= 0 && deg < 45) {
          next.right = true;
        } else if (deg >= 45 && deg < 135) {
          next.up = true;
        } else if (deg >= 135 && deg <= 180) {
          next.left = true;
        }
      }

      // Only fire callback if something changed
      const prev = lastKeys.current;
      if (
        prev.left !== next.left ||
        prev.up !== next.up ||
        prev.right !== next.right
      ) {
        lastKeys.current = next;
        onDirectionChange(next);
      }
    },
    [onDirectionChange],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      tracking.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      handleMove(e.clientX, e.clientY);
    },
    [handleMove],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!tracking.current) return;
      handleMove(e.clientX, e.clientY);
    },
    [handleMove],
  );

  const onPointerUp = useCallback(() => {
    tracking.current = false;
    resetThumb();
  }, [resetThumb]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      onDirectionChange({ left: false, up: false, right: false });
    };
  }, [onDirectionChange]);

  return (
    <div
      ref={containerRef}
      className="relative w-40 select-none touch-none"
      style={{ height: 80 }} // half of width (semicircle)
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Semicircle boundary */}
      <div
        className="absolute inset-0 border border-neutral-600 rounded-t-full"
        style={{ borderBottom: "none" }}
      />

      {/* Thumb — anchored at bottom-center */}
      <div
        ref={thumbRef}
        className="absolute bottom-0 left-1/2 w-12 h-12 -mb-6 rounded-full border border-neutral-500 bg-neutral-700/80"
        style={{ transform: "translate(-50%, 0)" }}
      />
    </div>
  );
}
