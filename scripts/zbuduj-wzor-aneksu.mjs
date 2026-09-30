// Buduje wzór aneksu: templates/aneksy/aneks-interrisk.docx
// Użycie: node scripts/zbuduj-wzor-aneksu.mjs
//
// SKĄD TEN SKRYPT, a nie plik z Worda. Wzór biura przyszedł jako stary .doc
// (Word 97), a docxtemplater czyta tylko .docx. Konwersja takiego pliku bez
// Worda gubi obrazki i tnie tekst na przypadkowe kawałki, w których
// {{znaczniki}} rozpadają się na kilka fragmentów i przestają działać. Tu
// składamy dokument sami - tekst, pogrubienia i układ przepisane 1:1 z wzorów
// „ANEKS RĘCZNY DO POLIS AA (BEZ) ZWOLNIENIA", czcionka Arial jak w oryginale.
//
// PODPIS DARKA NIE JEST W TYM PLIKU. Repozytorium i obraz Dockera są publiczne,
// więc skan podpisu we wzorze byłby do pobrania dla każdego. Na jego miejscu
// siedzi przezroczysta zaślepka (word/media/podpis.png), którą program przy
// generowaniu podmienia na plik z serwera - patrz src/lib/aneksy/dokument.ts.
//
// Wzór wolno potem poprawiać w Wordzie (np. zmienić adres oddziału), byle
// {{znaczniki}} zostały w całości, każdy wpisany jednym ciągiem.

import { readFileSync, writeFileSync } from "node:fs";
import PizZip from "pizzip";

const KATALOG = "templates/aneksy";

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Jeden fragment tekstu o jednolitym formatowaniu. */
function r(tekst, { b = false, i = false, sz = 10 } = {}) {
  const rpr =
    `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>` +
    `${b ? "<w:b/><w:bCs/>" : ""}${i ? "<w:i/><w:iCs/>" : ""}` +
    `<w:sz w:val="${sz * 2}"/><w:szCs w:val="${sz * 2}"/></w:rPr>`;
  return `<w:r>${rpr}<w:t xml:space="preserve">${esc(tekst)}</w:t></w:r>`;
}

/**
 * Akapit z kilku fragmentów. `po` = odstęp po akapicie w punktach.
 * `wciecie` = wcięcie wiszące pod numerem punktu (z własnym tabulatorem, bo
 * nie każdy program bierze wcięcie za punkt tabulacji), `zLewej` = zwykłe
 * wcięcie, `tabulatory` = punkty tabulacji wyśrodkowanej (w twipach).
 */
function p(fragmenty, { jc = "left", po = 0, przed = 0, wciecie = 0, zLewej = 0, tabulatory = [] } = {}) {
  const zawartosc = Array.isArray(fragmenty) ? fragmenty.join("") : fragmenty;
  const ind = wciecie
    ? `<w:ind w:left="${wciecie}" w:hanging="${wciecie}"/>`
    : zLewej
      ? `<w:ind w:left="${zLewej}"/>`
      : "";
  const stopy = [
    ...(wciecie ? [`<w:tab w:val="left" w:pos="${wciecie}"/>`] : []),
    ...tabulatory.map((pos) => `<w:tab w:val="center" w:pos="${pos}"/>`),
  ];
  const tabs = stopy.length ? `<w:tabs>${stopy.join("")}</w:tabs>` : "";
  return (
    `<w:p><w:pPr>${tabs}<w:spacing w:before="${przed * 20}" w:after="${po * 20}" w:line="264" w:lineRule="auto"/>` +
    `${ind}<w:jc w:val="${jc}"/></w:pPr>${zawartosc}</w:p>`
  );
}

const pusty = (po = 0) => p("", { po });

// Tabulator między numerem punktu a treścią - literalny znak tabulacji w <w:t>
// Word pokazuje jako spację, więc wcięcie wisiące by się rozjechało.
const TAB = "<w:r><w:tab/></w:r>";

