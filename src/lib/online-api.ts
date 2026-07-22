/**
 * Klient API sprzedaży online (ochronazklasa-api).
 * Wywołania idą z serwera Next.js po wewnętrznej sieci dockerowej `edge`,
 * więc token nigdy nie trafia do przeglądarki.
 */
const BAZA = process.env.OZK_API_URL ?? "http://ozk-api:4000";
const TOKEN = process.env.OZK_API_TOKEN ?? "";

export type StatusWniosku =
  | "oczekuje_na_platnosc"
  | "oplacony"
  | "certyfikat_wyslany"
  | "blad_wysylki";

export interface WniosekSkrot {
  id: string;
  utworzono: string;
  status: StatusWniosku;
  numerCertyfikatu: string | null;
  certyfikatDostepny: boolean;
  kwotaZl: number;
  wariant: { id: string; skladka: number | null };
  dataStartu: string;
  koniecOchrony: string;
  oplacajacy: { imie: string; nazwisko: string; email: string; telefon: string };
  ubezpieczeni: { imie: string; nazwisko: string; placowka: string }[];
  blad: string | null;
}

export interface Statystyki {
  wszystkie: number;
  oplacone: number;
  certyfikaty: number;
  przychodZl: number;
  dzieci: number;
}

export interface WniosekPelny extends WniosekSkrot {
  p24OrderId: number | null;
  certyfikatWyslanyAt: string | null;
  wariantPelny: {
    id: string;
    skladka: number;
    sumaUbezpieczenia: number;
    swiadczenieZa1Procent: number;
  } | null;
  oplacajacyPelny: Record<string, unknown> & {
    imie: string;
    nazwisko: string;
    email: string;
    telefon: string;
    miejscowosc: string;
    kodPocztowy: string;
    ulica: string;
    nrDomu: string;
    nrLokalu: string;
    identyfikacja: { typ: string; pesel: string; dataUrodzenia: string };
  };
  ubezpieczeniPelni: {
    imie: string;
    nazwisko: string;
    nazwaPlacowki: string;
    nrPlacowki: string;
    miejscowoscPlacowki: string;
    identyfikacja: { typ: string; pesel: string; dataUrodzenia: string };
  }[];
  zgody: Record<string, boolean>;
  apkZaliczona: boolean;
}

export interface StanSystemu {
  trybPlatnosci: "mock" | "p24";
  p24Sandbox: boolean;
  smtp: { ok: boolean; komunikat: string };
  umowaGrupowa: string;
  wystawioneCertyfikaty: number;
  sprzedazOnline: boolean;
}

const zapytaj = async <T>(sciezka: string, init?: RequestInit): Promise<T> => {
  const odpowiedz = await fetch(`${BAZA}${sciezka}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!odpowiedz.ok) {
    const tresc = await odpowiedz.text().catch(() => "");
    throw new Error(`API sprzedaży online: ${odpowiedz.status} ${tresc.slice(0, 200)}`);
  }
  return odpowiedz.json() as Promise<T>;
};

export const pobierzWnioski = (filtry: { status?: string; szukaj?: string } = {}) => {
  const p = new URLSearchParams();
  if (filtry.status) p.set("status", filtry.status);
  if (filtry.szukaj) p.set("szukaj", filtry.szukaj);
  const qs = p.toString();
  return zapytaj<{ statystyki: Statystyki; wnioski: WniosekSkrot[] }>(
    `/api/admin/applications${qs ? `?${qs}` : ""}`,
  );
};

export const pobierzWniosek = (id: string) =>
  zapytaj<WniosekPelny>(`/api/admin/applications/${encodeURIComponent(id)}`);

export const pobierzStanSystemu = () => zapytaj<StanSystemu>("/api/admin/status");

export const wyslijPonownie = (id: string) =>
  zapytaj<{ ok: boolean; komunikat: string }>(
    `/api/admin/applications/${encodeURIComponent(id)}/resend`,
    { method: "POST" },
  );

export const ponowRealizacje = (id: string) =>
  zapytaj<{ ok: boolean; komunikat: string }>(
    `/api/admin/applications/${encodeURIComponent(id)}/retry`,
    { method: "POST" },
  );

export const pobierzCertyfikat = async (id: string): Promise<ArrayBuffer> => {
  const odpowiedz = await fetch(
    `${BAZA}/api/admin/applications/${encodeURIComponent(id)}/certificate`,
    { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" },
  );
  if (!odpowiedz.ok) throw new Error(`Nie udało się pobrać certyfikatu (${odpowiedz.status})`);
  return odpowiedz.arrayBuffer();
};

export const ETYKIETY_STATUSU: Record<StatusWniosku, string> = {
  oczekuje_na_platnosc: "Oczekuje na płatność",
  oplacony: "Opłacony",
  certyfikat_wyslany: "Certyfikat wystawiony",
  blad_wysylki: "Błąd realizacji",
};

export const KLASA_STATUSU: Record<StatusWniosku, string> = {
  oczekuje_na_platnosc: "bg-amber-100 text-amber-800",
  oplacony: "bg-blue-100 text-blue-800",
  certyfikat_wyslany: "bg-emerald-100 text-emerald-800",
  blad_wysylki: "bg-red-100 text-red-800",
};
