import { ModifiedCommentBody, Offset, Replacement } from './types';

type OffsetDelta = {
	startDelta: number;
	endDelta: number;
	invalid?: boolean;
};

export function calcOffsetModification(offsets: Offset[], diff: ModifiedCommentBody['diff']): Replacement[] {
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
					else if (start <= i1 && i1 < end) {
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
					else if (i2 > end && i1 >= start && i1 < end) {
						delta.endDelta += i1 - end;
					}
					// 替换点包括整个区间
					else if (i1 < start && i2 > end) {
						delta.invalid = true;
					}
					// 替换点在该区间后不需要变动

					break;
				}
			}
		}
	}

	const replacement: Replacement[] = [];

	for (let i = 0; i < offsets.length; i++) {
		const { start, end } = offsets[i];
		const { startDelta, endDelta, invalid: invaild } = offsetsDelta[i];
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

	return replacement;
}
