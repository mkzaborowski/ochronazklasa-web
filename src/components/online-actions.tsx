"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resendCertificateAction, retryFulfilmentAction } from "@/lib/actions/online";

export function OnlineActions({
  id,
  certyfikatDostepny,
  mozliwaPonownaRealizacja,
}: {
  id: string;
  certyfikatDostepny: boolean;
  mozliwaPonownaRealizacja: boolean;
}) {
  const [oczekuje, startTransition] = useTransition();
  const [komunikat, setKomunikat] = useState<{ ok: boolean; text: string } | null>(null);

  const uruchom = (akcja: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => {
      const wynik = await akcja();
      setKomunikat({ ok: wynik.ok, text: wynik.message });
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {certyfikatDostepny && (
          <>
            <a
              href={`/api/online/${id}/certificate`}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              Pobierz certyfikat
            </a>
            <Button
              variant="outline"
              disabled={oczekuje}
              onClick={() => uruchom(() => resendCertificateAction(id))}
            >
              {oczekuje ? "Wysyłanie…" : "Wyślij certyfikat ponownie"}
            </Button>
          </>
        )}
        {mozliwaPonownaRealizacja && (
          <Button
            variant="outline"
            disabled={oczekuje}
            onClick={() => uruchom(() => retryFulfilmentAction(id))}
          >
            {oczekuje ? "Pracuję…" : "Ponów realizację"}
          </Button>
        )}
        {!certyfikatDostepny && !mozliwaPonownaRealizacja && (
          <span className="text-sm text-muted-foreground">
            Certyfikat pojawi się po zaksięgowaniu płatności.
          </span>
        )}
      </div>

      {komunikat && (
        <div
          className={`rounded-md p-3 text-sm ${
            komunikat.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {komunikat.text}
        </div>
      )}
    </div>
  );
}
