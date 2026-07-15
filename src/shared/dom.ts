type Child = Node | string | number | false | null | undefined;

type ElementOptions = {
  className?: string;
  text?: string;
  attrs?: Record<string, string | number | boolean>;
  onClick?: (event: MouseEvent) => void;
};

export function h<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options: ElementOptions = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text !== undefined) {
    element.textContent = options.text;
  }

  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    if (typeof value === "boolean") {
      if (value) {
        element.setAttribute(name, "");
      }
      continue;
    }
    element.setAttribute(name, String(value));
  }

  if (options.onClick) {
    element.addEventListener("click", (event) => options.onClick?.(event as MouseEvent));
  }

  for (const child of children) {
    if (child === false || child === null || child === undefined) {
      continue;
    }
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return element;
}

export function clear(element: HTMLElement): void {
  element.replaceChildren();
}

export function button(
  label: string,
  variant: "primary" | "secondary" | "ghost",
  onClick: (event: MouseEvent) => void,
): HTMLButtonElement {
  return h(
    "button",
    {
      className: `button button-${variant}`,
      attrs: { type: "button" },
      onClick,
    },
    label,
  );
}
