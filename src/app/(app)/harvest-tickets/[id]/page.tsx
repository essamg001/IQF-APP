import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { canSeeFinancials } from "@/lib/roles";
import { ReceiptForm } from "./receipt-form";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary, type Dictionary } from "@/lib/i18n/getDictionary";

type HarvestTicketsDict = Dictionary["harvestTickets"];

function complianceLabel(dict: HarvestTicketsDict): Record<string, string> {
  return {
    GLOBALGAP: dict.complianceGlobalGap,
    SPRING: dict.complianceSpring,
    LEAF: dict.complianceLeaf,
    NURTURE: dict.complianceNurture,
    AH_DL_GROW: dict.complianceAhDlGrow,
    FAIRTRADE: dict.complianceFairtrade,
    ORGANIC_100: dict.complianceOrganic100,
    BIO_SUISSE: dict.complianceBioSuisse,
    OTHER: dict.complianceOtherOption,
  };
}

function Check({ label, ok, dict }: { label: string; ok: boolean | null; dict: HarvestTicketsDict }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      {ok === null ? (
        <span className="text-slate-400">—</span>
      ) : (
        <Badge color={ok ? "green" : "red"}>{ok ? dict.ok : dict.notOk}</Badge>
      )}
    </div>
  );
}

function Presence({
  label,
  present,
  action,
  dict,
}: {
  label: string;
  present: boolean | null;
  action: string | null;
  dict: HarvestTicketsDict;
}) {
  return (
    <div className="flex items-start justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <div className="text-end">
        {present === null ? (
          <span className="text-slate-400">—</span>
        ) : (
          <Badge color={present ? "amber" : "slate"}>{present ? dict.present : dict.none}</Badge>
        )}
        {present && action && <p className="mt-1 text-xs text-slate-500">{action}</p>}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-slate-900">{value ?? "—"}</p>
    </div>
  );
}

