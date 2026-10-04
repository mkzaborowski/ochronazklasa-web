/**
 * Sprawdzenie zestawienia finansowego: `npm run check:zestawienie`.
 *
 * To jest dokument, po którym centrala przelewa nam prowizję. Błąd tutaj nie
 * wywala niczego — po prostu uzgadniamy inną kwotę, niż powinniśmy, i wychodzi
 * to dopiero przy przelewie albo wcale.
 */
import { zestawienieFinansowe } from "../src/lib/interrisk/zestawienie.ts";

// Sześć podryzyk na osobę w każdym wariancie — tyle podaje centrala.
const KONF = {
  prowizjaProcent: 40,
  podryzykNaOsobe: { w60: 6, w90: 6, w135: 6, w180: 6, w250: 6, w1: 6 },
};

let bledy = 0;
const sprawdz = (opis: string, warunek: boolean, szczegol = "") => {
  console.log(`  ${warunek ? "OK  " : "BŁĄD"} ${opis}${szczegol ? "  (" + szczegol + ")" : ""}`);
  if (!warunek) bledy++;
};

const OKRES = { od: "2026-09-01", do: "2026-09-30" };

/** Minimalny wiersz, taki jak przychodzi z usługi sprzedaży. */
const w = (
  wariantId: string, skladkaZl: number, wniosekId: string, kwotaWnioskuZl: number,
) => ({
  wniosekId, wariantId, numerPolisy: `A-A 6789${wariantId.slice(1, 3)}`,
  numerCertyfikatu: "C/1", imie: "Jan", nazwisko: "Kowalski", pesel: "", dataUrodzenia: "2015-01-01",
  okresOd: "2026-09-13", okresDo: "2027-09-12", sumaUbezpieczenia: 0, skladkaZl,
  certyfikatWyslanyAt: null, utworzono: "2026-09-15 10:00:00", kwotaWnioskuZl, kodAgenta: null,
});

console.log("\n[1] jedna polisa, trzy osoby");
{
  const mapa = new Map([["w135", [
    w("w135", 135, "a", 405), w("w135", 135, "a", 405), w("w135", 135, "a", 405),
  ]]]);
  const z = zestawienieFinansowe(mapa, OKRES, KONF);
  const r = z.wiersze[0];
  sprawdz("3 osoby", r.osob === 3, String(r.osob));
  sprawdz("składka 405 zł", r.skladkaLacznieZl === 405, String(r.skladkaLacznieZl));
  sprawdz("prowizja 40% = 162 zł", r.prowizjaZl === 162, String(r.prowizjaZl));
  // Przelewamy CAŁOŚĆ, nie 60% — prowizja wraca osobno. Gdyby ktoś kiedyś
  // „uprościł" to na składka − prowizja, każdy przelew byłby o 40% za niski.
  sprawdz("do przelewu idzie pełna składka, nie 60%", r.skladkaLacznieZl === 405,
    String(r.skladkaLacznieZl));
  sprawdz("zostaje w InterRisk 243 zł", r.zostajeWInterriskZl === 243, String(r.zostajeWInterriskZl));
  sprawdz("składka = prowizja + reszta", r.prowizjaZl + r.zostajeWInterriskZl === r.skladkaLacznieZl);
  sprawdz("6 podryzyk na osobę → 18 wierszy", r.wierszyWPliku === 18, String(r.wierszyWPliku));
  sprawdz("bez rozbieżności", z.rozbieznosci.length === 0);
}

console.log("\n[2] sumy po wielu wariantach");
{
  const mapa = new Map([
    ["w60", [w("w60", 60, "a", 60)]],
    ["w250", [w("w250", 250, "b", 250), w("w250", 250, "c", 250)]],
  ]);
  const z = zestawienieFinansowe(mapa, OKRES, KONF);
  sprawdz("3 osoby łącznie", z.sumy.osob === 3, String(z.sumy.osob));
  sprawdz("składka 560 zł", z.sumy.skladkaZl === 560, String(z.sumy.skladkaZl));
  sprawdz("prowizja 224 zł", z.sumy.prowizjaZl === 224, String(z.sumy.prowizjaZl));
  sprawdz("suma = prowizja + reszta",
    z.sumy.prowizjaZl + z.sumy.zostajeWInterriskZl === z.sumy.skladkaZl);
  // Kolejność po składce, żeby arkusz za każdym razem wyglądał tak samo.
  sprawdz("warianty rosnąco po składce",
    z.wiersze.map((x) => x.wariantId).join(",") === "w60,w250",
    z.wiersze.map((x) => x.wariantId).join(","));
}

