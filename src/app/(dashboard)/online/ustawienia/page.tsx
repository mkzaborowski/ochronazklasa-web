import Link from "next/link";
import { pobierzStanSystemu } from "@/lib/online-api";

export const dynamic = "force-dynamic";

function Pole({ etykieta, wartosc }: { etykieta: string; wartosc: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{etykieta}</span>
      <span className="text-right text-sm font-medium">{wartosc}</span>
    </div>
  );
}

export default async function OnlineSettingsPage() {
  let stan;
  let blad: string | null = null;
  try {
    stan = await pobierzStanSystemu();
  } catch (error) {
    blad = error instanceof Error ? error.message : String(error);
  }

  if (!stan) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Stan systemu sprzedaży</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{blad}</div>
      </div>
    );
  }

  const gotowe = stan.sprzedazOnline && stan.smtp.ok && !stan.umowaGrupowa.startsWith("[");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/online" className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
          ← Sprzedaż online
        </Link>
        <h1 className="text-xl font-semibold">Stan systemu sprzedaży</h1>
      </div>

      <div
        className={`rounded-lg border p-4 text-sm ${
          gotowe
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        {gotowe ? (
          <>
            <strong>System gotowy do sprzedaży.</strong> Płatności produkcyjne, poczta działa,
            umowa grupowa uzupełniona.
          </>
        ) : (
          <>
            <strong>Sprzedaż jeszcze nie ruszyła.</strong> Poniżej widać, czego brakuje. Zmiany
            wprowadza się w pliku <code>/opt/ozk-api/.env</code> na serwerze, po czym{" "}
            <code>bosman restart ozk-api</code>.
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Płatności</h2>
          <Pole
            etykieta="Tryb"
            wartosc={stan.trybPlatnosci === "p24" ? "Przelewy24 (produkcja)" : "Testowy (mock)"}
          />
          <Pole etykieta="Środowisko P24" wartosc={stan.p24Sandbox ? "sandbox" : "produkcyjne"} />
          {stan.trybPlatnosci !== "p24" && (
            <p className="mt-3 text-xs text-muted-foreground">
              Do uruchomienia: <code>P24_MERCHANT_ID</code>, <code>P24_POS_ID</code>,{" "}
              <code>P24_CRC</code>, <code>P24_REPORT_KEY</code> oraz{" "}
              <code>PAYMENTS_MODE=p24</code>.
            </p>
          )}
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Poczta (certyfikaty do klientów)</h2>
          <Pole etykieta="Stan" wartosc={stan.smtp.ok ? "działa" : "nieskonfigurowana"} />
          <p
            className={`mt-3 text-xs ${stan.smtp.ok ? "text-emerald-700" : "text-red-700"}`}
          >
            {stan.smtp.komunikat}
          </p>
          {!stan.smtp.ok && (
            <p className="mt-2 text-xs text-muted-foreground">
              Do uruchomienia: <code>SMTP_HOST</code>, <code>SMTP_PORT</code>,{" "}
              <code>SMTP_USER</code>, <code>SMTP_PASS</code>.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Umowa grupowa i certyfikaty</h2>
        <Pole
          etykieta="Seria i numer umowy grupowej"
          wartosc={
            stan.umowaGrupowa.startsWith("[") ? (
              <span className="text-amber-700">do uzupełnienia (od Kamili)</span>
            ) : (
              stan.umowaGrupowa
            )
          }
        />
        <Pole etykieta="Wystawione certyfikaty produkcyjne" wartosc={stan.wystawioneCertyfikaty} />
      </div>
    </div>
  );
}
