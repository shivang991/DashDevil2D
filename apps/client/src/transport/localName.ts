let pageName: string | undefined;
const valid = (name: string | null): name is string =>
  Boolean(name?.trim()) && new TextEncoder().encode(name!).length <= 128;

/** Storage is optional; all consumers in this page share the same immutable name. */
export function localName(): string {
  if (pageName) return pageName;
  try {
    const stored = localStorage.getItem("dashdevil-local-name");
    if (valid(stored)) return (pageName = stored);
  } catch {
    /* use page lifetime fallback */
  }
  pageName = `Driver ${crypto.getRandomValues(new Uint32Array(1))[0].toString(16).padStart(8, "0").slice(0, 6)}`;
  try {
    localStorage.setItem("dashdevil-local-name", pageName);
  } catch {
    /* use page lifetime fallback */
  }
  return pageName;
}
