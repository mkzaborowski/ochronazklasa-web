import { auth } from "@/auth";
import { pobierzRozliczenie } from "@/lib/online-api";
import { plikWariantu, sprawdzParametry, wgWariantow } from "@/lib/interrisk/paczka";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Plik rozliczeniowy dla InterRisk — jeden wariant, jeden okres.
 *
 * Paczka ze wszystkimi wariantami naraz siedzi pod /api/rozliczenie/zip; obie
 * trasy składają pliki tym samym kodem, więc nie mogą się rozjechać.
 */
export async function GET(req: Request) {
  const sesja = await auth();
  if (!sesja?.user) return new Response("Unauthorized", { status: 401 });

  const p = new URL(req.url).searchParams;
  const wariantId = p.get("wariant") ?? "";
  const nazwaKorekty = (p.get("zestaw") ?? "").trim();
  const dataAneksu = p.get("aneks") ?? "";
  const dataPlatnosci = p.get("platnosc") ?? "";
  const od = p.get("od") ?? "";
  const do_ = p.get("do") ?? "";

  if (!wariantId) return new Response("Brak wariantu", { status: 400 });
  const blad = sprawdzParametry({ nazwaKorekty, dataAneksu, dataPlatnosci, od, do: do_ });
  if (blad) return new Response(blad, { status: 400 });

  try {
    const { wiersze } = await pobierzRozliczenie();
    const dlaWariantu = wgWariantow(wiersze, { od, do: do_ }).get(wariantId) ?? [];
    if (dlaWariantu.length === 0) {
      return new Response(
        `Ten wariant nie ma wystawionych certyfikatów w okresie ${od} – ${do_}`,
        { status: 404 },
      );
    }

    const { bytes, nazwa } = await plikWariantu(wariantId, dlaWariantu, {
      nazwaKorekty,
      // Data z formularza jest dniem kalendarzowym, nie chwilą — „T12:00"
      // trzyma ją w tym samym dniu niezależnie od strefy serwera.
      dataAneksu: new Date(`${dataAneksu}T12:00:00`),
      dataPlatnosci: new Date(`${dataPlatnosci}T12:00:00`),
    });

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nazwa)}`,
      },
    });
  } catch (error) {
    const tresc = error instanceof Error ? error.message : String(error);
    // Niekompletna konfiguracja to 409 — plik wyszedłby poprawnie sformatowany
    // i błędny, a taki trafia do ubezpieczyciela i wraca po tygodniu.
    return new Response(tresc, { status: /podryzyk|suma ubezpieczenia|rozbicia/.test(tresc) ? 409 : 502 });
  }
}
