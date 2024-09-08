import "./style.css";
import iconAddComment from "iconify/add-comment-outline-rounded";
import iconComment from "iconify/comment-outline-rounded";
import iconClose from "iconify/close";
import iconDefaultAvatar from "iconify/account-circle";

const groupBy = function <K extends string, T>(arr: T[], func: (el: T) => K) {
  return arr.reduce(
    (acc, x) => {
      (acc[func(x)] = acc[func(x)] || []).push(x);
      return acc;
    },
    {} as {
      [key: string]: T[];
    },
  );
};

type Comment = {
  id: number;
  offset: {
    start: number;
    end: number;
  };
  commenter: {
    oauth_provider: "github";
    oauth_user_id: string;
    name: string | null;
    avatar_url?: string;
  };
  comment: string;
  created_time: string;
  last_edited_time: string | null;
  pending?: boolean;
};

type GitHubMeta = {
  client_id: string;
};

type JWTPayload = {
  provider: "github";
  id: string;
  name: string;
  isAdmin?: boolean;
};

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "short",
  timeStyle: "short",
});

let globalInitialized = false;
let apiEndpoint = "/api";

let selectedOffset: HTMLElement | null = null;

let commentsCache: Comment[] | undefined;

let commentsButton: HTMLElement;
let commentsPanel: HTMLElement;

let githubMeta: GitHubMeta;

const _fetchGitHubMeta = async () => {
  const res = await fetch(`${apiEndpoint}meta/github-app`, {
    method: "GET",
  });

  if (!res.ok) {
    throw res;
  }

  if (!githubMeta) githubMeta = (await res.json()).data;
};

const _handleOAuthToken = () => {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("oauth_token");
  if (!token) return;
  document.cookie = `oauth_token=${token}; path=/; expires=${new Date(JSON.parse(atob(token.split(".")[1])).exp * 1000).toUTCString()}; secure`;
  url.searchParams.delete("oauth_token");
  window.history.replaceState(null, "", url.toString());
};

const _getJWT = () => {
  // https://developer.mozilla.org/zh-CN/docs/Web/API/Document/cookie#%E7%A4%BA%E4%BE%8B_2_%E5%BE%97%E5%88%B0%E5%90%8D%E4%B8%BA_test2_%E7%9A%84_cookie
  return document.cookie.replace(
    /(?:(?:^|.*;\s*)oauth_token\s*\=\s*([^;]*).*$)|^.*$/,
    "$1",
  );
};

const _decodeJWT = () => {
  const jwt = _getJWT();
  if (!jwt) return;
  const payload = atob(jwt.split(".")[1]);

  return JSON.parse(payload) as JWTPayload;
};

const _logout = () => {
  document.cookie =
    "oauth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure";
};

