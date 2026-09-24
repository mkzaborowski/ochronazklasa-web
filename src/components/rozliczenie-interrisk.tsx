"use client";

import { useState } from "react";
import { AlertTriangle, FileSpreadsheet } from "lucide-react";
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
  const [zestaw, setZestaw] = useState("");
  const [aneks, setAneks] = useState(dzis);
  const [platnosc, setPlatnosc] = useState(dzis);
  const [zPeselem, setZPeselem] = useState(false);

  const gotowe = zestaw.trim() !== "" && aneks !== "" && platnosc !== "";

  const link = (wariantId: string) =>
    `/api/rozliczenie?wariant=${encodeURIComponent(wariantId)}` +
    `&zestaw=${encodeURIComponent(zestaw.trim())}` +
    `&aneks=${aneks}&platnosc=${platnosc}&pesel=${zPeselem ? "1" : "0"}`;

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
      {/* Skąd biorą się sumy: centrala przysłała kody, klucze i składki, ale
          kolumnę „Suma Ubezpieczenia" zostawiła pustą. Wpisujemy tam sumę
          wariantu — tę samą, którą ubezpieczony ma na certyfikacie. Piszemy to
          wprost, bo to jedyna liczba w pliku, która nie pochodzi wprost od
          centrali, a biuro podpisuje się pod całym plikiem. */}
      <p className="mt-2 text-xs text-muted-foreground">
        Sumy ubezpieczenia w pliku to sumy z certyfikatów (29 000 zł przy składce 60 zł,
        150 000 zł przy 250 zł). Centrala podała kody taryfowe, klucze i składki, a kolumnę
        z sumą zostawiła pustą — jeśli kiedyś przyśle rozbicie sum na poszczególne podryzyka,
        wpisujemy je i wchodzą w to miejsce.
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

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
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

      {/* W przysłanym szablonie kolumna PESEL jest pusta, ale my PESEL-e mamy.
          Domyślnie ich nie wpisujemy — zgodnie z wzorem — i zostawiamy decyzję
          biuru, bo to ono uzgadnia format z centralą. */}
      <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={zPeselem}
          onChange={(e) => setZPeselem(e.target.checked)}
          className="size-4"
        />
        Wpisz PESEL-e ubezpieczonych (w szablonie z centrali ta kolumna jest pusta)
      </label>

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
          Uzupełnij nazwę zestawu i obie daty — wchodzą do każdego wiersza pliku.
        </p>
      ) : null}
    </div>
  );
}
