import { mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve, sep } from "node:path";

export const ASSET_MAX_BYTES = 2_000_000;
const ASSET_REF_RE = /(["'`])asset:\/\/([^"'`\\\s]+)\1/g;
const MIME_BY_EXT = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
export const ASSET_EXTENSIONS = Object.freeze(Object.keys(MIME_BY_EXT));

export function normalizeAssetName(name) {
  if (typeof name !== "string" || !name.trim()) throw new Error("asset name required");
  const clean = name.trim().replaceAll("\\", "/");
  if (clean.includes("\0") || clean.startsWith("/") || clean.split("/").length !== 1) {
    throw new Error("asset name must be a single file name");
  }
  const file = basename(clean);
  if (file !== clean || !MIME_BY_EXT[extname(file).toLowerCase()]) {
    throw new Error(`unsupported canvas asset type: ${name}`);
  }
  return file;
}

export async function listCanvasAssets(assetDir) {
  const root = resolve(assetDir);
  let entries = [];
  try { entries = await readdir(root, { withFileTypes: true }); } catch { return []; }
  const assets = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    try {
      const name = normalizeAssetName(entry.name);
      const info = await stat(join(root, name));
      if (info.size <= ASSET_MAX_BYTES) assets.push({ name, bytes: info.size, mtimeMs: info.mtimeMs, href: `asset://${name}` });
    } catch { /* ignore unsupported/unreadable files */ }
  }
  return assets.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveCanvasAsset(assetDir, name, base64) {
  const file = normalizeAssetName(name);
  if (typeof base64 !== "string" || !base64) throw new Error("asset data required");
  const raw = base64.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(raw) || raw.length % 4 === 1) throw new Error("invalid asset base64");
  let data;
  try { data = Buffer.from(raw, "base64"); } catch { throw new Error("invalid asset base64"); }
  if (!data.byteLength || data.byteLength > ASSET_MAX_BYTES) throw new Error(`asset too large (max ${ASSET_MAX_BYTES}B)`);
  const root = resolve(assetDir);
  await mkdir(root, { recursive: true });
  const target = join(root, file);
  const temp = `${target}.upload-tmp`;
  await writeFile(temp, data, { flag: "w" });
  await rename(temp, target);
  return { name: file, bytes: data.byteLength, href: `asset://${file}` };
}

export function findAssetRefs(source) {
  if (typeof source !== "string") return [];
  const refs = [];
  for (const match of source.matchAll(ASSET_REF_RE)) {
    if (!refs.includes(match[2])) refs.push(match[2]);
  }
  return refs;
}

function assetPath(ref, assetDir) {
  const clean = decodeURIComponent(ref).replace(/^\/+/, "");
  if (!clean || clean.includes("\0")) throw new Error(`invalid canvas asset reference: asset://${ref}`);
  const root = resolve(assetDir);
  const full = resolve(root, clean);
  if (full !== root && !full.startsWith(root + sep)) {
    throw new Error(`canvas asset escapes asset directory: asset://${ref}`);
  }
  const mime = MIME_BY_EXT[extname(full).toLowerCase()];
  if (!mime) throw new Error(`unsupported canvas asset type: asset://${ref}`);
  return { full, mime };
}

async function realInside(full, root, ref) {
  const [actual, actualRoot] = await Promise.all([realpath(full), realpath(root)]);
  if (actual !== actualRoot && !actual.startsWith(actualRoot + sep)) {
    throw new Error(`canvas asset symlink escapes asset directory: asset://${ref}`);
  }
  return actual;
}

/**
 * Replace only quoted asset:// literals. The original source stays small and
 * readable; compiled code receives a data URI so the iframe needs no network.
 */
export async function materializeCanvasAssets(source, assetDir) {
  const refs = findAssetRefs(source);
  if (!refs.length) return { source, refs: [], signature: "" };
  let code = source;
  const signatures = [];
  for (const ref of refs) {
    const { full, mime } = assetPath(ref, assetDir);
    const actual = await realInside(full, assetDir, ref);
    const info = await stat(actual);
    if (info.size > ASSET_MAX_BYTES) throw new Error(`canvas asset too large: asset://${ref} (${info.size}B > ${ASSET_MAX_BYTES}B)`);
    const data = await readFile(actual);
    const uri = `data:${mime};base64,${data.toString("base64")}`;
    const literal = `asset://${ref}`;
    code = code.split(literal).join(uri);
    signatures.push(`${ref}:${info.size}:${info.mtimeMs}`);
  }
  return { source: code, refs, signature: signatures.sort().join("|") };
}
