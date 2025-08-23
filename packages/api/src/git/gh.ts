import { Octokit } from 'octokit';

export function getOctokit(token = process.env.GITHUB_TOKEN): Octokit {
  if (!token) throw new Error('github_token_missing');
  return new Octokit({ auth: token });
}

export async function createPullRequest(
  octokit: InstanceType<typeof Octokit>,
  p: {
    owner: string;
    repo: string;
    head: string;
    base: string;
    title: string;
    body?: string;
    draft?: boolean;
  },
) {
  const res = await octokit.rest.pulls.create({
    owner: p.owner,
    repo: p.repo,
    head: p.head,
    base: p.base,
    title: p.title,
    body: p.body,
    draft: p.draft ?? false,
  });
  return { number: res.data.number, url: res.data.html_url };
}
