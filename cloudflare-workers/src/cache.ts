import { getPaths } from './db';

export async function purgeAllCommentCache(env: Env, cache: Cache, baseUrl: string) {
	const paths = await getPaths(env);

	await Promise.all(
		paths.map((path) => {
			purgeCommentCache(env, cache, baseUrl, path);
		}),
	);
}

export async function purgeCommentCache(env: Env, cache: Cache, baseUrl: string, path: string) {
	await cache.delete(`${baseUrl}/comment${path}`);
}

export async function putCommentCache(env: Env, cache: Cache, baseUrl: string, path: string, resp: Response): Promise<void> {
	await cache.put(`${baseUrl}/comment${path}`, resp);
}

export async function matchCommentCache(env: Env, cache: Cache, baseUrl: string, path: string): Promise<Response | undefined> {
	return await cache.match(`${baseUrl}/comment${path}`);
}
