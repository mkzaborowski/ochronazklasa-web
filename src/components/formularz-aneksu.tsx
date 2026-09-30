"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowDown, ArrowUp, Check, Download, FileSearch, Loader2, Plus, Save, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDebounce } from "@/hooks/use-debounce";
import {
  zapiszAneks,
  znajdzPoliseDoAneksu,
  type FormularzAneksu,
  type WynikSzukaniaPolisy,
} from "@/lib/actions/aneksy";
import {
  dataPL,
  doZaplatyGrosze,
  formatujKwote,
  liniaLiczbyUbezpieczonych,
  MAKS_PUNKTOW,
  normalizujNumerPolisy,
  parsujKwote,
  rokSzkolnyDla,
} from "@/lib/aneksy/tresc";
import { nazwaPlikuAneksu } from "@/lib/interrisk/nazwa-pliku";

/** Stan pól tak, jak je widać — liczby jako tekst, bo pole może być chwilowo puste. */
export type PolaAneksu = {
  etykieta: string;
  numerAneksu: string;
  dataAneksu: string;
  numerPolisy: string;
  nazwaSzkoly: string;
  rokSzkolny: string;
  liczba: string;
  zwolnienia: boolean;
  zwolnieni: string;
  skladka: string;
  punkty: string[];
};

const poleTekstu =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const liczbaCalkowita = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN);

