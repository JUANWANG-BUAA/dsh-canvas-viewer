import { readFile, realpath, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

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