/** Obrazek w linii tekstu. Wymiary w cm. */
function obraz(relId, id, nazwa, szerCm, wysCm) {
  const cx = Math.round(szerCm * 360000);
  const cy = Math.round(wysCm * 360000);
  return (
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="${nazwa}"/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="${nazwa}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  );
}

const OSWIADCZENIE =
  "Oświadczam, że otrzymałem(am) i zapoznałem(am) się z warunkami umowy ubezpieczenia, " +
  "w tym z Ogólnymi Warunkami Ubezpieczenia Edu Plus zatwierdzonymi uchwałą nr 01/24/03/2026 " +
  "Zarządu InterRisk Towarzystwo Ubezpieczeń Spółka Akcyjna Vienna Insurance Group z dnia " +
  "24 marca 2026 roku (\"Ogólne Warunki Ubezpieczenia\"), informacją o której mowa w art. 17 " +
  "ust. 1 ustawy o działalności ubezpieczeniowej i reasekuracyjnej, informacją dotyczącą " +
  "możliwości i procedury złożenia i rozpatrzenia skarg i reklamacji, organu właściwego do ich " +
  "rozpatrzenia oraz pozasądowego rozpatrywania sporów.";

// Wcięcie wiszące pod numerem punktu: 0,6 cm.
const W = 340;

// Szerokość tekstu: A4 (11906) minus marginesy 2 × 1134 twipów.
const SZEROKOSC = 11906 - 2 * 1134;
const POLOWA = Math.round(SZEROKOSC / 2);
const CWIERC = Math.round(SZEROKOSC / 4);
const TRZY_CWIERCI = Math.round((SZEROKOSC * 3) / 4);

const tresc = [
  // --- nagłówek: logo i dane oddziału ---
  p(obraz("rIdLogo", 1, "InterRisk", 3.3, 1.2)),
  p(r("InterRisk Towarzystwo Ubezpieczeń S.A.", { b: true, sz: 9 }), { jc: "center" }),
  p(r("Vienna Insurance Group", { b: true, sz: 9 }), { jc: "center" }),
  p(r("Oddział Olsztyn", { sz: 8 }), { jc: "center" }),
  p(r("10-540 Olsztyn, ul. Dąbrowszczaków 21 lok", { sz: 8 }), { jc: "center" }),
  p(r("tel.: (89) 537-00-88, fax: (89) 537-00-87", { sz: 8 }), { jc: "center" }),
  p(r("NIP 526-00-38-806", { sz: 8 }), { jc: "right" }),
  pusty(), pusty(), pusty(),

  // --- tytuł ---
  p(r("Aneks nr {{numer_aneksu}} z dnia {{data_aneksu}}", { b: true }), { jc: "center" }),
  p(r("do polisy A-A {{numer_polisy}}", { b: true, i: true, sz: 11 }), { jc: "center", po: 6 }),
  p(r("Zawarty pomiędzy:"), { jc: "center", po: 4 }),
  p(r("InterRisk Towarzystwo Ubezpieczeń S.A. Vienna Insurance Group Oddział w Olsztynie,"), { jc: "both" }),
  p(r("10-540 Olsztyn, ul. Dąbrowszczaków 21 lok 406"), { jc: "both" }),
  p(r("a", { b: true }), { jc: "both" }),
  p(r("{{nazwa_szkoly}}", { b: true, sz: 11 }), { jc: "both", po: 8 }),

  // --- § 1 ---
  p(r("§ 1", { b: true, sz: 11 }), { jc: "center", po: 4 }),
  p(r("Niniejszym aneksem wprowadza się następujące zmiany do polisy:"), { jc: "both", po: 8 }),

  p([r("1.", { b: true }), TAB, r("{{linia_liczby}}", { b: true })], { wciecie: W, po: 8 }),

  p([r("2.", { b: true }), TAB, r("Korekta pkt 1 Oświadczenia", { b: true })], { wciecie: W, po: 4 }),
  p(r("Powinno być:"), { po: 2 }),
  p(r(OSWIADCZENIE, { b: true }), { jc: "both", po: 8 }),

  // Punkty dopisane przez biuro. Akapity z samym {{#…}} i {{/…}} docxtemplater
  // usuwa (paragraphLoop), więc bez dopisanych punktów nie zostaje po nich ślad.
  p(r("{{#dodatkowe_punkty}}")),
  p([r("{{nr}}.", { b: true }), TAB, r("{{tresc}}")], { jc: "both", wciecie: W, po: 8 }),
  p(r("{{/dodatkowe_punkty}}")),

  p(r("Pozostałe warunki ubezpieczenia nie ulegają zmianie.", { b: true }), { jc: "both", po: 8 }),

  // --- § 2 i § 3 ---
  p(r("§ 2", { b: true }), { jc: "center", po: 4 }),
  p(r("Niniejszy aneks stanowi integralną całość z polisą A-A {{numer_polisy}}.", { b: true, i: true }), { jc: "both", po: 8 }),
  p(r("§ 3", { b: true }), { jc: "center", po: 4 }),
  p(r("Niniejszy aneks został sporządzony w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze stron."), { jc: "both", po: 12 }),
  p(r("Olsztyn, dnia {{data_aneksu}}", { b: true }), { po: 12 }),

  // --- podpisy: dwie kolumny na tabulatorach wyśrodkowanych (¼ i ¾ szerokości
  // tekstu). Tabela bez ramek rozjeżdżała się w podglądach innych niż Word.
  // Podpis przedstawiciela (obraz z serwera) stoi nad prawą kolumną.
  p(obraz("rIdPodpis", 2, "Podpis", 4.6, 2.9), { jc: "center", zLewej: POLOWA }),
  p([TAB, r("…………………………………", { sz: 11 }), TAB, r("……………………………………………", { sz: 11 })], {
    tabulatory: [CWIERC, TRZY_CWIERCI],
  }),
  p([TAB, r("PODPIS UBEZPIECZAJĄCEGO", { sz: 8 }), TAB, r("PODPIS PRZEDSTAWICIELA INTERISK TU SA VIG", { sz: 8 })], {
    tabulatory: [CWIERC, TRZY_CWIERCI],
  }),
];

const document =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
  `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
  `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
  `<w:body>${tresc.join("")}` +
  `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
  `<w:pgMar w:top="851" w:right="1134" w:bottom="851" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>` +
  `</w:sectPr></w:body></w:document>`;

const styles =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
  `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/>` +
  `<w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="pl-PL"/></w:rPr></w:rPrDefault>` +
  `<w:pPrDefault><w:pPr><w:spacing w:after="0"/></w:pPr></w:pPrDefault></w:docDefaults>` +
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
  `</w:styles>`;

const contentTypes =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Default Extension="png" ContentType="image/png"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
  `</Types>`;

const rels =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
  `</Relationships>`;

const docRels =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>` +
  `<Relationship Id="rIdPodpis" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/podpis.png"/>` +
  `</Relationships>`;

const zip = new PizZip();
zip.file("[Content_Types].xml", contentTypes);
zip.file("_rels/.rels", rels);
zip.file("word/document.xml", document);
zip.file("word/styles.xml", styles);
zip.file("word/_rels/document.xml.rels", docRels);
zip.file("word/media/logo.png", readFileSync(`${KATALOG}/logo-interrisk.png`));
zip.file("word/media/podpis.png", readFileSync(`${KATALOG}/podpis-zaslepka.png`));

const wynik = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync(`${KATALOG}/aneks-interrisk.docx`, wynik);
console.log(`OK  ${KATALOG}/aneks-interrisk.docx (${wynik.length} B)`);
