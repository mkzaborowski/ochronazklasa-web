import Link from "next/link";
import { AlertTriangle, FileSpreadsheet, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ADMINISTRATOR,
  PROWIZJA_FIRMY_PROC,
  STAWKI,
  SZEF,
} from "@/lib/prowizje/zasady";
import type { RaportProwizji } from "@/lib/prowizje/raport";

/**
 * Rozliczenie prowizji — kto ile dostaje za okres.
 *
 * NIEZALEŻNE OD ROZLICZENIA Z INTERRISK. Tamto jest plikiem do zaczytania
 * u ubezpieczyciela, to jest lista przelewów dla naszych ludzi. Źródło danych
 * jest wspólne — te same wystawione i opłacone certyfikaty — więc pula do
 * podziału zgadza się z tym, co przyjdzie z centrali.
 *
 * Okres wybiera się zwykłym formularzem GET, a strona liczy się po stronie
 * serwera. Adres niesie okres, więc raport za wrzesień da się wysłać komuś
 * linkiem i zobaczy dokładnie to samo.
 */

const pln = (gr: number) =>
  (gr / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";

const ETYKIETY_ROLI = { agent: "agent", administrator: "administrator", szef: "szef" } as const;

export function RozliczenieProwizji({
  raport,
  blad,
}: {
  raport: RaportProwizji | null;
  blad: string | null;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Wallet className="size-4 text-[var(--blekit)]" />
            Rozliczenie prowizji
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Wypłaty dla agentów i firmy z {PROWIZJA_FIRMY_PROC}% prowizji od InterRisk. Z kodem
            agenta: agent {STAWKI.zAgentem.agent}%, administrator {STAWKI.zAgentem.administrator}%,
            szef reszta. Bez kodu: administrator {STAWKI.bezAgenta.administrator}%, szef reszta.
          </p>
        </div>
      </div>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1.5 text-xs text-muted-foreground">
          Od
          <input
            type="date"
            name="od"
            defaultValue={raport?.od}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm"
          />
        </label>
        <label className="grid gap-1.5 text-xs text-muted-foreground">
          Do
          <input
            type="date"
            name="do"
            defaultValue={raport?.do}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm"
          />
        </label>
        <Button type="submit" variant="secondary" size="sm">
          Przelicz
        </Button>
        {raport && raport.sprzedaze.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={`/api/prowizje?od=${raport.od}&do=${raport.do}`} />}
          >
            <FileSpreadsheet className="size-4" /> Pobierz xlsx
          </Button>
        ) : null}
      </form>

      {blad ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {blad}
        </div>
      ) : null}

      {raport && raport.sprzedaze.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          W tym okresie nie ma wystawionych certyfikatów z potwierdzoną płatnością.
        </p>
      ) : null}

      {raport && raport.sprzedaze.length > 0 ? <Tabela raport={raport} /> : null}
    </div>
  );
}

function Tabela({ raport }: { raport: RaportProwizji }) {
  const { zestawienie: z } = raport;
  const zgodne = z.sumy.wyplatyGr + z.sumy.czekaGr === z.sumy.pulaGr;

  return (
    <>
      {z.nierozstrzygniete.length > 0 ? (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>{pln(z.sumy.czekaGr)}</strong> czeka na przypisanie kodu — klient wpisał kod,
            którego system nie umiał rozstrzygnąć ({z.nierozstrzygniete.map((n) => n.kod).join(", ")}).
            Udział agenta nie trafia do nikogo z automatu: przypisz kod na{" "}
            <Link href="/online" className="underline underline-offset-4">
              liście sprzedaży
            </Link>
            , a raport przeliczy się sam.
          </span>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Osoba</th>
              <th className="py-2 pr-3 text-right font-medium">Z własnej sprzedaży</th>
              <th className="py-2 pr-3 text-right font-medium">Administrator</th>
              <th className="py-2 pr-3 text-right font-medium">Szef</th>
              <th className="py-2 text-right font-medium">Do wypłaty</th>
            </tr>
          </thead>
          <tbody>
            {z.osoby.map((o) => (
              <tr key={o.klucz} className="border-b last:border-0">
                <td className="py-2 pr-3">
                  <div className="font-medium">{o.nazwa}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.role.map((r) => ETYKIETY_ROLI[r]).join(" + ")}
                    {o.sprzedazy > 0
                      ? ` · ${o.sprzedazy} ${o.sprzedazy === 1 ? "sprzedaż" : "sprzedaży"} z kodu`
                      : ""}
                  </div>
                </td>
                <Kwota gr={o.zeSprzedazyGr} />
                <Kwota gr={o.zAdministratoraGr} />
                <Kwota gr={o.zSzefaGr} />
                <td className="py-2 text-right font-semibold tabular-nums">{pln(o.razemGr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Kontrola na dole, a nie w przypisie: to jest zdanie, które odpowiada na
          pytanie „czy te liczby się zgadzają", zanim ktoś zacznie robić przelewy. */}
      <dl className="mt-4 grid gap-x-6 gap-y-1 border-t pt-3 text-sm sm:grid-cols-2">
        <Wiersz etykieta="Sprzedaży w okresie">
          {z.sumy.sprzedazy} ({z.sumy.zAgentem} z kodem agenta, {z.sumy.bezAgenta} bez kodu)
        </Wiersz>
        <Wiersz etykieta="Składka łącznie">{pln(z.sumy.skladkaGr)}</Wiersz>
        <Wiersz etykieta={`Prowizja od InterRisk (${PROWIZJA_FIRMY_PROC}%)`}>
          {pln(z.sumy.pulaGr)}
        </Wiersz>
        <Wiersz etykieta="Do wypłaty teraz">
          {pln(z.sumy.wyplatyGr)}
          {z.sumy.czekaGr > 0 ? ` + ${pln(z.sumy.czekaGr)} czeka` : ""}
        </Wiersz>
      </dl>
      <p className={`mt-2 text-xs ${zgodne ? "text-muted-foreground" : "font-medium text-red-700"}`}>
        {zgodne
          ? "Suma wypłat zgadza się z prowizją od InterRisk co do grosza."
          : "Suma wypłat NIE zgadza się z prowizją — nie wypłacaj, zgłoś to."}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Administrator: {ADMINISTRATOR.nazwa}. Szef: {SZEF.nazwa}
        {SZEF.kodAgenta ? ` — jego sprzedaż z kodu ${SZEF.kodAgenta} łączy się z udziałem szefa w jedną wypłatę` : ""}.
        Okres liczony po dacie sprzedaży, nie wystawienia — korekta certyfikatu nie przesuwa
        sprzedaży do innego miesiąca.
      </p>
    </>
  );
}

function Kwota({ gr }: { gr: number }) {
  return (
    <td className={`py-2 pr-3 text-right tabular-nums ${gr === 0 ? "text-muted-foreground" : ""}`}>
      {gr === 0 ? "—" : pln(gr)}
    </td>
  );
}

function Wiersz({ etykieta, children }: { etykieta: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{etykieta}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  );
}
