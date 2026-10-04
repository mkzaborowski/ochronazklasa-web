-- Ustawienia automatycznej wysyłki paczki rozliczeniowej do InterRisk.
--
-- IF NOT EXISTS, bo ta sama migracja ma przejść i na produkcji, i na bazie
-- postawionej od zera - tak samo jak migracja 6.
CREATE TABLE IF NOT EXISTS "WysylkaRozliczenia" (
    "id" TEXT NOT NULL DEFAULT 'domyslne',
    "wlaczona" BOOLEAN NOT NULL DEFAULT false,
    "odbiorcy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dzienWysylki" INTEGER NOT NULL DEFAULT 5,
    "miesiecyWstecz" INTEGER NOT NULL DEFAULT 1,
    "dniDoPlatnosci" INTEGER NOT NULL DEFAULT 14,
    "ostatniOkres" TEXT,
    "ostatniBlad" TEXT,
    "ostatniaProba" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WysylkaRozliczenia_pkey" PRIMARY KEY ("id")
);