export default async function HarvestTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }

  const { id } = await params;
  const canSeeCost = canSeeFinancials(session.user);
  const locale = await resolveLocale();
  const dict = getDictionary(locale).harvestTickets;
  const COMPLIANCE_LABEL = complianceLabel(dict);
  const ticket = await prisma.harvestTicket.findUnique({
    where: { id },
    include: { plotLines: { include: { field: true } } },
  });
  if (!ticket) notFound();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {dict.detailTitlePrefix}
            {ticket.serialNumber}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{dict.detailSubtitle}</p>
        </div>
        {ticket.receivedDate ? (
          <Badge color={ticket.acceptedAtPackhouse ? "green" : "red"}>
            {ticket.acceptedAtPackhouse ? dict.acceptedAtPackhouse : dict.rejectedAtPackhouse}
          </Badge>
        ) : (
          <Badge color="amber">{dict.awaitingReceipt}</Badge>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">{dict.deliveryIdentityTitle}</h2>
          <div className="grid grid-cols-2 gap-3">
            <DetailRow label={dict.ggn} value={ticket.ggn} />
            <DetailRow
              label={dict.complianceLevel}
              value={ticket.complianceLevel ? COMPLIANCE_LABEL[ticket.complianceLevel] : ticket.complianceOther}
            />
            <DetailRow
              label={dict.productType}
              value={
                ticket.productType === "RAW"
                  ? dict.productTypeRaw
                  : ticket.productType === "FINAL"
                    ? dict.productTypeFinal
                    : ticket.productType === "REWORK"
                      ? dict.productTypeRework
                      : ticket.productType
              }
            />
            <DetailRow label={dict.reworkReason} value={ticket.reworkReason} />
          </div>
        </Card>

        <Card className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">{dict.conformityChecklistTitle}</h2>
          <Check label={dict.fruitConformity} ok={ticket.fruitConformityOk} dict={dict} />
          <Check label={dict.fruitSafety} ok={ticket.fruitSafetyOk} dict={dict} />
          <Check label={dict.cratesCleanliness} ok={ticket.cratesCleanlinessOk} dict={dict} />
          <Check label={dict.fieldCleanliness} ok={ticket.fieldCleanlinessOk} dict={dict} />
          <Check label={dict.vehicleCleanliness} ok={ticket.vehicleCleanlinessOk} dict={dict} />
        </Card>

        <Card className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">{dict.presenceChecklistTitle}</h2>
          <Presence label={dict.petsPresent} present={ticket.petsPresent} action={ticket.petsPresentAction} dict={dict} />
          <Presence
            label={dict.animalProductionNearby}
            present={ticket.animalProductionNearby}
            action={ticket.animalProductionNearbyAction}
            dict={dict}
          />
          <Presence
            label={dict.wildDomesticAnimalActivity}
            present={ticket.wildDomesticAnimalActivity}
            action={ticket.wildDomesticAnimalActivityAction}
            dict={dict}
          />
          <Presence
            label={dict.rodentDogActivity}
            present={ticket.rodentDogActivity}
            action={ticket.rodentDogActivityAction}
            dict={dict}
          />
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">{dict.deliveryHarvestDetailsTitle}</h2>
          <div className="grid grid-cols-2 gap-3">
            <DetailRow label={dict.loadingSupervisor} value={ticket.loadingSupervisor} />
            <DetailRow
              label={dict.loadingTime}
              value={ticket.loadingTime ? formatDate(ticket.loadingTime, "dd MMM yyyy HH:mm", locale) : null}
            />
            <DetailRow label={dict.transferredBy} value={ticket.transferredBy} />
            <DetailRow label={dict.vehicleNo} value={ticket.vehicleNo} />
            <DetailRow label={dict.authorizedGrower} value={ticket.authorizedGrower} />
            <DetailRow label={dict.cropName} value={ticket.cropName} />
            <DetailRow
              label={dict.harvestTime}
              value={ticket.harvestTime ? formatDate(ticket.harvestTime, "dd MMM yyyy HH:mm", locale) : null}
            />
            <DetailRow label={dict.harvestSupervisor} value={ticket.harvestSupervisor} />
            <DetailRow
              label={dict.harvestDate}
              value={ticket.harvestDate ? formatDate(ticket.harvestDate, "dd MMM yyyy", locale) : null}
            />
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <h2 className="px-4 pt-4 text-sm font-semibold text-slate-900">{dict.plotsSuppliedTitle}</h2>
        <table className="mt-3 w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colStation}</th>
              <th className="px-4 py-2 font-medium">{dict.colPlotValveGh}</th>
              <th className="px-4 py-2 font-medium">{dict.colMatchedField}</th>
              <th className="px-4 py-2 font-medium">{dict.colVariety}</th>
              <th className="px-4 py-2 font-medium">{dict.colCycle}</th>
              <th className="px-4 py-2 font-medium">{dict.colPlantingYear}</th>
              <th className="px-4 py-2 font-medium">{dict.colCut}</th>
              <th className="px-4 py-2 font-medium">{dict.colPallets}</th>
              <th className="px-4 py-2 font-medium">{dict.colCrates}</th>
              <th className="px-4 py-2 font-medium">{dict.colWeightKg}</th>
            </tr>
          </thead>
          <tbody>
            {ticket.plotLines.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">{l.stationNo ?? "—"}</td>
                <td className="px-4 py-2">{l.plotValveGhNo ?? "—"}</td>
                <td className="px-4 py-2">
                  {l.field ? (
                    <Badge color="green">{l.field.name}</Badge>
                  ) : (
                    <Badge color="slate">{dict.unmatched}</Badge>
                  )}
                </td>
                <td className="px-4 py-2">{l.varietyName ?? "—"}</td>
                <td className="px-4 py-2">{l.cycleNumber ?? "—"}</td>
                <td className="px-4 py-2">{l.plantingYear ?? "—"}</td>
                <td className="px-4 py-2">{l.cutNo ?? "—"}</td>
                <td className="px-4 py-2">{l.palletsCount ?? "—"}</td>
                <td className="px-4 py-2">{l.cratesCount ?? "—"}</td>
                <td className="px-4 py-2">{l.weightKg ?? "—"}</td>
              </tr>
            ))}
            {ticket.plotLines.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  {dict.noPlotsRecorded}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="h-4" />
      </Card>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold text-slate-900">{dict.packhouseReceiptTitle}</h2>
        <p className="mt-1 text-sm text-slate-500">{dict.packhouseReceiptSubtitle}</p>
        <div className="mt-4">
          {ticket.receivedDate ? (
            <div className="grid grid-cols-4 gap-3">
              <DetailRow label={dict.receivedDate} value={formatDate(ticket.receivedDate, "dd MMM yyyy", locale)} />
              <DetailRow
                label={dict.receivedTime}
                value={ticket.receivedTime ? formatDate(ticket.receivedTime, "HH:mm", locale) : null}
              />
              <DetailRow label={dict.deliveryNumber} value={ticket.deliveryNumber} />
              <DetailRow label={dict.cratesReceived} value={ticket.cratesReceived} />
              <DetailRow label={dict.palletsReceived} value={ticket.palletsReceived} />
              <DetailRow label={dict.grossWeightKg} value={ticket.grossWeightKg} />
              <DetailRow label={dict.netWeightKg} value={ticket.netWeightKg} />
              {canSeeCost && <DetailRow label={dict.pricePerKgUsd} value={ticket.pricePerKgUsd != null ? `$${ticket.pricePerKgUsd}` : null} />}
              <DetailRow label={dict.electronicWeightCardNo} value={ticket.electronicWeightCardNo} />
              <DetailRow label={dict.productTempC} value={ticket.productTempC} />
              <DetailRow label={dict.optimumTempC} value={ticket.optimumTempC} />
              <DetailRow label={dict.coldTruckTempC} value={ticket.coldTruckTempC} />
              <DetailRow label={dict.receivedBy} value={ticket.receivedByName} />
            </div>
          ) : (
            <ReceiptForm ticketId={ticket.id} canSeeCost={canSeeCost} />
          )}
        </div>
      </Card>
    </div>
  );
}
