// Publishes the installer at bananalytics.xyz/install.sh.
//
// The script people pipe into their shell is the one in the repository root.
// Copying it here before every build and dev run means the served copy cannot
// drift from the one that is reviewed, tested and tagged — a stale installer
// on the marketing domain would be worse than no installer at all, because
// nobody would think to look for it there.
//
// Next.js serves public/ with Cache-Control: max-age=0, so a new copy is picked
// up on the next request rather than lingering in a CDN.

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..", "..", "..", "install.sh");
const target = join(here, "..", "public", "install.sh");

if (!existsSync(source)) {
  console.error(
    `\ncopy-installer: ${source} is missing.\n` +
      `The marketing site publishes the installer, so building without it would\n` +
      `put a 404 behind a URL people are told to pipe into a root shell.\n`,
  );
  process.exit(1);
}

// A shell script that lost its shebang, or picked up CRLF endings on the way
// through a Windows checkout, fails on the target machine with "bad
// interpreter" — and the file looks perfectly fine in an editor. Catch it here
// rather than on someone's fresh server.
const contents = readFileSync(source, "utf8");
if (!contents.startsWith("#!")) {
  console.error("\ncopy-installer: install.sh does not start with a shebang.\n");
  process.exit(1);
}
if (contents.includes("\r\n")) {
  console.error(
    "\ncopy-installer: install.sh has CRLF line endings.\n" +
      "The kernel would look for an interpreter called 'bash\\r'.\n" +
      "Check .gitattributes and re-checkout the file.\n",
  );
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log("copy-installer: install.sh -> public/install.sh");

// The installer fetches these two once it is running. Serving them from the
// same origin means an install cannot get halfway and then stall because a
// second host is unreachable.
const deploySource = join(here, "..", "..", "..", "deploy");
const deployTarget = join(here, "..", "public", "deploy");
mkdirSync(deployTarget, { recursive: true });

for (const name of ["docker-compose.yml", "Caddyfile"]) {
  const from = join(deploySource, name);
  if (!existsSync(from)) {
    console.error(`\ncopy-installer: deploy/${name} is missing.\n`);
    process.exit(1);
  }
  copyFileSync(from, join(deployTarget, name));
  console.log(`copy-installer: deploy/${name} -> public/deploy/${name}`);
}
