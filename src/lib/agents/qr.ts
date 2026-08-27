import QRCode from "qrcode";
import { linkPolecajacy } from "./kod";

/**
 * Kod QR linku polecającego jako SVG do wstawienia wprost w stronę.
 *
 * Rysujemy po stronie serwera i wstawiamy w HTML zamiast pokazywać <img> na
 * trasę pobierania: ta trasa oddaje plik z nagłówkiem `attachment`, więc
 * przeglądarki potrafią zamiast wyświetlić go pobrać. Poza tym kod jest wtedy
 * na ekranie od razu, bez drugiego żądania.
 *
 * Wynik jest bezpieczny do wstawienia: powstaje z naszego linku zbudowanego
 * z kodu przepuszczonego przez `normalizujKod`, a nie z tekstu od użytkownika.
 */
export async function qrSvgAgenta(kod: string): Promise<string> {
  return QRCode.toString(linkPolecajacy(kod), {
    type: "svg",
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}
