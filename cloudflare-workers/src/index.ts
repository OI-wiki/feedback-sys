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
import { GetCommentBody, GetCommentRespBody, GetCommitHashRespBody, PostCommentBody, PutCommitHashBody, ResponseBody } from './types';
import { getComment, getMeta, postComment } from './db';
import { validateSecret, setCommitHash, compareCommitHash } from './administration';

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
		body.commenter.name == undefined || 
		body.commit_hash == undefined
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

	if(!await compareCommitHash(env, body.commit_hash)) {
		return error(409, 'Commit hash mismatch, usually due to outdated cache or running CI/CD, please retry after a few minutes');
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
	} satisfies ResponseBody;
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
	} satisfies ResponseBody<GetCommentRespBody>;
});

router.put('/meta/commithash', async (req, env, ctx) => {
	const body = await req.json<PutCommitHashBody>();

	if (body == undefined || body.commit_hash == undefined) {
		return error(400, 'Invalid request body');
	}

	if (body.commit_hash.length < 1) {
		return error(400, 'Invalid commit hash');
	}

	const authorization = req.headers.get('Authorization');

	if (!authorization) {
		return error(401, 'Unauthorized');
	}

	const [scheme, secret] = authorization.split(' ');

	if (scheme !== 'Bearer' || !secret) {
		return error(400, 'Malformed authorization header');
	}

	if (validateSecret(env, secret) !== true) {
		return error(401, 'Unauthorized');
	}

	setCommitHash(env, body.commit_hash);

	return {
		status: 200,
	} satisfies ResponseBody;
});

export default { ...router } satisfies ExportedHandler<Env>;
