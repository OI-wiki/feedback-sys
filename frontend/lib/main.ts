import "./style.css";
import "iconify-icon";

type Comment = {
  id: number;
  offset: {
    start: number;
    end: number;
  };
  commenter: {
    name: string | null;
  };
  comment: string;
  created_time: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

let selectedOffset: HTMLElement | null = null;

let commentsCache: Comment[] | undefined;

let popup = document.querySelector(
  "#review-context-menu-popup",
)! as HTMLDivElement;
let review = document.querySelector(
  "#review-context-menu-review",
)! as HTMLDialogElement;
let comments = document.querySelector(
  "#review-context-menu-comments",
)! as HTMLDivElement;

const _registerActionPopup = ({
  id,
  content,
  actions,
  isModal = false,
}: {
  id: string;
  content: string;
  actions: Map<string, Function>;
  isModal?: boolean;
}) => {
  if (document.querySelector(`#${id}`)) return;
  document.body.insertAdjacentHTML(
    "afterend",
    `
    <${isModal ? "dialog" : "div"} id="${id}" popover>
      ${content.trim()}
    </${isModal ? "dialog" : "div"}>
    `.trim(),
  );
  const popupItems = document.querySelectorAll(`#${id} .popup_item`);
  for (const item of popupItems) {
    item.addEventListener("click", (e) => {
      const action = (e.currentTarget as HTMLElement).dataset.action ?? "";
      actions.get(action)?.();
    });
  }
};

const _openContextMenu = (e: MouseEvent) => {
  selectedOffset = e.currentTarget as HTMLElement;

  let pageX = e.pageX;
  let pageY = e.pageY;

  const prevDisplay = popup.style.display;
  popup.style.display = "block";
  if (pageX + popup.offsetWidth > window.innerWidth) {
    pageX = window.innerWidth - popup.offsetWidth;
  }
  if (pageY + popup.offsetHeight > window.innerHeight) {
    pageY = window.innerHeight - popup.offsetHeight;
  }
  popup.style.display = prevDisplay;

  document.documentElement.style.setProperty(
    "--review-context-menu-popup-page-x",
    pageX + "px",
  );
  document.documentElement.style.setProperty(
    "--review-context-menu-popup-page-y",
    pageY + "px",
  );

  (
    document.querySelector(
      "#review-context-menu-popup .popup_item[data-action='comments']",
    ) as HTMLButtonElement
  ).disabled = !selectedOffset.classList.contains("review_has_comments");

  popup.showPopover();
};

const _submitComment = async ({
  apiEndpoint,
  offsets,
  username,
  content,
}: {
  apiEndpoint: string;
  offsets: [number, number];
  username: string;
  content: string;
}) => {
  const commitHash = globalThis.sessionStorage.getItem("commitHash");
  if (!commitHash) {
    throw new Error("Commit hash not found");
  }

  apiEndpoint = apiEndpoint.endsWith("/") ? apiEndpoint : apiEndpoint + "/";

  const comment = {
    offset: {
      start: offsets[0],
      end: offsets[1],
    },
    commenter: {
      name: username,
    },
    comment: content,
  };

  const res = await fetch(
    `${apiEndpoint}comment/${encodeURIComponent(new URL(window.location.href).pathname)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...comment,
        commit_hash: commitHash,
      }),
    },
  );
  if (!res.ok) {
    throw res;
  }

  if (commentsCache) {
    commentsCache.push({
      ...comment,
      id: commentsCache.length,
      created_time: new Date().toISOString(),
    });
  }

  _updateAvailableComments({ apiEndpoint });
};

const _fetchComments = async ({ apiEndpoint }: { apiEndpoint: string }) => {
  if (commentsCache) {
    return commentsCache;
  }

  apiEndpoint = apiEndpoint.endsWith("/") ? apiEndpoint : apiEndpoint + "/";
  const res = await fetch(
    `${apiEndpoint}comment/${encodeURIComponent(new URL(window.location.href).pathname)}`,
  );
  if (!res.ok) {
    throw res;
  }

  const comments = (await res.json()).data as Comment[];
  commentsCache = comments;

  return comments;
};

const _renderComments = (comments: Comment[]) => {
  const commentsEl = document.querySelector(
    "#user-comments",
  )! as HTMLDivElement;

  const fragment = document.createDocumentFragment();

  for (const comment of comments) {
    const container = document.createElement("div");
    container.classList.add("comment_container");
    container.innerHTML = `
      <div class="comment_header">
        <span class="comment_commenter">${comment.commenter.name}</span>
        <span class="comment_time">${dateTimeFormatter.format(new Date(comment.created_time))}</span>
      </div>
      <p class="comment_content">${comment.comment}</p>
      `.trim();
    fragment.appendChild(container);
  }

  while (commentsEl.firstChild) {
    commentsEl.removeChild(commentsEl.firstChild);
  }
  commentsEl.appendChild(fragment);
};

const _updateAvailableComments = async ({
  apiEndpoint,
}: {
  apiEndpoint: string;
}) => {
  const offsets = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".review_enabled[data-original-document-start][data-original-document-end]",
    ),
  );

  await _fetchComments({ apiEndpoint });

  for (let offset of offsets) {
    offset.classList.remove("review_has_comments");
    if (
      commentsCache!.find(
        (it) =>
          it.offset.start ===
            parseInt(offset!.dataset.originalDocumentStart!) &&
          it.offset.end === parseInt(offset!.dataset.originalDocumentEnd!),
      )
    ) {
      offset.classList.add("review_has_comments");
    }
  }
};

export function setupReview(
  el: Element,
  { apiEndpoint = "/api" }: { apiEndpoint?: string } = {},
) {
  const offsets = Array.from(
    el.querySelectorAll<HTMLElement>(
      "[data-original-document-start][data-original-document-end]",
    ),
  );

  if (!offsets) return;

  for (let offset of offsets) {
    offset.classList.add("review_enabled");
    offset.addEventListener("click", _openContextMenu);
  }

  _registerActionPopup({
    id: "review-context-menu-popup",
    content: `
      <div class="popup_content">
          <button class="popup_item" data-action="review">
              <iconify-icon icon="mdi-light:comment-text"></iconify-icon>
              <span>评论该段</span>
          </button>
          <button class="popup_item" data-action="comments">
              <iconify-icon icon="mdi-light:comment"></iconify-icon>
              <span>查看该段评论</span>
          </button>
      </div>
      `,
    actions: new Map<string, Function>([
      [
        "review",
        () => {
          popup.hidePopover();
          (
            document.querySelector("#review-content")! as HTMLSpanElement
          ).textContent = selectedOffset!.textContent;
          (
            document.querySelector("#review-input")! as HTMLTextAreaElement
          ).value = "";
          (
            document.querySelector("#review-notification")! as HTMLSpanElement
          ).textContent = "";
          review.showModal();
        },
      ],
      [
        "comments",
        async () => {
          popup.hidePopover();
          (
            document.querySelector("#comments-content")! as HTMLSpanElement
          ).textContent = selectedOffset!.textContent;
          _renderComments(
            (await _fetchComments({ apiEndpoint })).filter(
              (it) =>
                it.offset.start ===
                  parseInt(selectedOffset!.dataset.originalDocumentStart!) &&
                it.offset.end ===
                  parseInt(selectedOffset!.dataset.originalDocumentEnd!),
            ),
          );
          comments.showPopover();
        },
      ],
    ]),
  });

  _registerActionPopup({
    id: "review-context-menu-review",
    content: `
      <div class="popup_inner">
        <div class="popup_header">
          <span id="review-content"></span>
        </div>
        <div class="popup_content">
          <textarea id="review-input" required placeholder="写下你的评论..." autocapitalize="sentences" autocomplete="on" spellcheck="true" autofocus="true"></textarea>
          <div class="popup_bottom">
            <div class="popup_input_username">
              <span>署名：</span>
              <input id="review-username" required></input>
            </div>
            <div class="popup_actions">
              <span id="review-notification"></span>
              <button class="popup_item" data-action="cancel">取消</button>
              <button class="popup_item popup_item_primary" data-action="submit">提交</button>
            </div>
          </div>
        </div>
      </div>
      `,
    actions: new Map<string, Function>([
      [
        "cancel",
        () => {
          review.close();
        },
      ],
      [
        "submit",
        async () => {
          const username = document.querySelector(
            "#review-username",
          )! as HTMLInputElement;
          const content = document.querySelector(
            "#review-input",
          )! as HTMLTextAreaElement;
          const notification = document.querySelector(
            "#review-notification",
          )! as HTMLSpanElement;

          if (!username.checkValidity()) {
            notification.textContent = "请填写署名";
            return;
          }

          if (!content.checkValidity()) {
            notification.textContent = "请填写评论内容";
            return;
          }

          notification.textContent = "";

          try {
            await _submitComment({
              apiEndpoint,
              offsets: [
                parseInt(selectedOffset!.dataset.originalDocumentStart!),
                parseInt(selectedOffset!.dataset.originalDocumentEnd!),
              ],
              username: username.value,
              content: content.value,
            });

            review.close();
          } catch (e: unknown) {
            console.error(e);
            notification.textContent = "提交失败，请稍后再试";
          }
        },
      ],
    ]),
    isModal: true,
  });

  _registerActionPopup({
    id: "review-context-menu-comments",
    content: `
      <div class="popup_inner">
        <div class="popup_header">
          <span id="comments-content"></span>
        </div>
        <div class="popup_content">
          <div id="user-comments"></div>
          <div class="popup_bottom">
            <div class="popup_actions">
              <button class="popup_item" data-action="cancel">关闭</button>
            </div>
          </div>
        </div>
      </div>
    `,
    actions: new Map<string, Function>([
      [
        "cancel",
        () => {
          comments.hidePopover();
        },
      ],
    ]),
  });

  _updateAvailableComments({ apiEndpoint });

  popup = document.querySelector(
    "#review-context-menu-popup",
  )! as HTMLDivElement;
  review = document.querySelector(
    "#review-context-menu-review",
  )! as HTMLDialogElement;
  comments = document.querySelector(
    "#review-context-menu-comments",
  )! as HTMLDivElement;
}
