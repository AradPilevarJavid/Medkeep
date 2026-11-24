/**
 * Tiny DOM helper. User-controlled values must be passed via `text`, never
 * `html`, so records render as text and cannot inject markup.
 */

export type Child = Node | string | number | null | undefined | false;

type AttributeValue =
  string | number | boolean | null | undefined | Record<string, string> | ((event: Event) => void);

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, AttributeValue> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attributes)) {
    if (value === false || value === null || value === undefined) {
      continue;
    }
    if (key === 'class' && typeof value === 'string') {
      node.className = value;
    } else if (key === 'text' && typeof value === 'string') {
      node.textContent = value;
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(node.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (typeof value === 'string' || typeof value === 'number') {
      node.setAttribute(key, String(value));
    } else if (value === true) {
      node.setAttribute(key, '');
    }
  }

  appendChildren(node, children);
  return node;
}

function appendChildren(node: Element, children: readonly Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) {
      continue;
    }
    if (child instanceof Node) {
      node.append(child);
    } else {
      node.append(document.createTextNode(String(child)));
    }
  }
}

export function clear(node: Element): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}