const _registerDialog = ({
  idOrClass,
  content,
  actions = new Map<string, (el: HTMLElement) => void>(),
  parent = document.body,
  insertPosition = "afterend",
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
  verifyId?: boolean;
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
  dialog = document.querySelector(
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

const _selectOffsetParagraph = ({
  el,
  focusReply = false,
}: {
  el: HTMLElement;
  focusReply?: boolean;
}) => {
  if (selectedOffset !== el) {
    selectedOffset?.classList.remove("review_selected");
    selectedOffset = el;
  }

  if (
    selectedOffset?.classList.contains("review_has_comments") === true ||
    focusReply
  ) {
    selectedOffset.classList.remove("review_focused");
    selectedOffset.classList.add("review_selected");
    _openCommentsPanel();
  }
};

const _unselectOffsetParagraph = () => {
  selectedOffset?.classList.remove("review_selected");
  selectedOffset = null;
};

const _openContextMenu = ({ el }: { el: HTMLElement }) => {
  const contextMenu = el.querySelector(`.review-context-menu`) as
    | HTMLDivElement
    | undefined;
  if (contextMenu) {
    contextMenu.style.display = "";
    console.log(contextMenu, "display set to '' openContextMenu");
    return;
  }
  _registerDialog({
    idOrClass: "review-context-menu",
    content: `
    <button data-action="comment">
      ${iconAddComment}
    </button>
    `,
    parent: el,
    insertPosition: "beforeend",
    actions: new Map([
      [
        "comment",
        (innerEl) => {
          innerEl.parentElement?.remove();
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
        el.classList.add("review_focused");
      });
      innerEl.addEventListener("mouseleave", () => {
        el.classList.remove("review_focused");
      });
    },
  });
};

const _closeContextMenu = ({ el }: { el: HTMLElement }) => {
  const contextMenu = el.querySelector(
    `.review-context-menu:not([style*="display: none"])`,
  ) as HTMLDivElement | undefined;
  if (contextMenu) {
    contextMenu.style.display = "none";
    console.log(contextMenu, "display set to none closeContextMenu");
  }
};

const _openCommentsPanel = async () => {
  const comments = [...(await _fetchComments())];

  const selected = selectedOffset;

  if (
    selected &&
    comments.find(
      (it) =>
        it.offset.start === parseInt(selected.dataset.originalDocumentStart!) &&
        it.offset.end === parseInt(selected.dataset.originalDocumentEnd!),
    ) === undefined
  ) {
    comments.push({
      id: -1,
      offset: {
        start: parseInt(selected.dataset.originalDocumentStart!),
        end: parseInt(selected.dataset.originalDocumentEnd!),
      },
      commenter: {
        name: "",
        oauth_provider: "github",
        oauth_user_id: "",
      },
      comment: "",
      created_time: new Date().toISOString(),
      last_edited_time: null,
      pending: true,
    });
  }

  _renderComments(comments);
  let selectedCommentsGroup = document.querySelector(
    `#review-comments-panel .comments_group[data-original-document-start="${selectedOffset?.dataset.originalDocumentStart}"][data-original-document-end="${selectedOffset?.dataset.originalDocumentEnd}"]`,
  );

  selectedCommentsGroup?.classList.add("review_selected");
  selectedCommentsGroup?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
  const textarea = selectedCommentsGroup?.querySelector(
    ".comment_actions_panel textarea",
  ) as HTMLTextAreaElement | undefined;
  textarea?.focus();

  commentsButton.classList.add("review_hidden");
  commentsPanel.classList.remove("review_hidden");
};

const _closeCommentsPanel = () => {
  commentsPanel.classList.add("review_hidden");
  commentsButton.classList.remove("review_hidden");
};

const _submitComment = async ({
  offsets,
  content,
}: {
  offsets: [number, number];
  content: string;
}) => {
  const commitHash = sessionStorage.getItem("commitHash");
  if (!commitHash) {
    throw new Error("找不到 Commit hash，请联系站点管理员");
  }

  const comment = {
    offset: {
      start: offsets[0],
      end: offsets[1],
    },
    comment: content,
  };

  const res = fetch(
    `${apiEndpoint}comment/${encodeURIComponent(new URL(window.location.href).pathname)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${_getJWT()}`,
      },
      body: JSON.stringify({
        ...comment,
        commit_hash: commitHash,
      }),
    },
  );

  const id = commentsCache?.length ?? -1;
  if (commentsCache) {
    commentsCache.push({
      ...comment,
      commenter: {
        name: _decodeJWT()?.name ?? "未知用户",
        oauth_provider: _decodeJWT()?.provider as "github",
        oauth_user_id: _decodeJWT()?.id ?? "-1",
      },
      id: commentsCache.length,
      created_time: new Date().toISOString(),
      last_edited_time: null,
      pending: true,
    });
  }

  const resp = await res;

  if (!resp.ok) {
    if (commentsCache) {
      commentsCache = commentsCache.filter((it) => it.id !== id);
    }
    throw resp;
  }

  if (commentsCache) {
    commentsCache = commentsCache.map((it) =>
      it.id === id ? { ...it, pending: false } : it,
    );
  }

  await _fetchComments(true);
  _updateAvailableComments();
};

const _modifyComment = async ({
  id,
  comment,
}: {
  id: number;
  comment: string;
}) => {
  const res = fetch(
    `${apiEndpoint}comment/${encodeURIComponent(new URL(window.location.href).pathname)}/id/${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${_getJWT()}`,
      },
      body: JSON.stringify({
        comment,
      }),
    },
  );

  if (commentsCache) {
    commentsCache = commentsCache.map((it) =>
      it.id === id ? { ...it, pending: true } : it,
    );
  }

  const resp = await res;

  if (!resp.ok) {
    if (commentsCache) {
      commentsCache = commentsCache.map((it) =>
        it.id === id ? { ...it, pending: false } : it,
      );
    }
    throw resp;
  }

  if (commentsCache) {
    commentsCache = commentsCache.map((it) =>
      it.id === id ? { ...it, comment, pending: false } : it,
    );
  }

  await _fetchComments(true);
  _updateAvailableComments();
};

