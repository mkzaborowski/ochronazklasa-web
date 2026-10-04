"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zapiszWysylke, wyslijTeraz } from "@/lib/actions/rozliczenie-wysylka";
import type { UstawieniaWysylki } from "@/lib/interrisk/wysylka";

/**
 * Automatyczna wysyłka paczki rozliczeniowej do centrali.
 *
 * Formularz mówi PEŁNYM ZDANIEM, co się stanie i kiedy — bo to jedyne miejsce
 * w panelu, które samo z siebie wysyła listy na zewnątrz. „5. dnia miesiąca"
 * nic nie znaczy, dopóki nie widać, że chodzi o paczkę za wrzesień wychodzącą
 * 5 października na konkretny adres.
 */
export function WysylkaRozliczenia({ ustawienia }: { ustawienia: UstawieniaWysylki }) {
  const [wlaczona, setWlaczona] = useState(ustawienia.wlaczona);
  const [odbiorcy, setOdbiorcy] = useState(ustawienia.odbiorcy.join(", "));
  const [dzien, setDzien] = useState(String(ustawienia.dzienWysylki));
  const [wstecz, setWstecz] = useState(String(ustawienia.miesiecyWstecz));
  const [dniDoPlatnosci, setDniDoPlatnosci] = useState(String(ustawienia.dniDoPlatnosci));
  const [komunikat, setKomunikat] = useState<{ blad?: string; ok?: string } | null>(null);
  const [czeka, start] = useTransition();

  const zapisz = (formularz: FormData) =>
    start(async () => setKomunikat(await zapiszWysylke(formularz)));

  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Clock className="size-4 text-[var(--blekit)]" />
        Automatyczna wysyłka do centrali
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Panel sam składa paczkę za zamknięty miesiąc i wysyła ją mailem. Dopóki jest wyłączona,
        nic nie wychodzi — pliki pobiera się ręcznie powyżej.
      </p>

      <form action={zapisz} className="mt-4 grid gap-4">
        <label className="flex items-start gap-3 rounded-md border p-3">
          <input
            type="checkbox"
            name="wlaczona"
            checked={wlaczona}
            onChange={(e) => setWlaczona(e.target.checked)}
            className="mt-0.5 size-4"
          />
          <span className="text-sm">
            <span className="font-medium">Wysyłaj automatycznie</span>
            <span className="block text-xs text-muted-foreground">
              {wlaczona ? zdanie(dzien, wstecz, odbiorcy) : "Teraz nic nie jest wysyłane."}
            </span>
          </span>
        </label>

        <div className="grid gap-1.5">
          <Label htmlFor="odbiorcy" className="text-xs text-muted-foreground">
            Adresy odbiorców (oddziel przecinkiem)
          </Label>
          <Input
            id="odbiorcy"
            name="odbiorcy"
            value={odbiorcy}
            placeholder="rozliczenia@interrisk.pl, biuro@ochronazklasa.pl"
            onChange={(e) => setOdbiorcy(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="dzienWysylki" className="text-xs text-muted-foreground">
              Dzień miesiąca (1–28)
            </Label>
            <Input
              id="dzienWysylki" name="dzienWysylki" type="number" min={1} max={28}
              value={dzien} onChange={(e) => setDzien(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="miesiecyWstecz" className="text-xs text-muted-foreground">
              Obejmuje miesięcy wstecz
            </Label>
            <Input
              id="miesiecyWstecz" name="miesiecyWstecz" type="number" min={1} max={12}
              value={wstecz} onChange={(e) => setWstecz(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dniDoPlatnosci" className="text-xs text-muted-foreground">
              Termin płatności (dni)
            </Label>
            <Input
              id="dniDoPlatnosci" name="dniDoPlatnosci" type="number" min={0} max={90}
              value={dniDoPlatnosci} onChange={(e) => setDniDoPlatnosci(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={czeka} size="sm">
            Zapisz ustawienia
          </Button>
          {/* Wysyłka na żądanie: harmonogram, którego nikt nie sprawdził,
              odkrywa swoje usterki miesiąc później. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={czeka}
            onClick={() => start(async () => setKomunikat(await wyslijTeraz()))}
          >
            <Send className="size-4" /> Wyślij teraz
          </Button>
          <span className="text-xs text-muted-foreground">
            &bdquo;Wyślij teraz&rdquo; działa niezależnie od przełącznika i od dnia miesiąca.
          </span>
        </div>
      </form>

      {komunikat?.blad ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {komunikat.blad}
        </p>
      ) : null}
      {komunikat?.ok ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {komunikat.ok}
        </p>
      ) : null}

      <Historia ustawienia={ustawienia} />
    </div>
  );
}

/** Co się stanie, napisane po ludzku — nie „dzień 5, 1 miesiąc wstecz". */
function zdanie(dzien: string, wstecz: string, odbiorcy: string): string {
  const adresy = odbiorcy.split(/[\s,;]+/).filter(Boolean);
  const kto = adresy.length === 0 ? "— brak odbiorców, więc nic nie wyjdzie" : `na: ${adresy.join(", ")}`;
  const okres = Number(wstecz) === 1 ? "poprzedni miesiąc" : `miesiąc sprzed ${wstecz} miesięcy`;
  return `${dzien}. dnia każdego miesiąca wychodzi paczka za ${okres} ${kto}`;
}

function Historia({ ustawienia }: { ustawienia: UstawieniaWysylki }) {
  if (!ustawienia.ostatniaProba && !ustawienia.ostatniOkres) return null;
  const kiedy = ustawienia.ostatniaProba
    ? new Date(ustawienia.ostatniaProba).toLocaleString("pl-PL")
    : null;
  return (
    <dl className="mt-4 grid gap-1 border-t pt-3 text-xs text-muted-foreground">
      {ustawienia.ostatniOkres ? (
        <div className="flex justify-between gap-3">
          <dt>Ostatni wysłany okres</dt>
          <dd className="font-medium text-foreground">{ustawienia.ostatniOkres}</dd>
        </div>
      ) : null}
      {kiedy ? (
        <div className="flex justify-between gap-3">
          <dt>Ostatnia próba</dt>
          <dd>{kiedy}</dd>
        </div>
      ) : null}
      {/* Błąd zostaje widoczny do następnej udanej wysyłki — inaczej nieudana
          próba znika z ekranu i miesiąc mija bez rozliczenia. */}
      {ustawienia.ostatniBlad ? (
        <div className="mt-1 rounded-md border border-red-200 bg-red-50 p-2 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Ostatnia próba nie powiodła się: {ustawienia.ostatniBlad}
        </div>
      ) : null}
    </dl>
  );
}
