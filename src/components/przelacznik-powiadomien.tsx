"use client";

import { useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { ustawPowiadomienia } from "@/lib/actions/powiadomienia";

/** Włącznik maili o sprzedaży z własnego kodu — na karcie agenta. */
export function PrzelacznikPowiadomien({ wlaczone }: { wlaczone: boolean }) {
  const [stan, setStan] = useState(wlaczone);
  const [oczekuje, start] = useTransition();

  const przelacz = () => {
    const nowy = !stan;
    setStan(nowy); // od razu, żeby kliknięcie nie wyglądało na nieudane
    start(async () => {
      const wynik = await ustawPowiadomienia(nowy);
      if (wynik.ok) toast.success(wynik.komunikat);
      else {
        setStan(!nowy); // cofamy, bo zapis się nie udał
        toast.error(wynik.komunikat);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={przelacz}
      disabled={oczekuje}
      aria-pressed={stan}
      className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
        stan
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          : "text-muted-foreground hover:bg-accent"
      }`}
    >
      {stan ? <Bell className="size-4" /> : <BellOff className="size-4" />}
      {stan ? "Powiadomienia włączone" : "Powiadomienia wyłączone"}
    </button>
  );
}
