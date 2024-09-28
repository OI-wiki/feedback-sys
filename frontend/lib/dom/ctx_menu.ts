import { _selectOffsetParagraph } from "./comment";
import { _registerDialog } from "./util";
import iconAddComment from "iconify/add-comment-outline-rounded";

export const _createContextMenu = ({ el }: { el: HTMLElement }) => {
  if (el.querySelector(`.review-context-menu`)) return;
  _registerDialog({
    idOrClass: "review-context-menu",
    content: `
    <button data-action="comment">
      ${iconAddComment}
    </button>
    `,
    parent: el,
    actions: new Map([
      [
        "comment",
        () => {
          _selectOffsetParagraph({
            el,
            focusReply: true,
          });
        },
      ],
    ]),
    isClass: true,
    initialize: (innerEl) => {
      innerEl.addEventListener("mouseenter", () => {
        el.dataset.reviewFocused = "true";
      });
      innerEl.addEventListener("mouseleave", () => {
        delete el.dataset.reviewFocused;
      });
      innerEl.style.display = "none";
    },
  });
};

export const _openContextMenu = ({ el }: { el: HTMLElement }) => {
  const contextMenu = el.querySelector(`.review-context-menu`) as
    | HTMLDivElement
    | undefined;
  if (!contextMenu) {
    console.error("openContextMenu called but contextMenu not found");
    return;
  }
  contextMenu.style.display = "";
};

export const _closeContextMenu = ({ el }: { el: HTMLElement }) => {
  const contextMenu = el.querySelector(
    `.review-context-menu:not([style*="display: none"])`,
  ) as HTMLDivElement | undefined;
  if (!contextMenu) {
    console.error("closeContextMenu called but contextMenu not found");
    return;
  }
  contextMenu.style.display = "none";
};
