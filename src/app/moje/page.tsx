import Link from "next/link";
import { School, FileText, Globe, Wallet, Link2 as LinkIcon } from "lucide-react";
import { kartaZalogowanegoAgenta, daneAgenta, BRAK_KARTY } from "@/lib/agents/portal";
import { linkPolecajacy } from "@/lib/agents/kod";
import { qrSvgAgenta } from "@/lib/agents/qr";
import { AgentLink } from "@/components/agent-link";
import { AgentQr } from "@/components/agent-qr";
import { PrzelacznikPowiadomien } from "@/components/przelacznik-powiadomien";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ETYKIETY_ZRODLA, type ZrodloPolisy } from "@/lib/polisy/wszystkie";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const KLASA_ZRODLA: Record<ZrodloPolisy, string> = {
  reczna: "bg-slate-100 text-slate-700",
  grupowa: "bg-indigo-100 text-indigo-800",
  online: "bg-sky-100 text-sky-800",
};

export default async function MojPortalPage() {
  const karta = await kartaZalogowanegoAgenta();

  // Konto bez karty agenta nie jest błędem, tylko brakiem konfiguracji po
  // stronie biura. Mówimy o tym wprost zamiast odsyłać w miejsce, z którego
  // rola AGENT i tak zostanie odesłana z powrotem.
  if (karta === BRAK_KARTY) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Konto nie jest jeszcze podpięte</h1>
        <p className="mt-3 text-muted-foreground">
          Twoje konto działa, ale nie jest połączone z kartą agenta, więc nie ma jeszcze czego
          pokazać. Napisz do biura — podpięcie zajmuje chwilę.
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          <a href="mailto:biuro@ochronazklasa.pl" className="underline">
            biuro@ochronazklasa.pl
          </a>
        </p>
      </div>
    );
  }

  const { szkoly, polisy, statystyki } = await daneAgenta(karta);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {/* Nagłówek niesie kolor marki, żeby portal nie zaczynał się od szarej
          kartki. Kod opiekuna wygląda tu jak plakietka, bo agent podaje go
          przez telefon i musi go znaleźć wzrokiem w sekundę. */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--granat)] via-[var(--granat-2)] to-[var(--granat-3)] p-6 md:p-8 text-white shadow-[0_18px_40px_-24px_rgba(14,26,51,.9)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[2px] text-white/60">
              Panel agenta
            </div>
            <h1 className="mt-1.5 truncate text-2xl font-semibold tracking-tight md:text-3xl">
              {karta.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/70">
              {karta.code ? (
                <span className="rounded-lg bg-white/15 px-2.5 py-1 font-mono text-sm font-semibold tracking-wide text-white">
                  {karta.code}
                </span>
              ) : null}
              <span className="truncate">{karta.email}</span>
              {karta.phone ? <span>· {karta.phone}</span> : null}
            </div>
          </div>
          <div className="shrink-0 rounded-xl bg-white/10 p-3 backdrop-blur-sm">
            <div className="mb-2 text-xs font-medium text-white/70">Powiadomienia o sprzedaży</div>
            <PrzelacznikPowiadomien wlaczone={karta.powiadomieniaEmail} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kafelek Ikona={School} liczba={statystyki.szkoly} opis="Przypisane szkoły" barwa="indygo" />
        <Kafelek Ikona={FileText} liczba={statystyki.polisyGrupowe} opis="Polisy grupowe" barwa="fiolet" />
        <Kafelek Ikona={Globe} liczba={statystyki.sprzedazOnline} opis="Sprzedaż online" barwa="blekit" />
        <Kafelek
          Ikona={Wallet}
          liczba={`${statystyki.przychodOnlineZl.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`}
          opis={`Składka z ${statystyki.onlineOplacone} opłaconych`}
          barwa="zielen"
        />
      </div>

      {karta.code ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                <LinkIcon className="size-3.5" />
              </span>
              Twój link polecający
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AgentLink link={linkPolecajacy(karta.code)} kod={karta.code} />
            <p className="text-sm text-muted-foreground">
              Zakup zrobiony z tego linku przypisuje się do Ciebie — także wtedy, gdy rodzic
              najpierw poczyta stronę i wróci później (polecenie ważne 30 dni). Kod{" "}
              <strong className="font-medium text-foreground">{karta.code}</strong> działa też bez
              linku: rodzic może wpisać go w formularzu zakupu, w kroku z danymi.
            </p>
            <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
              <AgentQr svg={await qrSvgAgenta(karta.code)} kod={karta.code} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <School className="size-3.5" />
            </span>
            Twoje szkoły
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              {szkoly.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {szkoly.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nie masz jeszcze przypisanych szkół. Przypisania robi biuro.
            </p>
          ) : (
            <ul className="divide-y">
              {szkoly.map((s) => (
                <li key={s.id} className="flex items-baseline justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{s.nazwa}</div>
                    <div className="truncate text-xs text-muted-foreground">{s.adres}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-violet-700">
                    {s.liczbaPolis} {s.liczbaPolis === 1 ? "polisa" : "polis"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
              <FileText className="size-3.5" />
            </span>
            Twoje polisy
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
              {polisy.wiersze.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {polisy.niedostepne.length > 0 ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Lista jest niepełna — nie odpowiada: {polisy.niedostepne.join(", ")}.
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numer / Produkt</TableHead>
                  <TableHead>Ubezpieczający</TableHead>
                  <TableHead>Źródło</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Okres</TableHead>
                  <TableHead className="text-right">Składka</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {polisy.wiersze.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Nie ma jeszcze żadnych polis na Twoim koncie.
                    </TableCell>
                  </TableRow>
                ) : (
                  polisy.wiersze.map((w) => (
                    <TableRow key={w.klucz}>
                      <TableCell>
                        <div className="font-medium">{w.numer ?? "(bez numeru)"}</div>
                        <div className="text-xs text-muted-foreground">{w.produkt}</div>
                      </TableCell>
                      <TableCell className="max-w-64 truncate" title={w.ubezpieczajacy}>
                        {w.ubezpieczajacy}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${KLASA_ZRODLA[w.zrodlo]}`}
                        >
                          {ETYKIETY_ZRODLA[w.zrodlo]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${w.klasaStatusu}`}
                        >
                          {w.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{w.okres}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {w.skladkaZl != null
                          ? `${w.skladkaZl.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Widzisz tu wyłącznie swoje dane. Zmiany w karcie agenta, przypisaniach szkół i numerach
        polis robi biuro —{" "}
        <Link href="mailto:biuro@ochronazklasa.pl" className="underline">
          napisz do nas
        </Link>
        , jeśli coś się nie zgadza.
      </p>
    </div>
  );
}

/**
 * Każdy licznik ma własną barwę, ta sama za każdym wejściem.
 * Kolor niesie tu znaczenie: agent wraca po tę samą liczbę i po tygodniu
 * szuka jej po plamie koloru, a nie po czytaniu czterech podpisów.
 */
const BARWY = {
  indygo: { chip: "bg-indigo-100 text-indigo-700", kreska: "bg-indigo-500", liczba: "text-indigo-950" },
  fiolet: { chip: "bg-violet-100 text-violet-700", kreska: "bg-violet-500", liczba: "text-violet-950" },
  blekit: { chip: "bg-sky-100 text-sky-700", kreska: "bg-sky-500", liczba: "text-sky-950" },
  zielen: { chip: "bg-emerald-100 text-emerald-700", kreska: "bg-emerald-500", liczba: "text-emerald-950" },
} as const;

function Kafelek({
  Ikona,
  liczba,
  opis,
  barwa,
}: {
  Ikona: React.ComponentType<{ className?: string }>;
  liczba: number | string;
  opis: string;
  barwa: keyof typeof BARWY;
}) {
  const b = BARWY[barwa];
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4 pl-5 transition-shadow hover:shadow-md">
      <span className={`absolute inset-y-0 left-0 w-1 ${b.kreska}`} aria-hidden="true" />
      <div className="flex items-center gap-2.5">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${b.chip}`}>
          <Ikona className="size-4" />
        </span>
        <span className="text-xs leading-tight text-muted-foreground">{opis}</span>
      </div>
      <div className={`mt-3 text-2xl font-semibold tabular-nums ${b.liczba}`}>{liczba}</div>
    </div>
  );
}
