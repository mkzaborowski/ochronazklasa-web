// Analyze ulotka PDFs: copy each into templates/flyers/<key>.pdf and emit
// <key>.fields.json v2 — an explicit AcroForm field→role map computed offline:
//   { payment, period, variants, fields: [{ name, role, idx?, prefixAA? }] }
// Roles: policy(idx) | account(idx) | school | period | opiekunName |
//        opiekunPhone | opiekunEmail | deadline(skip at runtime)
//
// Classification = field value hints + geometry + page-text labels (pdftotext
// -bbox), because some delivered templates have EMPTY form fields.
// Run: node scripts/extract-flyer-fields.mjs

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import PizZip from "pizzip";
import { PDFDocument } from "pdf-lib";

const DL = path.join(os.homedir(), "Downloads");
const NEW = path.join(DL, "programdopolisulepszenianadzie9_07");
const OUT = path.join(process.cwd(), "templates", "flyers");

const V50_FULL = ["50PLNV50", "65PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"];

// key -> { src, payment, period, variants (flyer row order, top→bottom) }
const MAP = {
  "v50-full-cash-2y": {
    src: path.join(DL, "PŁATNOŚĆ GOTÓWKA SP 3 BRANIEWO IR OCHRONA 2026 50 65 90 140 195 (1).pdf"),
    payment: "cash", period: "2Y", variants: V50_FULL,
  },
  "v50-full-wire-2y": {
    src: path.join(NEW, "PŁATNOŚĆ PRZELEW IR OCHRONA 50 65 90 140 195 2 LATA.pdf"),
    payment: "wire", period: "2Y", variants: V50_FULL,
  },
  "v50-65-90-140-195-wire-2y": {
    src: path.join(NEW, "PŁATNOŚĆ PRZELEW IR OCHRONA 65 90 140 195 2 LATA.pdf"),
    payment: "wire", period: "2Y", variants: ["65PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"],
  },
  "v50-50-90-140-195-wire-2y": {
    src: path.join(NEW, "PŁATNOŚĆ PRZELEW IR OCHRONA 50 90 140 195 2 LATA.pdf"),
    payment: "wire", period: "2Y", variants: ["50PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"],
  },
  "v50-50-cash-1y": {
    src: path.join(NEW, "PŁATNOŚĆ GOTÓWKA IR O 50ZŁ 1 ROK.pdf"),
    payment: "cash", period: "1Y", variants: ["50PLNV50"],
  },
  "v50-50-cash-2y": {
    src: path.join(NEW, "PŁATNOŚĆ GOTÓWKA IR O 50ZŁ 2 LATA.pdf"),
    payment: "cash", period: "2Y", variants: ["50PLNV50"],
  },
  "v65-single-cash-2y": {
    src: path.join(NEW, "PŁATNOŚĆ GOTÓWKA IR 2026  65 2 LATA.pdf"),
    payment: "cash", period: "2Y", variants: ["65PLNV50"], // registry also maps 65PLNV40
  },
  "v40-50-80-120-165-cash-2y": {
    src: path.join(NEW, "PŁATNOŚĆ GOTÓWKA IR 2026 OCHRONA 50 80 120 165 2 lata.pdf"),
    payment: "cash", period: "2Y", variants: ["50PLNV40", "80PLNV40", "120PLNV40", "165PLN"],
  },
  "v50-50-90-140-195-cash-2y": {
    src: path.join(NEW, "PŁATNOŚĆ GOTÓWKA IR 2026 OCHRONA 50 90 140 195 2 LATA.pdf"),
    payment: "cash", period: "2Y", variants: ["50PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"],
  },
  "v50-65-85-125-cash-2y": {
    src: path.join(NEW, "PŁATNOŚĆ GOTÓWKA IR 2026 OCHRONA 65 85 125 2 LATA.pdf"),
    payment: "cash", period: "2Y", variants: ["65PLNV50", "85PLNV50", "125PLNV50"],
  },
  "v50-65-90-140-cash-2y": {
    src: path.join(NEW, "PŁATNOŚĆ GOTÓWKA IR 2026 OCHRONA 65 90 140 2 LATA.pdf"),
    payment: "cash", period: "2Y", variants: ["65PLNV50", "90PLNV50", "140PLNV50"],
  },
};

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
  const { pageH, ws } = pageWords(cfg.src);
  const pdf = await PDFDocument.load(readFileSync(cfg.src));
  const tf = pdf.getForm().getFields().filter((f) => f.constructor.name === "PDFTextField");

  const F = tf.map((f) => {
    const r = f.acroField.getWidgets()[0].getRectangle();
    return {
      name: f.getName(),
      v: (f.getText?.() ?? "").trim(),
      x: r.x, w: r.width,
      top: pageH - (r.y + r.height), // top-origin y for comparing with words
      h: r.height,
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
  // 3) wire rows hold TWO fields (policy | account): split row groups by x.
  if (cfg.payment === "wire") {
    const rows = [];
    for (const f of F.filter((x) => x.role === "policy").sort((a, b) => a.top - b.top)) {
      const row = rows.find((r) => Math.abs(r[0].top - f.top) < 5);
      if (row) row.push(f);
      else rows.push([f]);
    }
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      row.forEach((f, i) => (f.role = i === 0 ? "policy" : i === 1 ? "account" : null));
    }
    // any leftover unclassified wide field on a policy row -> account
    for (const p of F.filter((f) => f.role === "policy")) {
      if (F.some((f) => f.role === "account" && sameRow(p, f.top, f.top + f.h))) continue;
      const cand = F.filter((f) => !f.role && f.x > p.x && sameRow(p, f.top, f.top + f.h))
        .sort((a, b) => a.x - b.x)[0];
      if (cand) cand.role = "account";
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
    if (!F.some((f) => f.role === r)) problems.push(`missing ${r}`);

  const json = {
    payment: cfg.payment,
    period: cfg.period,
    variants: cfg.variants,
    fields: F.filter((f) => f.role).map(({ name, role, idx, prefixAA }) => ({
      name, role, ...(idx !== undefined ? { idx } : {}), ...(prefixAA !== undefined ? { prefixAA } : {}),
    })),
  };
  copyFileSync(cfg.src, path.join(OUT, `${key}.pdf`));
  writeFileSync(path.join(OUT, `${key}.fields.json`), JSON.stringify(json, null, 2));
  const st = problems.length ? `⚠ ${problems.join("; ")}` : "✓";
  console.log(
    `${key.padEnd(28)} ${st}  pol=${pol.length} acc=${acc.length} school=${F.some((f) => f.role === "school") ? "y" : "n"}`,
  );
  return problems.length === 0;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let ok = true;
for (const [key, cfg] of Object.entries(MAP)) ok = (await classify(key, cfg)) && ok;
writeFileSync(
  path.join(OUT, "README.md"),
  "# Ulotki (flyer templates)\n\nGenerated by scripts/extract-flyer-fields.mjs — <key>.pdf + <key>.fields.json\n(field→role map). Registered in src/lib/flyers/flyer-template-registry.ts.\n",
);
console.log(ok ? "\nALL OK" : "\nSOME PROBLEMS — inspect above");
