# Szablony polis InterRisk (DOCX)

Each variant has its own `.docx` template here, named exactly by its variant code
(e.g. `120PLNV40.docx`). The mapping lives in `src/lib/interrisk/variants.ts`.

## How generation works

The app fills **only** these placeholders and leaves everything else (tables,
terms, sums insured, pricing, formatting) untouched:

```
{{ubezpieczajacy_nazwa}}
{{ubezpieczajacy_adres}}
{{ubezpieczajacy_regon_pesel}}
{{ubezpieczajacy_telefon}}
{{ubezpieczajacy_email}}
{{kontakt_nazwa}}
{{kontakt_telefon}}
{{kontakt_email}}
{{okres_ubezpieczenia}}
{{numer_polisy}}            ← last 6 digits of the assigned bank account
{{numer_konta_bankowego}}  ← full assigned bank account number
```

## Current templates = the real InterRisk documents

The 13 `.docx` files here are the **real InterRisk EDU PLUS templates**, with the
placeholders above inserted into the policyholder / contact / period / policy
number / bank-account spots (all other content — tables, sums, terms — untouched).

They were produced from the originals by `scripts/build-real-templates.mjs`
(maps each source file to its variant code and swaps example data for
placeholders). All 13 were verified to render with zero leftover placeholders and
no leftover example data.

### Re-running the conversion (if you get updated originals)

1. Put the new source `.docx` files in `~/Downloads/files` (or pass a dir).
2. Check/adjust the filename→variant `MAP` in `scripts/build-real-templates.mjs`.
3. `node scripts/build-real-templates.mjs`
4. Spot-check by opening a couple of the generated files in Word.

To hand-edit instead: type each placeholder in one go so Word keeps it in a single
text run, then save as `<VARIANTCODE>.docx` here.
