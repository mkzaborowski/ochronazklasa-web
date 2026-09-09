"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Pencil, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { correctApplicationAction, reissueCertificateAction } from "@/lib/actions/online";

/**
 * Poprawka danych na wystawionym wniosku.
 *
 * PO CO. Rodzic wypełnia formularz sam i się myli: wpisuje swoje dane w rubryce
 * ubezpieczonego zamiast danych dziecka albo przekręca nazwisko syna. Do tej
 * pory jedynym wyjściem było wystawienie wszystkiego od nowa — nowy numer
 * certyfikatu i nowa płatność za to samo.
 *
 * DWA KROKI, NIE JEDEN. Najpierw zapisujemy poprawkę i widać, co się zapisało;
 * dopiero potem osobne kliknięcie wystawia poprawiony certyfikat i wysyła go
 * klientowi. Gdyby to był jeden przycisk, literówka w poprawce wychodziłaby
 * z domu, zanim ktokolwiek zdążyłby ją zauważyć.
 *
 * OBA KROKI PYTAJĄ O HASŁO. Nie dlatego, że nie wiadomo, kto jest zalogowany —
 * tylko dlatego, że to zmiana na dokumencie ubezpieczeniowym, a przeglądarki
 * zostawia się otwarte.
 */

export interface OsobaDoKorekty {
  imie: string;
  nazwisko: string;
  identyfikacja: { typ: string; pesel: string; dataUrodzenia: string };
}

interface Props {
  id: string;
  oplacajacy: OsobaDoKorekty & {
    miejscowosc: string;
    kodPocztowy: string;
    ulica: string;
    nrDomu: string;
    nrLokalu: string;
    email: string;
    telefon: string;
  };
  ubezpieczeni: OsobaDoKorekty[];
  /** wniosek ma już wystawiony certyfikat — jest co poprawiać w dokumencie */
  maCertyfikat: boolean;
}

type Ident = { typ: string; pesel: string; dataUrodzenia: string };

