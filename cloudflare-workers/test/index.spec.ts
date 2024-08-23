// test/index.spec.ts
import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { calcOffsetModification } from '../src/utils';
import { ModifiedCommentBody, Offset } from '../src/types';

describe('Commit offset patch', () => {
	// https://github.com/OI-wiki/OI-wiki/blob/master/docs/index.md
	it('OI-Wiki index unit test', async () => {
		const offsets: Offset[] = [
			{ start: 372, end: 439 },
			{ start: 441, end: 586 },
			{ start: 588, end: 744 },
			{ start: 746, end: 810 },
		];
		const diff: ModifiedCommentBody['diff'] = [
			{ tag: 'delete', i1: 20, i2: 298, j1: 20, j2: 20 },
			{ tag: 'replace', i1: 420, i2: 423, j1: 142, j2: 145 },
			{ tag: 'insert', i1: 538, i2: 538, j1: 260, j2: 265 },
			{ tag: 'insert', i1: 586, i2: 586, j1: 313, j2: 321 },
			{ tag: 'delete', i1: 696, i2: 712, j1: 431, j2: 431 },
			{ tag: 'replace', i1: 752, i2: 755, j1: 471, j2: 473 },
			{ tag: 'replace', i1: 770, i2: 773, j1: 488, j2: 490 },
		];

		const res = calcOffsetModification(offsets, diff);

		expect(res).toEqual([
			{ from: { start: 372, end: 439 }, to: { start: 94, end: 161 } },
			{ from: { start: 441, end: 586 }, to: { start: 163, end: 313 } },
			{ from: { start: 588, end: 744 }, to: { start: 323, end: 463 } },
			{ from: { start: 746, end: 810 }, to: { start: 465, end: 527 } },
		]);
	});
});
