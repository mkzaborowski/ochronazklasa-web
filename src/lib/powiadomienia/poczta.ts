/**
 * Klient wspólnej usługi pocztowej — ten sam, z którego korzysta sprzedaż
 * online przy wysyłce certyfikatów.
 *
 * Adres domyślny wskazuje nazwę kontenera w sieci `edge`, więc ruch nie
 * wychodzi na zewnątrz ani nie zależy od publicznego DNS-u.
 */

const URL_POCZTY = (process.env.POCZTA_URL ?? "http://poczta:8091").replace(/\/$/, "");
const KLUCZ = process.env.POCZTA_KLUCZ ?? "";

export const pocztaSkonfigurowana = (): boolean => Boolean(KLUCZ);

/**
 * Wrzuca list do kolejki usługi.
 *
 * `kluczIdempotencji` chroni przed drugą wysyłką tego samego powiadomienia,
 * gdyby zadanie uruchomiło się dwa razy albo przerwało w połowie.
 */
export async function wyslijList(opcje: {
  do: string;
  temat: string;
  tresc: string;
  trescHtml?: string;
  kluczIdempotencji?: string;
}): Promise<void> {
  if (!KLUCZ) throw new Error("POCZTA_KLUCZ nieustawiony — nie ma czym wysłać");

  const odpowiedz = await fetch(`${URL_POCZTY}/api/wyslij`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KLUCZ}` },
    body: JSON.stringify({
      do: opcje.do,
      temat: opcje.temat,
      tresc: opcje.tresc,
      tresc_html: opcje.trescHtml,
      klucz: opcje.kluczIdempotencji,
      zalaczniki: [],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!odpowiedz.ok) {
    throw new Error(`usługa pocztowa: ${odpowiedz.status} ${(await odpowiedz.text()).slice(0, 200)}`);
  }
}
