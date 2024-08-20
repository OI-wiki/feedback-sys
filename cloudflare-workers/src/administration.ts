import { getComment, getMeta, getPaths, isPathExists, setMeta, setPath, updateCommentOffsets } from './db';
import { ModifiedCommentBody } from './types';

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

type Offset = {
	start: number;
	end: number;
};

type OffsetDiff = {
	len: number;
	diff: number;
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

	// Sort diff by i1
	diff = diff.sort((a, b) => a.i1 - b.i1);

	function _calcDiff(
		offsets: Offset[],
		pseudoOffsetsDiffArr: {
			beforeEverything: OffsetDiff;
		},
		offsetsDiffArr: OffsetDiff[],
	) {
		for (const { tag, i1, i2, j1, j2 } of diff) {
			// console.log('In diff:', tag, i1, i2, j1, j2);
			switch (tag) {
				case 'insert': {
					const offsetIdx = offsets.findIndex((offset: { start: number; end: number }) => offset.start <= i1 && offset.end >= i1);
					// 插入点在某个区间内
					if (offsetIdx >= 0) {
						// 更改区间长度
						const diff = offsetsDiffArr[offsetIdx];
						// console.log('  插入点在某个区间内：', diff.len, j2 - j1); // checked
						diff.len += j2 - j1;
					}
					// 插入点在任意区间外
					else {
						// 更改距离插入位置最近的前一个区间的差分
						const diff = offsets.findIndex((offset: { start: number }) => offset.start > i1) - 1;
						// console.log('  插入点在任意区间外：', diff, j2 - j1); // checked
						// 如果插入位置在所有 offset 区间前
						if (diff == -1) {
							pseudoOffsetsDiffArr.beforeEverything.diff += j2 - j1;
						} else if (diff >= 0) {
							offsetsDiffArr[diff].diff += j2 - j1;
						}
					}

					break;
				}

				case 'replace':
				case 'delete': {
					// 如果该 diff 在所有 offset 区间前
					if (i2 <= pseudoOffsetsDiffArr.beforeEverything.len + pseudoOffsetsDiffArr.beforeEverything.diff) {
						// console.log('  该 diff 在所有 offset 区间前', i2 - i1 - (j2 - j1)); // checked
						pseudoOffsetsDiffArr.beforeEverything.diff -= i2 - i1 - (j2 - j1);
						break;
					}

					const offsetIdxs = offsets.map((_: any, idx: number) => idx);
					offsetIdxs.unshift(-1);

					for (const offsetIdx of offsetIdxs) {
						const { start, end } = offsetIdx === -1 ? { start: 0, end: pseudoOffsetsDiffArr.beforeEverything.len } : offsets[offsetIdx];
						const diff = offsetIdx === -1 ? pseudoOffsetsDiffArr.beforeEverything : offsetsDiffArr[offsetIdx];
						// console.log('  offsetIdx:', offsetIdx, start, end, diff);

						// 如果 diff 完全包含 offset
						if (i1 <= start && i2 >= end) {
							// console.log('  diff 完全包含 offset', diff); // checked
							diff.len = 0;
						}
						// 如果 offset 完全包含 diff
						else if (start <= i1 && end >= i2) {
							// console.log('  offset 完全包含 diff', diff, diff.len - (i2 - i1 - (j2 - j1))); // checked
							diff.len -= i2 - i1 - (j2 - j1);
						}
						// 如果 diff 左半边在 offset 内，右半边在 offset 外
						else if (i1 >= start && i1 <= end) {
							if (tag === 'delete') {
								// console.log('  diff 左半边在 offset 内，右半边在 offset 外', diff, end - i1); // checked
								diff.len -= end - i1;
							}
						}
						// 如果 diff 右半边在 offset 内，左半边在 offset 外
						else if (i2 >= start && i2 <= end) {
							if (tag === 'delete') {
								// console.log('  diff 右半边在 offset 内，左半边在 offset 外', diff, i2 - start); // checked
								diff.len -= i2 - start;
							}
						}
					}

					// 如果有 diff 跨多段 offset，那么直接删除多段 offset 的 diff
					if (tag === 'replace') {
						const cross = offsetIdxs
							.map((offsetIdx) => ({
								offset: offsetIdx === -1 ? { start: 0, end: pseudoOffsetsDiffArr.beforeEverything.len } : offsets[offsetIdx],
								diff: offsetIdx === -1 ? pseudoOffsetsDiffArr.beforeEverything : offsetsDiffArr[offsetIdx],
							}))
							.filter((d) => (i1 >= d.offset.start && i1 <= d.offset.end) || (i2 >= d.offset.start && i2 <= d.offset.end));
						if (cross.length > 1) {
							let len = cross.reduce((acc, d) => acc + d.diff.len, 0);
							// 跨段 diff 转 len 补偿
							len += cross.slice(-1).reduce((acc, d) => acc + d.diff.diff, 0);
							for (const d of cross) {
								// console.log('  跨段 replace', d, diff);
								d.diff.len = 0;
							}
							cross[0].diff.diff += len - (i2 - i1 - (j2 - j1));
						}
					}

					break;
				}
			}
		}
	}

	// Distinct offsets
	const offsets = [
		...new Map((await getComment(env, { path })).map((comment) => comment.offset).map((offset) => [offset.start, offset.end])).entries(),
	]
		.map(([start, end]) => ({ start, end }))
		.sort((a, b) => a.start - b.start);

	if (offsets.length === 0) {
		return;
	}

	const pseudoOffsetsDiffArr = {
		beforeEverything: {
			len: 0,
			diff: offsets[0].start,
		},
	};

	// offsets diff array
	const offsetsDiffArr = offsets.map((offset, idx, that) => ({
		len: offset.end - offset.start,
		diff: idx === that.length - 1 ? 0 : that[idx + 1].start - offset.end,
	}));

	const diffPseudoOffsetsDiffArr = {
		beforeEverything: {
			len: pseudoOffsetsDiffArr.beforeEverything.diff,
			diff: 0,
		},
	};

	let lastDiffOffsetEnd = diffPseudoOffsetsDiffArr.beforeEverything.len;
	const diffOffsets = offsetsDiffArr.map((diff) => {
		const offset = {
			start: lastDiffOffsetEnd + diff.len,
			end: lastDiffOffsetEnd + diff.len + diff.diff,
		};
		lastDiffOffsetEnd = offset.end;
		return offset;
	});

	const diffOffsetsDiffArr = diffOffsets.map((offset, idx, that) => ({
		len: offset.end - offset.start,
		diff: idx === that.length - 1 ? 0 : that[idx + 1].start - offset.end,
	}));

	// console.log('Initialalize:', offsets, pseudoOffsetsDiffArr, offsetsDiffArr);
	// 计算 offset 更改
	_calcDiff(offsets, pseudoOffsetsDiffArr, offsetsDiffArr);
	// console.log('Finalalize:', offsets, pseudoOffsetsDiffArr, offsetsDiffArr);

	// console.log('Diff Initialalize:', diffOffsets, diffPseudoOffsetsDiffArr, diffOffsetsDiffArr);
	// 计算 diff.diff 更改
	_calcDiff(diffOffsets, diffPseudoOffsetsDiffArr, diffOffsetsDiffArr);
	// 应用 diff.diff 更改到 offset
	for (const [idx, diff] of diffOffsetsDiffArr.entries()) {
		offsetsDiffArr[idx].diff += diff.len - (diffOffsets[idx].end - diffOffsets[idx].start);
	}
	pseudoOffsetsDiffArr.beforeEverything.diff += diffPseudoOffsetsDiffArr.beforeEverything.len - offsets[0].start;
	// console.log('Diff Finalalize:', diffOffsets, diffPseudoOffsetsDiffArr, diffOffsetsDiffArr);

	let lastOffset = {
		start: 0,
		end: pseudoOffsetsDiffArr.beforeEverything.len,
	};
	let lastDiff = {
		len: 0,
		diff: pseudoOffsetsDiffArr.beforeEverything.diff,
	};
	// console.log('Check (pseudo):', lastOffset, lastDiff);
	for (const [idx, diff] of offsetsDiffArr.entries()) {
		const offset = offsets[idx];
		// console.log('Check:', offset, diff);

		const from = {
			start: offset.start,
			end: offset.end,
		};
		const to = {
			start: lastOffset.end + lastDiff.diff,
			end: lastOffset.end + lastDiff.diff + diff.len,
		};

		if (diff.len === 0) {
			replacement.push({ from });
		} else {
			replacement.push({ from, to });
		}

		lastOffset = to;
		lastDiff = diff;
	}

	await updateCommentOffsets(env, path, replacement);
}
