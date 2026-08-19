"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Link polecający agenta — do skopiowania i rozdania.
 *
 * Kopiowanie jest tu głównym działaniem, nie ozdobą: ten link trafia do SMS-a,
 * na ulotkę i do stopki maila, więc przepisywanie go ręcznie skończyłoby się
 * literówką i sprzedażą przypisaną do nikogo.
 */
export function AgentLink({ link, kod }: { link: string; kod: string }) {
  const [skopiowany, setSkopiowany] = useState(false);

  const kopiuj = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setSkopiowany(true);
      toast.success("Link skopiowany.");
      // Znak potwierdzenia gaśnie sam — przycisk musi wrócić do stanu,
      // w którym da się kliknąć drugi raz bez zastanawiania się, czy zadziała.
      setTimeout(() => setSkopiowany(false), 2000);
    } catch {
      toast.error("Nie udało się skopiować — zaznacz i skopiuj ręcznie.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
        {link}
      </code>
      <Button variant="outline" size="sm" onClick={kopiuj} aria-label={`Kopiuj link agenta ${kod}`}>
        {skopiowany ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
        {skopiowany ? "Skopiowano" : "Kopiuj"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<a href={link} target="_blank" rel="noopener noreferrer" />}
      >
        <ExternalLink className="size-4" />
        Otwórz
      </Button>
    </div>
  );
}

/**
 * Wariant do tabeli: sam kod i jedno kliknięcie kopiujące PEŁNY link.
 * Kopiowanie kodu zamiast linku byłoby pułapką — agent wkleiłby „KNOWAK"
 * do SMS-a i nikt by z tego nie kliknął.
 */
export function KopiujLink({ link, kod }: { link: string; kod: string }) {
  const [skopiowany, setSkopiowany] = useState(false);

  const kopiuj = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setSkopiowany(true);
      toast.success(`Link agenta ${kod} skopiowany.`);
      setTimeout(() => setSkopiowany(false), 2000);
    } catch {
      toast.error("Nie udało się skopiować.");
    }
  };

  return (
    <button
      type="button"
      onClick={kopiuj}
      title={link}
      aria-label={`Kopiuj link agenta ${kod}`}
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs transition-colors hover:bg-accent"
    >
      {kod}
      {skopiowany ? (
        <Check className="size-3.5 text-emerald-600" />
      ) : (
        <Copy className="size-3.5 text-muted-foreground" />
      )}
    </button>
  );
}
