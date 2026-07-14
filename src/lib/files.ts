import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Deliberately outside `public/` — files here are only ever reachable through
// the authenticated route at /api/files/[subdir]/[filename], never served statically.
const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_SIZE_BYTES = 15 * 1024 * 1024;

export function safeFileSubpath(subdir: string, fileName: string) {
  // Reject anything that could escape UPLOADS_ROOT via path traversal.
  if (subdir.includes("..") || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return null;
  }
  return path.join(UPLOADS_ROOT, subdir, fileName);
}

export async function saveUploadedFile(file: File, subdir: string) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Only PDF, JPEG, or PNG files are accepted.");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("File is too large (max 15MB).");
  }

  const ext = path.extname(file.name) || (file.type === "application/pdf" ? ".pdf" : "");
  const fileName = `${randomUUID()}${ext}`;
  const dir = path.join(UPLOADS_ROOT, subdir);
  await mkdir(dir, { recursive: true });

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, fileName), bytes);

  return { fileName, originalName: file.name };
}

export async function readUploadedFile(subdir: string, fileName: string) {
  const fullPath = safeFileSubpath(subdir, fileName);
  if (!fullPath) return null;
  try {
    return await readFile(fullPath);
  } catch {
    return null;
  }
}
