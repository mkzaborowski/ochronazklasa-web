import QRCode from "qrcode";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { linkPolecajacy, normalizujKod } from "@/lib/agents/kod";

/**
 * Kod QR z linkiem polecającym agenta.
 *
 * Po co, skoro link można skopiować: agent stoi na zebraniu z rodzicami albo
 * zostawia ulotkę w sekretariacie. Rodzic z telefonem w ręce zeskanuje kod,
 * a przepisywanie „ochronazklasa.pl/kup-ubezpieczenie?a=KBAZUN" z kartki kończy
 * się literówką i sprzedażą nieprzypisaną do nikogo — czyli dokładnie tym,
 * czemu linki polecające miały zapobiec.
 *
 * PNG idzie do prezentacji i wiadomości, SVG (?format=svg) do druku — na ulotce
 * rastrowy kod w powiększeniu rozłazi się na piksele i skaner się gubi.
 *
 * Korekcja błędów "M": kod naklejony na ulotkę bywa zagięty albo poplamiony,
 * a "M" wybacza ok. 15% powierzchni. Wyższe poziomy zagęszczają siatkę,
 * co przy druku z ulotki działa przeciwko czytelności.
 */
export async function GET(req: Request, { params }: { params: Promise<{ kod: string }> }) {
  const devBypass =
    process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
  if (!devBypass) {
    const session = await auth();
    if (!session?.user) return new Response("Unauthorized", { status: 401 });
  }

  const { kod: surowy } = await params;
  const kod = normalizujKod(decodeURIComponent(surowy));
  if (!kod) return new Response("Nieprawidłowy kod agenta", { status: 400 });

  // Kod nieistniejącego agenta dałby QR prowadzący do sprzedaży, która nie
  // przypisze się do nikogo - lepiej powiedzieć to wprost niż wydrukować.
  const agent = await db.agent.findFirst({ where: { code: kod }, select: { name: true } });
  if (!agent) return new Response("Nie ma agenta o tym kodzie", { status: 404 });

  const link = linkPolecajacy(kod);
  const svg = new URL(req.url).searchParams.get("format") === "svg";
  const nazwaPliku = `qr-${kod}.${svg ? "svg" : "png"}`;

  const dane = svg
    ? Buffer.from(await QRCode.toString(link, { type: "svg", margin: 2, errorCorrectionLevel: "M" }))
    : await QRCode.toBuffer(link, { type: "png", margin: 2, width: 1024, errorCorrectionLevel: "M" });

  return new Response(new Uint8Array(dane), {
    headers: {
      "Content-Type": svg ? "image/svg+xml" : "image/png",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nazwaPliku)}`,
      // Kod zmienia się tylko razem z kodem agenta, ale nie trzymamy go
      // publicznie w cache - adres zdradzałby, kto u nas pracuje.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
