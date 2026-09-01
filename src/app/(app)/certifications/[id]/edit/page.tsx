import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { CertificationForm } from "../../certification-form";

export default async function EditCertificationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY"].includes(session.user.role)) {
    redirect("/");
  }
  const { id } = await params;
  const dict = getDictionary(await resolveLocale()).certifications;

  const certification = await prisma.certification.findUnique({ where: { id } });
  if (!certification) notFound();

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.editCertification}</h1>
      <div className="mt-6 max-w-xl">
        <Card>
          <CertificationForm certification={certification} />
        </Card>
      </div>
    </div>
  );
}
