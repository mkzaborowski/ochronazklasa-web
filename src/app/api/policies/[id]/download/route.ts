import { auth } from "@/auth";
import { db } from "@/lib/db";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // /api is not covered by the proxy guard, so authorize here.
  const devBypass =
    process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
  if (!devBypass) {
    const session = await auth();
    if (!session?.user) return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const policy = await db.generatedPolicy.findUnique({ where: { id } });
  if (!policy) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(policy.fileData), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(policy.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
