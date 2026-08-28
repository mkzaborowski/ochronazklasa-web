import { powiadomONowejSprzedazy } from "@/lib/powiadomienia/nowa-sprzedaz";

/**
 * Wyzwalacz powiadomień o nowej sprzedaży — wołany z crona na serwerze.
 *
 * Trasa, a nie pętla w procesie: panel bywa restartowany przy każdym wdrożeniu,
 * a licznik w pamięci znaczyłby, że po każdym wdrożeniu okno się przesuwa
 * i część sprzedaży zostaje bez powiadomienia. Cron pilnuje rytmu, a zadanie
 * samo wie, co już wysłało.
 *
 * Chroniona osobnym sekretem, nie sesją: cron nie ma się jak zalogować,
 * a przez zwykłe konto tej trasy wołać nie trzeba.
 */
export async function POST(req: Request) {
  const sekret = process.env.POWIADOMIENIA_SEKRET;
  if (!sekret) return new Response("POWIADOMIENIA_SEKRET nieustawiony", { status: 503 });

  const podany = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  // Porównanie o stałym czasie: różnica jest tu teoretyczna, ale kosztuje
  // jedną linijkę, a sekret chroni wysyłkę maili do wszystkich agentów.
  const rowne =
    podany.length === sekret.length &&
    podany.split("").reduce((r, z, i) => r | (z.charCodeAt(0) ^ sekret.charCodeAt(i)), 0) === 0;
  if (!rowne) return new Response("Unauthorized", { status: 401 });

  try {
    const wynik = await powiadomONowejSprzedazy();
    return Response.json(wynik, { status: wynik.bledy.length ? 207 : 200 });
  } catch (e) {
    return Response.json(
      { blad: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