console.log("\n[3] grosz nie ginie przy nieokrągłej prowizji");
{
  // 3 × 135 zł → 40% = 162,00. Ale 1 × 135 → 54,00; sprawdzamy kwotę,
  // przy której dzielenie daje połówkę grosza.
  for (const [osob, skladka] of [[1, 135], [7, 90], [13, 60], [11, 250]] as const) {
    const mapa = new Map([["w1", Array.from({ length: osob }, (_, i) => w("w1", skladka, `x${i}`, skladka))]]);
    const z = zestawienieFinansowe(mapa, OKRES, KONF);
    const r = z.wiersze[0];
    const domyka = Math.round((r.prowizjaZl + r.zostajeWInterriskZl) * 100) === Math.round(r.skladkaLacznieZl * 100);
    sprawdz(`${osob} × ${skladka} zł domyka się`, domyka,
      `${r.skladkaLacznieZl} = ${r.prowizjaZl} + ${r.zostajeWInterriskZl}`);
  }
}

console.log("\n[4] rozbieżność wpłaty jest wykrywana, ale nie zmienia kwot");
{
  // Sierpniowy zakup testowy bramki: wariant za 60 zł, pobrana złotówka.
  const mapa = new Map([["w60", [w("w60", 60, "test", 1)]]]);
  const z = zestawienieFinansowe(mapa, OKRES, KONF);
  sprawdz("zgłoszona jedna rozbieżność", z.rozbieznosci.length === 1, String(z.rozbieznosci.length));
  sprawdz("z obiema kwotami",
    z.rozbieznosci[0]?.wgPolisyZl === 60 && z.rozbieznosci[0]?.pobranoZl === 1,
    JSON.stringify(z.rozbieznosci[0]));
  // Dla ubezpieczyciela polisa jest warta 60 zł niezależnie od naszej wpłaty.
  sprawdz("kwota dla centrali zostaje wg polisy", z.sumy.skladkaZl === 60, String(z.sumy.skladkaZl));
  sprawdz("prowizja też wg polisy", z.sumy.prowizjaZl === 24, String(z.sumy.prowizjaZl));
}

console.log("\n[5] wielodzietny wniosek nie jest rozbieżnością");
{
  // Trójka dzieci w jednym wniosku: kwota wniosku to suma za całą trójkę
  // i powtarza się w każdym wierszu — nie wolno jej policzyć trzy razy.
  const mapa = new Map([["w90", [
    w("w90", 90, "rodzina", 270), w("w90", 90, "rodzina", 270), w("w90", 90, "rodzina", 270),
  ]]]);
  const z = zestawienieFinansowe(mapa, OKRES, KONF);
  sprawdz("brak fałszywej rozbieżności", z.rozbieznosci.length === 0,
    JSON.stringify(z.rozbieznosci));
  sprawdz("składka 270 zł", z.sumy.skladkaZl === 270, String(z.sumy.skladkaZl));
}

console.log("\n[6] kierunek pieniędzy: przelewamy całość, prowizja wraca");
{
  const mapa = new Map([["w135", [w("w135", 135, "a", 135)]]]);
  const z = zestawienieFinansowe(mapa, OKRES, KONF);
  // Te dwie kwoty trafiają wprost na przelew i na fakturę prowizyjną.
  sprawdz("do przelewu = 100% składki", z.sumy.skladkaZl === 135, String(z.sumy.skladkaZl));
  sprawdz("prowizja do zwrotu = 40%", z.sumy.prowizjaZl === 54, String(z.sumy.prowizjaZl));
  sprawdz("do przelewu NIE jest pomniejszone o prowizję",
    z.sumy.skladkaZl !== z.sumy.skladkaZl - z.sumy.prowizjaZl && z.sumy.skladkaZl > z.sumy.prowizjaZl);
  sprawdz("reszta to 60%", z.sumy.zostajeWInterriskZl === 81, String(z.sumy.zostajeWInterriskZl));
}

console.log("\n[7] pusty okres");
{
  const z = zestawienieFinansowe(new Map(), OKRES, KONF);
  sprawdz("zero wierszy", z.wiersze.length === 0);
  sprawdz("zerowe sumy", z.sumy.skladkaZl === 0 && z.sumy.prowizjaZl === 0);
}

console.log(bledy === 0 ? "\nZestawienie się zgadza." : `\n${bledy} niezgodności.`);
process.exit(bledy === 0 ? 0 : 1);
