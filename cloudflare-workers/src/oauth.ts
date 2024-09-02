// https://docs.github.com/zh/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app

import { GitHubGetUserInfoResp, GithubOrgMembershipResp } from './types';

type AccessTokenResp = {
	access_token: string;
};

export async function getAccessToken(env: Env, code: string): Promise<string> {
	const response = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		body: JSON.stringify({
			client_id: env.GITHUB_APP_CLIENT_ID,
			client_secret: env.GITHUB_APP_CLIENT_SECRET,
			code,
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to get access token');
	}

	return ((await response.json()) as AccessTokenResp).access_token;
}

export async function getUserInfo(token: string): Promise<GitHubGetUserInfoResp> {
	const response = await fetch('https://api.github.com/user', {
		headers: {
			Accept: 'application/vnd.github+json',
			Authorization: `Bearer ${token}`,
			'User-Agent': 'OI-Wiki Feedback System',
		},
	});

	if (!response.ok) {
		throw new Error(await response.text());
	}

	return (await response.json()) as GitHubGetUserInfoResp;
}

export async function getUserTeamMembership(
	token: string,
	login: string,
	org: string,
	team: string,
): Promise<GithubOrgMembershipResp | null> {
	const response = await fetch(`https://api.github.com/orgs/${org}/teams/${team}/memberships/${login}`, {
		headers: {
			Accept: 'application/vnd.github+json',
			Authorization: `Bearer ${token}`,
			'User-Agent': 'OI-Wiki Feedback System',
		},
	});

	if (response.status === 404) {
		return null;
	}

	if (!response.ok) {
		throw new Error(await response.text());
	}

	return (await response.json()) as GithubOrgMembershipResp;
}
