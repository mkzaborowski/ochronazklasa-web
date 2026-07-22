import Link from "next/link";
import {
  ETYKIETY_STATUSU,
  KLASA_STATUSU,
  pobierzStanSystemu,
  pobierzWnioski,
  type StatusWniosku,
} from "@/lib/online-api";
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
  searchParams: Promise<{ status?: string; szukaj?: string }>;
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
        <button className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Filtruj
        </button>
        {(filtry.status || filtry.szukaj) && (
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
              <TableHead>Status</TableHead>
              <TableHead>Certyfikat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dane.wnioski.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
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
                <TableCell>
                  <span
                    className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                      KLASA_STATUSU[w.status as StatusWniosku]
                    }`}
                  >
                    {ETYKIETY_STATUSU[w.status as StatusWniosku]}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {w.numerCertyfikatu ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
