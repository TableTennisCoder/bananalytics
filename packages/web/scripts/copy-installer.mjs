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

/**
 * A shell script that lost its shebang, or picked up CRLF endings on the way
 * through a Windows checkout, fails on the target machine with "bad
 * interpreter" — and looks perfectly fine in an editor.
 */
function assertRunnable(path, label) {
  const contents = readFileSync(path, "utf8");
  if (!contents.startsWith("#!")) {
    console.error(`\ncopy-installer: ${label} does not start with a shebang.\n`);
    process.exit(1);
  }
  if (contents.includes("\r\n")) {
    console.error(
      `\ncopy-installer: ${label} has CRLF line endings.\n` +
        `The kernel would look for an interpreter called 'bash\\r'.\n` +
        `Check .gitattributes and re-checkout the file.\n`,
    );
    process.exit(1);
  }
}

if (!existsSync(source)) {
  console.error(
    `\ncopy-installer: ${source} is missing.\n` +
      `The marketing site publishes the installer, so building without it would\n` +
      `put a 404 behind a URL people are told to pipe into a root shell.\n`,
  );
  process.exit(1);
}

// Catch a broken script here rather than on someone's fresh server.
assertRunnable(source, "install.sh");

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

// The installer drops these next to the compose file so an installation has a
// way to back itself up and a way back from a dump. They live under server/ in
// the repository because that is where they are used from during development;
// what matters is that they are reachable at the same origin as everything
// else the installer fetches.
const scriptSource = join(here, "..", "..", "..", "server", "scripts");
const scriptTarget = join(deployTarget, "scripts");
mkdirSync(scriptTarget, { recursive: true });

for (const name of ["backup.sh", "restore.sh"]) {
  const from = join(scriptSource, name);
  if (!existsSync(from)) {
    console.error(
      `\ncopy-installer: server/scripts/${name} is missing.\n` +
        `The installer fetches it, so publishing without it would leave every\n` +
        `new installation unable to back itself up.\n`,
    );
    process.exit(1);
  }
  assertRunnable(from, `server/scripts/${name}`);
  copyFileSync(from, join(scriptTarget, name));
  console.log(`copy-installer: server/scripts/${name} -> public/deploy/scripts/${name}`);
}
