// Buduje mapę pól AcroForm dla ulotek: dla każdego klucza z MAP czyta
// templates/flyers/<key>.pdf i zapisuje obok <key>.fields.json v2 —
//   { payment, period, variants, fields: [{ name, role, idx?, prefixAA? }] }
// Role: policy(idx) | account(idx) | school | period | opiekunName |
//       opiekunPhone | opiekunEmail | deadline (pomijane przy generowaniu)
//
// ŹRÓDŁEM SĄ PLIKI W REPOZYTORIUM, nie katalog Pobrane. Wcześniej skrypt
// czytał ulotki z ~/Downloads i na starcie kasował cały katalog wyjściowy —
// uruchomienie go na komputerze bez tamtych plików kasowało szablony, których
// nie było już z czego odtworzyć. Teraz nową ulotkę wgrywa się raz do
// templates/flyers/<key>.pdf, a skrypt jest idempotentny.
//
// Uruchomienie: node scripts/extract-flyer-fields.mjs [--only <key>]

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";

const OUT = path.join(process.cwd(), "templates", "flyers");

const V50_FULL = ["50PLNV50", "65PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"];

// key -> { payment, period, variants (kolejność wierszy na ulotce, góra→dół) }
//
// period: "1Y" | "2Y" | "ANY". ANY = ulotka drukuje świadczenie za 1% w dwóch
// wierszach, osobno dla umowy rocznej i dwuletniej, więc pasuje do obu okresów.
// O okresie decyduje DRUGA STRONA (tabela zakresu), a nie wypełnione pole
// „okres ubezpieczenia" na pierwszej — to pole i tak nadpisujemy przy
// generowaniu.
const MAP = {
  // --- dostarczone 28.08.2026 ---
  // Skladki przy przelewie czytamy z pol formularza; przy gotowce sa grafika,
  // wiec jedynym zrodlem jest nazwa pliku od dostawcy. Wartosc "1% swiadczenia"
  // ze strony 2 NIE rozstrzyga: 616 to zarowno 85 zl, jak i 90 zl w dwoch
  // roznych skalach skladek.
  "v50-50-65-cash-any": { payment: "cash", period: "ANY", variants: ["50PLNV50", "65PLNV50"] },
  "v50-65-wire-1y": { payment: "wire", period: "1Y", variants: ["65PLNV50"] },
  "v50-65-85-wire-2y": { payment: "wire", period: "2Y", variants: ["65PLNV50", "85PLNV50"] },
  "v50-50-85-cash-2y": { payment: "cash", period: "2Y", variants: ["50PLNV50", "85PLNV50"] },
  "v50-65-85-125-wire-2y": {
    payment: "wire", period: "2Y", variants: ["65PLNV50", "85PLNV50", "125PLNV50"],
  },
  "v50-50-65-85-cash-1y": {
    payment: "cash", period: "1Y", variants: ["50PLNV50", "65PLNV50", "85PLNV50"],
  },

  "v50-full-cash-2y": { payment: "cash", period: "2Y", variants: V50_FULL },
  "v50-full-wire-2y": { payment: "wire", period: "2Y", variants: V50_FULL },
  "v50-65-90-140-195-wire-2y": {
    payment: "wire", period: "2Y", variants: ["65PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"],
  },
  "v50-50-90-140-195-wire-2y": {
    payment: "wire", period: "2Y", variants: ["50PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"],
  },
  "v50-50-cash-1y": { payment: "cash", period: "1Y", variants: ["50PLNV50"] },
  "v50-50-cash-2y": { payment: "cash", period: "2Y", variants: ["50PLNV50"] },
  // rejestr mapuje ten sam plik również na 65PLNV40
  "v65-single-cash-2y": { payment: "cash", period: "2Y", variants: ["65PLNV50"] },
  "v40-50-80-120-165-cash-2y": {
    payment: "cash", period: "2Y", variants: ["50PLNV40", "80PLNV40", "120PLNV40", "165PLN"],
  },
  "v50-50-90-140-195-cash-2y": {
    payment: "cash", period: "2Y", variants: ["50PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"],
  },
  "v50-65-85-125-cash-2y": {
    payment: "cash", period: "2Y", variants: ["65PLNV50", "85PLNV50", "125PLNV50"],
  },
  "v50-65-90-140-cash-2y": {
    payment: "cash", period: "2Y", variants: ["65PLNV50", "90PLNV50", "140PLNV50"],
  },

  // --- dostarczone 20.08.2026 ---
  "v50-50-wire-2y": { payment: "wire", period: "2Y", variants: ["50PLNV50"] },
  "v50-50-65-cash-2y": { payment: "cash", period: "2Y", variants: ["50PLNV50", "65PLNV50"] },
  "v50-50-65-85-125-170-wire-2y": {
    payment: "wire", period: "2Y",
    variants: ["50PLNV50", "65PLNV50", "85PLNV50", "125PLNV50", "170PLNV50"],
  },
  "v50-50-90-cash-any": { payment: "cash", period: "ANY", variants: ["50PLNV50", "90PLNV50"] },
  "v50-50-85-wire-any": { payment: "wire", period: "ANY", variants: ["50PLNV50", "85PLNV50"] },
  "v50-50-65-85-125-cash-any": {
    payment: "cash", period: "ANY",
    variants: ["50PLNV50", "65PLNV50", "85PLNV50", "125PLNV50"],
  },
  "v50-50-65-85-wire-any": {
    payment: "wire", period: "ANY", variants: ["50PLNV50", "65PLNV50", "85PLNV50"],
  },
  "v50-65-85-125-170-wire-any": {
    payment: "wire", period: "ANY",
    variants: ["65PLNV50", "85PLNV50", "125PLNV50", "170PLNV50"],
  },
};

