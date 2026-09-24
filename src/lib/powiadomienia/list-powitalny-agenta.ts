/**
 * List powitalny dla nowego agenta — dane do logowania i jego kod opiekuna.
 *
 * HTML pisany pod klienty pocztowe, a nie pod przeglądarkę: układ na tabelach,
 * style w atrybutach `style`, żadnego flexboksa ani arkusza w <head>. Outlook
 * renderuje pocztę silnikiem Worda i wszystko poza tym po prostu ignoruje.
 * Paleta i proporcje jak w `list-o-sprzedazy.ts` — agent dostaje oba listy
 * i mają wyglądać jak z jednego miejsca.
 *
 * HASŁO IDZIE W TREŚCI, świadomie. Zwykle rozdziela się je od loginu, ale tu
 * konto zakłada biuro dla konkretnej osoby, hasło jest jednorazowo nadane i bez
 * niego pierwszy list byłby bezużyteczny — agent i tak musiałby po nie zadzwonić.
 * Dlatego w zamian: wysyłający MUSI je wcześniej zweryfikować (patrz skrypt
 * `wyslij-powitanie-agenta`), żeby nie wysłać komuś hasła, które nie działa.
 */

export interface DanePowitania {
  agent: string;
  /** adres, na który agent się loguje */
  login: string;
  haslo: string;
  kod: string;
  linkPolecajacy: string;
  linkPanelu: string;
  linkQr: string;
  /** czy panel ma już ekran zmiany hasła — zmienia treść akapitu na dole */
  zmianaHaslaMozliwa: boolean;
}

const GRANAT = "#1a2a4a";
const BLEKIT = "#8fabe3";
const TLO = "#f1f5fb";
const RAMKA = "#e2e9f6";
const SZARY = "#5a6b85";
const ZIELEN_TLO = "#ecfdf5";
const ZIELEN_RAMKA = "#a7f3d0";
const ZIELEN_TEKST = "#065f46";

const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

/**
 * Wołacz imienia — „Lena" → „Leno".
 *
 * Reguła celowo WĄSKA: tylko imiona na -a, czyli w praktyce żeńskie, gdzie
 * końcówka -o jest regularna (Lena→Leno, Kamila→Kamilo, Katarzyna→Katarzyno,
 * Lidia→Lidio). Reszta zostaje w mianowniku, bo wołacz męski bywa
 * nieregularny (Rafał→Rafale, Dariusz→Dariuszu) i zła odmiana imienia w
 * pierwszym liście do człowieka wygląda gorzej niż jej brak.
 *
 * Zdrobnień nie ruszamy — w bazie stoją imiona pełne, a to właśnie tam
 * reguła -a→-o się sypie (Ania→Aniu, nie „Anio").
 */
