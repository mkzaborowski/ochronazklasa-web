"use client";

import { useActionState } from "react";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { przypiszKodZFormularza } from "@/lib/actions/agents";

/**
 * Przypisanie nierozpoznanego kodu opiekuna do agenta.
 *
 * Pojawia się TYLKO tam, gdzie system sam nie umiał rozstrzygnąć. Kandydaci
 * stoją na górze listy z wynikiem dopasowania, żeby decyzja była wyborem
 * między konkretnymi osobami, a nie szukaniem po całej liście — ale pełna
 * lista zostaje pod spodem, bo system bywa w błędzie co do wszystkich trzech.
 */
export function PrzypiszKod({
  kod,
  kandydaci,
  agenci,
}: {
  kod: string;
  kandydaci: { agentId: string; name: string; pewnosc: number }[];
  agenci: { id: string; name: string }[];
}) {
  const [stan, akcja, wTrakcie] = useActionState(
    przypiszKodZFormularza.bind(null, kod),
    {} as { error?: string; ok?: boolean },
  );

  const idKandydatow = new Set(kandydaci.map((k) => k.agentId));
  const pozostali = agenci.filter((a) => !idKandydatow.has(a.id));

  if (stan.ok) {
    return (
      <p className="text-sm text-emerald-700 dark:text-emerald-400">
        Kod <code className="font-mono">{kod}</code> przypisany. Sprzedaż z tego kodu — także ta
        sprzed przypisania — liczy się od teraz temu agentowi.
      </p>
    );
  }

  return (
    <form action={akcja} className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`agent-${kod}`}>
        Agent dla kodu {kod}
      </label>
      <select
        id={`agent-${kod}`}
        name="agentId"
        defaultValue=""
        className="h-9 min-w-56 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Wybierz agenta…</option>
        {kandydaci.length > 0 ? (
          <optgroup label="Najbliżej pasujący">
            {kandydaci.map((k) => (
              <option key={k.agentId} value={k.agentId}>
                {k.name} ({Math.round(k.pewnosc * 100)}%)
              </option>
            ))}
          </optgroup>
        ) : null}
        <optgroup label={kandydaci.length > 0 ? "Pozostali" : "Agenci"}>
          {pozostali.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </optgroup>
      </select>
      <Button type="submit" size="sm" variant="secondary" disabled={wTrakcie}>
        <UserCheck className="size-4" />
        {wTrakcie ? "Zapisuję…" : "Przypisz"}
      </Button>
      {stan.error ? <span className="text-sm text-red-600">{stan.error}</span> : null}
    </form>
  );
}