const _deleteComment = async ({ id }: { id: number }) => {
  const res = fetch(
    `${apiEndpoint}comment/${encodeURIComponent(new URL(window.location.href).pathname)}/id/${id}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${_getJWT()}`,
      },
    },
  );

  if (commentsCache) {
    commentsCache = commentsCache.map((it) =>
      it.id === id ? { ...it, pending: true } : it,
    );
  }

  const resp = await res;

  if (!resp.ok) {
    if (commentsCache) {
      commentsCache = commentsCache.map((it) =>
        it.id === id ? { ...it, pending: false } : it,
      );
    }
    throw resp;
  }

  if (commentsCache) {
    commentsCache = commentsCache.filter((it) => it.id !== id);
  }

  await _fetchComments(true);
  _updateAvailableComments();
};

const _fetchComments = async (force: boolean = false) => {
  if (!force && commentsCache) {
    return commentsCache;
  }

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
  const commentsEl = commentsPanel.querySelector(
    ".panel_main",
  )! as HTMLDivElement;

  const fragment = document.createDocumentFragment();

  const group = groupBy(
    comments,
    (it) => `${it.offset.start}-${it.offset.end}`,
  );
  for (const key of Object.keys(group).sort(
    (a, b) => parseInt(a.split("-")[0]) - parseInt(b.split("-")[0]),
  )) {
    const container = document.createElement("div");
    container.classList.add("comments_group");

    const offsets = key.split("-");
    container.dataset.originalDocumentStart = offsets[0];
    container.dataset.originalDocumentEnd = offsets[1];

    const paragraph = document.querySelector<HTMLDivElement>(
      `.review_enabled[data-original-document-start="${container.dataset.originalDocumentStart}"][data-original-document-end="${container.dataset.originalDocumentEnd}"]`,
    );
    const content = paragraph?.textContent ?? "";

    container.innerHTML = `
      <div class="comments_group_header">
        <span class="comments_group_text_content">${content}</span>
      </div>
      <div class="comments_group_main"></div>
      <div class="comments_group_footer">
        <div class="comment_actions_panel">
          <div class="comment_actions_header">
            <span class="comment_username"></span>
            <button class="comment_actions_item" data-action="logout">退出登录</button>
          </div>
          <textarea required placeholder="写下你的评论..."  autocapitalize="sentences" autocomplete="on" spellcheck="true" maxlength="65535"></textarea>
          <div class="comment_actions_footer">
            <span class="comment_actions_notification"></span>
            <div class="comment_actions comment_actions_login">
              <button class="comment_actions_item comment_actions_item_btn comment_actions_item_btn_primary" data-action="login">登录到 GitHub</button>
            </div>
            <div class="comment_actions comment_actions_modify">
              <button class="comment_actions_item comment_actions_item_btn" data-action="modify_cancel">取消</button>
              <button class="comment_actions_item comment_actions_item_btn comment_actions_item_btn_primary" data-action="modify_submit">修改</button>
            </div>
            <div class="comment_actions comment_actions_reply">
              <button class="comment_actions_item comment_actions_item_btn" data-action="cancel">取消</button>
              <button class="comment_actions_item comment_actions_item_btn comment_actions_item_btn_primary" data-action="submit">提交</button>
            </div>
          </div>
        </div>
      </div>
    `.trim();

    const _updateTextareaHeight = (textarea: HTMLTextAreaElement) => {
      textarea.style.height = "5px";
      textarea.style.height = textarea.scrollHeight + "px";
    };

    container
      .querySelector(".comment_actions_panel textarea")!
      .addEventListener("input", (e) => {
        const element = e.currentTarget as HTMLTextAreaElement;
        _updateTextareaHeight(element);
      });

    const username = container.querySelector(
      ".comment_username",
    ) as HTMLDivElement;

    const commentActionsLogin = container.querySelector(
      ".comment_actions_login",
    ) as HTMLDivElement;

    const commentActionsLogout = container.querySelector(
      "button.comment_actions_item[data-action='logout']",
    ) as HTMLButtonElement;

    const userInfo = _decodeJWT();
    if (!userInfo) {
      username.textContent = "登录到 GitHub 以发表评论";
      commentActionsLogout.style.display = "none";
    } else {
      username.textContent = `作为 ${userInfo.name} 发表评论`;
      commentActionsLogin.style.display = "none";
    }

    const commentActionsModify = container.querySelector(
      ".comment_actions_modify",
    ) as HTMLDivElement;

    commentActionsModify.style.display = "none";

    container.addEventListener("mouseenter", () => {
      paragraph?.classList.add("review_focused");
    });
    container.addEventListener("mouseleave", () => {
      paragraph?.classList.remove("review_focused");
    });
    container.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedOffset?.classList.remove("review_selected");
      paragraph?.classList.remove("review_focused");
      paragraph?.classList.add("review_selected");
      document
        .querySelector(".comments_group.review_selected")
        ?.classList.remove("review_selected");
      container.classList.add("review_selected");
      selectedOffset = paragraph;
      selectedOffset?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    const commentsGroup = group[key].sort(
      (a, b) =>
        new Date(a.created_time).getTime() - new Date(b.created_time).getTime(),
    );
    const main = container.querySelector(".comments_group_main")!;

    for (const comment of commentsGroup) {
      if (comment.id === -1) continue;

      const commentEl = document.createElement("div");
      commentEl.classList.add("comment");
      if (comment.pending) {
        commentEl.classList.add("comment_pending");
      }
      commentEl.dataset.id = comment.id.toString();
      commentEl.innerHTML = `
        <div class="comment_container">
          <div class="comment_side">
            <div class="comment_user_avatar">
              <img src="${comment.commenter.avatar_url}" alt="user avatar"/>
            </div>
          </div>
          <div class="comment_base">
            <div class="comment_header">
              <span class="comment_commenter"></span>
              <span class="comment_time comment_created_time">发布于 ${dateTimeFormatter.format(new Date(comment.created_time))}</span>
              <span class="comment_time comment_edited_time">最后编辑于 ${comment.last_edited_time ? dateTimeFormatter.format(new Date(comment.last_edited_time)) : ""}</span>
              <div class="comment_actions">
                <button class="comment_actions_item" data-action="modify">修改</button>
                <button class="comment_actions_item" data-action="delete">删除</button>
              </div>
            </div>
            <div class="comment_main">
              <span class="comment_content"></span>
              <span class="comment_edit_tag">(已编辑)</span>
            </div>
          </div>
        </div>
        <div class="comment_tailing">
          <button class="comment_actions_item comment_expand" data-action="expand">展开</button>
          <button class="comment_actions_item comment_expand" data-action="fold">折叠</button>
        </div>
      `.trim();
      commentEl.querySelector(".comment_commenter")!.textContent =
        comment.commenter.name;
      commentEl.querySelector(".comment_main .comment_content")!.textContent =
        comment.comment;

      if (!comment.commenter.avatar_url) {
        const userAvatar = commentEl.querySelector(
          ".comment_user_avatar",
        ) as HTMLDivElement;
        userAvatar.innerHTML = iconDefaultAvatar;
      }

      const commentActionsHeader = commentEl.querySelector(
        ".comment_header .comment_actions",
      ) as HTMLDivElement;

      if (
        !userInfo ||
        userInfo.provider !== comment.commenter.oauth_provider ||
        userInfo.id !== comment.commenter.oauth_user_id
      ) {
        commentActionsHeader.style.display = "none";
      }

      if (userInfo && userInfo.isAdmin === true) {
        commentActionsHeader.style.display = "";
      }

      if (comment.id === -1) {
        commentActionsHeader.style.display = "none";
      }

      const commentHeaderCreatedTime = commentEl.querySelector(
        ".comment_header .comment_created_time",
      ) as HTMLSpanElement;

      const commentHeaderEditedTime = commentEl.querySelector(
        ".comment_header .comment_edited_time",
      ) as HTMLSpanElement;

      commentHeaderEditedTime.style.display = "none";

      if (comment.last_edited_time) {
        commentHeaderCreatedTime.addEventListener("click", () => {
          commentHeaderCreatedTime.style.display = "none";
          commentHeaderEditedTime.style.display = "";
        });
      }

      commentHeaderEditedTime.addEventListener("click", () => {
        commentHeaderCreatedTime.style.display = "";
        commentHeaderEditedTime.style.display = "none";
      });

      const commentEditTag = commentEl.querySelector(
        ".comment_main .comment_edit_tag",
      ) as HTMLSpanElement;

      if (!comment.last_edited_time) {
        commentEditTag.style.display = "none";
      }

      main.appendChild(commentEl);
    }

    for (const actions of container.querySelectorAll(".comment_actions_item")) {
      actions.addEventListener("click", (e) => {
        if (!(e.target instanceof HTMLButtonElement)) return;
        const target = e.target as HTMLButtonElement;

        const textarea = container.querySelector(
          ".comment_actions_panel textarea",
        ) as HTMLTextAreaElement;

        const notification = container.querySelector(
          ".comment_actions_notification",
        ) as HTMLSpanElement;

        const _handleError = async (e: any) => {
          console.error(e);

          if (e instanceof Error) {
            notification.textContent = e.message;
          } else if (e instanceof Response) {
            if (e.status === 401) {
              notification.textContent = "身份验证失效，请重新登录";
              _logout();
              return;
            }
            if (
              e.headers.get("content-type")?.includes("application/json") ===
              true
            ) {
              const json = (await e.json()) as {
                status: number;
                error: string;
              };
              notification.textContent = json.error;
            } else {
              notification.textContent = `未知接口错误：${e.status}(${e.statusText})`;
            }
          } else {
            notification.textContent = "提交失败，请稍后再试";
          }
        };

        switch (target?.dataset.action) {
          case "login": {
            if (!githubMeta) {
              console.log("githubMeta not ready");
              return;
            }
            window.location.href = `https://github.com/login/oauth/authorize?client_id=${githubMeta.client_id}&state=${encodeURIComponent(JSON.stringify({ redirect: window.location.href }))}`;
            break;
          }
          case "logout": {
            _logout();
            window.location.reload();
            break;
          }
          case "cancel": {
            textarea.disabled = false;
            textarea.value = "";
            notification.textContent = "";
            _updateTextareaHeight(textarea);
            break;
          }
          case "submit": {
            textarea.disabled = true;

            if (!textarea.checkValidity()) {
              notification.textContent = "请填写评论内容";
              textarea.disabled = false;
              return;
            }

            notification.textContent = "";

            _submitComment({
              offsets: [
                parseInt(selectedOffset!.dataset.originalDocumentStart!),
                parseInt(selectedOffset!.dataset.originalDocumentEnd!),
              ],
              content: textarea.value,
            })
              .then(() => {
                textarea.value = "";
                notification.textContent = "";
              })
              .catch(_handleError)
              .finally(() => {
                _openCommentsPanel().then(() => {
                  const newNotification = commentsPanel.querySelector(
                    ".review_selected .comment_actions_notification",
                  );
                  const newTextArea = commentsPanel.querySelector(
                    ".review_selected .comment_actions_panel textarea",
                  ) as HTMLTextAreaElement;
                  if (newNotification) {
                    newNotification.textContent = notification.textContent;
                  }
                  if (newTextArea) {
                    newTextArea.value = textarea.value;
                  }
                });
              });

            _openCommentsPanel().then(() => {
              const newSubmitButton = commentsPanel.querySelector(
                ".review_selected button[data-action='submit']",
              ) as HTMLButtonElement;
              if (newSubmitButton) {
                newSubmitButton.disabled = true;
              }
            });
            break;
          }
          case "modify": {
            container
              .querySelector(
                `.comment[data-id="${container.dataset.modifingId}"]`,
              )
              ?.classList.remove("comment_pending");

            target.dataset.tag = "using";
            const commentEl = container.querySelector(
              `.comment:has([data-tag="using"][data-action="${target?.dataset.action}"])`,
            ) as HTMLDivElement;
            delete target.dataset.tag;
            const id = commentEl?.dataset?.id;
            if (id == undefined) return;

            commentEl?.classList.add("comment_pending");
            commentActionsModify.style.display = "";
            container.dataset.modifingId = id;

            textarea.value =
              commentsCache?.find((it) => it.id === parseInt(id))?.comment ??
              "";

            const footer = container.querySelector(
              ".comments_group_footer",
            ) as HTMLDivElement;
            footer.style.display = "block";
            _updateTextareaHeight(textarea);
            footer.style.display = "";
            break;
          }
          case "modify_cancel": {
            container
              .querySelector(
                `.comment[data-id="${container.dataset.modifingId}"]`,
              )
              ?.classList.remove("comment_pending");
            commentActionsModify.style.display = "none";
            delete container.dataset.modifingId;
            textarea.disabled = false;
            textarea.value = "";
            notification.textContent = "";

            _updateTextareaHeight(textarea);
            break;
          }
          case "modify_submit": {
            const id = container.dataset.modifingId;
            if (id == undefined) return;

            _modifyComment({ id: parseInt(id), comment: textarea.value })
              .then(() => {
                textarea.value = "";
                notification.textContent = "";
              })
              .catch(_handleError)
              .finally(() => {
                _openCommentsPanel().then(() => {
                  const newNotification = commentsPanel.querySelector(
                    ".review_selected .comment_actions_notification",
                  );
                  const newTextArea = commentsPanel.querySelector(
                    ".review_selected .comment_actions_panel textarea",
                  ) as HTMLTextAreaElement;
                  if (newNotification) {
                    newNotification.textContent = notification.textContent;
                  }
                  if (newTextArea) {
                    newTextArea.value = textarea.value;
                  }
                });
              });

            _openCommentsPanel();
            break;
          }
          case "delete": {
            target.dataset.tag = "using";
            const commentEl = container.querySelector(
              `.comment:has([data-tag="using"][data-action="${target?.dataset.action}"])`,
            ) as HTMLDivElement;
            delete target.dataset.tag;
            const id = commentEl.dataset?.id;
            if (id == undefined) return;

            _deleteComment({ id: parseInt(id) })
              .catch(_handleError)
              .finally(() => {
                _openCommentsPanel().then(() => {
                  const newNotification = commentsPanel.querySelector(
                    ".review_selected .comment_actions_notification",
                  );
                  const newTextArea = commentsPanel.querySelector(
                    ".review_selected .comment_actions_panel textarea",
                  ) as HTMLTextAreaElement;
                  if (newNotification) {
                    newNotification.textContent = notification.textContent;
                  }
                  if (newTextArea) {
                    newTextArea.value = textarea.value;
                  }
                });
              });

            _openCommentsPanel().then(() => {
              const newNotification = commentsPanel.querySelector(
                ".review_selected .comment_actions_notification",
              );
              const newDeleteButton = commentsPanel.querySelector(
                `.comment[data-id="${id}"] button[data-action="delete"]`,
              ) as HTMLButtonElement;
              const newModifyButton = commentsPanel.querySelector(
                `.comment[data-id="${id}"] button[data-action="modify"]`,
              ) as HTMLButtonElement;
              if (newNotification) {
                newNotification.textContent = notification.textContent;
              }
              if (newDeleteButton) {
                newDeleteButton.disabled = true;
              }
              if (newModifyButton) {
                newModifyButton.disabled = true;
              }
            });
            break;
          }
        }
      });
    }

    fragment.appendChild(container);
  }

  while (commentsEl.firstChild) {
    commentsEl.removeChild(commentsEl.firstChild);
  }
  commentsEl.appendChild(fragment);

  for (const commentEl of commentsPanel.querySelectorAll<HTMLDivElement>(
    ".comment",
  )) {
    const commentMain = commentEl.querySelector(
      ".comment_main",
    ) as HTMLDivElement;
    const commentExpand = commentEl.querySelector(
      `.comment_tailing .comment_expand[data-action="expand"]`,
    ) as HTMLButtonElement;
    const commentFold = commentEl.querySelector(
      `.comment_tailing .comment_expand[data-action="fold"]`,
    ) as HTMLButtonElement;

    const offsetHeight = commentMain.offsetHeight;
    if (commentMain.scrollHeight <= offsetHeight) {
      commentExpand.style.display = "none";
    }
    commentFold.style.display = "none";

    commentExpand.addEventListener("click", () => {
      commentExpand.style.display = "none";
      commentFold.style.display = "";
      commentMain.style.maxHeight = "100%";
      commentMain.style.maxHeight = commentMain.scrollHeight + "px";
    });
    commentFold.addEventListener("click", () => {
      commentExpand.style.display = "";
      commentFold.style.display = "none";
      commentMain.style.maxHeight = `${offsetHeight}px`;
    });
  }
};

const _updateAvailableComments = async () => {
  const offsets = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".review_enabled[data-original-document-start][data-original-document-end]",
    ),
  );

  await _fetchComments();

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

export const __VERSION__: string = __LIB_VERSION__;

export function setupReview(
  el: Element,
  { apiEndpoint: endpoint = "/api" }: { apiEndpoint?: string } = {},
) {
  apiEndpoint = endpoint.endsWith("/") ? endpoint : endpoint + "/";

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
    offset.classList.add("review_enabled");
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
    _openContextMenu({
      el: offset,
    });
    _closeContextMenu({
      el: offset,
    });
  }

  // clear cache
  commentsCache = undefined;

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

  commentsButton = _registerDialog({
    idOrClass: "review-comments-button",
    content: `
    <button data-action="open">
      ${iconComment}
    </button>
    `,
    actions: new Map([["open", () => _openCommentsPanel()]]),
  });

  commentsPanel = _registerDialog({
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
    insertPosition: "beforeend",
    actions: new Map([["close", () => _closeCommentsPanel()]]),
  });

  // initialize comments panel position
  _closeCommentsPanel();

  console.log(
    `oiwiki-feedback-sys-frontend version ${__VERSION__} has been successfully installed.`,
  );

  globalInitialized = true;
}
