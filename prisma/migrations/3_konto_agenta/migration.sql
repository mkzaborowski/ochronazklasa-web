-- Konto w panelu wskazuje na kartę agenta.
--
-- Rola AGENT sama w sobie nie mówi, CZYJE dane pokazać: portal agenta wyświetla
-- szkoły, polisy i sprzedaż online konkretnej karty, a te wiszą na Agent.id.
-- Bez tej kolumny każdy zalogowany agent widziałby albo wszystko, albo nic.
--
-- Kolumna jest opcjonalna, bo administrator karty agenta nie ma i mieć nie musi.
-- Unikalna, bo dwa konta wskazujące tę samą kartę znaczyłyby, że nie wiadomo,
-- kto naprawdę zalogował się jako ten agent.
ALTER TABLE "User" ADD COLUMN "agentId" TEXT;

CREATE UNIQUE INDEX "User_agentId_key" ON "User"("agentId");

-- SET NULL, a nie CASCADE: usunięcie karty agenta nie może skasować konta
-- razem z historią logowań i audytem. Konto zostaje, po prostu bez karty.
ALTER TABLE "User" ADD CONSTRAINT "User_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
