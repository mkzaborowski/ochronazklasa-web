"use client";

import { useState } from "react";
import { AlertTriangle, FileArchive, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Pobieranie plików rozliczeniowych dla InterRisk.
 *
 * JEDEN PLIK NA POLISĘ GRUPOWĄ, bo taki jest ich szablon — w kolumnie „numer
 * polisy" stoi jedna wartość na cały plik. U nas każdy wariant to osobna polisa
 * grupowa, więc tyle plików, ile wariantów ze sprzedażą.
 *
 * Nazwa zestawu i obie daty wpisuje biuro: zmieniają się przy każdym
 * rozliczeniu i nie ma czego zapamiętywać. Kody taryfowe są odwrotnie — stałe
 * dla wariantu, więc siedzą w konfiguracji, a nie w tym formularzu.
 */

export interface WariantDoRozliczenia {
  wariantId: string;
  numerPolisy: string;
  skladkaZl: number;
  osob: number;
  /** ile wierszy zajmie jedna osoba; 0 = centrala nie podała rozbicia */
  podryzyk: number;
  /** czy rozbicie jest kompletne — bez tego pliku nie wolno złożyć */
  gotowy: boolean;
}

export function RozliczenieInterrisk({
  warianty,
  problemy,
}: {
  warianty: WariantDoRozliczenia[];
  /** warianty, których jeszcze nie da się rozliczyć, z powodem */
  problemy: { wariantId: string; powod: string }[];
}) {
  const dzis = new Date().toISOString().slice(0, 10);
  // Domyślnie poprzedni pełny miesiąc: rozliczenie jest z natury wsteczne,
  // a bieżący miesiąc jeszcze się sprzedaje.
  const teraz = new Date();
  const poprzedniOd = new Date(Date.UTC(teraz.getUTCFullYear(), teraz.getUTCMonth() - 1, 1))
    .toISOString().slice(0, 10);
  const poprzedniDo = new Date(Date.UTC(teraz.getUTCFullYear(), teraz.getUTCMonth(), 0))
    .toISOString().slice(0, 10);

  const [zestaw, setZestaw] = useState("");
  const [aneks, setAneks] = useState(poprzedniDo);
  const [platnosc, setPlatnosc] = useState(dzis);
  const [od, setOd] = useState(poprzedniOd);
  const [do_, setDo] = useState(poprzedniDo);

  const gotowe = zestaw.trim() !== "" && aneks !== "" && platnosc !== "" && od !== "" && do_ !== "" && od <= do_;

  const parametry =
    `zestaw=${encodeURIComponent(zestaw.trim())}` +
    `&aneks=${aneks}&platnosc=${platnosc}&od=${od}&do=${do_}`;
  const link = (wariantId: string) =>
    `/api/rozliczenie?wariant=${encodeURIComponent(wariantId)}&${parametry}`;
  const linkPaczki = `/api/rozliczenie/zip?${parametry}`;

  if (warianty.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold">Rozliczenie InterRisk</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nie ma jeszcze wystawionych certyfikatów z opłaconą składką — nie ma czego rozliczać.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="text-sm font-semibold">Rozliczenie InterRisk</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Wystawione certyfikaty z potwierdzoną płatnością, w układzie pliku do zaczytania.
        Jeden plik na polisę grupową — bo tak wygląda szablon z centrali.
      </p>
      {/* Sumy ubezpieczenia są teraz właściwością podryzyka, nie wariantu —
          i to jest nieoczywiste na tyle, że biuro powinno o tym wiedzieć,
          zanim zdziwi się, widząc 2 700 zł przy polisie na 29 000 zł. */}
      <p className="mt-2 text-xs text-muted-foreground">
        Kody taryfowe, klucze statystyczne, sumy ubezpieczenia i składki pochodzą z arkuszy
        centrali. Suma ubezpieczenia należy do podryzyka, nie do wariantu: tylko dwa pierwsze
        składniki mają sumę z certyfikatu, pozostałe cztery mają własne, niższe.
      </p>
      {/* Kolumna PESEL jest w szablonie pusta, my wypełniamy ją zawsze — to
          decyzja biura, więc niech biuro o niej wie, a nie odkrywa jej,
          otwierając plik. Co piąty ubezpieczony ma tam datę urodzenia. */}
      <p className="mt-1 text-xs text-muted-foreground">
        Kolumna &bdquo;PESEL Ubezpieczonego&rdquo; jest wypełniona zawsze — jednoznacznie wskazuje osobę
        przy zgłoszeniu szkody. Kto przy zakupie podał tylko datę urodzenia, ma w tym miejscu
        datę; w szablonie z centrali ta kolumna jest pusta.
      </p>

      {problemy.length > 0 ? (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Rozbicie na podryzyka jest niepełne, więc tych wariantów nie da się jeszcze
            rozliczyć. W szablonie jedna osoba zajmuje kilka wierszy — po jednym na każdy
            składnik pakietu, z własnym kodem taryfowym, kluczem, sumą ubezpieczenia
            i składką. Kody, klucze i składki przyszły z centrali; brakujące pozycje
            trzeba u niej dopytać.
            <ul className="mt-2 list-disc pl-5">
              {problemy.map((p) => (
                <li key={p.wariantId}>
                  <strong>{p.wariantId}</strong> — {p.powod}
                </li>
              ))}
            </ul>
          </span>
        </div>
      ) : null}

      {/* Okres jest obowiązkowy: bez niego plik brał całą historię sprzedaży
          od początku, co przy rozliczeniu co miesiąc znaczyłoby zgłaszanie
          centrali tego samego po raz kolejny. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="od" className="text-xs text-muted-foreground">
            Sprzedaż od
          </Label>
          <Input id="od" type="date" value={od} onChange={(e) => setOd(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="do" className="text-xs text-muted-foreground">
            Sprzedaż do
          </Label>
          <Input id="do" type="date" value={do_} onChange={(e) => setDo(e.target.value)} />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="zestaw" className="text-xs text-muted-foreground">
            Nazwa zestawu
          </Label>
          <Input
            id="zestaw"
            value={zestaw}
            placeholder="np. ZESTAW 01.09.2026"
            onChange={(e) => setZestaw(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="aneks" className="text-xs text-muted-foreground">
            Data aneksu
          </Label>
          <Input id="aneks" type="date" value={aneks} onChange={(e) => setAneks(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="platnosc" className="text-xs text-muted-foreground">
            Data płatności
          </Label>
          <Input
            id="platnosc"
            type="date"
            value={platnosc}
            onChange={(e) => setPlatnosc(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 p-3">
        <Button
          nativeButton={false}
          disabled={!gotowe}
          render={<a href={gotowe ? linkPaczki : undefined} />}
        >
          <FileArchive className="size-4" /> Pobierz wszystkie w zip
        </Button>
        <span className="text-xs text-muted-foreground">
          Po jednym pliku na wariant ze sprzedażą w tym okresie — zamiast pobierania po kolei.
        </span>
      </div>

      <ul className="mt-4 divide-y border-t">
        {warianty.map((w) => (
          <li key={w.wariantId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="text-sm">
              <div className="font-medium">
                {w.numerPolisy}{" "}
                <span className="font-normal text-muted-foreground">· {w.skladkaZl} zł</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {w.osob} {w.osob === 1 ? "ubezpieczony" : "ubezpieczonych"}
                {w.podryzyk === 0
                  ? " · brak rozbicia na podryzyka"
                  : ` · ${w.osob * w.podryzyk} wierszy w pliku (${w.podryzyk} podryzyka na osobę)` +
                    (w.gotowy ? "" : " · rozbicie niepełne")}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              disabled={!gotowe || !w.gotowy}
              render={<a href={gotowe && w.gotowy ? link(w.wariantId) : undefined} />}
            >
              <FileSpreadsheet className="size-4" /> Pobierz xlsx
            </Button>
          </li>
        ))}
      </ul>

      {!gotowe ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Uzupełnij nazwę zestawu, okres i obie daty — wchodzą do każdego wiersza pliku.
        </p>
      ) : null}
    </div>
  );
}
