import { GetComment, GetCommentRespBody, PostComment } from './types';

export async function postComment(env: Env, req: PostComment) {
	const db = env.DB;

	let page = await db.prepare('SELECT * FROM pages WHERE path = ?').bind(req.path).first();

	if (!page) {
		await db.prepare('INSERT INTO pages (path) VALUES (?)').bind(req.path).run();
		page = (await db.prepare('SELECT last_insert_rowid() AS id').first())!;
	}

	let offset = await db
		.prepare('SELECT * FROM offsets WHERE page_id = ? AND start = ? AND end = ?')
		.bind(page.id, req.offset.start, req.offset.end)
		.first();

	if (!offset) {
		await db.prepare('INSERT INTO offsets (page_id, start, end) VALUES (?, ?, ?)').bind(page.id, req.offset.start, req.offset.end).run();
		offset = (await db.prepare('SELECT last_insert_rowid() AS id').first())!;
	}

	await db
		.prepare('INSERT INTO commenters (name, user_agent, ip_address) VALUES (?, ?, ?)')
		.bind(req.commenter?.name, req.commenter?.user_agent, req.commenter?.ip_address)
		.run();
	const commiterId = (await db.prepare('SELECT last_insert_rowid() AS id').first())!.id;

	await db
		.prepare('INSERT INTO comments (offset_id, commenter_id, comment, created_time) VALUES (?, ?, ?, ?)')
		.bind(offset.id, commiterId, req.comment, new Date().toISOString())
		.run();
}

export async function getComment(env: Env, req: GetComment): Promise<GetCommentRespBody> {
	const db = env.DB;

	const page = await db.prepare('SELECT * FROM pages WHERE path = ?').bind(req.path).first();

	if (!page) {
		return [];
	}

	const comments = (
		await db
			.prepare(
				'SELECT * FROM comments JOIN commenters ON comments.commenter_id = commenters.id JOIN offsets ON comments.offset_id = offsets.id WHERE offsets.page_id = ?',
			)
			.bind(page.id)
			.all()
	).results;

	return comments.map((comment) => {
		return {
			offset: {
				start: comment.start as number,
				end: comment.end as number,
			},
			commenter: {
				name: comment.name as string | null,
			},
			comment: comment.comment as string,
            created_time: comment.created_time as string,
		};
	});
}
