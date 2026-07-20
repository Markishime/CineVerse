/**
 * Windows: replace fs.symlink with junctions (dirs) or copy (files)
 * so Firebase Hosting webframeworks deploy works without Developer Mode.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function ensureParent(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function copyRecursive(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    ensureParent(dest);
    fs.copyFileSync(src, dest);
  }
}

function linkOrCopy(target, linkPath) {
  ensureParent(linkPath);
  // Resolve relative targets from the link's directory
  const absTarget = path.isAbsolute(target)
    ? target
    : path.resolve(path.dirname(linkPath), target);

  if (!fs.existsSync(absTarget)) {
    // Nothing to link — create empty dir so build can continue
    fs.mkdirSync(linkPath, { recursive: true });
    return;
  }

  if (fs.existsSync(linkPath)) {
    try {
      fs.rmSync(linkPath, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  const st = fs.statSync(absTarget);
  if (st.isDirectory()) {
    try {
      // Junction does not require admin on Windows
      execFileSync(
        "cmd",
        ["/c", "mklink", "/J", linkPath, absTarget],
        { stdio: "ignore" },
      );
      return;
    } catch {
      copyRecursive(absTarget, linkPath);
      return;
    }
  }

  try {
    execFileSync(
      "cmd",
      ["/c", "mklink", "/H", linkPath, absTarget],
      { stdio: "ignore" },
    );
  } catch {
    ensureParent(linkPath);
    fs.copyFileSync(absTarget, linkPath);
  }
}

function wrap(orig, sync) {
  return function patched(target, linkPath, type, cb) {
    if (typeof type === "function") {
      cb = type;
      type = undefined;
    }
    try {
      linkOrCopy(target, linkPath);
      if (sync) return undefined;
      if (cb) process.nextTick(() => cb(null));
      return undefined;
    } catch (err) {
      if (sync) throw err;
      if (cb) process.nextTick(() => cb(err));
      return undefined;
    }
  };
}

fs.symlink = wrap(fs.symlink, false);
fs.symlinkSync = wrap(fs.symlinkSync, true);

// promises API
if (fs.promises && fs.promises.symlink) {
  fs.promises.symlink = async function (target, linkPath) {
    linkOrCopy(target, linkPath);
  };
}

// Must not write to stdout — Firebase parses `npm root` / `npm list` stdout.
process.stderr.write("[symlink-polyfill] Windows junction/copy polyfill active\n");
