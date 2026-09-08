import { auth } from "@/auth";
import { db } from "@/lib/db";
import { nazwaPlikuUlotki } from "@/lib/interrisk/nazwa-pliku";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const devBypass =
    process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
  if (!devBypass) {
    const session = await auth();
    if (!session?.user) return new Response("Unauthorized", { status: 401 });
    // Rola AGENT ma własny portal i nie pobiera dokumentów biura.
    if (session.user.role === "AGENT") return new Response("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const flyer = await db.generatedFlyer.findUnique({
    where: { id },
    include: { school: { select: { nazwa: true, etykieta: true } } },
  });
  if (!flyer) return new Response("Not found", { status: 404 });

  // Jak przy polisie: nazwę składamy TUTAJ, więc ulotki wygenerowane wcześniej
  // też pobierają się z nazwą placówki. Dotąd każda nazywała się tak samo
  // (`ulotka_65pln50.pdf`) i druga tego dnia lądowała w katalogu jako „(1)".
  const nazwa = nazwaPlikuUlotki({
    etykieta: flyer.school?.etykieta,
    szkola: flyer.school?.nazwa,
    szablon: flyer.templateKey,
  });

  return new Response(new Uint8Array(flyer.fileData), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nazwa)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
