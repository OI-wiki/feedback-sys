import { GitHubMeta, JWTPayload } from "./types";
import { apiEndpoint } from "./const";

export const fetchGitHubMeta = async (): Promise<GitHubMeta> => {
  const res = await fetch(`${apiEndpoint}meta/github-app`, {
    method: "GET",
  });

  if (!res.ok) {
    throw res;
  }

  return (await res.json()).data;
};

export const handleOAuthToken = () => {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("oauth_token");
  if (!token) return;
  document.cookie = `oauth_token=${token}; path=/; expires=${new Date(JSON.parse(atob(token.split(".")[1])).exp * 1000).toUTCString()}; secure`;
  url.searchParams.delete("oauth_token");
  window.history.replaceState(null, "", url.toString());
};

export const getJWT = () => {
  // https://developer.mozilla.org/zh-CN/docs/Web/API/Document/cookie#%E7%A4%BA%E4%BE%8B_2_%E5%BE%97%E5%88%B0%E5%90%8D%E4%B8%BA_test2_%E7%9A%84_cookie
  return document.cookie.replace(
    /(?:(?:^|.*;\s*)oauth_token\s*\=\s*([^;]*).*$)|^.*$/,
    "$1",
  );
};

export const decodeJWT = () => {
  const jwt = getJWT();
  if (!jwt) return;
  const raw = jwt.split(".")[1];

  const bytes = Array.from(atob(raw), (char) => char.charCodeAt(0));
  const decodedString = new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  return JSON.parse(decodedString) as JWTPayload;
};

export const logout = () => {
  document.cookie =
    "oauth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure";
};
