// Import the nationwide school directory XLSX into the SchoolRecord table.
//
// Usage:
//   npm run import:schools                 # default file in ~/Downloads
//   npm run import:schools -- "/path/to.xlsx"
//   npm run import:schools -- --wipe       # delete all first (drops agent links)
//
// Idempotent: deterministic ids (sha1 of regonNormalized|name) + skipDuplicates,
// so re-running does not duplicate rows and preserves existing agent assignments.

import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const wipe = args.includes("--wipe");
const fileArg = args.find((a) => !a.startsWith("--"));
const FILE =
  fileArg ||
  path.join(os.homedir(), "Downloads", "cała Polska — województa oczyszczone ze szkół specjalnych1.xlsx");

const digitsOnly = (s) => String(s ?? "").replace(/\D/g, "");
const normalizeRegon = (s) => {
  const d = digitsOnly(s);
  return d.length > 0 && d.length <= 9 ? d.padStart(9, "0") : d;
};

function cellStr(v) {
  if (v == null) return null;
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "object") {
    if (v.text != null) return String(v.text).trim() || null;
    if (v.result != null) return String(v.result).trim() || null;
    if (Array.isArray(v.richText)) return v.richText.map((p) => p.text).join("").trim() || null;
    if (v.hyperlink) return String(v.hyperlink).trim() || null;
  }
  return String(v).trim() || null;
}

const HEADER_MAP = {
  REGON: "regon",
  Typ: "type",
  Nazwa: "name",
  Województwo: "voivodeship",
  Powiat: "county",
  Gmina: "commune",
  Miejscowość: "city",
  "Rodzaj miejscowości": "localityType",
  Ulica: "street",
  "Numer budynku": "buildingNumber",
  "Numer lokalu": "apartmentNumber",
  "Kod pocztowy": "postalCode",
  Poczta: "postOffice",
  Telefon: "phone",
  "E-mail": "email",
  "Strona www": "website",
  "Publiczność status": "publicStatus",
  "Liczba uczniów": "studentCount",
};

console.log(`Reading ${FILE} …`);
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(FILE);
const ws = wb.worksheets[0];
console.log(`Main sheet: "${ws.name}" (${ws.rowCount} rows)`);

// Map columns by header name (first occurrence wins -> ignores duplicate helper cols)
const col = {};
ws.getRow(1).eachCell({ includeEmpty: true }, (cell, i) => {
  const key = HEADER_MAP[cellStr(cell.value)];
  if (key && !(key in col)) col[key] = i;
});
for (const need of ["regon", "name"]) {
  if (!col[need]) { console.error(`Missing required column: ${need}`); process.exit(1); }
}

const seen = new Set();
const records = [];
ws.eachRow((row, rn) => {
  if (rn === 1) return;
  const get = (k) => (col[k] ? cellStr(row.getCell(col[k]).value) : null);
  const name = get("name");
  const regonRaw = get("regon");
  if (!name && !regonRaw) return; // blank row
  const regonNormalized = normalizeRegon(regonRaw || "");
  const id = createHash("sha1").update(`${regonNormalized}|${name ?? ""}`).digest("hex").slice(0, 24);
  if (seen.has(id)) return; // de-dup within the file
  seen.add(id);
  const studentCount = Number.parseInt(digitsOnly(get("studentCount") || ""), 10);
  records.push({
    id,
    regonRaw: regonRaw ?? "",
    regonNormalized,
    type: get("type"),
    name: name ?? "",
    voivodeship: get("voivodeship"),
    county: get("county"),
    commune: get("commune"),
    city: get("city"),
    localityType: get("localityType"),
    street: get("street"),
    buildingNumber: get("buildingNumber"),
    apartmentNumber: get("apartmentNumber"),
    postalCode: get("postalCode"),
    postOffice: get("postOffice"),
    phone: get("phone"),
    email: get("email"),
    website: get("website"),
    publicStatus: get("publicStatus"),
    studentCount: Number.isNaN(studentCount) ? null : studentCount,
  });
});
console.log(`Parsed ${records.length} unique records.`);

const db = new PrismaClient();
try {
  if (wipe) {
    const del = await db.schoolRecord.deleteMany({});
    console.log(`Wiped ${del.count} existing records.`);
  }
  let inserted = 0;
  const BATCH = 1000;
  for (let i = 0; i < records.length; i += BATCH) {
    const res = await db.schoolRecord.createMany({
      data: records.slice(i, i + BATCH),
      skipDuplicates: true,
    });
    inserted += res.count;
    process.stdout.write(`\r  inserted ${inserted} / ${records.length}`);
  }
  console.log(`\n✓ Import done. Inserted ${inserted}, skipped ${records.length - inserted} (already present).`);
  const total = await db.schoolRecord.count();
  console.log(`SchoolRecord rows now: ${total}`);
} catch (e) {
  console.error("\nImport failed:", e.message);
  process.exit(1);
} finally {
  await db.$disconnect();
}
