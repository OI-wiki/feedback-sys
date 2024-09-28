import iconDefaultAvatar from "iconify/account-circle";
import iconShare from "iconify/share";
import iconEdit from "iconify/edit";
import iconDelete from "iconify/delete";
import { Comment } from "../types";
import { getJWT, decodeJWT, logout, githubMeta } from "../auth";
import { apiEndpoint } from "../const";
import { groupBy, dateTimeFormatter } from "../util";

let selectedOffset: HTMLElement | null = null;

let commentsCache: Comment[] | undefined;

let commentsButton: HTMLElement;
let commentsPanel: HTMLElement;

export const resetCommentsCache = () => {
  commentsCache = undefined;
};

export const setCommentsButton = (button: HTMLElement) => {
  commentsButton = button;
};

export const setCommentsPanel = (panel: HTMLElement) => {
  commentsPanel = panel;
};

export const handleAnchor = async () => {
  const url = new URL(window.location.href);
  const anchor = url.hash;
  if (!anchor) return;

  const rawCommentId = /#comment-(\d+)/.exec(anchor)?.[1];
  if (!rawCommentId) return;
  const commentId = parseInt(rawCommentId);

  await fetchComments();
  const comment = commentsCache?.find((it) => it.id === commentId);
  if (!comment) return;

  const offsets = [comment.offset.start, comment.offset.end];
  const paragraph = document.querySelector<HTMLDivElement>(
    `[data-review-enabled][data-original-document-start="${offsets[0]}"][data-original-document-end="${offsets[1]}"]`,
  );
  if (!paragraph) return;

  await selectOffsetParagraph({
    el: paragraph,
    focusReply: true,
  });

  const commentEl = document.querySelector<HTMLDivElement>(
    `.comment[data-id="${commentId}"]`,
  );

  commentEl?.classList.add("comment_highlighting");
  commentEl?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
};

