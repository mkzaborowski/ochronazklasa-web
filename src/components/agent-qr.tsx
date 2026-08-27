import { Download, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Kod QR agenta z pobieraniem do druku.
 *
 * Dwa formaty, bo idą w różne miejsca: PNG do prezentacji, maila i mediów
 * społecznościowych, SVG do ulotki i plakatu — rastrowy kod w powiększeniu
 * rozłazi się na piksele i skaner przestaje go czytać.
 */
export function AgentQr({ svg, kod }: { svg: string; kod: string }) {
  return (
    <div className="flex flex-wrap items-start gap-5">
      <div
        className="w-40 shrink-0 rounded-lg border bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
        // SVG powstaje na serwerze z naszego linku, nie z danych użytkownika
        dangerouslySetInnerHTML={{ __html: svg }}
        aria-label={`Kod QR linku polecającego agenta ${kod}`}
        role="img"
      />
      <div className="min-w-0 space-y-3">
        <p className="text-sm text-muted-foreground">
          Rodzic skanuje kod telefonem i trafia wprost do zakupu z tym poleceniem. Wygodniejsze
          niż przepisywanie adresu z kartki — a przepisany z literówką link nie przypisze
          sprzedaży do nikogo.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={`/api/agenci/${encodeURIComponent(kod)}/qr`} download />}
          >
            <FileImage className="size-4" />
            PNG (ekran)
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={`/api/agenci/${encodeURIComponent(kod)}/qr?format=svg`} download />}
          >
            <Download className="size-4" />
            SVG (druk)
          </Button>
        </div>
      </div>
    </div>
  );
}
