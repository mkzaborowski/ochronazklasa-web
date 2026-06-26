import { google, type drive_v3 } from "googleapis";
import { Readable } from "node:stream";

/**
 * Google Drive access via a service account against the company Shared Drive.
 *
 * Setup (one-time):
 *   1. Google Cloud project > enable "Google Drive API".
 *   2. Create a service account + JSON key.
 *   3. Share the company Shared Drive with the service account email (Content
 *      manager). All files then live in the Shared Drive, owned by the org —
 *      not by any single employee.
 *
 * Env: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
 *      GOOGLE_DRIVE_SHARED_DRIVE_ID, GOOGLE_DRIVE_ROOT_FOLDER_ID
 */

const SCOPES = ["https://www.googleapis.com/auth/drive"];

let cached: drive_v3.Drive | null = null;

export function getDriveClient(): drive_v3.Drive {
  if (cached) return cached;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error(
      "Google Drive is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
    );
  }

  const auth = new google.auth.JWT({ email, key, scopes: SCOPES });
  cached = google.drive({ version: "v3", auth });
  return cached;
}

/** Shared-Drive-aware defaults that must accompany every call. */
export const sharedDriveParams = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
} as const;

export interface UploadFileInput {
  name: string;
  mimeType: string;
  data: Buffer | Readable;
  parentFolderId: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
}

// ---------------------------------------------------------------------------
// Thin wrappers — fill in / extend as the file-management module is built.
// ---------------------------------------------------------------------------

export async function ensureFolder(name: string, parentId: string): Promise<string> {
  const drive = getDriveClient();
  const existing = await drive.files.list({
    q: `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
    fields: "files(id, name)",
    ...sharedDriveParams,
  });
  if (existing.data.files?.[0]?.id) return existing.data.files[0].id;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    ...sharedDriveParams,
  });
  return created.data.id!;
}

export async function uploadFile(input: UploadFileInput): Promise<DriveFile> {
  const drive = getDriveClient();
  const body = Buffer.isBuffer(input.data) ? Readable.from(input.data) : input.data;
  const res = await drive.files.create({
    requestBody: { name: input.name, parents: [input.parentFolderId] },
    media: { mimeType: input.mimeType, body },
    fields: "id, name, mimeType, webViewLink, modifiedTime, size",
    ...sharedDriveParams,
  });
  return res.data as DriveFile;
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media", ...sharedDriveParams },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, webViewLink, modifiedTime, size)",
    orderBy: "folder,name",
    ...sharedDriveParams,
  });
  return (res.data.files ?? []) as DriveFile[];
}
