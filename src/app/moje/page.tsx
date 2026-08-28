import Link from "next/link";
import { School, FileText, Globe, Wallet } from "lucide-react";
import { kartaZalogowanegoAgenta, daneAgenta, BRAK_KARTY } from "@/lib/agents/portal";
import { linkPolecajacy } from "@/lib/agents/kod";
import { qrSvgAgenta } from "@/lib/agents/qr";
import { AgentLink } from "@/components/agent-link";
import { AgentQr } from "@/components/agent-qr";
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{karta.name}</h1>
        <p className="text-sm text-muted-foreground">
          {karta.email}
          {karta.phone ? ` · ${karta.phone}` : ""}
          {karta.code ? ` · kod ${karta.code}` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kafelek Ikona={School} liczba={statystyki.szkoly} opis="Przypisane szkoły" />
        <Kafelek Ikona={FileText} liczba={statystyki.polisyGrupowe} opis="Polisy grupowe" />
        <Kafelek Ikona={Globe} liczba={statystyki.sprzedazOnline} opis="Sprzedaż online" />
        <Kafelek
          Ikona={Wallet}
          liczba={`${statystyki.przychodOnlineZl.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`}
          opis={`Składka z ${statystyki.onlineOplacone} opłaconych`}
        />
      </div>

      {karta.code ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Twój link polecający</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AgentLink link={linkPolecajacy(karta.code)} kod={karta.code} />
            <p className="text-sm text-muted-foreground">
              Zakup zrobiony z tego linku przypisuje się do Ciebie — także wtedy, gdy rodzic
              najpierw poczyta stronę i wróci później (polecenie ważne 30 dni). Kod{" "}
              <strong className="font-medium text-foreground">{karta.code}</strong> działa też bez
              linku: rodzic może wpisać go w formularzu zakupu, w kroku z danymi.
            </p>
            <div className="border-t pt-4">
              <AgentQr svg={await qrSvgAgenta(karta.code)} kod={karta.code} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Twoje szkoły ({szkoly.length})</CardTitle>
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
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
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
          <CardTitle className="text-base">
            Twoje polisy ({polisy.wiersze.length})
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

function Kafelek({
  Ikona,
  liczba,
  opis,
}: {
  Ikona: React.ComponentType<{ className?: string }>;
  liczba: number | string;
  opis: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Ikona className="size-4" />
        <span className="text-xs">{opis}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{liczba}</div>
    </div>
  );
}
