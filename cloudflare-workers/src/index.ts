/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { AutoRouter, error } from 'itty-router';
import { GetCommentBody, GetCommentRespBody, PostCommentBody, ResponseBody } from './types';
import { getComment, postComment } from './db';

const router = AutoRouter();

router.post('/comment', async (req, env, ctx) => {
	const body = await req.json<PostCommentBody>();

	if (
		body == undefined ||
		body.path == undefined ||
		body.offset == undefined ||
		body.commenter == undefined ||
		body.comment == undefined ||
		body.offset.start == undefined ||
		body.offset.end == undefined ||
		body.commenter.name == undefined
	) {
		return error(400, 'Invalid request body');
	}

	if (!body.path.startsWith('/')) {
		return error(400, 'Invalid path');
	}

	if (body.offset.start < 0 || body.offset.end < 0 || body.offset.start >= body.offset.end) {
		return error(400, 'Invalid offset');
	}

	if (body.commenter.name.length < 1 || body.commenter.name.length > 128) {
		return error(400, 'Invalid commenter name');
	}

	if (body.comment.length < 1 || body.comment.length > 65535) {
		return error(400, 'Invalid comment');
	}

	await postComment(env, {
		path: body.path,
		offset: body.offset,
		commenter: {
			name: body.commenter.name,
			user_agent: req.headers.get('user-agent')!,
			ip_address: req.headers.get('cf-connecting-ip') ?? '127.0.0.1', // In development environment, cf-connecting-ip header will be null
		},
		comment: body.comment,
	});

	return {
		status: 200,
	} as ResponseBody<{}>;
});

router.get('/comment', async (req, env, ctx) => {
	const query = req.query as GetCommentBody;

	if (query == undefined || query.path == undefined) {
		return error(400, 'Invalid request body');
	}

	const rst = await getComment(env, query);

	return {
		status: 200,
		data: rst,
	} as ResponseBody<GetCommentRespBody>;
});

export default { ...router } satisfies ExportedHandler<Env>;
