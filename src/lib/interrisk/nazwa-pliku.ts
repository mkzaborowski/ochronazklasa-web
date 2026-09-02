/**
 * Nazwa pliku polisy.
 *
 * PO CO. Plik nazywał się `65pln50_679857.docx` — wariant i numer polisy.
 * Biuro otwiera go, eksportuje do PDF-a (szkoły dostają PDF) i przy zapisie
 * DOPISUJE Z RĘKI nazwę placówki, żeby dało się później znaleźć, do której
 * szkoły ta polisa należy. Ta nazwa jest w bazie od początku — nie ma powodu,
 * żeby ktokolwiek przepisywał ją ręcznie przy każdej polisie.
 *
 * NAZWA SZKOŁY IDZIE NA POCZĄTEK. W katalogu pobranych plików to ona jest tym,
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
// eslint-disable-next-line no-control-regex
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
  /** nazwa placówki; null gdy z jakiegoś powodu jej nie znamy */
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

  const szkola = skroc(bezpieczny(dane.szkola ?? ""), MAKS_SZKOLA);
  if (szkola) czlony.push(szkola);

  czlony.push(bezpieczny(dane.wariant) || "polisa");

  const numer = bezpieczny(dane.numerPolisy ?? "");
  if (numer) czlony.push(numer);

  return `${czlony.join("_")}.${dane.rozszerzenie ?? "docx"}`;
}
