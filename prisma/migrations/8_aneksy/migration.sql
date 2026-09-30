-- Aneksy do polis grupowych InterRisk (zakładka „Wystaw aneks").
--
-- Nowa tabela, nic istniejącego nie jest zmieniane. Numer aneksu celowo NIE
-- jest unikalny: biuro nadaje go ręcznie i część aneksów wystawia poza
-- programem, więc program powtórzenie tylko zgłasza, a nie blokuje.

-- CreateTable
CREATE TABLE "Aneks" (
    "id" TEXT NOT NULL,
    "numerAneksu" TEXT NOT NULL,
    "numerPolisy" TEXT NOT NULL,
    "dataAneksu" DATE NOT NULL,
    "nazwaSzkoly" TEXT NOT NULL,
    "etykieta" TEXT,
    "rokSzkolny" TEXT NOT NULL,
    "liczbaUbezpieczonych" INTEGER NOT NULL,
    "liczbaZwolnionych" INTEGER NOT NULL DEFAULT 0,
    "skladkaGrosze" INTEGER NOT NULL,
    "dodatkowePunkty" JSONB NOT NULL DEFAULT '[]',
    "schoolId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aneks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Aneks_numerPolisy_idx" ON "Aneks"("numerPolisy");

-- CreateIndex
CREATE INDEX "Aneks_createdAt_idx" ON "Aneks"("createdAt");

-- AddForeignKey
ALTER TABLE "Aneks" ADD CONSTRAINT "Aneks_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

