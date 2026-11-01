/** Decorative indicator; provide loading text in the surrounding UI. */
export function Loader({ size = "default" }: { size?: "default" | "sm" }) {
  return (
    <span
      className={`loader animate-[loader-bounce_1s_infinite_linear] inline-block shrink-0 aspect-[2] motion-reduce:animate-none ${size === "sm" ? "w-[30px]" : "w-[60px]"}`}
      data-size={size}
      aria-hidden="true"
    />
  );
}