export const registerDialog = ({
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

export const selectOffsetParagraph = async ({
  el,
  focusReply = false,
}: {
  el: HTMLElement;
  focusReply?: boolean;
}) => {
  if (selectedOffset !== el) {
    delete selectedOffset?.dataset.reviewSelected;
    selectedOffset = el;
  }

  if (selectedOffset?.dataset.reviewHasComments || focusReply) {
    delete selectedOffset.dataset.reviewFocused;
    selectedOffset.dataset.reviewSelected = "true";
    await openCommentsPanel();
  }
};

export const unselectOffsetParagraph = () => {
  delete selectedOffset?.dataset.reviewSelected;
  selectedOffset = null;
};

export const openCommentsPanel = async () => {
  const comments = [...(await fetchComments())];

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

  await renderComments(comments);
  let selectedCommentsGroup = document.querySelector(
    `#review-comments-panel .comments_group[data-original-document-start="${selectedOffset?.dataset.originalDocumentStart}"][data-original-document-end="${selectedOffset?.dataset.originalDocumentEnd}"]`,
  ) as HTMLElement;

  if (selectedCommentsGroup) {
    selectedCommentsGroup.dataset.reviewSelected = "true";
  }
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

export const closeCommentsPanel = () => {
  commentsPanel.classList.add("review_hidden");
  commentsButton.classList.remove("review_hidden");
};

export const submitComment = async ({
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
        Authorization: `Bearer ${getJWT()}`,
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
        name: decodeJWT()?.name ?? "未知用户",
        oauth_provider: decodeJWT()?.provider as "github",
        oauth_user_id: decodeJWT()?.id ?? "-1",
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

  await fetchComments(true);
  updateAvailableComments();
};

export const _modifyComment = async ({
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
        Authorization: `Bearer ${getJWT()}`,
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

  await fetchComments(true);
  updateAvailableComments();
};

export const _deleteComment = async ({ id }: { id: number }) => {
  const res = fetch(
    `${apiEndpoint}comment/${encodeURIComponent(new URL(window.location.href).pathname)}/id/${id}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getJWT()}`,
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

  await fetchComments(true);
  updateAvailableComments();
};

export const fetchComments = async (force: boolean = false) => {
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

export const renderComments = async (comments: Comment[]) => {
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
      `[data-review-enabled][data-original-document-start="${container.dataset.originalDocumentStart}"][data-original-document-end="${container.dataset.originalDocumentEnd}"]`,
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
    ) as HTMLSpanElement;

    const commentActionsLogin = container.querySelector(
      ".comment_actions_login",
    ) as HTMLDivElement;

    const commentActionsLogout = container.querySelector(
      "button.comment_actions_item[data-action='logout']",
    ) as HTMLButtonElement;

    const userInfo = decodeJWT();
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
      if (paragraph) {
        paragraph.dataset.reviewFocused = "true";
      }
    });
    container.addEventListener("mouseleave", () => {
      delete paragraph?.dataset.reviewFocused;
    });
    container.addEventListener("click", (e) => {
      e.stopPropagation();
      delete selectedOffset?.dataset.reviewSelected;
      delete paragraph?.dataset.reviewFocused;
      delete paragraph?.dataset.reviewSelected;
      delete (
        document.querySelector(".comments_group[data-review-selected]") as
          | HTMLElement
          | undefined
      )?.dataset.reviewSelected;
      container.dataset.reviewSelected = "true";
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
              <a class="comment_commenter"></a>
              <span class="comment_time comment_created_time">发布于 ${dateTimeFormatter.format(new Date(comment.created_time))}</span>
              <span class="comment_time comment_edited_time">最后编辑于 ${comment.last_edited_time ? dateTimeFormatter.format(new Date(comment.last_edited_time)) : ""}</span>
              <div class="comment_actions">
                <button class="comment_actions_item" data-action="copy_permalink" title="分享">${iconShare}</button>
                <button class="comment_actions_item comment_actions_item_administration" data-action="modify" title="编辑">${iconEdit}</button>
                <button class="comment_actions_item comment_actions_item_administration" data-action="delete" title="删除">${iconDelete}</button>
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
      const commenter = commentEl.querySelector(
        ".comment_commenter",
      )! as HTMLAnchorElement;
      if (comment.commenter.name) {
        commenter.textContent = comment.commenter.name;
        commenter.title = comment.commenter.name;
      }

      const userAvatar = commentEl.querySelector(
        ".comment_user_avatar",
      ) as HTMLDivElement;

      if (comment.commenter.profile_url) {
        commenter.target = "_blank";
        commenter.href = comment.commenter.profile_url;
        userAvatar.style.cursor = "pointer";
        userAvatar.addEventListener("click", () => {
          window.open(comment.commenter.profile_url);
        });
      }

      if (!comment.commenter.avatar_url) {
        userAvatar.innerHTML = iconDefaultAvatar;
      }

      commentEl.querySelector(".comment_main .comment_content")!.textContent =
        comment.comment;

      const commentActionsHeader = commentEl.querySelector(
        ".comment_header .comment_actions",
      ) as HTMLDivElement;

      let shouldShowAdministrationActions = true;
      let shouldShowCommonActions = true;

      if (
        !userInfo ||
        userInfo.provider !== comment.commenter.oauth_provider ||
        userInfo.id !== comment.commenter.oauth_user_id
      ) {
        shouldShowAdministrationActions = false;
      }

      if (userInfo && userInfo.isAdmin === true) {
        shouldShowAdministrationActions = true;
      }

      if (comment.id === -1) {
        shouldShowAdministrationActions = false;
      }

      if (!shouldShowAdministrationActions) {
        commentActionsHeader
          .querySelectorAll<HTMLButtonElement>(
            ".comment_actions_item_administration",
          )
          .forEach((it) => {
            it.style.display = "none";
          });
      }

      if (!shouldShowAdministrationActions && !shouldShowCommonActions) {
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
      actions.addEventListener("click", async () => {
        const target = actions as HTMLButtonElement;

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
              logout();
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
          case "copy_permalink": {
            target.dataset.tag = "using";
            const commentEl = container.querySelector(
              `.comment:has([data-tag="using"][data-action="${target?.dataset.action}"])`,
            ) as HTMLDivElement;
            delete target.dataset.tag;
            const id = commentEl?.dataset?.id;
            if (id == undefined) return;

            const permalink = new URL(window.location.href);
            permalink.hash = `#comment-${id}`;
            await navigator.clipboard.writeText(permalink.toString());
            notification.textContent = "已复制评论链接地址";
            break;
          }
          case "login": {
            if (!githubMeta) {
              console.log("githubMeta not ready");
              return;
            }
            window.location.href = `https://github.com/login/oauth/authorize?client_id=${githubMeta.client_id}&state=${encodeURIComponent(JSON.stringify({ redirect: window.location.href }))}`;
            break;
          }
          case "logout": {
            logout();
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
            await openCommentsPanel();
            const newSubmitButton = commentsPanel.querySelector(
              "[data-review-selected] button[data-action='submit']",
            ) as HTMLButtonElement;

            if (newSubmitButton) {
              newSubmitButton.disabled = true;
            }

            try {
              await submitComment({
                offsets: [
                  parseInt(selectedOffset!.dataset.originalDocumentStart!),
                  parseInt(selectedOffset!.dataset.originalDocumentEnd!),
                ],
                content: textarea.value,
              });

              textarea.value = "";
              notification.textContent = "";
            } catch (error) {
              _handleError(error);
            } finally {
              await openCommentsPanel();

              const newNotification = commentsPanel.querySelector(
                "[data-review-selected] .comment_actions_notification",
              );
              const newTextArea = commentsPanel.querySelector(
                "[data-review-selected] .comment_actions_panel textarea",
              ) as HTMLTextAreaElement;

              if (newNotification) {
                newNotification.textContent = notification.textContent;
              }
              if (newTextArea) {
                newTextArea.value = textarea.value;
              }
            }

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
            await openCommentsPanel();

            try {
              await _modifyComment({
                id: parseInt(id),
                comment: textarea.value,
              });

              textarea.value = "";
              notification.textContent = "";
            } catch (error) {
              _handleError(error);
            } finally {
              await openCommentsPanel();

              const newNotification = commentsPanel.querySelector(
                "[data-review-selected] .comment_actions_notification",
              );
              const newTextArea = commentsPanel.querySelector(
                "[data-review-selected] .comment_actions_panel textarea",
              ) as HTMLTextAreaElement;

              if (newNotification) {
                newNotification.textContent = notification.textContent;
              }
              if (newTextArea) {
                newTextArea.value = textarea.value;
              }
            }

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
                openCommentsPanel().then(() => {
                  const newNotification = commentsPanel.querySelector(
                    "[data-review-selected] .comment_actions_notification",
                  );
                  const newTextArea = commentsPanel.querySelector(
                    "[data-review-selected] .comment_actions_panel textarea",
                  ) as HTMLTextAreaElement;
                  if (newNotification) {
                    newNotification.textContent = notification.textContent;
                  }
                  if (newTextArea) {
                    newTextArea.value = textarea.value;
                  }
                });
              });

            openCommentsPanel().then(() => {
              const newNotification = commentsPanel.querySelector(
                "[data-review-selected] .comment_actions_notification",
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
      commentMain.style.maxHeight = commentMain.scrollHeight + "px";
    });
    commentFold.addEventListener("click", () => {
      commentExpand.style.display = "";
      commentFold.style.display = "none";
      commentMain.style.maxHeight = `${offsetHeight}px`;
    });
  }
};

export const updateAvailableComments = async () => {
  const offsets = Array.from(
    document.querySelectorAll<HTMLElement>(
      "[data-review-enabled][data-original-document-start][data-original-document-end]",
    ),
  );

  await fetchComments();

  for (let offset of offsets) {
    delete offset.dataset.reviewHasComments;
    if (
      commentsCache!.find(
        (it) =>
          it.offset.start ===
            parseInt(offset!.dataset.originalDocumentStart!) &&
          it.offset.end === parseInt(offset!.dataset.originalDocumentEnd!),
      )
    ) {
      offset.dataset.reviewHasComments = "true";
    }
  }
};
