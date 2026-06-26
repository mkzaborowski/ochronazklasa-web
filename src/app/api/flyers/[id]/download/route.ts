import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const devBypass =
    process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
  if (!devBypass) {
    const session = await auth();
    if (!session?.user) return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const flyer = await db.generatedFlyer.findUnique({ where: { id } });
  if (!flyer) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(flyer.fileData), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(flyer.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
