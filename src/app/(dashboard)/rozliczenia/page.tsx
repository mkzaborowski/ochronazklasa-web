import { pobierzRozliczenie } from "@/lib/online-api";
import {
  RozliczenieInterrisk,
  type WariantDoRozliczenia,
} from "@/components/rozliczenie-interrisk";
import { PODRYZYKA_WARIANTU, problemyKonfiguracji } from "@/lib/interrisk/rozliczenie-kody";
import { RozliczenieProwizji } from "@/components/rozliczenie-prowizji";
import { domyslnyOkres, raportProwizji, type RaportProwizji } from "@/lib/prowizje/raport";
import { getCurrentUser } from "@/lib/auth-helpers";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export const dynamic = "force-dynamic";

/**
 * Rozliczenia z InterRisk — osobna zakładka.
 *
 * Wcześniej ta sekcja siedziała nad listą sprzedaży. Rozliczenie robi się raz
 * na zestaw, a listę sprzedaży otwiera się codziennie — mieszanie tych dwóch
 * rzeczy na jednym ekranie kazało przewijać formularz rozliczeniowy za każdym
 * razem, gdy ktoś chciał tylko sprawdzić wniosek.
 */
export default async function RozliczeniaPage({
  searchParams,
}: {
  searchParams: Promise<{ od?: string; do?: string }>;
}) {
  const parametry = await searchParams;
  const uzytkownik = await getCurrentUser();
  // Prowizje to kwoty konkretnych ludzi, w tym szefa i administratora.
  // Tryb deweloperski nie ma konta, więc tam sekcja jest widoczna.
  const trybDeweloperski =
    process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
  const widziProwizje = trybDeweloperski || uzytkownik?.role === "ADMIN";

  let prowizje: RaportProwizji | null = null;
  let bladProwizji: string | null = null;
  if (widziProwizje) {
    const domyslny = domyslnyOkres();
    const od = DATA.test(parametry.od ?? "") ? parametry.od! : domyslny.od;
    const do_ = DATA.test(parametry.do ?? "") ? parametry.do! : domyslny.do;
    if (od > do_) {
      bladProwizji = 'Data „od” jest późniejsza niż „do”.';
    } else {
      try {
        prowizje = await raportProwizji(od, do_);
      } catch (error) {
        bladProwizji = `Nie udało się policzyć prowizji: ${error instanceof Error ? error.message : error}`;
      }
    }
  }

  let warianty: WariantDoRozliczenia[] = [];
  let blad: string | null = null;

  try {
    const { wiersze } = await pobierzRozliczenie();
    const wg = new Map<string, WariantDoRozliczenia>();
    for (const w of wiersze) {
      const biezacy = wg.get(w.wariantId);
      if (biezacy) biezacy.osob += 1;
      else
        wg.set(w.wariantId, {
          wariantId: w.wariantId,
          numerPolisy: w.numerPolisy,
          skladkaZl: w.skladkaZl,
          osob: 1,
          podryzyk: (PODRYZYKA_WARIANTU[w.wariantId] ?? []).length,
          // Sama liczba podryzyk nie wystarczy: rozbicie bywa niepełne (dziś
          // brakuje w nim sum ubezpieczenia). O tym, czy wolno pobrać plik,
          // decyduje to samo sprawdzenie, które wypisuje powody niżej.
          gotowy: problemyKonfiguracji([w.wariantId]).length === 0,
        });
    }
    warianty = [...wg.values()].sort((a, b) => a.skladkaZl - b.skladkaZl);
  } catch (error) {
    blad = error instanceof Error ? error.message : String(error);
  }

  const osobLacznie = warianty.reduce((s, w) => s + w.osob, 0);
  const wierszyLacznie = warianty.reduce((s, w) => s + w.osob * w.podryzyk, 0);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Rozliczenia</h1>
        <p className="text-sm text-muted-foreground">
          Wypłaty prowizji i pliki do zaczytania po stronie InterRisk — z wystawionych
          certyfikatów z potwierdzoną płatnością.
          {osobLacznie > 0 ? (
            <>
              {" "}
              Do rozliczenia{" "}
              <strong className="font-medium text-foreground">{osobLacznie}</strong>{" "}
              {osobLacznie === 1 ? "ubezpieczony" : "ubezpieczonych"}
              {wierszyLacznie > 0 ? ` (${wierszyLacznie} wierszy)` : ""}.
            </>
          ) : null}
        </p>
      </div>

      {widziProwizje ? <RozliczenieProwizji raport={prowizje} blad={bladProwizji} /> : null}

      {blad ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Nie udało się połączyć z usługą sprzedaży online (ozk-api).
          <div className="mt-1 font-mono text-xs opacity-80">{blad}</div>
        </div>
      ) : (
        <RozliczenieInterrisk
          warianty={warianty}
          problemy={problemyKonfiguracji(warianty.map((w) => w.wariantId))}
        />
      )}
    </div>
  );
}
