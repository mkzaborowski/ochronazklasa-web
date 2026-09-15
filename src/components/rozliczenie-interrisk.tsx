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
}

export function RozliczenieInterrisk({
  warianty,
  brakiKodow,
}: {
  warianty: WariantDoRozliczenia[];
  /** warianty bez kodów z centrali — plik wyjdzie z pustymi kolumnami */
  brakiKodow: string[];
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

      {brakiKodow.length > 0 ? (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Brakuje kodów z centrali ({brakiKodow.join(", ")}). Plik pobierze się, ale kolumny
            {" "}
            <em>kod taryfowy</em>, <em>klucz statystyczny</em> i <em>Uprawniony</em> będą puste —
            InterRisk go tak nie zaczyta. Uzupełnij je w{" "}
            <code>src/lib/interrisk/rozliczenie-kody.ts</code>.
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
                {w.osob} {w.osob === 1 ? "ubezpieczony" : "ubezpieczonych"} do rozliczenia
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              disabled={!gotowe}
              render={<a href={gotowe ? link(w.wariantId) : undefined} />}
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
