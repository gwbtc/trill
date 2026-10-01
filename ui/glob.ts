import * as fs from "node:fs/promises";
import { $ } from "bun";

const GLOBBER_PIER = "/home/y/urbit/globber";
const GLOB_FOLDER = GLOBBER_PIER + "/landscape/globs";
const PUT_FOLDER = GLOBBER_PIER + "/.urb/put";
const BACKEND_FOLDER = "/home/y/code/groundwire/trill/backend";

async function buildUI() {
  await $`bun run build`;
}
async function makeNewFolder() {
  const dirs = await fs.readdir(GLOB_FOLDER);
  const max = dirs.reduce((acc, i) => {
    if (!i.startsWith("trill")) return acc;
    const nums = i.match(/\d+/g).map(Number);
    console.log(nums, "nums");
    if (!nums) return acc;
    return nums[0] > acc ? nums[0] : acc;
  }, 0);
  const newFolder = `/trill${max + 1}`;
  console.log({ newFolder });
  return newFolder;
}

async function copyBuiltUI(newFolder: string) {
  try {
    await fs.cp("./dist", GLOB_FOLDER + newFolder, { recursive: true });
    return true;
  } catch (e) {
    console.error("bad!", e);
    throw new Error("error copying UI to globber");
  }
}

async function globUI(newFolder: string) {
  const payload = {
    source: {
      dojo: "+hood/commit %landscape",
    },
    sink: { app: "hood" },
  };
  const payload2 = {
    source: { dojo: `-landscape!make-glob %landscape /globs${newFolder}` },
    sink: { stdout: null },
  };
  console.log(payload2);
  const payload3 = {
    source: {
      dojo: "+hood/exit",
    },
    sink: { app: "hood" },
  };
  try {
    await fs.rm(PUT_FOLDER, { recursive: true, force: true });
    await fs.mkdir(PUT_FOLDER);
    const ports = await fs.readFile(GLOBBER_PIER + "/.http.ports", "utf8");
    const loopbackPort = ports.match(/\d+/)![0]!;
    console.log(loopbackPort, "loopback");
    const one = await curl(payload, loopbackPort);
    console.log(one);
    const two = await curl(payload2, loopbackPort);
    console.log(two);
    // const three = await curl(payload3, loopbackPort);
    // console.log(three)
    return true;
  } catch (e) {
    console.error("bad2!", e);
    throw new Error("error running globber");
  }
}
async function s3Copy() {
  const mccp = await $`mc cp ${PUT_FOLDER}/* sortug/globs`;
  console.log(mccp);
}
async function editDocket() {
  const list = await fs.readdir(PUT_FOLDER);
  const file = list[0];
  const hash = file.replaceAll("glob-", "").replace(".glob", "");
  const docketPath = BACKEND_FOLDER + "/desk.docket-0";
  const docket = await fs.readFile(docketPath, "utf8");
  const nd = docket.split("\n").reduce((acc, line) => {
    if (!line.includes("glob-http")) return acc + "\n" + line;
    const newline = line
      .replace(/glob-0.+glob/, file)
      .replace(/\s0v.+/, " " + hash + "]");
    return acc + "\n" + newline;
  });
  await fs.writeFile(docketPath, nd, "utf8");
}

async function run() {
  try {
    await buildUI();
    const newFolder = await makeNewFolder();
    await copyBuiltUI(newFolder);
    await globUI(newFolder);
    await s3Copy();
    await editDocket();
  } catch (e) {
    console.error("BIG BAD!", e);
    throw new Error("error somewhere");
  }
}

async function curl(payload: any, port: string) {
  return await $`curl http://localhost:${port} -s --retry-all-errors --data '${JSON.stringify(payload)}'`;
}
run();
