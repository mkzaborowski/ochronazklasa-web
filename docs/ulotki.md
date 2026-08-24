# Ulotki do polis

Ulotka to gotowy PDF od dostawcy z pustymi polami formularza, które panel
wypełnia przy generowaniu: nazwa szkoły, okres, numery polis i rachunków,
dane opiekuna. Reszta — zakres na drugiej stronie, składki, grafika — jest
częścią pliku i nie da się jej zmienić z panelu.

Ulotka = **forma płatności** (gotówka/przelew) × **okres** × **dokładny zestaw
wariantów**. Zestaw musi się zgadzać co do sztuki: ulotka drukuje konkretne
składki, więc „prawie pasuje" nie istnieje.

## Skąd wiadomo, na jaki okres jest ulotka

Z **drugiej strony**, nie z daty wpisanej w dostarczonym pliku — to pole i tak
nadpisujemy przy generowaniu.

| Co jest w tabeli zakresu | Okres |
| --- | --- |
| tylko wiersz „umowa zawarta na 1 rok" | `1Y` |
| tylko wiersz „umowa zawarta na 2 lata" | `2Y` |
| oba wiersze | `ANY` — jedna ulotka obsługuje oba okresy |

Przy `ANY` rodzic czyta wiersz odpowiadający swojej umowie. Jeśli dla danego
zestawu istnieje ulotka przypisana wprost do okresu, wygrywa ona — drukuje
tylko właściwy wiersz, więc nie ma czego zgadywać.

## Skąd wiadomo, które warianty

Po składkach z nazwy pliku, ale seria (V40/V50) wynika z **liczb w tabeli
zakresu**, nie z nazwy. Składki 50 i 65 występują w obu seriach, a przy 50
serie się różnią: V40 płaci 140 zł za dzień pobytu w szpitalu, V50 — 120 zł.
Wystarczy porównać ten wiersz z szablonem polisy (`templates/policies/*.docx`).

Pomyłka tutaj oznacza ulotkę z zakresem, którego szkoła nie kupiła.

## Dodanie nowej ulotki

1. Plik do `templates/flyers/<klucz>.pdf`. Klucz opisuje zawartość, np.
   `v50-50-65-85-wire-any`.
2. Wpis w `MAP` w `scripts/extract-flyer-fields.mjs` (płatność, okres, warianty
   w kolejności wierszy na ulotce, góra→dół).
3. `npm run build-flyer-fields` — buduje `<klucz>.fields.json`, czyli mapę
   pole→rola. Skrypt czyta **wyłącznie pliki z repozytorium** i jest
   idempotentny.
4. Wpis w `src/lib/flyers/flyer-template-registry.ts` (klucz, etykieta dla
   operatora, te same płatność/okres/warianty).
5. `npm run check:ulotki`.

## Dlaczego `check:ulotki` jest w CI

Ulotki przychodzą **wypełnione przykładem**: nazwa cudzej szkoły, nazwisko
cudzego opiekuna, cudze numery polis. Generator nadpisuje wyłącznie pola,
którym nadano rolę — więc pole przeoczone przy budowie mapy wydrukuje cudze
dane na ulotce **każdej** szkoły.

Tak było na ulotce OCHRONA 65: dwa różne pola nazywały się `Text1`,
`getTextField("Text1")` trafiał w to niewłaściwe (niewidoczne, bez strony)
i w nagłówku każdej wygenerowanej ulotki zostawało
„NIEPUBLICZNEGO PRZEDSZKOLA ZACZAROWANY OŁÓWEK". Naprawia to
`npm run fix-flyer-duplicates -- --zapisz`; test generuje każdą ulotkę
i sprawdza, że nie została w niej żadna wartość od dostawcy.

## Dwie rzeczy, których nie wolno zmienić w generatorze

**Nie wołamy `form.flatten()`.** Pobrana ulotka ma zostać do edycji: agent
regularnie zmienia po wygenerowaniu datę ochrony, nazwę szkoły albo numer konta
i drukuje z Acrobata, nie z panelu. Przez chwilę utrwalaliśmy formularz i z
panelu wychodził gotowiec bez jednego pola do poprawienia — wróciło to
reklamacją. `check:ulotki` sprawdza teraz, że każde pole z mapy przetrwało zapis.

**Zapisujemy przez `pdf.save({ updateFieldAppearances: false })`.** Polskie
znaki bierze się stąd, że wygląd pola generujemy sami krojem PP Mori
(`updateAppearances`). Domyślne `save()` przelicza wygląd wszystkich pól
jeszcze raz i potrafi podmienić krój na taki bez ogonków — psując to, co przed
chwilą wyszło dobrze.
