// test/index.spec.ts
import { describe, it, expect } from 'vitest';
import { calcOffsetModification } from '../src/utils';
import { ModifiedCommentBody, Offset } from '../src/types';

describe('Commit offset patch', () => {
	it('Insert inner unit test', () => {
		const offsets: Offset[] = [
			{ start: 0, end: 10 },
			{ start: 20, end: 30 },
		];

		const diff: ModifiedCommentBody['diff'] = [{ tag: 'insert', i1: 5, i2: 5, j1: 5, j2: 10 }];

		const res = calcOffsetModification(offsets, diff);

		expect(res).toEqual([
			{ from: { start: 0, end: 10 }, to: { start: 0, end: 15 } },
			{ from: { start: 20, end: 30 }, to: { start: 25, end: 35 } },
		]);
	});

	it('Insert before unit test', () => {
		const offsets: Offset[] = [
			{ start: 0, end: 10 },
			{ start: 20, end: 30 },
		];

		const diff: ModifiedCommentBody['diff'] = [{ tag: 'insert', i1: 15, i2: 15, j1: 15, j2: 20 }];

		const res = calcOffsetModification(offsets, diff);

		expect(res).toEqual([
			{ from: { start: 0, end: 10 }, to: { start: 0, end: 10 } },
			{ from: { start: 20, end: 30 }, to: { start: 25, end: 35 } },
		]);
	});

	it('Delete before unit test', () => {
		const offsets: Offset[] = [
			{ start: 0, end: 10 },
			{ start: 20, end: 30 },
		];

		const diff: ModifiedCommentBody['diff'] = [{ tag: 'delete', i1: 15, i2: 20, j1: 15, j2: 15 }];

		const res = calcOffsetModification(offsets, diff);

		expect(res).toEqual([
			{ from: { start: 0, end: 10 }, to: { start: 0, end: 10 } },
			{ from: { start: 20, end: 30 }, to: { start: 15, end: 25 } },
		]);
	});

	it('Replace inner unit test', () => {
		const offsets: Offset[] = [
			{ start: 0, end: 10 },
			{ start: 20, end: 30 },
		];

		const diff: ModifiedCommentBody['diff'] = [{ tag: 'replace', i1: 5, i2: 8, j1: 5, j2: 10 }];

		const res = calcOffsetModification(offsets, diff);

		expect(res).toEqual([
			{ from: { start: 0, end: 10 }, to: { start: 0, end: 12 } },
			{ from: { start: 20, end: 30 }, to: { start: 22, end: 32 } },
		]);
	});

	it('Replace right unit test', () => {
		const offsets: Offset[] = [
			{ start: 0, end: 10 },
			{ start: 20, end: 30 },
		];

		const diff: ModifiedCommentBody['diff'] = [{ tag: 'replace', i1: 5, i2: 15, j1: 5, j2: 10 }];

		const res = calcOffsetModification(offsets, diff);

		expect(res).toEqual([
			{ from: { start: 0, end: 10 }, to: { start: 0, end: 5 } },
			{ from: { start: 20, end: 30 }, to: { start: 15, end: 25 } },
		]);
	});

	it('Replace left unit test', () => {
		const offsets: Offset[] = [
			{ start: 0, end: 10 },
			{ start: 20, end: 30 },
		];

		const diff: ModifiedCommentBody['diff'] = [{ tag: 'replace', i1: 15, i2: 25, j1: 15, j2: 20 }];

		const res = calcOffsetModification(offsets, diff);

		expect(res).toEqual([
			{ from: { start: 0, end: 10 }, to: { start: 0, end: 10 } },
			{ from: { start: 20, end: 30 }, to: { start: 15, end: 20 } },
		]);
	});

	it('Replace union unit test', () => {
		const offsets: Offset[] = [
			{ start: 0, end: 10 },
			{ start: 20, end: 30 },
		];

		const diff: ModifiedCommentBody['diff'] = [{ tag: 'replace', i1: 5, i2: 35, j1: 5, j2: 10 }];

		const res = calcOffsetModification(offsets, diff);

		expect(res).toEqual([{ from: { start: 0, end: 10 }, to: { start: 0, end: 5 } }, { from: { start: 20, end: 30 } }]);
	});

	// https://github.com/OI-wiki/OI-wiki/blob/master/docs/index.md
	it('OI-Wiki index unit test', () => {
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
