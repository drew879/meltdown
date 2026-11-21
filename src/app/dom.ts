// A very small helper for building elements, so screens read as markup.
export type Child = Node | string | number | null | false | undefined;
type Attrs = Record<string, string | number | boolean | null | undefined | ((e: Event) => void)>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || (value === false && !key.startsWith('aria-'))) continue;
    if (typeof value === 'function') node.addEventListener(key.replace(/^on/, '').toLowerCase(), value);
    else if (key === 'class') node.className = String(value);
    else if (key.startsWith('aria-')) node.setAttribute(key, String(value)); // aria-pressed="false" must stay
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  node.append(...(children.filter((c) => c !== null && c !== false && c !== undefined) as (Node | string)[]).map((c) => (typeof c === 'number' ? String(c) : c)));
  return node;
}
