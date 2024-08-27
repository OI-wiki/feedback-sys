import { getMeta, getOffsets, isPathExists, setMeta, setPath, updateCommentOffsets } from './db';
import { ModifiedCommentBody, Offset, PostComment } from './types';
import { calcOffsetModification, escapeTelegramMarkdown, sendTelegramMessage } from './utils';

const encoder = new TextEncoder();

export function validateSecret(env: Env, secret: string): boolean {
	const secretBytes = encoder.encode(env.ADMINISTRATOR_SECRET);
	const inputBytes = encoder.encode(secret);

	if (secretBytes.byteLength !== inputBytes.byteLength) {
		return false;
	}

	return crypto.subtle.timingSafeEqual(secretBytes, inputBytes);
}

export async function setCommitHash(env: Env, hash: string) {
	await setMeta(env, 'commit_hash', hash);
}

export async function compareCommitHash(env: Env, hash: string): Promise<boolean> {
	const storedHash = await getMeta(env, 'commit_hash');
	return storedHash === hash;
}

export async function renameComments(env: Env, oldPath: string, newPath: string) {
	if (oldPath == newPath) {
		throw new Error('The path you want to rename from and to are the same');
	}

	const [oldPathExists, newPathExists] = await isPathExists(env, oldPath, newPath);
	if (!oldPathExists) {
		return;
	}
	if (newPathExists) {
		throw new Error('The path you want to rename to already exists');
	}

	await setPath(env, oldPath, newPath);
}

export async function modifyComments(env: Env, path: string, diff: ModifiedCommentBody['diff']) {
	if (!(await isPathExists(env, path))) {
		throw new Error('The path you want to modify does not exist');
	}

	const offsets: Offset[] = (await getOffsets(env, path)).sort((a, b) => a.start - b.start);

	if (offsets.length === 0) {
		return;
	}

	await updateCommentOffsets(env, path, calcOffsetModification(offsets, diff));
}

export async function sendCommentUpdateToTelegram(env: Env, req: PostComment) {
	const message = `💬 New paragraph comment on `
	+ `[${escapeTelegramMarkdown(`${req.path}(${req.offset.start}-${req.offset.end})`)}](${escapeTelegramMarkdown(`https://oi-wiki.org${req.path}`)})\n`
	+ `by ${escapeTelegramMarkdown(req.commenter.name)}\n\n`
	+ `${escapeTelegramMarkdown(req.comment)}`;

	await Promise.all(env.TELEGRAM_CHAT_ID.split(',').map((chatId) => sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, message)));
}
