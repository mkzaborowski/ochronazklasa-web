-- Powiadomienie mailem o sprzedaży z własnego kodu opiekuna.
--
-- Domyślnie WŁĄCZONE: agent, który nie wie, że ktoś kupił z jego polecenia,
-- nie zadzwoni do tego klienta i nie dopilnuje szkoły. Wyłączyć może sam,
-- ze swojego portalu.
ALTER TABLE "Agent" ADD COLUMN "powiadomieniaEmail" BOOLEAN NOT NULL DEFAULT true;

-- Ślad wysyłki. Usługa pocztowa ma własny klucz idempotencji, ale opieranie się
-- wyłącznie na nim znaczyłoby, że o powtórce dowiadujemy się dopiero od agenta,
-- który dostał dwa takie same maile. Tu widać wprost, co i kiedy poszło.
CREATE TABLE "PowiadomienieSprzedazy" (
  "id"        TEXT NOT NULL,
  "wniosekId" TEXT NOT NULL,
  "agentId"   TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "wyslano"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PowiadomienieSprzedazy_pkey" PRIMARY KEY ("id")
);

-- Jeden wniosek = jedno powiadomienie, niezależnie od tego, ile razy zadanie
-- się uruchomi i czy poprzednie przebiegło do końca.
CREATE UNIQUE INDEX "PowiadomienieSprzedazy_wniosekId_key" ON "PowiadomienieSprzedazy"("wniosekId");
CREATE INDEX "PowiadomienieSprzedazy_agentId_idx" ON "PowiadomienieSprzedazy"("agentId");

ALTER TABLE "PowiadomienieSprzedazy" ADD CONSTRAINT "PowiadomienieSprzedazy_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
