import "./style.css";
import iconComment from "iconify/comment-outline-rounded";
import iconClose from "iconify/close";
import { setApiEndpoint } from "./const";
import {
  _decodeJWT,
  _fetchGitHubMeta,
  _getJWT,
  _handleOAuthToken,
  _logout,
} from "./auth";
import {
  _closeContextMenu,
  _createContextMenu,
  _openContextMenu,
} from "./dom/ctx_menu";
import {
  _selectOffsetParagraph,
  _updateAvailableComments,
  _closeCommentsPanel,
  _unselectOffsetParagraph,
  _openCommentsPanel,
  _handleAnchor,
  resetCommentsCache,
  setCommentsButton,
  setCommentsPanel,
} from "./dom/comment";
import { _registerDialog } from "./dom/util";

let globalInitialized = false;
export const __VERSION__: string = __LIB_VERSION__;

export function setupReview(
  el: Element,
  { apiEndpoint: endpoint = "/api" }: { apiEndpoint?: string } = {},
) {
  setApiEndpoint(endpoint.endsWith("/") ? endpoint : endpoint + "/");

  _handleOAuthToken();

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
      _selectOffsetParagraph({
        el: e.currentTarget as HTMLElement,
      });
    });
    offset.addEventListener("mouseenter", (e) => {
      _openContextMenu({
        el: e.currentTarget as HTMLElement,
      });
    });
    offset.addEventListener("mouseleave", (e) => {
      _closeContextMenu({
        el: e.currentTarget as HTMLElement,
      });
    });
    // pre render context menu
    _createContextMenu({ el: offset });
  }

  // clear cache
  resetCommentsCache();

  _updateAvailableComments();
  _fetchGitHubMeta();

  if (globalInitialized) {
    _closeCommentsPanel();
    console.log("oiwiki-feedback-sys-frontend has been successfully reset.");
    return;
  }

  document.addEventListener("click", () => {
    _unselectOffsetParagraph();
  });

  setCommentsButton(
    _registerDialog({
      idOrClass: "review-comments-button",
      content: `
    <button data-action="open">
      ${iconComment}
    </button>
    `,
      actions: new Map([["open", () => _openCommentsPanel()]]),
    }),
  );

  setCommentsPanel(
    _registerDialog({
      idOrClass: "review-comments-panel",
      content: `
    <div class="panel_header">
      <span>本页评论</span>
      <button data-action="close">
        ${iconClose}
      </button>
    </div>
    <div class="panel_main"></div>
    `,
      actions: new Map([["close", () => _closeCommentsPanel()]]),
    }),
  );

  // initialize comments panel position
  _closeCommentsPanel();

  _handleAnchor();

  console.log(
    `oiwiki-feedback-sys-frontend version ${__VERSION__} has been successfully installed.`,
  );

  globalInitialized = true;
}
