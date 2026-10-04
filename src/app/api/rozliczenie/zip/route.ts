import { auth } from "@/auth";
import { paczkaRozliczen, sprawdzParametry } from "@/lib/interrisk/paczka";

/**
 * Paczka zip ze wszystkimi wariantami, które miały sprzedaż w okresie.
 *
 * Biuro pobierało dotąd pięć plików po kolei, pięć razy wpisując te same trzy
 * pola. Tu wpisuje je raz.
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

  const blad = sprawdzParametry({ nazwaKorekty, dataAneksu, dataPlatnosci, od, do: do_ });
  if (blad) return new Response(blad, { status: 400 });

  try {
    const paczka = await paczkaRozliczen(
      { od, do: do_ },
      {
        nazwaKorekty,
        dataAneksu: new Date(`${dataAneksu}T12:00:00`),
        dataPlatnosci: new Date(`${dataPlatnosci}T12:00:00`),
      },
    );

    return new Response(new Uint8Array(paczka.bytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(paczka.nazwa)}`,
        // Co w środku — do podejrzenia w narzędziach sieciowych, gdyby ktoś
        // pytał, dlaczego paczka ma trzy pliki, a wariantów jest pięć.
        "X-Warianty": paczka.warianty.map((w) => w.wariantId).join(","),
      },
    });
  } catch (error) {
    const tresc = error instanceof Error ? error.message : String(error);
    return new Response(tresc, { status: /Brak wystawionych|nie dało się złożyć/.test(tresc) ? 409 : 502 });
  }
}
