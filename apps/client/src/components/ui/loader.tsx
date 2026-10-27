import "./loader.css";

/** Decorative indicator; provide loading text in the surrounding UI. */
export function Loader({ size = "default" }: { size?: "default" | "sm" }) {
  return <span className="loader" data-size={size} aria-hidden="true" />;
}
