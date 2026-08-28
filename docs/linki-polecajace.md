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
| ochronazklasa.pl (SPA) | nieobowiązkowe pole „Kod opiekuna polisy" w kroku z danymi — dla rodziców, którzy przyszli z ulotki, a nie z linku | `src/components/PurchasePage/PoleOpiekuna.tsx` |
| ozk-api | normalizuje i zapisuje w kolumnie `wnioski.kod_agenta` | `src/polecenia.ts`, `src/db.ts` |
| panel | dopasowuje kod do agenta przy wyświetlaniu | `src/lib/agents/{kod,atrybucja}.ts` |

**Wniosek trzyma KOD, nie identyfikator agenta.** Baza sprzedaży to osobna
usługa (SQLite w ozk-api) i nie zna tabeli agentów. Nazwisko dokłada panel przy
wyświetlaniu — dzięki temu zmiana nazwiska agenta nie przepisuje historii
sprzedaży, a awaria panelu nie zatrzymuje sklepu.

## Dwie drogi kodu, jedno miejsce zapisu

Kod trafia do wniosku albo z linku (`?a=KOD`), albo z ręki — z pola w kroku
z danymi. Obie drogi zapisują się w tym samym miejscu i po tych samych
zasadach, więc **wygrywa ostatnie wskazanie**: rodzic, który wszedł z linku
jednego agenta, a wpisał kod drugiego, kupuje u drugiego. Pole jest wypełnione
kodem z linku, żeby było widać, co pójdzie na wniosek.

Ręczne wpisanie powstało z prostego powodu: nie każdy rodzic wchodzi z linku.
Dostaje ulotkę w szkole, słyszy kod przez telefon, pyta znajomych, kto prowadzi
ich placówkę. Bez tego pola takie zakupy zostawały nieprzypisane, choć agent
faktycznie za nimi stał.

## Kod QR

Każdy agent ma kod QR swojego linku — na karcie agenta w panelu, z pobieraniem
w dwóch formatach: **PNG** na ekran i do wiadomości, **SVG** do druku. Na ulotce
rastrowy kod w powiększeniu rozłazi się na piksele i skaner przestaje go czytać.

Trasa: `GET /api/agenci/<KOD>/qr` (dodaj `?format=svg`). Wymaga zalogowania
i sprawdza, czy agent o tym kodzie istnieje — kod QR prowadzący do sprzedaży,
która nie przypisze się do nikogo, lepiej żeby nie trafił na wydruk.

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

## Portal agenta

Agent loguje się do tego samego panelu co biuro (`/login`) i trafia na `/moje` —
własną kartę bez edycji: przypisane szkoły, polisy tych szkół, sprzedaż online
ze swoich kodów, link polecający z kodem QR i proste liczniki.

Konto zakłada biuro:

```
npm run konto-agenta -- <email-logowania> <hasło> <KOD-AGENTA>
```

Kod agenta jest obowiązkowy, bo to on wiąże konto z kartą (`User.agentId`).
Rola sama w sobie nie mówi, CZYJE dane pokazać.

### Gdzie stoi blokada

Nie w menu i nie w middleware, tylko po stronie serwera, w trzech miejscach:

| Co | Gdzie | Zasada |
| --- | --- | --- |
| Strony panelu biura | `src/app/(dashboard)/layout.tsx` | rola AGENT → przekierowanie na `/moje` |
| Akcje serwerowe | `requireBiuro()` w `src/lib/auth-helpers.ts` | zakładanie klientów, generowanie polis i ulotek, kasowanie — tylko ADMIN/VIEWER |
| Trasy API | `src/app/api/**` | pobieranie dokumentów biura zabronione dla AGENT; kod QR wyłącznie własny |

Ukrycie linków chowa drogę, ale nie zamyka drzwi — adres da się wpisać z ręki,
a akcję serwerową wywołać z pominięciem strony.

**Puste zawężenie nie znaczy „bez filtru".** Agent bez nadanego kodu nie ma
żadnej sprzedaży online. Gdyby brak kodów potraktować jak brak filtru,
zobaczyłby sprzedaż wszystkich — patrz `tylkoAgenta` w `src/lib/polisy/wszystkie.ts`.

`/moje` NIGDY nie odsyła do panelu biura. Konto bez podpiętej karty dostaje tam
komunikat, a nie kolejne przekierowanie — inaczej powstałaby pętla bez jednego
zdania wyjaśnienia.

## Powiadomienia o sprzedaży

Agent dostaje maila, gdy ktoś kupi ubezpieczenie z jego kodu opiekuna. Bez tego
dowiadywał się o sprzedaży dopiero wtedy, gdy sam zajrzał do panelu — a nie
zadzwoni do klienta, o którym nie wie.

**Dopiero po opłaceniu.** Wniosek oczekujący na płatność bywa porzucany
w bramce, a mail o sprzedaży, której nie było, jest gorszy niż brak maila.

**Wyłącza sam** — przełącznikiem na swojej karcie w `/moje`. To jedyna rzecz,
którą agent może w panelu zmienić, i dotyczy wyłącznie jego skrzynki: kartę
bierzemy z konta zalogowanego, nie z parametru, więc nikt nie wyciszy koledze.

### Uruchamianie

Zadanie chodzi z crona na serwerze, nie z pętli w procesie: panel restartuje się
przy każdym wdrożeniu, a licznik w pamięci znaczyłby, że po wdrożeniu okno się
przesuwa i część sprzedaży zostaje bez powiadomienia.

```
*/10 * * * * curl -fsS -X POST -H "Authorization: Bearer $POWIADOMIENIA_SEKRET" \
  http://ochrona-app-1:3000/api/powiadomienia/sprzedaz >/dev/null
```

Wymaga `POWIADOMIENIA_SEKRET` i `POCZTA_KLUCZ` w `/opt/ochrona/.env`.
Bez sekretu trasa odpowiada 503, bez klucza poczty zadanie kończy się błędem
z jasnym komunikatem, zamiast po cichu nic nie wysłać.

Idempotencja jest podwójna: ślad w tabeli `PowiadomienieSprzedazy` (jeden
wniosek = jedno powiadomienie) i klucz idempotencji w usłudze pocztowej. Sam
klucz by wystarczył, ale wtedy o powtórce dowiadywalibyśmy się od agenta,
który dostał dwa takie same maile. Ślad zapisujemy PO udanej wysyłce — zapis
przed nią znaczyłby, że nieudany list nigdy się nie ponowi.
