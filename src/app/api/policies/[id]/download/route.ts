import { auth } from "@/auth";
import { db } from "@/lib/db";
import { nazwaPlikuPolisy } from "@/lib/interrisk/nazwa-pliku";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // /api is not covered by the proxy guard, so authorize here.
  const devBypass =
    process.env.AUTH_DISABLED === "true" && process.env.NODE_ENV !== "production";
  if (!devBypass) {
    const session = await auth();
    if (!session?.user) return new Response("Unauthorized", { status: 401 });
    // Rola AGENT ma własny portal i nie pobiera dokumentów biura.
    if (session.user.role === "AGENT") return new Response("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const policy = await db.generatedPolicy.findUnique({
    where: { id },
    include: { school: { select: { nazwa: true } } },
  });
  if (!policy) return new Response("Not found", { status: 404 });

  // Nazwę składamy TUTAJ, z danych w bazie, a nie bierzemy zapisanej przy
  // tworzeniu. Dzięki temu polisy wystawione wcześniej - a jest ich
  // kilkadziesiąt - też pobierają się już z nazwą szkoły, bez ruszania bazy.
  const nazwa = nazwaPlikuPolisy({
    szkola: policy.school?.nazwa,
    wariant: policy.variantCode,
    numerPolisy: policy.policyNumber,
  });

  return new Response(new Uint8Array(policy.fileData), {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nazwa)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
