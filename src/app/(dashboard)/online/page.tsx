import Link from "next/link";
import {
  BEZ_AGENTA,
  ETYKIETY_STATUSU,
  KLASA_STATUSU,
  pobierzStanSystemu,
  pobierzWnioski,
  type StatusWniosku,
} from "@/lib/online-api";
import { dopasujAgentow, kodyDoRozstrzygniecia } from "@/lib/agents/atrybucja";
import { PrzypiszKod } from "@/components/przypisz-kod";
import { db } from "@/lib/db";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const fieldClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const dataPL = (iso: string) => {
  const d = iso.slice(0, 10).split("-");
  return d.length === 3 ? `${d[2]}.${d[1]}.${d[0]}` : iso;
};

const kwota = (zl: number) => zl.toLocaleString("pl-PL", { minimumFractionDigits: 2 });

export default async function OnlineSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; szukaj?: string; agent?: string }>;
}) {
  const filtry = await searchParams;

  let dane;
  let stan;
  let blad: string | null = null;
  try {
    [dane, stan] = await Promise.all([pobierzWnioski(filtry), pobierzStanSystemu()]);
  } catch (error) {
    blad = error instanceof Error ? error.message : String(error);
  }

  if (blad || !dane || !stan) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Sprzedaż online</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Nie udało się połączyć z usługą sprzedaży online (ozk-api).
          <div className="mt-1 font-mono text-xs opacity-80">{blad}</div>
        </div>
      </div>
    );
  }

  // Nazwiska agentów dokładamy tutaj: usługa sprzedaży zna wyłącznie kody.
  const agenci = await dopasujAgentow(dane.wnioski.map((w) => w.kodAgenta));
  // Do rozstrzygnięcia patrzymy po CAŁEJ sprzedaży, nie po bieżącym filtrze:
  // kod czekający na decyzję ma być widoczny także wtedy, gdy ktoś akurat
  // zawęził tabelę do jednego statusu.
  const doRozstrzygniecia = await kodyDoRozstrzygniecia(
    dane.statystyki.wgAgenta.map((p) => p.kod),
  );
  // Wartością filtru są WSZYSTKIE kody agenta, także porzucone — inaczej po
  // zmianie kodu jego dawna sprzedaż wypadałaby z własnego filtru.
  const doFiltru = (
    await db.agent
      .findMany({
        where: { code: { not: null } },
        select: { name: true, code: true, codeHistory: true, codeAliases: true },
        orderBy: [{ active: "desc" }, { name: "asc" }],
      })
      .catch(() => [])
  ).map((a) => ({
    name: a.name,
    wartosc: [a.code!, ...a.codeHistory, ...a.codeAliases].join(","),
  }));

  // Pełna lista do ręcznego przypisania — także agenci bez kodu, bo brak kodu
  // nie znaczy, że ta sprzedaż nie jest ich.
  const wszyscyAgenci = doRozstrzygniecia.length
    ? await db.agent
        .findMany({ select: { id: true, name: true }, orderBy: [{ active: "desc" }, { name: "asc" }] })
        .catch(() => [])
    : [];

  const kafelki = [
    { etykieta: "Wnioski", wartosc: dane.statystyki.wszystkie },
    { etykieta: "Opłacone", wartosc: dane.statystyki.oplacone },
    { etykieta: "Certyfikaty", wartosc: dane.statystyki.certyfikaty },
    { etykieta: "Ubezpieczone dzieci", wartosc: dane.statystyki.dzieci },
    { etykieta: "Przychód", wartosc: `${kwota(dane.statystyki.przychodZl)} zł` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sprzedaż online</h1>
          <p className="text-sm text-muted-foreground">
            Polisy indywidualne EDU Plus kupowane przez ochronazklasa.pl
          </p>
        </div>
        <Link
          href="/online/ustawienia"
          className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          Stan systemu
        </Link>
      </div>

      {!stan.sprzedazOnline && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Tryb testowy.</strong> Płatności nie są pobierane, a certyfikaty są znaczone jako
          dokumenty testowe. Sprzedaż ruszy po wpisaniu danych Przelewy24 —
          szczegóły w zakładce „Stan systemu”.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kafelki.map((k) => (
          <div key={k.etykieta} className="rounded-lg border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.etykieta}</div>
            <div className="mt-1 text-2xl font-semibold">{k.wartosc}</div>
          </div>
        ))}
      </div>

      {doRozstrzygniecia.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {doRozstrzygniecia.length === 1
              ? "Jeden kod czeka na decyzję"
              : `${doRozstrzygniecia.length} kody czekają na decyzję`}
          </h2>
          <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
            Klient wpisał kod opiekuna z ręki, a system nie umiał rozstrzygnąć, czyj jest —
            albo pasuje do dwóch osób tak samo dobrze, albo do nikogo. Wskaż agenta:
            przypisanie działa też wstecz, na sprzedaż, która już się odbyła.
          </p>
          <ul className="mt-3 space-y-3">
            {doRozstrzygniecia.map((k) => (
              <li key={k.kod} className="flex flex-wrap items-center gap-3">
                <code className="rounded bg-amber-100 px-2 py-1 font-mono text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                  {k.kod}
                </code>
                <PrzypiszKod kod={k.kod} kandydaci={k.kandydaci} agenci={wszyscyAgenci} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="szukaj"
          defaultValue={filtry.szukaj ?? ""}
          placeholder="Szukaj: nazwisko, e-mail, PESEL, nr certyfikatu"
          className={`${fieldClass} min-w-[260px] flex-1`}
        />
        <select name="status" defaultValue={filtry.status ?? ""} className={fieldClass}>
          <option value="">Wszystkie statusy</option>
          {Object.entries(ETYKIETY_STATUSU).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="agent" defaultValue={filtry.agent ?? ""} className={fieldClass}>
          <option value="">Wszyscy agenci</option>
          <option value={BEZ_AGENTA}>Bez rekomendacji</option>
          {doFiltru.map((a) => (
            <option key={a.wartosc} value={a.wartosc}>
              {a.name}
            </option>
          ))}
        </select>
        <button className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Filtruj
        </button>
        {(filtry.status || filtry.szukaj || filtry.agent) && (
          <Link href="/online" className="flex h-9 items-center rounded-md border px-4 text-sm">
            Wyczyść
          </Link>
        )}
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Klient</TableHead>
              <TableHead>Zakres</TableHead>
              <TableHead>Kwota</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Certyfikat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dane.wnioski.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Brak wniosków spełniających kryteria.
                </TableCell>
              </TableRow>
            )}
            {dane.wnioski.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {dataPL(w.utworzono)}
                </TableCell>
                <TableCell>
                  <Link href={`/online/${w.id}`} className="font-medium hover:underline">
                    {w.oplacajacy.imie} {w.oplacajacy.nazwisko}
                  </Link>
                  <div className="text-xs text-muted-foreground">{w.oplacajacy.email}</div>
                </TableCell>
                <TableCell>
                  {w.ubezpieczeni.length} × {w.wariant.skladka ?? "?"} zł
                  <div className="text-xs text-muted-foreground">
                    {w.ubezpieczeni.map((u) => `${u.imie} ${u.nazwisko}`).join(", ")}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap font-medium">{kwota(w.kwotaZl)} zł</TableCell>
                <TableCell className="text-sm">
                  <Agent kod={w.kodAgenta} dopasowany={agenci.get(w.kodAgenta ?? "")} />
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                      KLASA_STATUSU[w.status as StatusWniosku]
                    }`}
                  >
                    {ETYKIETY_STATUSU[w.status as StatusWniosku]}
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  {/* Przy kilkorgu dzieci jest kilka numerów - po jednym na
                      certyfikat. W jednej linii rozpychałyby tabelę. */}
                  {w.numerCertyfikatu
                    ? w.numerCertyfikatu.split(", ").map((n) => (
                        <div key={n} className="whitespace-nowrap">
                          {n}
                        </div>
                      ))
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * Agent przy wniosku. Cztery stany, każdy znaczy co innego:
 *   brak kodu    — klient przyszedł sam, sprzedaż jest niczyja i tak ma zostać,
 *   kod znany    — pokazujemy nazwisko z linkiem do profilu,
 *   kod rozpoznany— kodu nie ma w bazie, ale pasuje do nazwiska jednej osoby
 *                  (MARCELMOTYCKI → Marcel Motycki). Mówimy o tym WPROST, bo
 *                  to jest wniosek systemu, a nie fakt z bazy — i ktoś musi
 *                  móc go zakwestionować, patrząc na tę tabelę.
 *   kod nieznany — literówka, agent skasowany albo dwoje o tym samym nazwisku;
 *                  pokazujemy sam kod, bo ktoś się o tę sprzedaż upomni.
 */
function Agent({
  kod,
  dopasowany,
}: {
  kod: string | null;
  dopasowany?: {
    id: string;
    name: string;
    active: boolean;
    poprzedniKod: boolean;
    rozpoznany?: { pewnosc: number; powod: string };
  };
}) {
  if (!kod) return <span className="text-muted-foreground">bez rekomendacji</span>;
  if (!dopasowany) {
    return (
      <span className="text-amber-700" title="Kod nie pasuje do żadnego agenta">
        {kod} <span className="text-xs">(nieznany)</span>
      </span>
    );
  }
  return (
    <Link href={`/agents/${dopasowany.id}`} className="hover:underline">
      {dopasowany.name}
      {dopasowany.poprzedniKod ? (
        <span className="ml-1 text-xs text-muted-foreground" title={`stary kod: ${kod}`}>
          (stary kod)
        </span>
      ) : null}
      {dopasowany.rozpoznany ? (
        <span
          className="ml-1 text-xs text-muted-foreground"
          title={`Kod ${kod} nie jest zapisany w bazie — ${dopasowany.rozpoznany.powod}. Aby przypisać go na stałe, otwórz profil agenta.`}
        >
          (rozpoznany z {kod})
        </span>
      ) : null}
    </Link>
  );
}
