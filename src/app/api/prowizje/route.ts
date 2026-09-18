import { auth } from "@/auth";
import { raportProwizji } from "@/lib/prowizje/raport";
import { nazwaPlikuProwizji, plikProwizji } from "@/lib/prowizje/plik";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Plik z wypłatami prowizji za okres.
 *
 * TYLKO ADMINISTRATOR. To są kwoty, które dostają konkretni ludzie — w tym
 * udział szefa i administratora. Rola AGENT i tak nie wchodzi do panelu biura,
 * ale trasa /api nie przechodzi przez tamtą bramkę, więc pilnujemy tutaj.
 */
export async function GET(req: Request) {
  const devBypass =
    process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
  if (!devBypass) {
    const session = await auth();
    if (!session?.user) return new Response("Unauthorized", { status: 401 });
    if (session.user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  }

  const p = new URL(req.url).searchParams;
  const od = p.get("od") ?? "";
  const do_ = p.get("do") ?? "";
  if (!DATA.test(od) || !DATA.test(do_) || od > do_) {
    return new Response("Podaj prawidłowy okres (od ≤ do)", { status: 400 });
  }

  try {
    const raport = await raportProwizji(od, do_);
    const bytes = await plikProwizji(raport);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          nazwaPlikuProwizji(od, do_),
        )}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return new Response(
      `Nie udało się przygotować raportu: ${error instanceof Error ? error.message : error}`,
      { status: 502 },
    );
  }
}
