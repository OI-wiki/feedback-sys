import "./style.css";
import iconComment from "iconify/comment-outline-rounded";
import iconClose from "iconify/close";
import { setApiEndpoint } from "./const";
import { handleOAuthToken } from "./auth";
import {
  closeContextMenu,
  createContextMenu,
  openContextMenu,
} from "./dom/ctx_menu";
import {
  selectOffsetParagraph,
  updateAvailableComments,
  closeCommentsPanel,
  unselectOffsetParagraph,
  openCommentsPanel,
  handleAnchor,
  resetCommentsCache,
  setCommentsButton,
  setCommentsPanel,
} from "./dom/comment";
import { registerDialog } from "./dom/util";

let globalInitialized = false;
export const __VERSION__: string = __LIB_VERSION__;

export function setupReview(
  el: Element,
  { apiEndpoint: endpoint = "/api" }: { apiEndpoint?: string } = {},
) {
  setApiEndpoint(endpoint.endsWith("/") ? endpoint : endpoint + "/");

  handleOAuthToken();

  const offsets = Array.from(
    el.querySelectorAll<HTMLElement>(
      "[data-original-document-start][data-original-document-end]",
    ),
  );

  if (!offsets) {
    console.warn(
      "oiwiki-feedback-sys-frontend not found any offsets to inject, quitting...",
    );
    return;
  }

  for (let offset of offsets) {
    offset.dataset.reviewEnabled = "true";
    offset.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent bubble so that the document click event won't be triggered
      selectOffsetParagraph({
        el: e.currentTarget as HTMLElement,
      });
    });
    offset.addEventListener("mouseenter", (e) => {
      openContextMenu({
        el: e.currentTarget as HTMLElement,
      });
    });
    offset.addEventListener("mouseleave", (e) => {
      closeContextMenu({
        el: e.currentTarget as HTMLElement,
      });
    });
    // pre render context menu
    createContextMenu({ el: offset });
  }

  // clear cache
  resetCommentsCache();

  updateAvailableComments();

  if (globalInitialized) {
    closeCommentsPanel();
    console.log("oiwiki-feedback-sys-frontend has been successfully reset.");
    return;
  }

  document.addEventListener("click", () => {
    unselectOffsetParagraph();
  });

  setCommentsButton(
    registerDialog({
      idOrClass: "review-comments-button",
      content: `
    <button data-action="open">
      ${iconComment}
    </button>
    `,
      actions: new Map([["open", () => openCommentsPanel()]]),
    }),
  );

  setCommentsPanel(
    registerDialog({
      idOrClass: "review-comments-panel",
      content: `
    <div class="panel_header">
      <span>本页评论</span>
      <button data-action="close">
        ${iconClose}
      </button>
    </div>
    <div class="panel_main"></div>
    <div class="panel_footer">
      Powered by <a href="https://github.com/OI-wiki/feedback-sys" target="_blank">OI Wiki Feedback System</a>
    </div>
    `,
      actions: new Map([["close", () => closeCommentsPanel()]]),
    }),
  );

  // initialize comments panel position
  closeCommentsPanel();

  handleAnchor();

  console.log(
    `oiwiki-feedback-sys-frontend version ${__VERSION__} has been successfully installed.`,
  );

  globalInitialized = true;
}
