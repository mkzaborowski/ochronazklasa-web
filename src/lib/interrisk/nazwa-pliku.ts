/**
 * Nazwa pliku polisy.
 *
 * PO CO. Plik nazywał się `65pln50_679857.docx` — wariant i numer polisy.
 * Biuro otwiera go, eksportuje do PDF-a (szkoły dostają PDF) i przy zapisie
 * DOPISUJE Z RĘKI nazwę placówki, żeby dało się później znaleźć, do której
 * szkoły ta polisa należy. Ta nazwa jest w bazie od początku — nie ma powodu,
 * żeby ktokolwiek przepisywał ją ręcznie przy każdej polisie.
 *
 * ETYKIETA WYGRYWA Z NAZWĄ. Biuro może wpisać przy wystawianiu krótkie
 * „Ubezpieczenie dla" — i wtedy w nazwie pliku stoi ono, a nie pełna nazwa
 * z dokumentu. Dwa powody, oba z praktyki: „Szkoła Podstawowa nr 5 im.
 * Bohaterów Westerplatte w Słupsku" nie daje się przeczytać rzutem oka, a przy
 * polisie wystawionej na fundację pełna nazwa mówi „Fundacja IN ALTUM" — czyli
 * nie mówi nic o tym, której szkoły dotyczy ochrona.
 *
 * NAZWA IDZIE NA POCZĄTEK. W katalogu pobranych plików to ona jest tym,
 * czego się szuka i po czym się sortuje; wariant i numer są dopiskiem
 * odróżniającym polisy tej samej szkoły. Odwrotna kolejność grupowałaby pliki
 * po wariancie, czyli po rzeczy, która nikogo nie interesuje przy szukaniu.
 *
 * NAZWĘ SKŁADAMY PRZY POBIERANIU, nie tylko przy tworzeniu. Dzięki temu polisy
 * wystawione WCZEŚNIEJ też pobierają się już z nazwą szkoły — inaczej poprawka
 * dotyczyłaby wyłącznie tego, co dopiero powstanie, a biuro ma w systemie
 * kilkadziesiąt polis wystawionych wcześniej.
 */

/**
 * Znaki, których Windows nie przyjmuje w nazwie pliku, plus znaki sterujące.
 * Myślnik i spacja ZOSTAJĄ: „Zespół Szkolno-Przedszkolny" ma się czytać tak,
 * jak się nazywa, a oba znaki są w nazwie pliku całkowicie legalne.
 */
const ZAKAZANE = /[<>:"/\\|?*\u0000-\u001f]/g;

/**
 * Ile znaków przeznaczamy na nazwę szkoły.
 *
 * Pełne nazwy placówek bywają ogromne („Zespół Szkolno-Przedszkolny nr 3
 * im. Świętej Jadwigi Królowej w …"), a ścieżka w Windows ma twardy limit.
 * Ucinamy na granicy słowa, żeby nie kończyć w połowie wyrazu.
 */
const MAKS_SZKOLA = 70;

function bezpieczny(tekst: string): string {
  return tekst
    .replace(ZAKAZANE, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Windows odrzuca nazwy kończące się kropką albo spacją.
    .replace(/[. ]+$/, "");
}

function skroc(tekst: string, maks: number): string {
  if (tekst.length <= maks) return tekst;
  const uciete = tekst.slice(0, maks);
  const spacja = uciete.lastIndexOf(" ");
  // Ucięcie na granicy słowa tylko wtedy, gdy zostaje sensowny kawałek —
  // przy jednym długim wyrazie lepszy jest twardy skrót niż pusty napis.
  return (spacja > maks * 0.6 ? uciete.slice(0, spacja) : uciete).replace(/[. ]+$/, "");
}

export interface DanePolisyDoNazwy {
  /** „Ubezpieczenie dla" — krótka nazwa od biura; ma pierwszeństwo */
  etykieta?: string | null;
  /** pełna nazwa ubezpieczającego; używana, gdy etykiety nie ma */
  szkola?: string | null;
  /** kod wariantu, np. „65pln50" */
  wariant: string;
  /** numer polisy, np. „679857" */
  numerPolisy?: string | null;
  /** domyślnie „docx" */
  rozszerzenie?: string;
}

/**
 * „Szkoła Podstawowa nr 5 w Nowym Sączu_65pln50_679857.docx"
 *
 * Bez nazwy szkoły wychodzi dokładnie to, co dotąd: `65pln50_679857.docx`.
 * Polskie znaki zostają — nagłówek pobierania idzie w UTF-8, a biuro czyta te
 * nazwy oczami; „Szkola Podstawowa" zamiast „Szkoła" niczego by nie ułatwiło.
 */
export function nazwaPlikuPolisy(dane: DanePolisyDoNazwy): string {
  const czlony: string[] = [];

  // Etykieta pierwsza, pełna nazwa jako zapas. Pusta etykieta (samo spacje)
  // ma znaczyć „nie podano", a nie „nazwij plik pustym napisem".
  const opis = skroc(bezpieczny(dane.etykieta ?? "") || bezpieczny(dane.szkola ?? ""), MAKS_SZKOLA);
  if (opis) czlony.push(opis);

  czlony.push(bezpieczny(dane.wariant) || "polisa");

  const numer = bezpieczny(dane.numerPolisy ?? "");
  if (numer) czlony.push(numer);

  return `${czlony.join("_")}.${dane.rozszerzenie ?? "docx"}`;
}

/**
 * „SP 5 Słupsk_ulotka_65pln50.pdf"
 *
 * Ulotka dotąd nazywała się `ulotka_65pln50.pdf` — dla KAŻDEJ szkoły tak samo,
 * więc druga pobrana tego samego dnia lądowała w katalogu jako „(1)". Ta sama
 * etykieta, co przy polisie: jeden wpis przy wystawianiu opisuje oba dokumenty.
 */
export function nazwaPlikuUlotki(dane: {
  etykieta?: string | null;
  szkola?: string | null;
  szablon: string;
}): string {
  const opis = skroc(bezpieczny(dane.etykieta ?? "") || bezpieczny(dane.szkola ?? ""), MAKS_SZKOLA);
  const szablon = bezpieczny(dane.szablon) || "ulotka";
  return opis ? `${opis}_ulotka_${szablon}.pdf` : `ulotka_${szablon}.pdf`;
}
