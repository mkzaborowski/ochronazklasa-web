// Analyze the sample ulotka PDFs: copy them into templates/flyers/<key>.pdf and
// extract the coordinates of the dynamic fields (policy numbers, bank accounts,
// opiekun name/phone/email) into <key>.fields.json — consumed by generate-flyer.
//
// Detection uses the sample agent strings (DARIUSZ ZABOROWSKI / 883 952 595 /
// dariusz.zaborowski@...) only to LOCATE the slots; nothing is hardcoded into
// generated output. Run: node scripts/extract-flyer-fields.mjs

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const DL = path.join(os.homedir(), "Downloads");
const OUT = path.join(process.cwd(), "templates", "flyers");
mkdirSync(OUT, { recursive: true });

// key -> source file + payment + variant codes in flyer row order (top→bottom)
const MAP = {
  "v50-full-cash": {
    src: "PŁATNOŚĆ GOTÓWKA SP 3 BRANIEWO IR OCHRONA 2026 50 65 90 140 195 (1).pdf",
    payment: "cash",
    variants: ["50PLNV50", "65PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"],
  },
  "v50-full-wire": {
    src: "PŁATNOŚĆ PRZELEW IR OCHRONA 50 65 90 140 195 SP 3 W CIECHANOWIE.pdf",
    payment: "wire",
    variants: ["50PLNV50", "65PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"],
  },
  "v50-65to195-wire": {
    src: "PŁATNOŚĆ PRZELEW IR OCHRONA 65 90 140 195 I LO STALOWA WOLA.pdf",
    payment: "wire",
    variants: ["65PLNV50", "90PLNV50", "140PLNV50", "195PLNV50"],
  },
  "v50-50-cash": {
    src: "PŁATNOŚĆ GOTÓWKA IR O A-A 676546 50ZŁ SP W KRUSZEWCU.pdf",
    payment: "cash",
    variants: ["50PLNV50"],
  },
};

function words(file) {
  const xml = execFileSync("pdftotext", ["-bbox", "-f", "1", "-l", "1", file, "-"], {
    maxBuffer: 50 * 1024 * 1024,
  }).toString();
  const pageH = Number(xml.match(/<page width="[\d.]+" height="([\d.]+)"/)?.[1] ?? 841.89);
  const pageW = Number(xml.match(/<page width="([\d.]+)"/)?.[1] ?? 595.28);
  const ws = [];
  const re = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
  let m;
  while ((m = re.exec(xml))) {
    ws.push({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], t: m[5] });
  }
  return { pageH, pageW, ws };
}

// pdf-lib box (origin bottom-left) from a top-origin token bbox
const box = (pageH, t, pad = 1.2) => ({
  x: t.x0 - pad,
  y: pageH - t.y1 - pad,
  w: t.x1 - t.x0 + pad * 2,
  h: t.y1 - t.y0 + pad * 2,
  size: +(t.y1 - t.y0).toFixed(1),
});
const span = (toks) => ({
  x0: Math.min(...toks.map((t) => t.x0)),
  y0: Math.min(...toks.map((t) => t.y0)),
  x1: Math.max(...toks.map((t) => t.x1)),
  y1: Math.max(...toks.map((t) => t.y1)),
});

for (const [key, cfg] of Object.entries(MAP)) {
  const srcPath = path.join(DL, cfg.src);
  copyFileSync(srcPath, path.join(OUT, `${key}.pdf`));
  const { pageH, pageW, ws } = words(srcPath);

  // policy-number tokens: number right after each "A-A"
  const policy = [];
  ws.forEach((w, i) => {
    if (w.t === "A-A") {
      const num = ws[i + 1];
      if (num && /^\d{4,}$/.test(num.t) && Math.abs(num.y0 - w.y0) < 4) policy.push(num);
    }
  });
  policy.sort((a, b) => a.y0 - b.y0);

  // accounts (wire): digit-group tokens to the right, same row as each policy number
  const accounts = [];
  if (cfg.payment === "wire") {
    for (const p of policy) {
      const row = ws
        .filter((w) => Math.abs(w.y0 - p.y0) < 4 && w.x0 > p.x1 && /^\d{2,4}$/.test(w.t))
        .sort((a, b) => a.x0 - b.x0);
      if (row.length >= 4) accounts.push(span(row));
    }
  }

  const find = (pred) => ws.filter(pred);
  const nameToks = find((w) => /DARIUSZ|ZABOROWSKI/.test(w.t));
  const phoneToks = (() => {
    const i = ws.findIndex((w, k) => w.t === "883" && ws[k + 1]?.t === "952");
    return i >= 0 ? [ws[i], ws[i + 1], ws[i + 2]].filter(Boolean) : [];
  })();
  const emailTok = ws.find((w) => /@ochronazklasa\.pl/.test(w.t));

  const fields = {
    payment: cfg.payment,
    variants: cfg.variants,
    pageW,
    pageH,
    policyNumbers: policy.map((p) => box(pageH, p)),
    accounts: accounts.map((s) => box(pageH, s)),
    opiekunName: nameToks.length ? box(pageH, span(nameToks)) : null,
    opiekunPhone: phoneToks.length ? box(pageH, span(phoneToks)) : null,
    opiekunEmail: emailTok ? box(pageH, emailTok) : null,
  };
  writeFileSync(path.join(OUT, `${key}.fields.json`), JSON.stringify(fields, null, 2));
  console.log(
    `${key}: ${cfg.payment} | nums=${fields.policyNumbers.length} accts=${fields.accounts.length} ` +
      `name=${!!fields.opiekunName} phone=${!!fields.opiekunPhone} email=${!!fields.opiekunEmail}`,
  );
}
console.log(`\nDone → ${OUT}`);
