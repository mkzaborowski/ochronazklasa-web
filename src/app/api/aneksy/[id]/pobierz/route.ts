import { auth } from "@/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { zlozAneks } from "@/lib/aneksy/dokument";
import { nazwaPlikuAneksu } from "@/lib/interrisk/nazwa-pliku";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Aneks w Wordzie — składany przy każdym pobraniu z danych w bazie.
 *
 * Nie trzymamy gotowego pliku: po poprawce w formularzu następne pobranie od
 * razu ma nową treść, a nazwa pliku idzie za aktualnym skrótem szkoły.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // /api nie jest objęte strażnikiem w proxy.ts — autoryzacja tutaj.
  const devBypass =
    process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
  const session = devBypass ? null : await auth();
  if (!devBypass) {
    if (!session?.user) return new Response("Unauthorized", { status: 401 });
    // Agent ma własny portal i nie pobiera dokumentów biura.
    if (session.user.role === "AGENT") return new Response("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const a = await db.aneks.findUnique({ where: { id } });
  if (!a) return new Response("Nie ma takiego aneksu", { status: 404 });

  const plik = zlozAneks({
    numerAneksu: a.numerAneksu,
    numerPolisy: a.numerPolisy,
    dataAneksu: a.dataAneksu.toISOString().slice(0, 10),
    nazwaSzkoly: a.nazwaSzkoly,
    rokSzkolny: a.rokSzkolny,
    liczbaUbezpieczonych: a.liczbaUbezpieczonych,
    liczbaZwolnionych: a.liczbaZwolnionych,
    skladkaGrosze: a.skladkaGrosze,
    dodatkowePunkty: Array.isArray(a.dodatkowePunkty) ? a.dodatkowePunkty.map(String) : [],
  });

  const nazwa = nazwaPlikuAneksu({
    numerPolisy: a.numerPolisy,
    etykieta: a.etykieta,
    szkola: a.nazwaSzkoly,
  });

  await logAudit({
    userId: session?.user?.id,
    action: "aneks.download",
    entity: "Aneks",
    entityId: a.id,
  });

  return new Response(new Uint8Array(plik), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nazwa)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
