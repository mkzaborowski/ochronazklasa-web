import { auth } from "@/auth";
import { pobierzRozliczenie } from "@/lib/online-api";
import {
  nazwaPlikuRozliczenia,
  plikRozliczenia,
  type OsobaDoRozliczenia,
} from "@/lib/interrisk/rozliczenie";
import {
  PODRYZYKA_WARIANTU,
  problemyKonfiguracji,
  PROWIZJA_PROCENT,
  UPRAWNIONY,
} from "@/lib/interrisk/rozliczenie-kody";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Plik rozliczeniowy dla InterRisk — wystawione certyfikaty z opłaconych polis.
 *
 * JEDEN PLIK NA POLISĘ GRUPOWĄ, bo taki jest szablon: w kolumnie „numer polisy"
 * stoi jedna wartość na cały plik. U nas każdy wariant to osobna polisa
 * grupowa, więc wariant wybiera się parametrem.
 *
 * Daty i nazwa zestawu przychodzą z formularza — zmieniają się przy każdym
 * rozliczeniu i nie ma sensu ich nigdzie zapisywać.
 */
export async function GET(req: Request) {
  const devBypass =
    process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
  if (!devBypass) {
    const session = await auth();
    if (!session?.user) return new Response("Unauthorized", { status: 401 });
    // Rozliczenie niesie PESEL-e i kwoty prowizji — to nie jest dokument dla agenta.
    if (session.user.role === "AGENT") return new Response("Forbidden", { status: 403 });
  }

  const p = new URL(req.url).searchParams;
  const wariantId = p.get("wariant") ?? "";
  const nazwaKorekty = (p.get("zestaw") ?? "").trim();
  const dataAneksu = p.get("aneks") ?? "";
  const dataPlatnosci = p.get("platnosc") ?? "";
  const zPeselem = p.get("pesel") === "1";

  if (!wariantId) return new Response("Brak wariantu", { status: 400 });
  if (!nazwaKorekty) return new Response("Podaj nazwę zestawu", { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAneksu) || !/^\d{4}-\d{2}-\d{2}$/.test(dataPlatnosci)) {
    return new Response("Podaj daty aneksu i płatności", { status: 400 });
  }

  let osoby: OsobaDoRozliczenia[];
  let numerPolisy = "";
  try {
    const dane = await pobierzRozliczenie();
    const dlaWariantu = dane.wiersze.filter((w) => w.wariantId === wariantId);
    if (dlaWariantu.length === 0) {
      return new Response("Ten wariant nie ma jeszcze wystawionych certyfikatów", { status: 404 });
    }
    numerPolisy = dlaWariantu[0].numerPolisy;
    osoby = dlaWariantu.map((w) => ({
      numerPolisy: w.numerPolisy,
      imie: w.imie,
      nazwisko: w.nazwisko,
      pesel: w.pesel,
      okresOd: w.okresOd,
      okresDo: w.okresDo,
    }));
  } catch (error) {
    return new Response(
      `Nie udało się pobrać sprzedaży: ${error instanceof Error ? error.message : error}`,
      { status: 502 },
    );
  }

  // To samo sprawdzenie, co wypisuje powody w panelu — żeby przycisk i to
  // wejście nie mogły się rozjechać. Niekompletne rozbicie odrzucamy tak samo
  // jak brak rozbicia: plik wyszedłby poprawnie sformatowany i błędny, a taki
  // trafia do ubezpieczyciela i wraca po tygodniu.
  const problemy = problemyKonfiguracji([wariantId]);
  if (problemy.length > 0) {
    return new Response(
      `Nie można rozliczyć tego wariantu: ${problemy.map((p) => p.powod).join("; ")}. ` +
        "Uzupełnij src/lib/interrisk/rozliczenie-kody.ts danymi z centrali.",
      { status: 409 },
    );
  }

  const podryzyka = PODRYZYKA_WARIANTU[wariantId] ?? [];

  const bytes = await plikRozliczenia(osoby, {
    nazwaKorekty,
    // Data z formularza jest dniem kalendarzowym, nie chwilą — „T12:00"
    // trzyma ją w tym samym dniu niezależnie od strefy serwera.
    dataAneksu: new Date(`${dataAneksu}T12:00:00`),
    dataPlatnosci: new Date(`${dataPlatnosci}T12:00:00`),
    uprawniony: UPRAWNIONY,
    prowizjaProcent: PROWIZJA_PROCENT,
    zPeselem,
    podryzyka,
  });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        nazwaPlikuRozliczenia(numerPolisy, nazwaKorekty),
      )}`,
      "Cache-Control": "private, no-store",
    },
  });
}
