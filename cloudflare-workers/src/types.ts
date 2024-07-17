export type PostCommentBody = {
	path: string;
	offset: {
		start: number;
		end: number;
	};
	commenter: {
		name: string;
	};
	comment: string;
};

export type PostComment = {
	commenter: {
		user_agent: string;
		ip_address: string | null;
	};
} & PostCommentBody;

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

export type ResponseBody<T> = {
	status: 200;
	data: T;
};
