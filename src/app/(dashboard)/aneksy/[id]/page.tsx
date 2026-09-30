import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireBiuro } from "@/lib/auth-helpers";
import { FormularzAneksu } from "@/components/formularz-aneksu";
import { DeleteButton } from "@/components/delete-button";
import { usunAneks } from "@/lib/actions/aneksy";

export const dynamic = "force-dynamic";

const kiedy = (d: Date) =>
  d.toLocaleString("pl-PL", {
    timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

export default async function AneksPage({ params }: { params: Promise<{ id: string }> }) {
  await requireBiuro();
  const { id } = await params;
  const a = await db.aneks.findUnique({ where: { id } });
  if (!a) notFound();

  const ludzie = await db.user.findMany({
    where: { id: { in: [a.createdById, a.updatedById].filter((x): x is string => !!x) } },
    select: { id: true, name: true, email: true },
  });
  const kto = (uid: string | null) => {
    const u = ludzie.find((x) => x.id === uid);
    return u ? u.name?.trim() || u.email : "—";
  };
  // Grosze → tekst pola tak, jak wpisałoby go biuro: „65" albo „42,50".
  const skladka =
    a.skladkaGrosze % 100
      ? `${Math.floor(a.skladkaGrosze / 100)},${String(a.skladkaGrosze % 100).padStart(2, "0")}`
      : String(a.skladkaGrosze / 100);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/aneksy" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Wszystkie aneksy
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Aneks nr {a.numerAneksu} do polisy A-A {a.numerPolisy}
          </h1>
          <p className="text-sm text-muted-foreground">
            Wystawił(a): {kto(a.createdById)}, {kiedy(a.createdAt)}
            {a.updatedAt.getTime() - a.createdAt.getTime() > 1000
              ? ` · ostatnia zmiana: ${kto(a.updatedById)}, ${kiedy(a.updatedAt)}`
              : ""}
          </p>
        </div>
        <DeleteButton
          action={usunAneks.bind(null, a.id)}
          confirmText={`Usunąć aneks nr ${a.numerAneksu} do polisy A-A ${a.numerPolisy}? Tego nie da się cofnąć.`}
        />
      </div>
      <FormularzAneksu
        key={a.updatedAt.toISOString()}
        id={a.id}
        wersja={a.updatedAt.toISOString()}
        poczatkowe={{
          etykieta: a.etykieta ?? "",
          numerAneksu: a.numerAneksu,
          dataAneksu: a.dataAneksu.toISOString().slice(0, 10),
          numerPolisy: a.numerPolisy,
          nazwaSzkoly: a.nazwaSzkoly,
          rokSzkolny: a.rokSzkolny,
          liczba: String(a.liczbaUbezpieczonych),
          zwolnienia: a.liczbaZwolnionych > 0,
          zwolnieni: a.liczbaZwolnionych > 0 ? String(a.liczbaZwolnionych) : "",
          skladka,
          punkty: Array.isArray(a.dodatkowePunkty) ? a.dodatkowePunkty.map(String) : [],
        }}
      />
    </div>
  );
}
