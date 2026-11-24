/**
 * Tiny DOM helper. User-controlled values must be passed via `text`, never
 * `html`, so records render as text and cannot inject markup.
 */

/**
 * @param {string} tag
 * @param {Record<string, unknown>} [attributes]
 * @param {...(Node | string | number | null | undefined | false)} children
 * @returns {HTMLElement}
 */
export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attributes)) {
    if (value === false || value === null || value === undefined) {
      continue;
    }
    if (key === 'class') {
      node.className = String(value);
    } else if (key === 'text') {
      node.textContent = String(value);
    } else if (key === 'dataset' && value && typeof value === 'object') {
      Object.assign(node.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }

  appendChildren(node, children);
  return node;
}

/**
 * @param {Element} node
 * @param {ReadonlyArray<unknown>} children
 */
function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
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

/**
 * @param {Element} node
 */
export function clear(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
export function byId(id) {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing required element: #${id}`);
  }
  return node;
}
