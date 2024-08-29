export type PostCommentBody = {
	offset: {
		start: number;
		end: number;
	};
	comment: string;
	commit_hash: string;
};

export type PostComment = {
	commenter: {
		oauth_provider: string;
		oauth_user_id: string;
	};
} & Omit<PostCommentBody, 'commit_hash'> & {
		path: string;
	};

export type GetCommentBody = {
	path: string;
};

export type GetComment = GetCommentBody;

export type GetCommentRespBody = {
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
}[];

export type PutCommitHashBody = {
	commit_hash: string;
};

export type GetCommitHashRespBody = {
	commit_hash: string | undefined;
};

export type ModifiedCommentBody = {
	type: 'modified';
	// @see: https://docs.python.org/3/library/difflib.html#difflib.SequenceMatcher.get_opcodes
	diff: { tag: 'replace' | 'delete' | 'insert'; i1: number; i2: number; j1: number; j2: number }[];
};

export type RenamedCommentBody = {
	type: 'renamed';
	to: string;
};

export type PatchCommentBody = ModifiedCommentBody | RenamedCommentBody;

export type ResponseBody<T = {}> = {
	status: 200;
	data?: T;
};

export type Offset = {
	start: number;
	end: number;
};

export type Replacement = {
	from: {
		start: number;
		end: number;
	};
	to?: {
		start: number;
		end: number;
	};
};

export type OAuthState = {
	redirect: string;
};

export type GitHubGetUserInfoResp = {
	login: string;
	id: number;
	name: string;
	email: string;
};
