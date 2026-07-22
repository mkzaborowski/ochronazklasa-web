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
    const nazwa = `Certyfikat ${(wniosek.numerCertyfikatu ?? id).replaceAll("/", "-")}.pdf`;
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
