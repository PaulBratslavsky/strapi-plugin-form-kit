/** Tiny DOM helpers — keep the bundle lean. */

export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | null | undefined> = {},
  children: Array<Node | string> = []
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.setAttribute('class', String(v));
    else if (k === 'for') node.setAttribute('for', String(v));
    else if (k.startsWith('data-')) node.setAttribute(k, String(v));
    else if (k in node) (node as any)[k] = v;
    else node.setAttribute(k, String(v));
  }
  for (const child of children) {
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
};

export const clear = (node: Node) => {
  while (node.firstChild) node.removeChild(node.firstChild);
};
