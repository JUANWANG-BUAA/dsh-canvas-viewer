import { createHash, randomUUID } from "node:crypto";
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
} as const;
type AssetMime = (typeof MIME_BY_EXT)[keyof typeof MIME_BY_EXT];

export const ASSET_EXTENSIONS = Object.freeze(Object.keys(MIME_BY_EXT));

export type CanvasAsset = {
  name: string;
  mime: AssetMime;
  bytes: number;
  data: Buffer;
  etag: string;
};

function digest(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function hasImageSignature(ext: string, data: Uint8Array): boolean {
  if (ext === ".png") return data.length >= 8 && Buffer.from(data.subarray(0, 8)).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (ext === ".jpg" || ext === ".jpeg") return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (ext === ".gif") return data.length >= 6 && (Buffer.from(data.subarray(0, 6)).toString("ascii") === "GIF87a" || Buffer.from(data.subarray(0, 6)).toString("ascii") === "GIF89a");
  if (ext === ".webp") return data.length >= 12 && Buffer.from(data.subarray(0, 4)).toString("ascii") === "RIFF" && Buffer.from(data.subarray(8, 12)).toString("ascii") === "WEBP";
  if (ext === ".avif") return data.length >= 12 && Buffer.from(data.subarray(4, 8)).toString("ascii") === "ftyp" && /^(avif|avis|mif1)$/.test(Buffer.from(data.subarray(8, 12)).toString("ascii"));
  return false;
}

function validateImageBytes(name: string, data: Buffer): void {
  const ext = extname(name).toLowerCase();
  if (!hasImageSignature(ext, data)) throw new Error(`asset content does not match ${ext} image: ${name}`);
}

export function normalizeAssetName(name: unknown): string {
  if (typeof name !== "string" || !name.trim()) throw new Error("asset name required");
  const clean = name.trim().replaceAll("\\", "/");
  if (clean.includes("\0") || clean.startsWith("/") || clean.split("/").length !== 1) {
    throw new Error("asset name must be a single file name");
  }
  const file = basename(clean);
  if (file !== clean || !MIME_BY_EXT[extname(file).toLowerCase() as keyof typeof MIME_BY_EXT]) {
    throw new Error(`unsupported canvas asset type: ${name}`);
  }
  return file;
}

export async function listCanvasAssets(assetDir: string) {
  const root = resolve(assetDir);
  let entries: import("node:fs").Dirent[] = [];
  try { entries = await readdir(root, { withFileTypes: true }); } catch { return []; }
  const assets: Array<{ name: string; bytes: number; mtimeMs: number; href: string; etag: string }> = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    try {
      const name = normalizeAssetName(entry.name);
      const full = join(root, name);
      const info = await stat(full);
      if (!info.isFile() || info.size > ASSET_MAX_BYTES) continue;
      const data = await readFile(full);
      validateImageBytes(name, data);
      assets.push({ name, bytes: info.size, mtimeMs: info.mtimeMs, href: `asset://${name}`, etag: `"${digest(data)}"` });
    } catch { /* ignore unsupported, malformed, or unreadable files */ }
  }
  return assets.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveCanvasAsset(assetDir: string, name: unknown, base64: unknown) {
  const file = normalizeAssetName(name);
  if (typeof base64 !== "string" || !base64) throw new Error("asset data required");
  const raw = base64.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(raw) || raw.length % 4 === 1) throw new Error("invalid asset base64");
  const data = Buffer.from(raw, "base64");
  if (!data.byteLength || data.byteLength > ASSET_MAX_BYTES) throw new Error(`asset too large (max ${ASSET_MAX_BYTES}B)`);
  validateImageBytes(file, data);
  const root = resolve(assetDir);
  await mkdir(root, { recursive: true });
  const target = join(root, file);
  const temp = join(root, `.${file}.${randomUUID()}.upload-tmp`);
  try {
    await writeFile(temp, data, { flag: "wx", mode: 0o600 });
    await rename(temp, target);
  } finally {
    await rm(temp, { force: true }).catch(() => {});
  }
  const etag = `"${digest(data)}"`;
  return { name: file, bytes: data.byteLength, href: `asset://${file}`, etag };
}

export function findAssetRefs(source: unknown): string[] {
  if (typeof source !== "string") return [];
  const refs: string[] = [];
  for (const match of source.matchAll(ASSET_REF_RE)) {
    const ref = normalizeAssetName(match[2]);
    if (!refs.includes(ref)) refs.push(ref);
  }
  return refs;
}

function assetPath(ref: string, assetDir: string) {
  let decoded: string;
  try { decoded = decodeURIComponent(ref); } catch { throw new Error(`invalid canvas asset reference: asset://${ref}`); }
  const clean = normalizeAssetName(decoded);
  const root = resolve(assetDir);
  const full = resolve(root, clean);
  if (full !== root && !full.startsWith(root + sep)) throw new Error(`canvas asset escapes asset directory: asset://${ref}`);
  return { full, clean, mime: MIME_BY_EXT[extname(clean).toLowerCase() as keyof typeof MIME_BY_EXT] };
}

/** Read one managed image for a host-side gallery thumbnail. */
export async function readCanvasAsset(assetDir: string, name: string): Promise<CanvasAsset> {
  const { full, clean, mime } = assetPath(name, assetDir);
  const actual = await realInside(full, assetDir, name);
  const info = await stat(actual);
  if (!info.isFile()) throw new Error(`canvas asset is not a file: asset://${name}`);
  if (info.size > ASSET_MAX_BYTES) throw new Error(`canvas asset too large: asset://${name}`);
  const data = await readFile(actual);
  validateImageBytes(clean, data);
  return { name: clean, mime, bytes: info.size, data, etag: `"${digest(data)}"` };
}

async function realInside(full: string, root: string, ref: string): Promise<string> {
  const [actual, actualRoot] = await Promise.all([realpath(full), realpath(root)]);
  if (actual !== actualRoot && !actual.startsWith(actualRoot + sep)) throw new Error(`canvas asset symlink escapes asset directory: asset://${ref}`);
  return actual;
}

/** Replace only quoted asset:// literals. The source stays small; the iframe receives data URIs. */
export async function materializeCanvasAssets(source: string, assetDir: string) {
  const refs = findAssetRefs(source);
  if (!refs.length) return { source, refs: [], signature: "" };
  let code = source;
  const signatures: string[] = [];
  for (const ref of refs) {
    const asset = await readCanvasAsset(assetDir, ref);
    const uri = `data:${asset.mime};base64,${asset.data.toString("base64")}`;
    code = code.split(`asset://${ref}`).join(uri);
    signatures.push(`${ref}:${asset.bytes}:${asset.etag}`);
  }
  return { source: code, refs, signature: signatures.sort().join("|") };
}
