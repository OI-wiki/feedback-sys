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

import { AutoRouter, cors, error } from 'itty-router';
import {
	GetCommentBody,
	GetCommentRespBody,
	OAuthState,
	PatchCommentBody,
	PostCommentBody,
	PutCommitHashBody,
	ResponseBody,
} from './types';
import { getComment, postComment, registerUser } from './db';
import {
	validateSecret,
	setCommitHash,
	compareCommitHash,
	modifyComments,
	renameComments,
	sendCommentUpdateToTelegram,
} from './administration';
import { matchCommentCache, purgeAllCommentCache, purgeCommentCache, putCommentCache } from './cache';
import { signJWT, verifyAndDecodeJWT } from './utils';
import { getAccessToken, getUserInfo } from './oauth';

const { preflight, corsify } = cors({
	origin: 'https://oi-wiki.org',
	allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
	allowHeaders: ['Authorization', 'Content-Type'],
	maxAge: 86400,
});

const router = AutoRouter({
	before: [preflight],
	finally: [corsify],
});

router.post('/comment/:path', async (req, env, ctx) => {
	const params = req.params as GetCommentBody;

	if (params == undefined || params.path == undefined) {
		return error(400, 'Invalid request body');
	}

	params.path = decodeURIComponent(params.path);

	if (!params.path.startsWith('/')) {
		return error(400, 'Invalid path');
	}

	const body = await req.json<PostCommentBody>();

	if (
		body == undefined ||
		body.offset == undefined ||
		body.comment == undefined ||
		body.offset.start == undefined ||
		body.offset.end == undefined ||
		body.commit_hash == undefined
	) {
		return error(400, 'Invalid request body');
	}

	if (body.offset.start < 0 || body.offset.end < 0 || body.offset.start >= body.offset.end) {
		return error(400, 'Invalid offset');
	}

	if (body.comment.length < 1 || body.comment.length > 65535) {
		return error(400, 'Invalid comment');
	}

	if (!(await compareCommitHash(env, body.commit_hash))) {
		return error(409, 'Commit hash mismatch, usually due to outdated cache or running CI/CD, please retry after a few minutes');
	}

	const authorization = req.headers.get('Authorization');

	if (!authorization) {
		return error(401, 'Unauthorized');
	}

	const [scheme, secret] = authorization.split(' ');

	if (scheme !== 'Bearer' || !secret) {
		return error(400, 'Malformed authorization header');
	}

	let token;
	try {
		token = await verifyAndDecodeJWT(secret, env.OAUTH_JWT_SECRET);
	} catch (e) {
		return error(401, 'Unauthorized');
	}

	const data = {
		path: params.path,
		offset: body.offset,
		commenter: {
			oauth_provider: 'github',
			oauth_user_id: token.id + '',
		},
		comment: body.comment,
	};

	await postComment(env, data);

	ctx.waitUntil(sendCommentUpdateToTelegram(env, data));

	const cache = caches.default;
	ctx.waitUntil(purgeCommentCache(env, cache, new URL(req.url).origin, params.path));

	return {
		status: 200,
	} satisfies ResponseBody;
});

router.get('/comment/:path', async (req, env, ctx) => {
	const params = req.params as GetCommentBody;

	if (params == undefined || params.path == undefined) {
		return error(400, 'Invalid request body');
	}

	params.path = decodeURIComponent(params.path);

	const cache = caches.default;
	let resp = await matchCommentCache(env, cache, new URL(req.url).origin, params.path);

	if (!resp) {
		resp = new Response(
			JSON.stringify({
				status: 200,
				data: await getComment(env, params),
			} satisfies ResponseBody<GetCommentRespBody>),
			{
				headers: {
					'Content-Type': 'application/json',
				},
			},
		);
		ctx.waitUntil(putCommentCache(env, cache, new URL(req.url).origin, params.path, resp.clone()));
	}

	return resp;
});

router.patch('/comment/:path', async (req, env, ctx) => {
	const params = req.params as GetCommentBody;

	if (params == undefined || params.path == undefined) {
		return error(400, 'Invalid request body');
	}

	params.path = decodeURIComponent(params.path);

	if (!params.path.startsWith('/')) {
		return error(400, 'Invalid path');
	}

	const body = await req.json<PatchCommentBody>();

	if (body == undefined) {
		return error(400, 'Invalid request body');
	}

	if (body.type != 'renamed' && body.type != 'modified') {
		return error(400, 'Invalid request body');
	}

	if (body.type == 'renamed' && (body.to == undefined || !body.to.startsWith('/'))) {
		return error(400, 'Invalid request body');
	}

	if (body.type == 'modified' && (body.diff == undefined || body.diff instanceof Array == false || body.diff.length == 0)) {
		return error(400, 'Invalid request body');
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

	const cache = caches.default;
	ctx.waitUntil(purgeCommentCache(env, cache, new URL(req.url).origin, params.path));

	if (body.type == 'renamed') {
		await renameComments(env, params.path, body.to);
	} else if (body.type == 'modified') {
		await modifyComments(env, params.path, body.diff);
	}

	return {
		status: 200,
	} satisfies ResponseBody;
});

router.get('/meta/github-app', async (req, env, ctx) => {
	return {
		status: 200,
		data: {
			client_id: env.GITHUB_APP_CLIENT_ID,
		},
	} satisfies ResponseBody;
});

router.get('/oauth/callback', async (req, env, ctx) => {
	const code = req.query['code'] as string | undefined;
	const rawState = req.query['state'] as string | undefined;

	if (code == undefined || rawState == undefined) {
		return error(400, 'Invalid request');
	}

	const state: OAuthState = JSON.parse(decodeURIComponent(rawState as string));

	if (state == undefined || state.redirect == undefined) {
		return error(400, 'Invalid request');
	}

	const token = await getAccessToken(env, code);
	const userInfo = await getUserInfo(token);

	const jwt = await signJWT({ id: userInfo.id, name: userInfo.name }, env.OAUTH_JWT_SECRET);

	await registerUser(env, userInfo.name, 'github', userInfo.id + '');

	return new Response(null, {
		status: 302,
		headers: {
			// 这样设计而不是 Set-Cookie 是因为跨站 Set-Cookie 不好做
			Location: `${state.redirect}?oauth_token=${jwt}`,
		},
	});
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

	await setCommitHash(env, body.commit_hash);

	return {
		status: 200,
	} satisfies ResponseBody;
});

router.delete('/cache', async (req, env, ctx) => {
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

	const cache = caches.default;
	await purgeAllCommentCache(env, cache, new URL(req.url).origin);

	return {
		status: 200,
	} satisfies ResponseBody;
});

export default { ...router } satisfies ExportedHandler<Env>;
