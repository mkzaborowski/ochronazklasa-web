/**
 * Podsumowanie założonych kont — list do biura, nie do agenta.
 *
 * Powstaje przy zakładaniu kont partiami: ktoś przysyła listę ludzi, panel
 * zakłada im karty i konta, a biuro dostaje jedną wiadomość z kompletem
 * danych zamiast odtwarzać je z czterech osobnych maili powitalnych.
 *
 * ZAWIERA HASŁA, bo po to powstaje: biuro musi móc podać je przez telefon,
 * gdy komuś list powitalny zginie w spamie. To jedyny powód — i dlatego
 * trafia tylko na adres administratora, nigdy do agenta.
 *
 * HTML pod klienty pocztowe: układ na tabelach, style w atrybutach, paleta
 * jak w pozostałych listach z panelu.
 */

export interface KontoWPodsumowaniu {
  agent: string;
  kod: string;
  login: string;
  haslo: string;
  telefon: string | null;
  nowaKarta: boolean;
  linkPolecajacy: string;
  /** czy list powitalny do tej osoby faktycznie wyszedł */
  powitanieWyslane: boolean;
}

export interface DanePodsumowania {
  konta: KontoWPodsumowaniu[];
  linkPanelu: string;
}

const GRANAT = "#1a2a4a";
const BLEKIT = "#8fabe3";
const TLO = "#f1f5fb";
const RAMKA = "#e2e9f6";
const SZARY = "#5a6b85";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

const bezpieczny = (s: string) =>
  s.replace(/[&<>"']/g, (z) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[z] ?? z,
  );

export const temat = (d: DanePodsumowania) =>
  `Założone konta agentów (${d.konta.length}) — dane do logowania`;

export function trescTekstowa(d: DanePodsumowania): string {
  const linie = d.konta.flatMap((k) => [
    `${k.agent}  [${k.nowaKarta ? "nowa karta" : "karta już była"}]`,
    `  Kod:      ${k.kod}`,
    `  Login:    ${k.login}`,
    `  Hasło:    ${k.haslo}`,
    `  Telefon:  ${k.telefon ?? "—"}`,
    `  Link:     ${k.linkPolecajacy}`,
    `  List powitalny: ${k.powitanieWyslane ? "wysłany" : "NIE WYSŁANY"}`,
    "",
  ]);
  return [
    `Założone konta: ${d.konta.length}.`,
    `Panel: ${d.linkPanelu}`,
    "",
    ...linie,
    "Hasła nadał panel przy zakładaniu kont. Agenci nie mogą ich dziś sami",
    "zmienić — panel nie ma jeszcze ekranu zmiany hasła.",
    "",
    "Ochrona z Klasą",
  ].join("\n");
}

const komorka = (tresc: string, opcje: { mono?: boolean; szer?: string } = {}) =>
  `<td style="padding:9px 10px;border-bottom:1px solid ${RAMKA};font-size:13px;color:${GRANAT};${
    opcje.mono ? `font-family:${MONO};word-break:break-all;` : ""
  }${opcje.szer ? `width:${opcje.szer};` : ""}">${tresc}</td>`;

export function trescHtml(d: DanePodsumowania): string {
  const wiersze = d.konta
    .map(
      (k) => `
      <tr>
        ${komorka(
          `<strong>${bezpieczny(k.agent)}</strong><br>` +
            `<span style="color:${SZARY};font-size:12px">${
              k.nowaKarta ? "nowa karta" : "karta już była"
            }${k.telefon ? ` · ${bezpieczny(k.telefon)}` : ""}${
              k.powitanieWyslane ? "" : ' · <strong style="color:#b45309">list NIE wysłany</strong>'
            }</span>`,
        )}
        ${komorka(bezpieczny(k.kod), { mono: true })}
        ${komorka(bezpieczny(k.login), { mono: true })}
        ${komorka(`<strong>${bezpieczny(k.haslo)}</strong>`, { mono: true })}
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${bezpieczny(temat(d))}</title></head>
<body style="margin:0;padding:0;background:${TLO};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Dane do logowania ${d.konta.length} nowych agentów.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${TLO};padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px -20px rgba(26,42,74,.4);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">

      <tr><td style="background:${GRANAT};padding:28px 32px">
        <div style="color:${BLEKIT};font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700">Ochrona z Klasą — panel</div>
        <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:6px;line-height:1.3">Założone konta agentów</div>
      </td></tr>

      <tr><td style="padding:26px 32px 10px">
        <p style="margin:0;color:${GRANAT};font-size:15px;line-height:1.6">
          Konta są gotowe — ${d.konta.length === 1 ? "jedno" : `${d.konta.length}`}. Każda z tych osób dostała własny list
          powitalny z tymi samymi danymi. Poniżej komplet, gdyby trzeba było podać je przez telefon.
        </p>
      </td></tr>

      <tr><td style="padding:12px 24px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          <tr>
            <th align="left" style="padding:6px 10px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${SZARY};border-bottom:2px solid ${RAMKA}">Agent</th>
            <th align="left" style="padding:6px 10px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${SZARY};border-bottom:2px solid ${RAMKA}">Kod</th>
            <th align="left" style="padding:6px 10px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${SZARY};border-bottom:2px solid ${RAMKA}">Login</th>
            <th align="left" style="padding:6px 10px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${SZARY};border-bottom:2px solid ${RAMKA}">Hasło</th>
          </tr>
          ${wiersze}
        </table>
      </td></tr>

      <tr><td style="padding:22px 32px 0" align="center">
        <a href="${bezpieczny(d.linkPanelu)}" style="display:inline-block;background:${GRANAT};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 30px;border-radius:10px">Otwórz panel</a>
      </td></tr>

      <tr><td style="padding:18px 32px 30px">
        <p style="margin:0;color:${SZARY};font-size:12px;line-height:1.6;text-align:center">
          Hasła nadał panel przy zakładaniu kont. Agenci nie mogą ich dziś sami zmienić —
          panel nie ma jeszcze ekranu zmiany hasła.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}
