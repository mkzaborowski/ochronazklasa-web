import { FileText, Folder, ExternalLink } from "lucide-react";
import { listFolder, type DriveFile } from "@/lib/google/drive";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const FOLDER_MIME = "application/vnd.google-apps.folder";

async function loadFiles(): Promise<
  { configured: boolean; files: DriveFile[]; error?: string }
> {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    return { configured: false, files: [] };
  }
  try {
    const files = await listFolder(rootId);
    return { configured: true, files };
  } catch (e) {
    return { configured: true, files: [], error: (e as Error).message };
  }
}

export default async function DocumentsPage() {
  const { configured, files, error } = await loadFiles();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dokumenty (Google Drive)</h1>
        <p className="text-sm text-muted-foreground">
          Pliki polis na współdzielonym dysku firmowym.
        </p>
      </div>

      {!configured ? (
        <Notice tone="info">
          Integracja z Google Drive nie jest jeszcze skonfigurowana. Uzupełnij{" "}
          <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code>,{" "}
          <code>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code> i{" "}
          <code>GOOGLE_DRIVE_ROOT_FOLDER_ID</code> w <code>.env</code> (instrukcja
          w <code>PROJECT.md</code>).
        </Notice>
      ) : error ? (
        <Notice tone="error">Błąd Google Drive: {error}</Notice>
      ) : files.length === 0 ? (
        <Notice tone="info">Folder jest pusty.</Notice>
      ) : (
        <div className="divide-y rounded-lg border">
          {files.map((f) => {
            const isFolder = f.mimeType === FOLDER_MIME;
            return (
              <div key={f.id} className="flex items-center gap-3 p-3">
                {isFolder ? (
                  <Folder className="size-5 text-amber-500" />
                ) : (
                  <FileText className="size-5 text-muted-foreground" />
                )}
                <div className="flex-1 truncate text-sm font-medium">{f.name}</div>
                <div className="hidden text-xs text-muted-foreground sm:block">
                  {f.modifiedTime ? formatDate(new Date(f.modifiedTime)) : ""}
                </div>
                {f.webViewLink ? (
                  <a
                    href={f.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Otwórz <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "info" | "error";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
      : "border-border bg-muted/40 text-muted-foreground";
  return <div className={`rounded-lg border p-4 text-sm ${cls}`}>{children}</div>;
}
