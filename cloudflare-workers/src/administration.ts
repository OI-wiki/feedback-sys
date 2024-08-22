import { getComment, getMeta, getOffsets, getPaths, isPathExists, setMeta, setPath, updateCommentOffsets } from './db';
import { ModifiedCommentBody, Offset } from './types';

type Replacement = {
	from: {
		start: number;
		end: number;
	};
	to?: {
		start: number;
		end: number;
	};
};

type OffsetDelta = {
	startDelta: number;
	endDelta: number;
	invaild?: boolean;
};

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

	const replacement: Replacement[] = [];

	const offsets: Offset[] = (await getOffsets(env, path)).sort((a, b) => a.start - b.start);

	if (offsets.length === 0) {
		return;
	}

	const offsetsDelta: OffsetDelta[] = Array.from({ length: offsets.length }, () => ({ startDelta: 0, endDelta: 0 }));

	for (const { tag, i1, i2, j1, j2 } of diff) {
		for (let i = 0; i < offsets.length; i++) {
			const { start, end } = offsets[i];
			const delta = offsetsDelta[i];
			switch (tag) {
				case 'insert': {
					const insertedLength = j2 - j1;
					// 插入点在该区间前
					if (i1 < start) {
						delta.startDelta += insertedLength;
						delta.endDelta += insertedLength;
					}
					// 插入点在该区间内
					else if (start <= i1 && i1 <= end) {
						delta.endDelta += insertedLength;
					}
					// 插入点在该区间外不需要变动

					break;
				}

				case 'delete':
				case 'replace': {
					// 替换点在该区间前
					if (i2 < start) {
						const deltaLength = j2 - j1 - (i2 - i1);
						delta.startDelta += deltaLength;
						delta.endDelta += deltaLength;
					}
					// 替换点在该区间内
					else if (i1 >= start && i2 <= end) {
						const deltaLength = j2 - j1 - (i2 - i1);
						delta.endDelta += deltaLength;
					}
					// 替换点右半边在该区间内，左半边在该区间外
					else if (i1 < start && i2 >= start && i2 <= end) {
						const deltaLength = i1 - start; // 获取替换部分
						delta.startDelta += deltaLength;
						delta.endDelta += deltaLength - (i2 - start);
					}
					// 替换点右半边在该区间外，左半边在该区间内
					else if (i2 > end && i1 >= start && i1 <= end) {
						delta.endDelta += i1 - end;
					}
					// 替换点包括整个区间
					else if (i1 < start && i2 > end) {
						delta.invaild = true;
					}
					// 替换点在该区间后不需要变动

					break;
				}
			}
		}
	}

	for (let i = 0; i < offsets.length; i++) {
		const { start, end } = offsets[i];
		const { startDelta, endDelta, invaild } = offsetsDelta[i];
		replacement.push({
			from: {
				start: start,
				end: end,
			},
			to:
				invaild === true
					? undefined
					: {
							start: start + startDelta,
							end: end + endDelta,
						},
		});
	}

	await updateCommentOffsets(env, path, replacement);
}
