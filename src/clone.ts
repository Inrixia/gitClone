import { Octokit } from "@octokit/core";
import { spawn } from "child_process";
import { mkdir, rm, writeFile } from "fs/promises";

import args from "args";

const parseArray = (s: [string]) => {
	if (s[0] === undefined) return [];
	if (s[0].includes(",")) return s[0].split(",");
	return s[0].split(" ");
};

args
	.option("token", "GitHub auth token to use")
	.option("excludeOrgs", "Comma separated list of orgs to exclude", [], parseArray)
	.option("excludeRepos", "Comma separated list of repos to exclude", [], parseArray)
	.option("savePath", "Path to mirror repositories to", "./repos");

type Args = { token: string; savePath: string; excludeOrgs: string[]; excludeRepos: string[] };
const { token, savePath, excludeOrgs, excludeRepos } = <Args>args.parse(process.argv);

const octokit = new Octokit({ auth: token });

const gitClone = async <R extends MinimalRepo>(repo: R, username: string) => {
	const repoPath = `${savePath}/${repo.full_name}/`;
	console.log(`Cloning ${repo.clone_url} in ${repoPath}....`);
	await mkdir(repoPath, { recursive: true });
	await writeFile(`${savePath}/${repo.owner.login}/${repo.name}.json`, JSON.stringify(repo));
	spawn("git", ["clone", "--mirror", repo.clone_url.replace("github.com", `${username}:${token}@github.com`), "."], { cwd: repoPath });
};

type MinimalRepo = { id: number; name: string; owner: { login: string }; clone_url: string; full_name: string };

(async () => {
	await rm(`${savePath}`, { recursive: true }).catch(() => null);

	const {
		data: { login },
	} = await octokit.request("GET /user");

	for await (const repo of reposIterable()) {
		if (excludeRepos.includes(repo.name)) continue;
		if (excludeOrgs.includes(repo.owner.login)) continue;
		gitClone(repo, login);
	}
})();

async function* reposIterable() {
	let page = 1;
	let repos = await octokit.request("GET /user/repos", { per_page: 100, page });
	while (repos.data.length !== 0) {
		yield* repos.data;
		repos = await octokit.request("GET /user/repos", { per_page: 100, page: ++page });
	}
}
