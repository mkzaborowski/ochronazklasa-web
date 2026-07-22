import Link from "next/link";
import { notFound } from "next/navigation";
import { ETYKIETY_STATUSU, KLASA_STATUSU, pobierzWniosek, type StatusWniosku } from "@/lib/online-api";
import { OnlineActions } from "@/components/online-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const dataPL = (iso: string) => {
  const d = iso.slice(0, 10).split("-");
  return d.length === 3 ? `${d[2]}.${d[1]}.${d[0]}` : iso;
};
const kwota = (zl: number) => zl.toLocaleString("pl-PL", { minimumFractionDigits: 2 });
const ident = (i: { typ: string; pesel: string; dataUrodzenia: string }) =>
  i.typ === "pesel" ? i.pesel : `ur. ${dataPL(i.dataUrodzenia)}`;

function Pole({ etykieta, wartosc }: { etykieta: string; wartosc: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{etykieta}</span>
      <span className="text-right text-sm font-medium">{wartosc}</span>
    </div>
  );
}

export default async function OnlineApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let w;
  try {
    w = await pobierzWniosek(id);
  } catch {
    notFound();
  }

  const o = w.oplacajacyPelny;
  const zgodyTak = Object.values(w.zgody ?? {}).filter(Boolean).length;
  const zgodyWszystkie = Object.keys(w.zgody ?? {}).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/online" className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
          ← Sprzedaż online
        </Link>
        <h1 className="text-xl font-semibold">
          {o.imie} {o.nazwisko}
        </h1>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${KLASA_STATUSU[w.status as StatusWniosku]}`}
        >
          {ETYKIETY_STATUSU[w.status as StatusWniosku]}
        </span>
      </div>

      {w.blad && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Błąd realizacji: {w.blad}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Ubezpieczenie</h2>
          <Pole etykieta="Numer certyfikatu" wartosc={w.numerCertyfikatu ?? "—"} />
          <Pole etykieta="Wariant" wartosc={`${w.wariantPelny?.skladka ?? "?"} zł / dziecko`} />
          <Pole
            etykieta="Suma ubezpieczenia"
            wartosc={
              w.wariantPelny ? `${w.wariantPelny.sumaUbezpieczenia.toLocaleString("de-DE")} zł` : "—"
            }
          />
          <Pole
            etykieta="Świadczenie za 1%"
            wartosc={
              w.wariantPelny
                ? `${w.wariantPelny.swiadczenieZa1Procent.toLocaleString("de-DE")} zł`
                : "—"
            }
          />
          <Pole
            etykieta="Okres ochrony"
            wartosc={`${dataPL(w.dataStartu)} – ${dataPL(w.koniecOchrony)}`}
          />
          <Pole etykieta="Kwota" wartosc={`${kwota(w.kwotaZl)} zł`} />
          <Pole etykieta="Złożony" wartosc={w.utworzono} />
          <Pole etykieta="Płatność P24" wartosc={w.p24OrderId ?? "—"} />
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Osoba opłacająca składkę</h2>
          <Pole etykieta="Imię i nazwisko" wartosc={`${o.imie} ${o.nazwisko}`} />
          <Pole etykieta="PESEL / ur." wartosc={ident(o.identyfikacja)} />
          <Pole
            etykieta="Adres"
            wartosc={`${o.ulica} ${o.nrDomu}${o.nrLokalu ? "/" + o.nrLokalu : ""}, ${o.kodPocztowy} ${o.miejscowosc}`}
          />
          <Pole etykieta="E-mail" wartosc={o.email} />
          <Pole etykieta="Telefon" wartosc={o.telefon} />
          <Pole
            etykieta="Zgody"
            wartosc={`${zgodyTak} / ${zgodyWszystkie}${w.apkZaliczona ? " · APK ✓" : ""}`}
          />
        </div>
      </div>

      <div className="rounded-lg border">
        <h2 className="border-b px-5 py-3 text-sm font-semibold">
          Ubezpieczeni ({w.ubezpieczeniPelni.length})
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lp</TableHead>
              <TableHead>Imię i nazwisko</TableHead>
              <TableHead>PESEL / data ur.</TableHead>
              <TableHead>Placówka</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {w.ubezpieczeniPelni.map((u, i) => (
              <TableRow key={i}>
                <TableCell>{i + 1}</TableCell>
                <TableCell className="font-medium">
                  {u.imie} {u.nazwisko}
                </TableCell>
                <TableCell>{ident(u.identyfikacja)}</TableCell>
                <TableCell>
                  {u.nazwaPlacowki}
                  {u.nrPlacowki && u.nrPlacowki !== "-" ? ` nr ${u.nrPlacowki}` : ""},{" "}
                  {u.miejscowoscPlacowki}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Działania</h2>
        <OnlineActions
          id={w.id}
          certyfikatDostepny={w.certyfikatDostepny}
          mozliwaPonownaRealizacja={w.status === "blad_wysylki" || w.status === "oplacony"}
        />
      </div>
    </div>
  );
}
