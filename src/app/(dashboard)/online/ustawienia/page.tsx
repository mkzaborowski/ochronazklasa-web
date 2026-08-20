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

  // Panel i API wdrażają się osobno. Przez te dwie minuty panel może rozmawiać
  // ze starszym API, które jeszcze nie zna pola `warianty` - i to nie powód,
  // żeby strona się wywracała.
  const warianty = stan.warianty ?? [];
  const bezNumeru = warianty.filter((w) => !w.numerPolisy?.trim());
  const gotowe = stan.sprzedazOnline && stan.smtp.ok && bezNumeru.length === 0;

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
            każdy wariant ma numer polisy grupowej.
          </>
        ) : (
          <>
            <strong>Sprzedaż jeszcze nie ruszyła.</strong> Brakuje:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {!stan.sprzedazOnline ? (
                <li>
                  prawdziwych płatności — <code>PAYMENTS_MODE=p24</code> w{" "}
                  <code>/opt/ozk-api/.env</code>
                </li>
              ) : null}
              {!stan.smtp.ok ? <li>działającej wysyłki certyfikatów (patrz karta „Poczta”)</li> : null}
              {bezNumeru.length ? (
                <li>
                  numerów polis grupowych dla wariantów:{" "}
                  {bezNumeru.map((w) => `${w.skladka} zł`).join(", ")} — numery żyją przy
                  wariantach w kodzie API (<code>src/types.ts</code>), nie w <code>.env</code>
                </li>
              ) : null}
            </ul>
            <p className="mt-2">
              Po zmianach w <code>.env</code>: <code>bosman restart ozk-api</code>.
            </p>
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
          <h2 className="mb-3 text-sm font-semibold">Wysyłka certyfikatów</h2>
          <Pole etykieta="Stan" wartosc={stan.smtp.ok ? "działa" : "nieskonfigurowana"} />
          <p
            className={`mt-3 text-xs ${stan.smtp.ok ? "text-emerald-700" : "text-red-700"}`}
          >
            {stan.smtp.komunikat}
          </p>
          {!stan.smtp.ok && (
            <p className="mt-2 text-xs text-muted-foreground">
              Produkcyjnie certyfikaty idą przez usługę pocztową (
              <code>POCZTA_KLUCZ</code>) — SMTP jest tylko drogą zapasową (
              <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>,{" "}
              <code>SMTP_PASS</code>).
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold">Polisy grupowe</h2>
        <p className="mt-1 mb-3 text-xs text-muted-foreground">
          Każdy wariant to osobna umowa z InterRisk. Numer z tego wiersza trafia na certyfikat
          klienta, który kupił ten wariant. Rachunek służy wyłącznie do uzgodnień
          z ubezpieczycielem — składkę pobiera Przelewy24.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Wariant</th>
                <th className="py-2 font-medium">Polisa grupowa</th>
                <th className="py-2 font-medium">Rachunek InterRisk</th>
              </tr>
            </thead>
            <tbody>
              {warianty.map((w) => (
                <tr key={w.id} className="border-b last:border-b-0">
                  <td className="py-2 whitespace-nowrap font-medium">{w.skladka} zł</td>
                  <td className="py-2 whitespace-nowrap">
                    {w.numerPolisy?.trim() ? (
                      w.numerPolisy
                    ) : (
                      <span className="text-amber-700">brak numeru</span>
                    )}
                  </td>
                  <td className="py-2 whitespace-nowrap text-muted-foreground">
                    {w.numerKonta || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {warianty.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              Usługa sprzedaży nie podała numerów polis — najpewniej działa jeszcze starsza
              wersja API.
            </p>
          ) : null}
        </div>
        <div className="mt-3 border-t pt-3">
          <Pole etykieta="Wystawione certyfikaty produkcyjne" wartosc={stan.wystawioneCertyfikaty} />
        </div>
      </div>
    </div>
  );
}
