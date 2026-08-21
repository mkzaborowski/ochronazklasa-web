import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { pobierzCertyfikat, pobierzWniosek } from "@/lib/online-api";

/** Pobranie certyfikatu przez panel - token API zostaje po stronie serwera. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nieautoryzowany", { status: 401 });

  const { id } = await params;
  try {
    const [wniosek, pdf] = await Promise.all([pobierzWniosek(id), pobierzCertyfikat(id)]);
    // Przy kilkorgu dzieci numerów jest kilka - do nazwy pliku bierzemy pierwszy,
    // bo cała lista dałaby nazwę nie do odczytania.
    const numery = (wniosek.numerCertyfikatu ?? id).split(", ");
    const nazwa =
      numery.length > 1
        ? `Certyfikaty ${numery[0].replaceAll("/", "-")} i inne.pdf`
        : `Certyfikat ${numery[0].replaceAll("/", "-")}.pdf`;
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nazwa}"`,
      },
    });
  } catch (error) {
    return new NextResponse(String(error instanceof Error ? error.message : error), { status: 502 });
  }
}
