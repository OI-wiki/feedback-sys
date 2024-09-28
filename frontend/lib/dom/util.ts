export const _registerDialog = ({
  idOrClass,
  content,
  actions = new Map<string, (el: HTMLElement) => void>(),
  parent = document.body,
  insertPosition = "beforeend",
  tag = "div",
  isClass = false,
  initialize = () => {},
}: {
  idOrClass: string;
  content: string;
  parent?: HTMLElement;
  insertPosition?: InsertPosition;
  actions?: Map<string, (el: HTMLElement) => void>;
  tag?: keyof HTMLElementTagNameMap;
  isClass?: boolean;
  initialize?: (el: HTMLElement) => void;
}): HTMLElement => {
  let dialog = document.querySelector<HTMLElement>(`#${idOrClass}`);
  if (!isClass && dialog) return dialog;

  parent.insertAdjacentHTML(
    insertPosition,
    `
    <${tag} ${isClass ? `class="${idOrClass}"` : `id="${idOrClass}"`}>
      ${content.trim()}
    </${tag}>
    `.trim(),
  );
  dialog = parent.querySelector(
    isClass ? `.${idOrClass}` : `#${idOrClass}`,
  )! as HTMLElement;

  initialize(dialog);

  const actionElements = dialog.querySelectorAll(`[data-action]`);
  for (const actionEl of actionElements) {
    actionEl.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent bubble so that the document click event won't be triggered
      const el = e.currentTarget as HTMLElement;
      const action = el.dataset.action ?? "";
      actions.get(action)?.(el);
    });
  }

  return dialog;
};
