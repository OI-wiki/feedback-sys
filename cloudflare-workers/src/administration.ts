import { getMeta, setMeta } from "./db";

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