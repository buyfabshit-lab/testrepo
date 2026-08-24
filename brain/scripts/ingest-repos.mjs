#!/usr/bin/env node
/**
 * Build a brain out of your repositories.
 *
 * Clones (or refreshes) every repo listed in repos.json, walks what it finds,
 * and writes public/repo-brain.json — the same shape the app exports, so the
 * canvas loads it like any other brain.
 *
 * Each bubble keeps its `repo` and a GitHub `source` URL, so clicking one in
 * the app takes you to the actual file, directory or commit it came from.
 *
 *   npm run ingest              # every repo in repos.json
 *   npm run ingest -- owner/x   # just this one
 *
 * Public repos need no token. For private ones, be logged in to git first
 * (a credential helper, or a token in the clone URL).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const CACHE = path.join(ROOT, ".repo-cache");
const OUT = path.join(ROOT, "public", "repo-brain.json");

/** Per repo, so one huge repo cannot drown every other one on the canvas. */
const MAX_PER_REPO = 60;
const MAX_TEXT = 1200;
const MAX_COMMITS = 25;

/** git log field and record separators — safe inside a --format string. */
const FS = "\x1f";
const RS = "\x1e";

const SKIP_DIRS = new Set([
  ".git", "node_modules", "dist", "build", ".next", "out", "vendor",
  ".vercel", ".netlify", "coverage", "__pycache__", ".venv", ".repo-cache",
]);
const TEXT_EXT = new Set([
  ".md", ".txt", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json",
  ".sql", ".css", ".html", ".yml", ".yaml", ".toml", ".sh", ".py", ".rb", ".go",
]);

/** Topic words worth tagging when they appear. Kept short so tags stay reusable. */
const KEYWORDS = [
  "supabase", "stripe", "netlify", "vercel", "railway", "deploy", "auth",
  "schema", "migration", "webhook", "api", "storage", "vault", "shop",
  "checkout", "inventory", "wholesale", "artwork", "logo", "prompts",
  "security", "rls", "email", "wallet", "credits", "tenant", "pricing",
  "mobile", "font", "animation", "shader", "cart", "order", "print",
];

const args = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "repos.json"), "utf8"));
const repos = args.length ? args : config.repos;

