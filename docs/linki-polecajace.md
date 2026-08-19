# Linki polecające agentów

Każdy agent ma kod. Kod robi link. Link decyduje, czy sprzedaż online jest
komuś przypisana:

```
https://ochronazklasa.pl/kup-ubezpieczenie?a=KNOWAK
```

Kto wejdzie na stronę bez linku — z wyszukiwarki, z reklamy, z wizytówki —
kupuje **bez rekomendacji**, i taka sprzedaż nie jest przypisana do nikogo.
To jest domyślne zachowanie i jest zamierzone: przypisywanie takiej sprzedaży
komukolwiek byłoby wymyślaniem zasługi, której nie było.

## Droga kodu przez trzy usługi

| Gdzie | Co robi | Plik |
| --- | --- | --- |
| ochronazklasa.pl (SPA) | zdejmuje `?a=` z adresu przy starcie, zapamiętuje na 30 dni, dokleja do wniosku | `src/lib/polecenie.ts` |
| ozk-api | normalizuje i zapisuje w kolumnie `wnioski.kod_agenta` | `src/polecenia.ts`, `src/db.ts` |
| panel | dopasowuje kod do agenta przy wyświetlaniu | `src/lib/agents/{kod,atrybucja}.ts` |

**Wniosek trzyma KOD, nie identyfikator agenta.** Baza sprzedaży to osobna
usługa (SQLite w ozk-api) i nie zna tabeli agentów. Nazwisko dokłada panel przy
wyświetlaniu — dzięki temu zmiana nazwiska agenta nie przepisuje historii
sprzedaży, a awaria panelu nie zatrzymuje sklepu.

## Zasady, których nie wolno złamać

1. **Kod nigdy nie blokuje zakupu.** Kod nierozpoznany, z literówką albo ze
   śmieciem z adresu po prostu znika i wniosek idzie dalej jako nieprzypisany.
   Gdyby zły kod potrafił odrzucić wniosek, jedna literówka w linku wyłączałaby
   sprzedaż całej grupie agenta.
2. **Ta sama reguła normalizacji w trzech miejscach.** Wielkie litery, bez
   ogonków, tylko `A-Z 0-9 -`, 2–16 znaków. Rozjazd między przeglądarką a API
   znaczyłby, że kod wysłany z formularza nie zgadza się z zapisanym w bazie.
   Rozjazd nie jest cichy: kod, którego panel nie rozpozna, wyświetla się jako
   „(nieznany)” i widać go w tabeli.
3. **Ostatnie kliknięcie wygrywa.** Kto przyszedł najpierw z linku jednego
   agenta, a potem z linku drugiego, liczy się do drugiego.
4. **Zmiana kodu nie odpina wcześniejszej sprzedaży.** Stary kod ląduje w
   `Agent.codeHistory` i nadal liczy się do tego agenta. Filtry i liczniki
   działają na wszystkich jego kodach naraz.

## Obsługa

- Nowy agent dostaje kod automatycznie (z nazwiska: „Kamila Nowak” → `KNOWAK`).
  Można go nadpisać w formularzu.
- Agenci sprzed tej zmiany: `npm run agenci:kody` (podgląd) i
  `npm run agenci:kody -- --zapisz`.
- Link do skopiowania: profil agenta albo kolumna „Link polecający” na liście.
- Sprzedaż wg agentów: pulpit i `/online` (filtr „Agent”).
