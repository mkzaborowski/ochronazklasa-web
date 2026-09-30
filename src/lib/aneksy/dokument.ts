/**
 * Składanie aneksu w Wordzie ze wzoru templates/aneksy/aneks-interrisk.docx.
 *
 * Importy tylko względne (z rozszerzeniem .ts) i z node_modules — ten plik
 * uruchamia też sam node w `npm run check:aneksy`, bez Next.js.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { dataPL, liniaLiczbyUbezpieczonych, type DaneAneksu } from "./tresc.ts";

const WZOR = path.join(process.cwd(), "templates", "aneksy", "aneks-interrisk.docx");

/**
 * Skan podpisu Darka leży NA SERWERZE, nie w repozytorium.
 *
 * Repozytorium i obraz Dockera są publiczne, a podpis we wzorze byłby do
 * pobrania dla każdego i do podrobienia na dowolnym dokumencie. Plik trafia
 * do kontenera przez wolumen tylko do odczytu (docker-compose.prod.yml:
 * ./zasoby:/app/zasoby:ro), a we wzorze zostaje przezroczysta zaślepka.
 */
export const SCIEZKA_PODPISU = path.join(process.cwd(), "zasoby", "podpis-aneks.png");

/** Bajty podpisu albo `null`, gdy pliku nie ma — aneks wyjdzie wtedy bez podpisu. */
export function wczytajPodpis(sciezka = SCIEZKA_PODPISU): Buffer | null {
  try {
    return existsSync(sciezka) ? readFileSync(sciezka) : null;
  } catch {
    return null;
  }
}

/** Dane, które trafiają do {{znaczników}} wzoru. */
export function daneDoWzoru(d: DaneAneksu) {
  return {
    numer_aneksu: d.numerAneksu.trim(),
    data_aneksu: dataPL(d.dataAneksu),
    numer_polisy: d.numerPolisy,
    nazwa_szkoly: d.nazwaSzkoly.trim(),
    linia_liczby: liniaLiczbyUbezpieczonych(d),
    // Punkty 1 i 2 są stałe we wzorze, dopisane zaczynają się od 3.
    dodatkowe_punkty: d.dodatkowePunkty.map((tresc, i) => ({ nr: i + 3, tresc })),
  };
}

export function zlozAneks(
  d: DaneAneksu,
  podpis: Buffer | null = wczytajPodpis(),
  wzor: Buffer = readFileSync(WZOR),
): Buffer {
  const zip = new PizZip(wzor);
  if (podpis) zip.file("word/media/podpis.png", podpis);

  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    // \n w dopisanym punkcie ma dać nową linię w Wordzie, a nie zniknąć
    linebreaks: true,
    nullGetter: () => "",
  });
  doc.render(daneDoWzoru(d));
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}
