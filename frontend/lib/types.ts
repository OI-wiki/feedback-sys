export type Comment = {
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
    profile_url?: string;
  };
  comment: string;
  created_time: string;
  last_edited_time: string | null;
  pending?: boolean;
};

export type GitHubMeta = {
  client_id: string;
};

export type JWTPayload = {
  provider: "github";
  id: string;
  name: string;
  isAdmin?: boolean;
};
