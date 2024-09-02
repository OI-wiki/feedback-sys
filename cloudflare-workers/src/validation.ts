import { validateSecret } from './administration';
import { Commenter, JWTPayload, ModifiedCommentBody, PostCommentBody } from './types';
import { verifyAndDecodeJWT } from './utils';

export function validatePath(path: string | undefined): boolean {
	if (path === undefined) {
		return false;
	}

	if (!path.startsWith('/')) {
		return false;
	}

	return true;
}

export function validateAndDecodePath(path: string | undefined): string | null {
	if (path === undefined) {
		return null;
	}

	path = decodeURIComponent(path);

	if (!path.startsWith('/')) {
		return null;
	}

	return path;
}

export function validateDiff(diff: ModifiedCommentBody['diff']): boolean {
	return diff != undefined && diff instanceof Array === true && diff.length !== 0;
}

export function validateOffset(offset: PostCommentBody['offset']): boolean {
	return offset.start >= 0 && offset.end >= 0 && offset.start < offset.end;
}

export function validateComment(comment: PostCommentBody['comment'] | undefined): boolean {
	return comment != undefined && comment.length >= 1 && comment.length <= 65535;
}

export async function validateAndDecodeAuthorizationToken(env: Env, req: Request): Promise<JWTPayload | null> {
	const authorization = req.headers.get('Authorization');

	if (!authorization) {
		return null;
	}

	const [scheme, secret] = authorization.split(' ');

	if (scheme !== 'Bearer' || !secret) {
		return null;
	}

	let token;
	try {
		token = await verifyAndDecodeJWT<JWTPayload>(secret, env.OAUTH_JWT_SECRET);
	} catch (e) {
		return null;
	}

	return token;
}

export function validateAdministratorSecret(env: Env, req: Request): boolean {
	const authorization = req.headers.get('Authorization');

	if (!authorization) {
		return false;
	}

	const [scheme, secret] = authorization.split(' ');

	if (scheme !== 'Bearer' || !secret) {
		return false;
	}

	return validateSecret(env, secret);
}

export function validateCommitHash(hash: string | undefined): boolean {
	return hash != undefined && hash.length > 0;
}

export function isSameCommenter(commenter: Commenter | null, token: JWTPayload | null): boolean {
	if (commenter === null || token === null) {
		return false;
	}
	return commenter.oauth_provider === token.provider && commenter.oauth_user_id === token.id;
}

export function isAdmin(token: JWTPayload | null): boolean {
	return token !== null && token.role === 'admin';
}
