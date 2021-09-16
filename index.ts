const { Octokit } = require("@octokit/core");
const { spawn } = require("child_process");
const { mkdir, rm, writeFile } = require("fs/promises");

const auth = process.argv.slice(2)[0];
if (auth === undefined) throw new Error('No auth token given. Please re run with token provided. Ex: "npm run token username"');

const username = process.argv.slice(3)[0];
if (username === undefined) throw new Error('No username given. Please re run with username provided. Ex: "npm run token username"');

const path = "./repositories";

const octokit = new Octokit({ auth });

const gitClone = async (repo: any) => {
	const repoPath = `${path}/${repo.full_name}/`;
	console.log(`Cloning ${repo.clone_url} in ${repoPath}....`);
	await mkdir(repoPath, { recursive: true });
	await writeFile(`${path}/${repo.owner.login}/${repo.name}.json`, JSON.stringify(repo));
	await spawn("git", ["clone", "--mirror", repo.clone_url.replace("github.com", `${username}:${auth}@github.com`), "."], { cwd: repoPath });
};

const wrappedSpawn = async (command: string, args: string[], cwd: string) =>
	new Promise((res, rej) => {
		const clone = spawn(command, args, { cwd });
		let errors = "";
		clone.stderr.on("data", (error: string) => (errors += error));
		clone.on("exit", () => {
			if (errors !== "") rej(errors);
			else res(undefined);
		});
	});

const excludeOwners = ["BBTTT-Studios", "github"];
const excludeRepos = ["DefinitelyTyped"];
(async () => {
	await rm(`${path}`, { recursive: true }).catch(() => null);
	let data = [];
	let page = 0;
	while (data.length !== 0 || page < 1) {
		for (const repo of (await octokit.request("GET /user/repos", { per_page: 100, page: page++ })).data) {
			if (excludeOwners.includes(repo.owner.login) || excludeRepos.includes(repo.name)) continue;
			gitClone(repo);
		}
	}
})();
