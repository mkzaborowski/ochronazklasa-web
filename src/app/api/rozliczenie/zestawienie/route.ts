import { auth } from "@/auth";
import { pobierzRozliczenie } from "@/lib/online-api";
import { sprawdzParametry, wgWariantow } from "@/lib/interrisk/paczka";
import { zestawienieFinansowe } from "@/lib/interrisk/zestawienie";
import { KONFIGURACJA, nazwaPlikuZestawienia, plikZestawienia } from "@/lib/interrisk/zestawienie-plik";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Samo zestawienie finansowe, bez arkuszy osobowych.
 *
 * Ten sam plik leży w paczce zip — tu jest osobno, bo biuro uzgadnia kwoty
 * z centralą częściej, niż składa pełne rozliczenie.
 */
export async function GET(req: Request) {
  const sesja = await auth();
  if (!sesja?.user) return new Response("Unauthorized", { status: 401 });

  const p = new URL(req.url).searchParams;
  const nazwaKorekty = (p.get("zestaw") ?? "").trim();
  const dataAneksu = p.get("aneks") ?? "";
  const dataPlatnosci = p.get("platnosc") ?? "";
  const od = p.get("od") ?? "";
  const do_ = p.get("do") ?? "";

  // Podgląd w panelu potrzebuje tylko okresu — nazwa zestawu i daty wchodzą
  // dopiero do nagłówka arkusza. Dzięki temu tabela na ekranie pokazuje się od
  // razu, a nie dopiero po wypełnieniu pól, których do liczb nie potrzeba.
  const json = p.get("format") === "json";
  const blad = json
    ? sprawdzParametry({ nazwaKorekty: "x", dataAneksu: "2000-01-01", dataPlatnosci: "2000-01-01", od, do: do_ })
    : sprawdzParametry({ nazwaKorekty, dataAneksu, dataPlatnosci, od, do: do_ });
  if (blad) return new Response(blad, { status: 400 });

  try {
    const { wiersze } = await pobierzRozliczenie();
    const wg = wgWariantow(wiersze, { od, do: do_ });
    if (wg.size === 0) {
      return json
        ? Response.json({ okres: { od, do: do_ }, wiersze: [], sumy: null, rozbieznosci: [] })
        : new Response(`Brak sprzedaży w okresie ${od} – ${do_}`, { status: 409 });
    }
    const zestawienie = zestawienieFinansowe(wg, { od, do: do_ }, KONFIGURACJA);
    if (json) return Response.json(zestawienie);

    const bytes = await plikZestawienia(zestawienie, {
      nazwaKorekty,
      dataAneksu: new Date(`${dataAneksu}T12:00:00`),
      dataPlatnosci: new Date(`${dataPlatnosci}T12:00:00`),
    });

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          nazwaPlikuZestawienia(nazwaKorekty),
        )}`,
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : String(error), { status: 502 });
  }
}