/** Etykieta składki na ulotce: „50 zł", „125 PLN". Zostaje jak jest. */
const SKLADKA = /^\d{2,3}\s*(zł|PLN)$/i;

function pageWords(file) {
  const xml = execFileSync("pdftotext", ["-bbox", "-f", "1", "-l", "1", file, "-"], {
    maxBuffer: 50 * 1024 * 1024,
  }).toString();
  const pageH = Number(xml.match(/<page width="[\d.]+" height="([\d.]+)"/)?.[1] ?? 841.89);
  const ws = [];
  const re = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
  let m;
  while ((m = re.exec(xml))) ws.push({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], t: m[5] });
  return { pageH, ws };
}

async function classify(key, cfg) {
  const src = path.join(OUT, `${key}.pdf`);
  if (!existsSync(src)) {
    console.log(`${key.padEnd(30)} ✗  brak pliku ${path.relative(process.cwd(), src)}`);
    return false;
  }
  const { pageH, ws } = pageWords(src);
  const pdf = await PDFDocument.load(readFileSync(src));
  const tf = pdf.getForm().getFields().filter((f) => f.constructor.name === "PDFTextField");

  const F = tf.map((f) => {
    const r = f.acroField.getWidgets()[0].getRectangle();
    // Rozmiar i kolor pola siedzą w jego napisie DA, np.
    //   "/HeBo 12 Tf 0.25 0.25 0.25 rg"   albo   "1 1 1 rg\n/Helvetica 15 Tf"
    // Kolejność bywa odwrotna, a szarość zapisana jako "0 g" zamiast "rg".
    const daObj = f.acroField.dict.get(PDFName.of("DA"));
    const da = daObj instanceof PDFString ? daObj.asString() : "";
    const rozmiar = Number(da.match(/([\d.]+)\s+Tf/)?.[1]) || 10;
    const rgb = da.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/);
    const szarosc = da.match(/(?:^|\s)([\d.]+)\s+g(?:\s|$)/);
    const kolor = rgb
      ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
      : szarosc
        ? [Number(szarosc[1]), Number(szarosc[1]), Number(szarosc[1])]
        : [0, 0, 0];
    return {
      name: f.getName(),
      v: (f.getText?.() ?? "").trim(),
      x: r.x, w: r.width,
      top: pageH - (r.y + r.height), // top-origin y for comparing with words
      h: r.height,
      // prostokąt w układzie PDF (origo w lewym dolnym rogu) - po nim rysujemy
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      rozmiar, kolor,
      role: null, idx: undefined, prefixAA: undefined,
    };
  });

  const sameRow = (a, wTop, wBot) => wBot > a.top - 3 && wTop < a.top + a.h + 3;
  const leftWords = (f) => ws.filter((w) => sameRow(f, w.y0, w.y1) && w.x1 <= f.x + 2);
  const wordNear = (f, re, dx = 170) =>
    leftWords(f).some((w) => re.test(w.t) && f.x - w.x1 < dx);

  // 1) explicit value hints
  for (const f of F) {
    if (/\d{1,2}\.\d{1,2}\.20\d{2}\s*[-–]/.test(f.v)) f.role = "period";
    else if (/^\d{1,2}\.\d{1,2}\.20\d{2}$/.test(f.v)) f.role = "deadline";
    else if (f.v.includes("@")) f.role = "opiekunEmail";
    else if (f.v.includes("|") || /\d{3}\s\d{3}\s\d{3}/.test(f.v)) f.role = "opiekunPhone";
    else if (/^A-?A/.test(f.v)) f.role = "policy";
    else if (/^\d{2}[\s ]\d{4}/.test(f.v)) f.role = "account";
  }
  // 2) label-based for the rest
  for (const f of F.filter((f) => !f.role)) {
    if (wordNear(f, /^OKRES$/i) || wordNear(f, /UBEZPIECZENIA/i, 90)) f.role = "period";
    else if (wordNear(f, /^A-?A$/, 60)) { f.role = "policy"; f.prefixAA = false; }
    else if (wordNear(f, /^(50|65|80|85|90|120|125|140|165|170|195)$/, 120) || wordNear(f, /^(zł|PLN)$/i, 90))
      f.role = "policy";
    else if (f.top < pageH * 0.7 && wordNear(f, /^POLISY/i, 220) && wordNear(f, /^NUMER/i, 340))
      f.role = "policy"; // "NUMER POLISY ____" (blank single-variant forms)
  }
  // 3) Ulotka przelewowa: wiersz to trzy pola obok siebie —
  //      [ "50 zł" (etykieta składki) | numer polisy | numer rachunku ]
  //
  //    Zaczepiamy się o ETYKIETĘ SKŁADKI, bo to jedyne pole w wierszu, które
  //    zawsze ma wartość. Wcześniej wiersze wychodziły z pól rozpoznanych jako
  //    „polisa", a te rozpoznawało sąsiedztwo napisu na stronie — działało
  //    tylko dla ulotek dostarczonych z wpisanym „A-A" w polu. W ulotkach z
  //    pustymi polami jeden wiersz na komplet gubił rachunek, czyli rodzic
  //    dostawał ulotkę bez numeru konta, na które ma zapłacić.
  if (cfg.payment === "wire") {
    for (const f of F) {
      if (f.role === "policy" || f.role === "account") { f.role = null; f.prefixAA = undefined; }
    }
    for (const etykieta of F.filter((f) => SKLADKA.test(f.v)).sort((a, b) => a.top - b.top)) {
      const wiersz = F.filter(
        (f) => f !== etykieta && !f.role && f.x > etykieta.x && Math.abs(f.top - etykieta.top) <= 6,
      ).sort((a, b) => a.x - b.x);
      if (wiersz[0]) wiersz[0].role = "policy";
      if (wiersz[1]) wiersz[1].role = "account";
    }
  }
  // 4) bottom band -> opiekun name/phone/email (top→bottom order)
  const band = F.filter((f) => !f.role && f.top > pageH * 0.7).sort((a, b) => a.top - b.top);
  const wantBottom = ["opiekunName", "opiekunPhone", "opiekunEmail"].filter(
    (r) => !F.some((f) => f.role === r),
  );
  band.slice(0, wantBottom.length).forEach((f, i) => (f.role = wantBottom[i]));
  // 5) school = topmost remaining
  const rest = F.filter((f) => !f.role).sort((a, b) => a.top - b.top);
  if (!F.some((f) => f.role === "school") && rest[0]) rest[0].role = "school";

  // policy idx by row order (top→bottom) + prefixAA default
  const pol = F.filter((f) => f.role === "policy").sort((a, b) => a.top - b.top);
  pol.forEach((f, i) => {
    f.idx = i;
    if (f.prefixAA === undefined)
      f.prefixAA = !ws.some((w) => /^A-?A$/.test(w.t) && sameRow(f, w.y0, w.y1) && w.x1 <= f.x + 2);
  });
  const acc = F.filter((f) => f.role === "account").sort((a, b) => a.top - b.top);
  acc.forEach((f, i) => (f.idx = i));

  // report + validate
  const problems = [];
  if (pol.length !== cfg.variants.length)
    problems.push(`policy fields ${pol.length} != variants ${cfg.variants.length}`);
  if (cfg.payment === "wire" && acc.length !== cfg.variants.length)
    problems.push(`account fields ${acc.length} != variants ${cfg.variants.length}`);
  for (const r of ["opiekunName", "opiekunPhone", "opiekunEmail", "period"])
    if (!F.some((f) => f.role === r)) problems.push(`brak roli ${r}`);
  // NAJWAŻNIEJSZE: pole z wartością, któremu nie nadano roli, NIE JEST
  // nadpisywane przy generowaniu - czyli wydrukuje się tak, jak przyszło od
  // dostawcy. Ulotki przychodzą wypełnione przykładem (nazwa szkoły, opiekun,
  // numery polis), więc przeoczona rola oznacza cudze nazwisko i cudzy numer
  // polisy na ulotce każdej szkoły. Etykiety składek zostają celowo.
  const przecieki = F.filter((f) => !f.role && f.v && !SKLADKA.test(f.v));
  for (const f of przecieki) problems.push(`nieprzypisane pole z wartością ${f.name}=${JSON.stringify(f.v)}`);

  const json = {
    payment: cfg.payment,
    period: cfg.period,
    variants: cfg.variants,
    fields: F.filter((f) => f.role).map(({ name, role, idx, prefixAA, rect, rozmiar, kolor }) => ({
      name, role, ...(idx !== undefined ? { idx } : {}), ...(prefixAA !== undefined ? { prefixAA } : {}),
      rect: { x: +rect.x.toFixed(2), y: +rect.y.toFixed(2), w: +rect.w.toFixed(2), h: +rect.h.toFixed(2) },
      rozmiar, kolor,
    })),
  };
  writeFileSync(path.join(OUT, `${key}.fields.json`), JSON.stringify(json, null, 2));
  const st = problems.length ? `⚠ ${problems.join("; ")}` : "✓";
  console.log(
    `${key.padEnd(28)} ${st}  pol=${pol.length} acc=${acc.length} school=${F.some((f) => f.role === "school") ? "y" : "n"}`,
  );
  return problems.length === 0;
}

// --only <key> przebudowuje jedną ulotkę; bez tego wszystkie z MAP.
const tylko = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;
if (tylko && !MAP[tylko]) {
  console.error(`Nieznany klucz: ${tylko}. Dostępne: ${Object.keys(MAP).join(", ")}`);
  process.exit(1);
}

let ok = true;
for (const [key, cfg] of Object.entries(MAP)) {
  if (tylko && key !== tylko) continue;
  ok = (await classify(key, cfg)) && ok;
}
writeFileSync(
  path.join(OUT, "README.md"),
  "# Ulotki (szablony)\n\n<key>.pdf wgrywa się tu ręcznie; <key>.fields.json (mapa pole→rola)\ngeneruje `npm run build-flyer-fields` NA PODSTAWIE tych plików PDF.\nKlucze rejestruje src/lib/flyers/flyer-template-registry.ts.\n",
);
console.log(ok ? "\nWSZYSTKO OK" : "\nSĄ PROBLEMY — patrz wyżej");
process.exit(ok ? 0 : 1);