export const wolacz = (imie: string): string =>
  /^[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+a$/.test(imie) ? imie.slice(0, -1) + "o" : imie;

const bezpieczny = (s: string) =>
  s.replace(/[&<>"']/g, (z) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[z] ?? z,
  );

export const temat = (d: DanePowitania) => `Twoje konto w panelu Ochrona z Klasą — kod ${d.kod}`;

export function trescTekstowa(d: DanePowitania): string {
  return [
    `Cześć ${wolacz(d.agent)},`,
    "",
    "zakładamy Ci konto w panelu. Poniżej wszystko, czego potrzebujesz na start.",
    "",
    "LOGOWANIE",
    `Adres:  ${d.linkPanelu}`,
    `Login:  ${d.login}`,
    `Hasło:  ${d.haslo}`,
    "",
    `TWÓJ KOD OPIEKUNA: ${d.kod}`,
    `Link:   ${d.linkPolecajacy}`,
    `Kod QR: ${d.linkQr}`,
    "",
    "Zakup zrobiony z tego linku przypisuje się do Ciebie — także wtedy, gdy",
    "rodzic najpierw poczyta stronę i wróci później (polecenie ważne 30 dni).",
    "Kod działa też bez linku: rodzic może go wpisać w formularzu zakupu,",
    "w kroku z danymi.",
    "",
    "W panelu zobaczysz swój link z kodem QR do wydruku, swoje szkoły",
    "i bieżącą sprzedaż ze swojego kodu. Przypisania szkół robi biuro.",
    "",
    d.zmianaHaslaMozliwa
      ? "Hasło zmienisz w panelu, na swojej karcie."
      : "To hasło nadało biuro przy zakładaniu konta. Panel nie ma jeszcze ekranu zmiany hasła — gdy zechcesz je zmienić, napisz do biura.",
    "",
    "W razie pytań: biuro@ochronazklasa.pl",
    "",
    "Ochrona z Klasą",
  ].join("\n");
}

/**
 * Wiersz tabelki „etykieta → wartość".
 *
 * `mono` dla danych, które ktoś będzie przepisywał — w kroju o stałej
 * szerokości nie da się pomylić zera z literą O ani jedynki z l.
 */
const wiersz = (
  etykieta: string,
  wartosc: string,
  opcje: { mono?: boolean; ostatni?: boolean } = {},
) => {
  const kreska = opcje.ostatni ? "none" : `1px solid ${RAMKA}`;
  const krój = opcje.mono ? `font-family:${MONO};letter-spacing:.2px;word-break:break-all` : "";
  return `
          <tr>
            <td style="padding:11px 0;border-bottom:${kreska};color:${SZARY};font-size:14px;white-space:nowrap">${bezpieczny(etykieta)}</td>
            <td style="padding:11px 0 11px 16px;border-bottom:${kreska};color:${GRANAT};font-size:14px;font-weight:600;text-align:right;${krój}">${bezpieczny(wartosc)}</td>
          </tr>`;
};

export function trescHtml(d: DanePowitania): string {
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${bezpieczny(temat(d))}</title></head>
<body style="margin:0;padding:0;background:${TLO};-webkit-font-smoothing:antialiased">
<!-- podgląd w skrzynce: pierwsze zdanie listy wiadomości -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Dane do logowania i Twój kod opiekuna ${bezpieczny(d.kod)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${TLO};padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px -20px rgba(26,42,74,.4);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">

      <tr><td style="background:${GRANAT};padding:28px 32px">
        <div style="color:${BLEKIT};font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700">Ochrona z Klasą — panel</div>
        <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:6px;line-height:1.3">Twoje konto jest gotowe</div>
      </td></tr>

      <tr><td style="padding:28px 32px 4px">
        <p style="margin:0;color:${GRANAT};font-size:16px;line-height:1.6">
          Cześć ${bezpieczny(wolacz(d.agent))}, witamy w zespole. Poniżej wszystko, czego potrzebujesz na start.
        </p>
      </td></tr>

      <tr><td style="padding:22px 32px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${wiersz("Adres", d.linkPanelu.replace(/^https?:\/\//, ""), { mono: true })}
          ${wiersz("Login", d.login, { mono: true })}
          ${wiersz("Hasło", d.haslo, { mono: true })}
          ${wiersz("Rola", "AGENT", { ostatni: true })}
        </table>
      </td></tr>

      <tr><td style="padding:18px 32px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ZIELEN_TLO};border:1px solid ${ZIELEN_RAMKA};border-radius:12px">
          <tr><td style="padding:14px 18px;color:${ZIELEN_TEKST};font-size:13px;line-height:1.55">
            Hasło <strong>sprawdzone przed wysłaniem</strong> — logowanie tymi danymi kończy się na Twojej karcie w panelu.
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:26px 32px 0">
        <div style="color:${GRANAT};font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase">Kod opiekuna</div>
      </td></tr>

      <tr><td style="padding:12px 32px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${TLO};border-radius:12px">
          <tr><td align="center" style="padding:22px 18px 20px">
            <div style="color:${GRANAT};font-size:30px;font-weight:700;font-family:${MONO};letter-spacing:2px">${bezpieczny(d.kod)}</div>
            <div style="margin-top:12px">
              <a href="${bezpieczny(d.linkPolecajacy)}" style="color:${GRANAT};font-size:13px;text-decoration:underline;word-break:break-all">${bezpieczny(d.linkPolecajacy)}</a>
            </div>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:14px 32px 0">
        <p style="margin:0;color:${SZARY};font-size:13px;line-height:1.6">
          Kod QR do wydruku: <a href="${bezpieczny(d.linkQr)}" style="color:${GRANAT};text-decoration:underline;word-break:break-all">${bezpieczny(d.linkQr.replace(/^https?:\/\//, ""))}</a>
        </p>
      </td></tr>

      <tr><td style="padding:18px 32px 0">
        <p style="margin:0;color:${GRANAT};font-size:14px;line-height:1.65">
          Zakup zrobiony z Twojego linku przypisuje się do Ciebie — także wtedy, gdy rodzic najpierw poczyta stronę i wróci później (polecenie ważne 30 dni). Kod działa też bez linku: rodzic może go wpisać w formularzu zakupu, w kroku z danymi.
        </p>
      </td></tr>

      <tr><td style="padding:26px 32px 8px" align="center">
        <a href="${bezpieczny(d.linkPanelu)}" style="display:inline-block;background:${GRANAT};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px">Zaloguj się do panelu</a>
      </td></tr>

      <tr><td style="padding:18px 32px 30px">
        <p style="margin:0;color:${SZARY};font-size:13px;line-height:1.6;text-align:center">
          W panelu masz swój link z kodem QR, swoje szkoły i bieżącą sprzedaż ze swojego kodu. Przypisania szkół robi biuro.<br><br>
          ${
            d.zmianaHaslaMozliwa
              ? "Hasło zmienisz w panelu, na swojej karcie."
              : "To hasło nadało biuro przy zakładaniu konta. Panel nie ma jeszcze ekranu zmiany hasła — gdy zechcesz je zmienić, napisz do biura."
          }<br><br>
          W razie pytań: <a href="mailto:biuro@ochronazklasa.pl" style="color:${GRANAT};text-decoration:underline">biuro@ochronazklasa.pl</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}