export function KorektaWniosku({ id, oplacajacy, ubezpieczeni, maCertyfikat }: Props) {
  const router = useRouter();
  const [otwarte, setOtwarte] = useState(false);
  const [pending, startTransition] = useTransition();

  const [o, setO] = useState({ ...oplacajacy });
  const [u, setU] = useState<OsobaDoKorekty[]>(ubezpieczeni.map((x) => ({ ...x })));
  const [powod, setPowod] = useState("");
  const [haslo, setHaslo] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [zapisane, setZapisane] = useState(false);

  const [hasloWystawienia, setHasloWystawienia] = useState("");

  const zmienUbezpieczonego = (i: number, zmiana: Partial<OsobaDoKorekty>) =>
    setU((lista) => lista.map((x, j) => (j === i ? { ...x, ...zmiana } : x)));

  const zmienIdent = (i: number, zmiana: Partial<Ident>) =>
    setU((lista) =>
      lista.map((x, j) => (j === i ? { ...x, identyfikacja: { ...x.identyfikacja, ...zmiana } } : x)),
    );

  const zapisz = () => {
    setBlad(null);
    startTransition(async () => {
      const res = await correctApplicationAction(id, {
        powod,
        haslo,
        oplacajacy: {
          imie: o.imie,
          nazwisko: o.nazwisko,
          miejscowosc: o.miejscowosc,
          kodPocztowy: o.kodPocztowy,
          ulica: o.ulica,
          nrDomu: o.nrDomu,
          nrLokalu: o.nrLokalu,
          email: o.email,
          telefon: o.telefon,
          identyfikacja: o.identyfikacja,
        },
        ubezpieczeni: u.map((x) => ({
          imie: x.imie,
          nazwisko: x.nazwisko,
          identyfikacja: x.identyfikacja,
        })),
      });
      if (res.ok) {
        toast.success(res.message);
        setZapisane(true);
        setHaslo("");
        setPowod("");
        router.refresh();
      } else {
        setBlad(res.message);
        toast.error(res.message);
      }
    });
  };

  const wystaw = () => {
    setBlad(null);
    startTransition(async () => {
      const res = await reissueCertificateAction(id, hasloWystawienia);
      if (res.ok) {
        toast.success(res.message);
        setHasloWystawienia("");
        setZapisane(false);
        router.refresh();
      } else {
        setBlad(res.message);
        toast.error(res.message);
      }
    });
  };

  if (!otwarte) {
    return (
      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Poprawka danych</h2>
            <p className="text-sm text-muted-foreground">
              Imię, nazwisko, PESEL i dane kontaktowe. Wariantu, składki ani liczby
              ubezpieczonych poprawić się tędy nie da — to jest treść zawartej umowy.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOtwarte(true)}>
            <Pencil className="size-4" /> Popraw dane
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Poprawka danych</h2>
        <Button variant="ghost" size="sm" onClick={() => setOtwarte(false)} disabled={pending}>
          <X className="size-4" /> Zamknij
        </Button>
      </div>

      <section className="mb-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ubezpieczeni
        </h3>
        <div className="grid gap-4">
          {u.map((x, i) => (
            <div key={i} className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
              <Pole label="Imię">
                <Input
                  value={x.imie}
                  onChange={(e) => zmienUbezpieczonego(i, { imie: e.target.value })}
                />
              </Pole>
              <Pole label="Nazwisko">
                <Input
                  value={x.nazwisko}
                  onChange={(e) => zmienUbezpieczonego(i, { nazwisko: e.target.value })}
                />
              </Pole>
              {/* Typ identyfikacji jest wyborem rodzica przy zakupie, ale przy
                  poprawce bywa właśnie tym, co trzeba zmienić: mama wpisała swój
                  PESEL, a dziecko ma tylko datę urodzenia. */}
              <Pole label="Identyfikacja">
                <select
                  value={x.identyfikacja.typ}
                  onChange={(e) => zmienIdent(i, { typ: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="pesel">PESEL</option>
                  <option value="dataUrodzenia">Data urodzenia</option>
                </select>
              </Pole>
              {x.identyfikacja.typ === "pesel" ? (
                <Pole label="PESEL">
                  <Input
                    value={x.identyfikacja.pesel}
                    inputMode="numeric"
                    maxLength={11}
                    onChange={(e) => zmienIdent(i, { pesel: e.target.value })}
                  />
                </Pole>
              ) : (
                <Pole label="Data urodzenia">
                  <Input
                    type="date"
                    value={x.identyfikacja.dataUrodzenia}
                    onChange={(e) => zmienIdent(i, { dataUrodzenia: e.target.value })}
                  />
                </Pole>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Opłacający
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Pole label="Imię">
            <Input value={o.imie} onChange={(e) => setO({ ...o, imie: e.target.value })} />
          </Pole>
          <Pole label="Nazwisko">
            <Input value={o.nazwisko} onChange={(e) => setO({ ...o, nazwisko: e.target.value })} />
          </Pole>
          <Pole label="Ulica">
            <Input value={o.ulica} onChange={(e) => setO({ ...o, ulica: e.target.value })} />
          </Pole>
          <div className="grid grid-cols-2 gap-3">
            <Pole label="Nr domu">
              <Input value={o.nrDomu} onChange={(e) => setO({ ...o, nrDomu: e.target.value })} />
            </Pole>
            <Pole label="Nr lokalu">
              <Input value={o.nrLokalu} onChange={(e) => setO({ ...o, nrLokalu: e.target.value })} />
            </Pole>
          </div>
          <Pole label="Kod pocztowy">
            <Input
              value={o.kodPocztowy}
              onChange={(e) => setO({ ...o, kodPocztowy: e.target.value })}
            />
          </Pole>
          <Pole label="Miejscowość">
            <Input
              value={o.miejscowosc}
              onChange={(e) => setO({ ...o, miejscowosc: e.target.value })}
            />
          </Pole>
          {/* Na ten adres pójdzie poprawiony certyfikat — dlatego stoi tu,
              a nie tylko w podglądzie danych wyżej. */}
          <Pole label="E-mail (tu pójdzie certyfikat)">
            <Input
              type="email"
              value={o.email}
              onChange={(e) => setO({ ...o, email: e.target.value })}
            />
          </Pole>
          <Pole label="Telefon">
            <Input value={o.telefon} onChange={(e) => setO({ ...o, telefon: e.target.value })} />
          </Pole>
        </div>
      </section>

      <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
        <Pole label="Co poprawiasz i dlaczego">
          <Input
            value={powod}
            placeholder="np. mama wpisała swoje dane zamiast dziecka"
            onChange={(e) => setPowod(e.target.value)}
          />
        </Pole>
        <Pole label="Potwierdź swoim hasłem">
          <Input
            type="password"
            value={haslo}
            autoComplete="current-password"
            onChange={(e) => setHaslo(e.target.value)}
          />
        </Pole>
      </div>

      {blad ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{blad}</span>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={zapisz} disabled={pending || !powod.trim() || !haslo}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Zapisz poprawkę
        </Button>
        <span className="text-xs text-muted-foreground">
          Zapis nie wysyła nic do klienta — certyfikat wystawisz osobno, niżej.
        </span>
      </div>

      {maCertyfikat ? (
        <div
          className={`mt-5 rounded-md border p-4 ${
            zapisane
              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
              : "bg-muted/40"
          }`}
        >
          <h3 className="text-sm font-semibold">Wystaw poprawiony certyfikat</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Certyfikat powstaje na nowo z poprawionych danych i idzie mailem do klienta.{" "}
            <strong className="font-medium text-foreground">Numer zostaje ten sam</strong> — to ten
            sam dokument bez błędu, a nie drugi obok pierwszego.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Pole label="Potwierdź hasłem">
              <Input
                type="password"
                value={hasloWystawienia}
                autoComplete="current-password"
                className="w-56"
                onChange={(e) => setHasloWystawienia(e.target.value)}
              />
            </Pole>
            <Button variant="secondary" onClick={wystaw} disabled={pending || !hasloWystawienia}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Wystaw i wyślij
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Pole({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
