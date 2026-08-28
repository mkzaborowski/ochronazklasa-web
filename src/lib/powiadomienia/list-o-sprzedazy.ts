/**
 * Treść listu do agenta o nowej sprzedaży z jego kodu.
 *
 * HTML pisany pod klienty pocztowe, a nie pod przeglądarkę: układ na tabelach,
 * style w atrybutach `style`, żadnego flexboksa ani arkusza w <head>. Outlook
 * renderuje pocztę silnikiem Worda i wszystko poza tym po prostu ignoruje.
 *
 * Wersja tekstowa nie jest formalnością — trafia do podglądu w skrzynce i do
 * czytników ekranu, a część agentów ma wyłączone obrazki i HTML.
 */

export interface DaneListu {
  agent: string;
  kod: string;
  wariant: string;
  skladkaZl: number;
  ubezpieczeni: string[];
  oplacajacy: string;
  dataStartu: string;
  numerCertyfikatu: string | null;
  linkPortalu: string;
}

const GRANAT = "#1a2a4a";
const BLEKIT = "#8fabe3";
const TLO = "#f1f5fb";
const RAMKA = "#e2e9f6";
const SZARY = "#5a6b85";

const zl = (kwota: number) =>
  `${kwota.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`;

const bezpieczny = (s: string) =>
  s.replace(/[&<>"']/g, (z) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[z] ?? z,
  );

export const temat = (d: DaneListu) =>
  `Nowa sprzedaż z Twojego kodu ${d.kod} — ${zl(d.skladkaZl)}`;

export function trescTekstowa(d: DaneListu): string {
  return [
    `Cześć ${d.agent},`,
    "",
    `ktoś właśnie kupił ubezpieczenie z Twojego kodu opiekuna ${d.kod}.`,
    "",
    `Wariant:        ${d.wariant}`,
    `Składka:        ${zl(d.skladkaZl)}`,
    `Ubezpieczeni:   ${d.ubezpieczeni.join(", ") || "—"}`,
    `Opłacający:     ${d.oplacajacy}`,
    `Ochrona od:     ${d.dataStartu}`,
    // null, nie "" — puste ciągi to celowe odstępy między akapitami
    d.numerCertyfikatu ? `Certyfikat:     ${d.numerCertyfikatu}` : null,
    "",
    `Wszystkie swoje polisy i sprzedaż online widzisz w panelu: ${d.linkPortalu}`,
    "",
    "Powiadomienia możesz wyłączyć w panelu, na swojej karcie.",
    "",
    "Ochrona z Klasą",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

const wiersz = (etykieta: string, wartosc: string) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${RAMKA};color:${SZARY};font-size:14px;white-space:nowrap">${bezpieczny(etykieta)}</td>
        <td style="padding:10px 0 10px 16px;border-bottom:1px solid ${RAMKA};color:${GRANAT};font-size:14px;font-weight:600;text-align:right">${bezpieczny(wartosc)}</td>
      </tr>`;

export function trescHtml(d: DaneListu): string {
  const ubezpieczeni = d.ubezpieczeni.length ? d.ubezpieczeni.join(", ") : "—";
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${bezpieczny(temat(d))}</title></head>
<body style="margin:0;padding:0;background:${TLO};-webkit-font-smoothing:antialiased">
<!-- podgląd w skrzynce: pierwsze zdanie listy wiadomości -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Sprzedaż z kodu ${bezpieczny(d.kod)} na ${zl(d.skladkaZl)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${TLO};padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px -20px rgba(26,42,74,.4);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">

      <tr><td style="background:${GRANAT};padding:28px 32px">
        <div style="color:${BLEKIT};font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700">Ochrona z Klasą</div>
        <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:6px;line-height:1.3">Nowa sprzedaż z Twojego kodu</div>
      </td></tr>

      <tr><td style="padding:28px 32px 8px">
        <p style="margin:0 0 18px;color:${GRANAT};font-size:16px;line-height:1.6">
          Cześć ${bezpieczny(d.agent)}, ktoś właśnie kupił ubezpieczenie z Twojego kodu opiekuna <strong style="background:${TLO};border-radius:6px;padding:2px 8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${bezpieczny(d.kod)}</strong>.
        </p>
      </td></tr>

      <tr><td style="padding:0 32px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${TLO};border-radius:12px;padding:4px 20px">
          <tr><td style="padding:18px 0 4px">
            <div style="color:${SZARY};font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700">Składka</div>
            <div style="color:${GRANAT};font-size:32px;font-weight:700;letter-spacing:-.5px">${zl(d.skladkaZl)}</div>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:20px 32px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${wiersz("Wariant", d.wariant)}
          ${wiersz("Ubezpieczeni", ubezpieczeni)}
          ${wiersz("Opłacający", d.oplacajacy)}
          ${wiersz("Ochrona od", d.dataStartu)}
          ${d.numerCertyfikatu ? wiersz("Certyfikat", d.numerCertyfikatu) : ""}
        </table>
      </td></tr>

      <tr><td style="padding:26px 32px 8px" align="center">
        <a href="${bezpieczny(d.linkPortalu)}" style="display:inline-block;background:${GRANAT};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px">Zobacz w panelu</a>
      </td></tr>

      <tr><td style="padding:18px 32px 30px">
        <p style="margin:0;color:${SZARY};font-size:13px;line-height:1.6;text-align:center">
          Wszystkie swoje szkoły, polisy i sprzedaż online masz na swojej karcie w panelu.<br>
          Powiadomienia możesz tam wyłączyć w każdej chwili.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}