export function FormularzAneksu({
  poczatkowe,
  id,
  wersja: wersjaPoczatkowa,
}: {
  poczatkowe: PolaAneksu;
  /** przy edycji zapisanego aneksu */
  id?: string;
  wersja?: string;
}) {
  const router = useRouter();
  const [pola, setPola] = useState<PolaAneksu>(poczatkowe);
  const [wersja, setWersja] = useState(wersjaPoczatkowa);
  const [zapisuje, startZapisu] = useTransition();
  const [bledy, setBledy] = useState<string[]>([]);
  const [duplikat, setDuplikat] = useState<WynikSzukaniaPolisy["aneksy"][number] | null>(null);
  const [konflikt, setKonflikt] = useState<{ kto: string | null; kiedy: string } | null>(null);
  const [zmienione, setZmienione] = useState(false);

  // Nazwę i skrót z polisy wpisujemy tylko wtedy, gdy biuro ich samo nie
  // ruszało — ręcznej poprawki nie nadpisuje wynik wyszukiwania.
  const [recznaNazwa, setRecznaNazwa] = useState(!!id);
  const [recznaEtykieta, setRecznaEtykieta] = useState(!!id);
  // Rok szkolny idzie za datą, dopóki ktoś go nie zmieni ręcznie.
  const [recznyRok, setRecznyRok] = useState(!!id);

  const ustaw = <K extends keyof PolaAneksu>(k: K, v: PolaAneksu[K]) => {
    setPola((p) => ({ ...p, [k]: v }));
    setZmienione(true);
  };

  // Ostrzeżenie przed zamknięciem karty z niezapisanym aneksem.
  useEffect(() => {
    if (!zmienione) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [zmienione]);

  // --- wyszukiwanie polisy po numerze ---
  const numer = normalizujNumerPolisy(pola.numerPolisy);
  const numerOdczekany = useDebounce(numer, 350);
  // Trzymamy tylko GOTOWY wynik i numer, którego dotyczy. „Szukam…" wynika
  // z tego, że wynik jest dla innego numeru niż wpisany — bez osobnego stanu.
  const [szukanie, setSzukanie] = useState<{ numer: string; wynik: WynikSzukaniaPolisy } | null>(null);

  useEffect(() => {
    if (numerOdczekany.length < 6) return;
    let aktualne = true;
    znajdzPoliseDoAneksu(numerOdczekany)
      .then((wynik) => {
        if (!aktualne) return;
        setSzukanie({ numer: numerOdczekany, wynik });
        if (wynik.polisa) {
          const polisa = wynik.polisa;
          setPola((p) => ({
            ...p,
            nazwaSzkoly: recznaNazwa ? p.nazwaSzkoly : polisa.nazwa,
            etykieta: recznaEtykieta ? p.etykieta : (polisa.etykieta ?? ""),
          }));
        }
      })
      // Błąd sieci nie może zostawić „Szukam…" na zawsze — traktujemy jak
      // „nie ma w programie", nazwę da się wpisać ręcznie.
      .catch(() => aktualne && setSzukanie({ numer: numerOdczekany, wynik: { polisa: null, aneksy: [] } }));
    return () => {
      aktualne = false;
    };
    // Celowo tylko numer: flagi „ręcznie” czytamy w chwili przyjścia wyniku.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numerOdczekany]);

  // --- wyliczenia na żywo ---
  const liczba = liczbaCalkowita(pola.liczba);
  const zwolnieni = pola.zwolnienia ? liczbaCalkowita(pola.zwolnieni) : 0;
  const skladkaGrosze = parsujKwote(pola.skladka);
  const wyliczenie = useMemo(() => {
    if (!Number.isInteger(liczba) || liczba < 1) return null;
    if (!Number.isInteger(zwolnieni) || zwolnieni < 0 || zwolnieni > liczba) return null;
    if (!skladkaGrosze) return null;
    const d = {
      numerAneksu: "", numerPolisy: "", dataAneksu: pola.dataAneksu, nazwaSzkoly: "",
      rokSzkolny: pola.rokSzkolny, liczbaUbezpieczonych: liczba, liczbaZwolnionych: zwolnieni,
      skladkaGrosze, dodatkowePunkty: [],
    };
    return { linia: liniaLiczbyUbezpieczonych(d), kwota: formatujKwote(doZaplatyGrosze(d)) };
  }, [liczba, zwolnieni, skladkaGrosze, pola.dataAneksu, pola.rokSzkolny]);

  const nazwaPliku = nazwaPlikuAneksu({
    numerPolisy: numer || "______",
    etykieta: pola.etykieta,
    szkola: pola.nazwaSzkoly,
  });

  const wynikSzukania = szukanie?.numer === numer ? szukanie.wynik : undefined;
  const inneAneksy = (wynikSzukania?.aneksy ?? []).filter((a) => a.id !== id);

  // --- punkty dopisane ---
  const ustawPunkt = (i: number, tekst: string) =>
    ustaw("punkty", pola.punkty.map((p, j) => (j === i ? tekst : p)));
  const przesunPunkt = (i: number, o: -1 | 1) => {
    const nowe = [...pola.punkty];
    [nowe[i], nowe[i + o]] = [nowe[i + o], nowe[i]];
    ustaw("punkty", nowe);
  };

  // --- zapis ---
  function zapisz({ pobierz, mimoDuplikatu = false }: { pobierz: boolean; mimoDuplikatu?: boolean }) {
    setBledy([]);
    setKonflikt(null);
    if (!mimoDuplikatu) setDuplikat(null);

    const formularz: FormularzAneksu = {
      etykieta: pola.etykieta,
      numerAneksu: pola.numerAneksu,
      numerPolisy: pola.numerPolisy,
      dataAneksu: pola.dataAneksu,
      nazwaSzkoly: pola.nazwaSzkoly,
      rokSzkolny: pola.rokSzkolny,
      liczbaUbezpieczonych: liczba,
      liczbaZwolnionych: pola.zwolnienia ? zwolnieni : 0,
      skladkaGrosze: skladkaGrosze ?? NaN,
      dodatkowePunkty: pola.punkty,
    };

    startZapisu(async () => {
      const w = await zapiszAneks(formularz, { id, wersja, mimoDuplikatu });
      if (w.ok) {
        setDuplikat(null);
        setZmienione(false);
        setWersja(w.wersja);
        toast.success(id ? "Zmiany w aneksie zapisane" : "Aneks zapisany");
        if (pobierz) window.location.assign(`/api/aneksy/${w.id}/pobierz`);
        if (!id) router.replace(`/aneksy/${w.id}`);
        else router.refresh();
        return;
      }
      if ("bledy" in w) setBledy(w.bledy);
      else if ("duplikat" in w) setDuplikat(w.duplikat);
      else if ("konflikt" in w) setKonflikt(w.konflikt);
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Aneks</CardTitle>
          <CardDescription>
            Numer polisy wystarczy wpisać — jeśli polisa była wystawiona w programie, nazwa szkoły
            i skrót uzupełnią się same. Wszystko można poprawić.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="etykieta">Ubezpieczenie dla (skrót do nazwy pliku)</Label>
            <Input
              id="etykieta"
              value={pola.etykieta}
              maxLength={70}
              placeholder="np. SP 5 Słupsk"
              onChange={(e) => {
                setRecznaEtykieta(true);
                ustaw("etykieta", e.target.value);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Plik pobierze się jako <span className="font-mono text-foreground">{nazwaPliku}</span>
              {pola.etykieta.trim() ? "" : " — puste pole = pełna nazwa szkoły"}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="numerAneksu">Numer aneksu</Label>
              <Input
                id="numerAneksu"
                value={pola.numerAneksu}
                placeholder="np. 1/2026"
                onChange={(e) => ustaw("numerAneksu", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dataAneksu">Data aneksu</Label>
              <Input
                id="dataAneksu"
                type="date"
                value={pola.dataAneksu}
                onChange={(e) => {
                  const data = e.target.value;
                  setPola((p) => ({
                    ...p,
                    dataAneksu: data,
                    rokSzkolny: recznyRok || !data ? p.rokSzkolny : rokSzkolnyDla(data),
                  }));
                  setZmienione(true);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Ta sama data trafia na dół aneksu: „Olsztyn, dnia{" "}
                {pola.dataAneksu ? dataPL(pola.dataAneksu) : "…"}”.
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="numerPolisy">Numer polisy</Label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 whitespace-nowrap rounded-lg border bg-muted px-2.5 py-1 font-mono text-sm text-muted-foreground">
                A-A
              </span>
              <Input
                id="numerPolisy"
                inputMode="numeric"
                className="font-mono"
                value={pola.numerPolisy}
                placeholder="679857"
                onChange={(e) => ustaw("numerPolisy", e.target.value)}
              />
            </div>
            <StanSzukania numer={numer} wynik={wynikSzukania} />
            {inneAneksy.length ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                Do tej polisy są już aneksy:{" "}
                {inneAneksy.map((a, i) => (
                  <span key={a.id}>
                    {i ? ", " : ""}
                    <a className="font-medium underline" href={`/aneksy/${a.id}`} target="_blank" rel="noreferrer">
                      nr {a.numerAneksu}
                    </a>{" "}
                    z {dataPL(a.dataAneksu)}
                    {a.wystawil ? ` (${a.wystawil})` : ""}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Ten sam numer trafia też do § 2 („integralną całość z polisą A-A {numer || "…"}”).
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="nazwaSzkoly">Nazwa szkoły</Label>
            <Input
              id="nazwaSzkoly"
              value={pola.nazwaSzkoly}
              placeholder="np. Szkoła Podstawowa nr 5 w Słupsku"
              onChange={(e) => {
                setRecznaNazwa(true);
                ustaw("nazwaSzkoly", e.target.value);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>§ 1 — zmiany do polisy</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <section className="grid gap-3">
            <h3 className="text-sm font-semibold">1. Liczba osób ubezpieczonych</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="rokSzkolny">W roku</Label>
                <Input
                  id="rokSzkolny"
                  value={pola.rokSzkolny}
                  placeholder="2026-2027"
                  onChange={(e) => {
                    setRecznyRok(true);
                    ustaw("rokSzkolny", e.target.value);
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="liczba">Liczba ubezpieczonych</Label>
                <Input
                  id="liczba"
                  inputMode="numeric"
                  value={pola.liczba}
                  placeholder="np. 120"
                  onChange={(e) => ustaw("liczba", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="skladka">Składka za osobę (zł)</Label>
                <Input
                  id="skladka"
                  inputMode="decimal"
                  value={pola.skladka}
                  placeholder="np. 65 albo 42,50"
                  onChange={(e) => ustaw("skladka", e.target.value)}
                />
              </div>
            </div>

            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={pola.zwolnienia}
                onChange={(e) => ustaw("zwolnienia", e.target.checked)}
              />
              Część uczniów jest zwolniona z opłaty składki
            </label>
            {pola.zwolnienia ? (
              <div className="grid gap-2 sm:w-1/3">
                <Label htmlFor="zwolnieni">Liczba zwolnionych</Label>
                <Input
                  id="zwolnieni"
                  inputMode="numeric"
                  value={pola.zwolnieni}
                  placeholder="np. 5"
                  onChange={(e) => ustaw("zwolnieni", e.target.value)}
                />
              </div>
            ) : null}

            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              {wyliczenie ? (
                <>
                  <div className="font-medium">{wyliczenie.linia}</div>
                  <div className="mt-1 text-muted-foreground">
                    Do zapłaty przez szkołę:{" "}
                    <span className="font-semibold text-foreground">{wyliczenie.kwota}</span>
                  </div>
                </>
              ) : (
                <span className="text-muted-foreground">
                  Wpisz liczbę ubezpieczonych i składkę — program sam policzy kwotę.
                </span>
              )}
            </div>
          </section>

          <section className="grid gap-1 border-t pt-4">
            <h3 className="text-sm font-semibold">2. Korekta pkt 1 Oświadczenia</h3>
            <p className="text-sm text-muted-foreground">
              Dodawana do każdego aneksu, zawsze w tym samym brzmieniu.
            </p>
          </section>

          <section className="grid gap-3 border-t pt-4">
            {pola.punkty.map((punkt, i) => (
              <div key={i} className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`punkt-${i}`} className="font-semibold">
                    {i + 3}. Punkt dopisany
                  </Label>
                  <div className="flex gap-1">
                    <Button
                      type="button" size="icon-sm" variant="ghost" aria-label="Przesuń wyżej"
                      disabled={i === 0} onClick={() => przesunPunkt(i, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button" size="icon-sm" variant="ghost" aria-label="Przesuń niżej"
                      disabled={i === pola.punkty.length - 1} onClick={() => przesunPunkt(i, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      type="button" size="icon-sm" variant="ghost" aria-label="Usuń punkt"
                      onClick={() => ustaw("punkty", pola.punkty.filter((_, j) => j !== i))}
                    >
                      <X />
                    </Button>
                  </div>
                </div>
                <textarea
                  id={`punkt-${i}`}
                  rows={3}
                  className={poleTekstu}
                  value={punkt}
                  placeholder="np. Zmiana adresu e-mail szkoły — było: …, powinno być: …"
                  onChange={(e) => ustawPunkt(i, e.target.value)}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={pola.punkty.length >= MAKS_PUNKTOW}
              onClick={() => ustaw("punkty", [...pola.punkty, ""])}
            >
              <Plus /> Dodaj punkt
            </Button>
            <p className="text-xs text-muted-foreground">
              Na końcu § 1 zawsze stoi: „Pozostałe warunki ubezpieczenia nie ulegają zmianie.”
              § 2, § 3, miejscowość (Olsztyn), data i podpis uzupełniają się same.
            </p>
          </section>
        </CardContent>
      </Card>

      {bledy.length ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          <ul className="list-inside list-disc space-y-0.5">
            {bledy.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {duplikat ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">
            Aneks nr {duplikat.numerAneksu} do polisy A-A {numer} już jest — z {dataPL(duplikat.dataAneksu)}
            {duplikat.wystawil ? `, wystawił(a) ${duplikat.wystawil}` : ""}.{" "}
            <a className="font-medium underline" href={`/aneksy/${duplikat.id}`} target="_blank" rel="noreferrer">
              Otwórz
            </a>
          </span>
          <Button
            type="button" variant="outline" size="sm" disabled={zapisuje}
            onClick={() => zapisz({ pobierz: false, mimoDuplikatu: true })}
          >
            Zapisz mimo to
          </Button>
        </div>
      ) : null}

      {konflikt ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">
            Ten aneks został w międzyczasie zmieniony
            {konflikt.kto ? ` przez: ${konflikt.kto}` : ""} (
            {new Date(konflikt.kiedy).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}).
            Twoje zmiany nie zostały zapisane, żeby nie nadpisać cudzych. Odśwież stronę, żeby
            zobaczyć aktualną wersję.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
            Odśwież
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="lg" disabled={zapisuje} onClick={() => zapisz({ pobierz: true })}>
          {zapisuje ? <Loader2 className="animate-spin" /> : <Download />}
          Zapisz i pobierz Word
        </Button>
        <Button type="button" size="lg" variant="outline" disabled={zapisuje} onClick={() => zapisz({ pobierz: false })}>
          <Save /> Zapisz
        </Button>
        {id && !zmienione ? (
          <Button
            size="lg" variant="ghost" nativeButton={false} render={<a href={`/api/aneksy/${id}/pobierz`} />}
          >
            <Download /> Pobierz zapisany
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function StanSzukania({ numer, wynik }: { numer: string; wynik?: WynikSzukaniaPolisy }) {
  if (numer.length < 6) return null;
  if (!wynik) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Szukam polisy w programie…
      </p>
    );
  }
  if (wynik?.polisa) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <Check className="size-3" />
        Polisa z programu: {wynik.polisa.nazwa} · wariant {wynik.polisa.wariant} · {wynik.polisa.okres}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <FileSearch className="size-3" />
      Nie ma tej polisy w programie (np. wystawiona ręcznie) — wpisz nazwę szkoły poniżej.
    </p>
  );
}
