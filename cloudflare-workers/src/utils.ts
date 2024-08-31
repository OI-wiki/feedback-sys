import { ModifiedCommentBody, Offset, Replacement } from './types';
import jwt from '@tsndr/cloudflare-worker-jwt';

type OffsetDelta = {
	startDelta: number;
	endDelta: number;
	invalid?: boolean;
};

type TelegramBotAPIResponse =
	| { ok: false; error_code: number; description?: string }
	| {
			ok: true;
			result: unknown;
	  };

export function calcOffsetModification(offsets: Offset[], diff: ModifiedCommentBody['diff']): Replacement[] {
	const offsetsDelta: OffsetDelta[] = Array.from({ length: offsets.length }, () => ({ startDelta: 0, endDelta: 0 }));

	// i1, i2, j1, j2, start, end 均为左闭右开
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
					if (i2 <= start) {
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
					else if (i1 < start && i2 > start && i2 <= end) {
						const deltaLength = i1 - start; // 获取替换部分
						delta.startDelta += deltaLength;
						delta.endDelta += deltaLength - (i2 - start);
					}
					// 替换点右半边在该区间外，左半边在该区间内
					else if (i2 >= end && i1 >= start && i1 < end) {
						delta.endDelta += i1 - end;
					}
					// 替换点包括整个区间
					else if (i1 < start && i2 >= end) {
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
		let { startDelta, endDelta, invalid } = offsetsDelta[i];
		if (end + endDelta - (start + startDelta) === 0) {
			invalid = true;
		}
		replacement.push({
			from: {
				start: start,
				end: end,
			},
			to:
				invalid === true
					? undefined
					: {
							start: start + startDelta,
							end: end + endDelta,
						},
		});
	}

	return replacement;
}

export function escapeTelegramMarkdown(text: string): string {
	return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

export async function sendTelegramMessage(botToken: string, chatId: string, message: string) {
	const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			chat_id: chatId,
			text: message,
			parse_mode: 'MarkdownV2',
			link_preview_options: {
				is_disabled: true,
			},
		}),
	});

	const result: TelegramBotAPIResponse = (await response.json()) as TelegramBotAPIResponse;

	if (!response.ok || !result.ok) {
		throw new Error(`Failed to send message to telegram: ${JSON.stringify(result)}`);
	}
}

export async function signJWT(
	payload: {
		[key: string]: any;
	},
	secret: string,
): Promise<string> {
	return await jwt.sign(
		{
			...payload,
			nbf: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
		},
		secret,
		{ algorithm: 'HS256' },
	);
}

export async function verifyAndDecodeJWT(
	token: string,
	secret: string,
): Promise<{
	[key: string]: any;
}> {
	await jwt.verify(token, secret, { algorithm: 'HS256', throwError: true });

	return jwt.decode(token).payload as {
		[key: string]: any;
	};
}
