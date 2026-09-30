import { requireBiuro } from "@/lib/auth-helpers";
import { FormularzAneksu } from "@/components/formularz-aneksu";
import { dzisISO, rokSzkolnyDla } from "@/lib/aneksy/tresc";

export const dynamic = "force-dynamic";

export default async function NowyAneksPage() {
  await requireBiuro();
  // Data liczona na serwerze w czasie polskim — przeglądarka bywa w innej strefie.
  const dzis = dzisISO();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Wystaw aneks</h1>
        <p className="text-sm text-muted-foreground">
          Aneks do polisy grupowej InterRisk. Zapisany trafia do wspólnej listy aneksów, którą
          widzi całe biuro.
        </p>
      </div>
      <FormularzAneksu
        poczatkowe={{
          etykieta: "",
          numerAneksu: "",
          dataAneksu: dzis,
          numerPolisy: "",
          nazwaSzkoly: "",
          rokSzkolny: rokSzkolnyDla(dzis),
          liczba: "",
          zwolnienia: false,
          zwolnieni: "",
          skladka: "",
          punkty: [],
        }}
      />
    </div>
  );
}
