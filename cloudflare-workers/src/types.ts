export type PostCommentBody = {
	offset: {
		start: number;
		end: number;
	};
	commenter: {
		name: string;
	};
	comment: string;
	commit_hash: string;
};

export type PostComment = {
	commenter: {
		user_agent: string;
		ip_address: string | null;
	};
} & Omit<PostCommentBody, 'commit_hash'> & {
		path: string;
	};

export type GetCommentBody = {
	path: string;
};

export type GetComment = GetCommentBody;

export type GetCommentRespBody = {
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

export type ResponseBody<T = {}> = {
	status: 200;
	data?: T;
};
