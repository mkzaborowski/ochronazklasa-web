import { wyslijRozliczenie } from "@/lib/interrisk/wysylka";

/**
 * Wyzwalacz automatycznej wysyłki rozliczenia — wołany z crona na serwerze.
 *
 * Ten sam wzorzec co /api/powiadomienia/sprzedaz: trasa, a nie pętla w procesie
 * (panel bywa restartowany przy każdym wdrożeniu), chroniona osobnym sekretem,
 * bo cron nie ma się jak zalogować. Cron może chodzić często — zadanie samo
 * wie, czy dziś jest ten dzień i czy ten okres już poszedł.
 */
export async function POST(req: Request) {
  const sekret = process.env.POWIADOMIENIA_SEKRET;
  if (!sekret) return new Response("POWIADOMIENIA_SEKRET nieustawiony", { status: 503 });

  const podany = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const rowne =
    podany.length === sekret.length &&
    podany.split("").reduce((r, z, i) => r | (z.charCodeAt(0) ^ sekret.charCodeAt(i)), 0) === 0;
  if (!rowne) return new Response("Unauthorized", { status: 401 });

  try {
    const wynik = await wyslijRozliczenie();
    return Response.json(wynik, { status: wynik.stan === "blad" ? 500 : 200 });
  } catch (e) {
    return Response.json({ blad: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