/** Deterministic ids: re-running updates bubbles instead of duplicating them. */
function idFor(...parts) {
  const hex = createHash("sha1").update(parts.join(" ")).digest("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join("-");
}

function git(cwd, ...argv) {
  try {
    return execFileSync("git", argv, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function clone(full) {
  const dir = path.join(CACHE, full.replace("/", "__"));
  if (fs.existsSync(path.join(dir, ".git"))) {
    git(dir, "fetch", "--depth", "80", "--quiet", "origin");
    const head = git(dir, "rev-parse", "--abbrev-ref", "origin/HEAD").split("/").pop();
    if (head) git(dir, "reset", "--hard", "--quiet", `origin/${head}`);
    return dir;
  }
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  try {
    execFileSync("git", ["clone", "--depth", "80", "--quiet", `https://github.com/${full}.git`, dir], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (error) {
    console.warn(`  ! could not clone ${full}: ${String(error.message).split("\n")[0]}`);
    return null;
  }
  return dir;
}

function walk(dir, base = dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, files);
    else if (TEXT_EXT.has(path.extname(entry.name))) files.push(path.relative(base, full));
  }
  return files;
}

function clip(text, limit = MAX_TEXT) {
  const flat = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return flat.length <= limit ? flat : `${flat.slice(0, limit - 1).trimEnd()}…`;
}

/** Turn 20260812165447_a-slug-like-this into "A slug like this". */
function humanise(slug) {
  return slug
    .replace(/^\d{8,}_?/, "")
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

function topicTags(...sources) {
  const haystack = sources.join(" ").toLowerCase();
  return KEYWORDS.filter((word) => haystack.includes(word));
}

function make({ repo, slug, key, title, text, kind, tags, source, when }) {
  return {
    id: idFor(repo, key),
    text: clip(text),
    title: clip(title, 90),
    tags: [...new Set([slug, ...tags])].filter(Boolean),
    kind,
    summary: "",
    source,
    pinned: false,
    repo,
    createdAt: when,
    updatedAt: when,
    enriched: false,
  };
}

/** Split a markdown file into one bubble per section. */
function sections(markdown) {
  const out = [];
  let heading = null;
  let body = [];
  const flush = () => {
    const text = body.join("\n").trim();
    if (text.length >= 80) out.push({ heading, text });
    body = [];
  };
  for (const line of markdown.split("\n")) {
    const match = line.match(/^(#{1,3})\s+(.*)$/);
    if (match) {
      flush();
      heading = match[2].replace(/[#*`]/g, "").trim();
    } else {
      body.push(line);
    }
  }
  flush();
  return out;
}

/** Longer sections, and sections nearer the repo root, say more. */
function byWorth(a, b) {
  const depth = (bubble) => (bubble.source.match(/\//g) ?? []).length;
  return b.text.length - a.text.length || depth(a) - depth(b);
}

/**
 * Share a budget across categories by weight, then hand any unspent slots to
 * whoever still has material. A small repo therefore loses nothing at all.
 */
function ration(budget, groups) {
  const taken = groups.map(([list, weight]) => list.slice(0, Math.floor(budget * weight)));
  let spare = budget - taken.reduce((sum, list) => sum + list.length, 0);
  for (let i = 0; i < groups.length && spare > 0; i++) {
    const extra = groups[i][0].slice(taken[i].length, taken[i].length + spare);
    taken[i] = [...taken[i], ...extra];
    spare -= extra.length;
  }
  return taken.flat();
}

function ingest(full) {
  const [, name] = full.split("/");
  const slug = name.toLowerCase();
  const dir = clone(full);
  if (!dir) return [];

  const branch = git(dir, "rev-parse", "--abbrev-ref", "HEAD") || "main";
  const blob = (file) => `https://github.com/${full}/blob/${branch}/${file}`;
  const files = fs.existsSync(dir) ? walk(dir) : [];
  const now = Date.now();
  const stamp = (file) => {
    const seconds = Number(git(dir, "log", "-1", "--format=%ct", "--", file));
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : now;
  };

  if (files.length === 0) {
    console.log(`  ${full}: empty repository, skipped`);
    return [];
  }

  const docs = [];
  const modules = [];
  const artifacts = [];
  const todos = [];

  for (const file of files) {
    let content = "";
    try {
      content = fs.readFileSync(path.join(dir, file), "utf8");
    } catch {
      continue;
    }
    if (content.length > 400_000) continue;

    // Documentation: the highest-signal thing in almost any repo.
    if (path.extname(file) === ".md") {
      const when = stamp(file);
      sections(content).forEach((section, index) => {
        docs.push(
          make({
            repo: full, slug, key: `doc:${file}#${index}`,
            title: section.heading || humanise(path.basename(file, ".md")),
            text: section.text,
            kind: "note",
            tags: ["docs", ...topicTags(file, section.heading ?? "", section.text)],
            source: blob(file),
            when,
          }),
        );
      });
    }

    // Named artifacts: files whose filename already states their intent.
    if (file.includes("migrations/") || /functions[/\\][^/\\]+[/\\]index\.[tj]s$/.test(file)) {
      const comment = content.match(/^(?:--|\/\/)\s?.+(?:\n(?:--|\/\/).*)*/m);
      artifacts.push(
        make({
          repo: full, slug, key: `artifact:${file}`,
          title: humanise(path.basename(file, path.extname(file))),
          text: comment ? comment[0].replace(/^(--|\/\/)\s?/gm, "") : clip(content, 400),
          kind: "fact",
          tags: ["schema", ...topicTags(file, content.slice(0, 2000))],
          source: blob(file),
          when: stamp(file),
        }),
      );
    }

    for (const match of content.matchAll(/(?:TODO|FIXME|HACK)[:\s]+(.{8,160})/g)) {
      todos.push(
        make({
          repo: full, slug, key: `todo:${file}:${match.index}`,
          title: clip(match[1], 70),
          text: `${match[0].trim()}\n\nin ${file}`,
          kind: "task",
          tags: ["todo", ...topicTags(file)],
          source: blob(file),
          when: stamp(file),
        }),
      );
    }
  }

  // One bubble per meaningful directory, so the shape of the repo shows up.
  const byDir = new Map();
  for (const file of files) {
    const dirname = path.dirname(file);
    if (dirname === ".") continue;
    const key = dirname.split(path.sep).slice(0, 2).join("/");
    const list = byDir.get(key);
    if (list) list.push(file);
    else byDir.set(key, [file]);
  }
  for (const [dirname, contents] of byDir) {
    if (contents.length < 2) continue;
    modules.push(
      make({
        repo: full, slug, key: `module:${dirname}`,
        title: `${dirname}/`,
        text: `${contents.length} files in ${dirname}/:\n\n${contents
          .slice(0, 18)
          .map((file) => `· ${path.relative(dirname, file)}`)
          .join("\n")}${contents.length > 18 ? `\n· …and ${contents.length - 18} more` : ""}`,
        kind: "note",
        tags: ["module", ...dirname.split("/").map((part) => part.toLowerCase()), ...topicTags(dirname)],
        source: `https://github.com/${full}/tree/${branch}/${dirname}`,
        when: stamp(dirname),
      }),
    );
  }

  // Commits that say something. One-word "fix" commits are noise on a canvas.
  const log = git(dir, "log", `-${MAX_COMMITS * 3}`, `--format=%H${FS}%ct${FS}%s${FS}%b${RS}`);
  const commits = [];
  for (const entry of log.split(RS)) {
    const [sha, seconds, subject, body] = entry.trim().split(FS);
    if (!sha || !subject) continue;
    if (subject.length < 30 && !body?.trim()) continue;
    if (/^(merge|bump|wip|fix typo)\b/i.test(subject)) continue;
    commits.push(
      make({
        repo: full, slug, key: `commit:${sha}`,
        title: subject,
        text: body?.trim() ? `${subject}\n\n${body.trim()}` : subject,
        kind: "fact",
        tags: ["history", ...topicTags(subject, body ?? "")],
        source: `https://github.com/${full}/commit/${sha}`,
        when: Number(seconds) * 1000 || now,
      }),
    );
    if (commits.length >= MAX_COMMITS) break;
  }

  const readme = files.find((file) => /^readme\.md$/i.test(file));
  const overview = readme
    ? clip(fs.readFileSync(path.join(dir, readme), "utf8").replace(/^#.*$/m, "").trim(), 500)
    : `${files.length} tracked text files.`;

  const repoBubble = make({
    repo: full, slug, key: "repo",
    title: name,
    text: `${overview}\n\n${files.length} files · ${byDir.size} directories · branch ${branch}`,
    kind: "link",
    tags: ["repo", ...topicTags(files.join(" "), overview)],
    source: `https://github.com/${full}`,
    when: Number(git(dir, "log", "-1", "--format=%ct")) * 1000 || now,
  });
  // The repo itself always stays full-size and never fades in focus mode.
  repoBubble.pinned = true;

  // A repo that overflows keeps a bit of everything. Taking the first N of one
  // concatenated list instead spends the whole budget on documentation and
  // leaves the repo with no modules, no schema and no history — which is not
  // what that repo actually looks like.
  const all = [repoBubble, ...docs, ...modules, ...artifacts, ...todos, ...commits];
  const kept = [
    repoBubble,
    ...ration(MAX_PER_REPO - 1, [
      [docs.sort(byWorth), 0.45],
      [modules, 0.18],
      [artifacts, 0.17],
      [todos, 0.05],
      [commits, 0.15],
    ]),
  ];
  console.log(
    `  ${full}: ${kept.length} bubbles` +
      ` (${docs.length} doc, ${modules.length} module, ${artifacts.length} artifact,` +
      ` ${todos.length} todo, ${commits.length} commit${all.length > kept.length ? `; ${all.length - kept.length} trimmed` : ""})`,
  );
  return kept;
}

console.log(`Building a brain from ${repos.length} repo${repos.length === 1 ? "" : "s"}…`);
fs.mkdirSync(CACHE, { recursive: true });
const thoughts = repos.flatMap(ingest).sort((a, b) => a.createdAt - b.createdAt);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ version: 1, thoughts }, null, 2));
console.log(`\n${thoughts.length} bubbles → ${path.relative(process.cwd(), OUT)}`);
