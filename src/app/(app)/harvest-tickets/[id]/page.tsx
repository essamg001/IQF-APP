import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReceiptForm } from "./receipt-form";
import { format } from "date-fns";

const COMPLIANCE_LABEL: Record<string, string> = {
  GLOBALGAP: "GlobalG.A.P.",
  SPRING: "Spring",
  LEAF: "Leaf",
  NURTURE: "Nurture",
  AH_DL_GROW: "AH/DL Grow",
  FAIRTRADE: "Fairtrade",
  ORGANIC_100: "100% Organic",
  BIO_SUISSE: "Bio Suisse",
  OTHER: "Other",
};

function Check({ label, ok }: { label: string; ok: boolean | null }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      {ok === null ? (
        <span className="text-slate-400">—</span>
      ) : (
        <Badge color={ok ? "green" : "red"}>{ok ? "OK" : "Not OK"}</Badge>
      )}
    </div>
  );
}

function Presence({ label, present, action }: { label: string; present: boolean | null; action: string | null }) {
  return (
    <div className="flex items-start justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <div className="text-right">
        {present === null ? (
          <span className="text-slate-400">—</span>
        ) : (
          <Badge color={present ? "amber" : "slate"}>{present ? "Present" : "None"}</Badge>
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
  const ticket = await prisma.harvestTicket.findUnique({
    where: { id },
    include: { plotLines: { include: { field: true } } },
  });
  if (!ticket) notFound();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Harvest Ticket {ticket.serialNumber}</h1>
          <p className="mt-1 text-sm text-slate-500">Product delivery sheet (GEN03107)</p>
        </div>
        {ticket.receivedDate ? (
          <Badge color={ticket.acceptedAtPackhouse ? "green" : "red"}>
            {ticket.acceptedAtPackhouse ? "Accepted at Packhouse" : "Rejected at Packhouse"}
          </Badge>
        ) : (
          <Badge color="amber">Awaiting Receipt</Badge>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Delivery Identity</h2>
          <div className="grid grid-cols-2 gap-3">
            <DetailRow label="GGN" value={ticket.ggn} />
            <DetailRow
              label="Compliance Level"
              value={ticket.complianceLevel ? COMPLIANCE_LABEL[ticket.complianceLevel] : ticket.complianceOther}
            />
            <DetailRow label="Product Type" value={ticket.productType} />
            <DetailRow label="Rework Reason" value={ticket.reworkReason} />
          </div>
        </Card>

        <Card className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">Conformity Checklist</h2>
          <Check label="Fruit conformity" ok={ticket.fruitConformityOk} />
          <Check label="Fruit safety" ok={ticket.fruitSafetyOk} />
          <Check label="Crates cleanliness" ok={ticket.cratesCleanlinessOk} />
          <Check label="Field cleanliness" ok={ticket.fieldCleanlinessOk} />
          <Check label="Vehicle cleanliness" ok={ticket.vehicleCleanlinessOk} />
        </Card>

        <Card className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">Presence Checklist</h2>
          <Presence label="Pets present" present={ticket.petsPresent} action={ticket.petsPresentAction} />
          <Presence
            label="Animal production nearby"
            present={ticket.animalProductionNearby}
            action={ticket.animalProductionNearbyAction}
          />
          <Presence
            label="Wild/domestic animal activity"
            present={ticket.wildDomesticAnimalActivity}
            action={ticket.wildDomesticAnimalActivityAction}
          />
          <Presence label="Rodent/dog activity" present={ticket.rodentDogActivity} action={ticket.rodentDogActivityAction} />
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Delivery & Harvest Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <DetailRow label="Loading Supervisor" value={ticket.loadingSupervisor} />
            <DetailRow label="Loading Time" value={ticket.loadingTime ? format(ticket.loadingTime, "dd MMM yyyy HH:mm") : null} />
            <DetailRow label="Transferred By" value={ticket.transferredBy} />
            <DetailRow label="Vehicle No." value={ticket.vehicleNo} />
            <DetailRow label="Authorized Grower" value={ticket.authorizedGrower} />
            <DetailRow label="Crop Name" value={ticket.cropName} />
            <DetailRow label="Harvest Time" value={ticket.harvestTime ? format(ticket.harvestTime, "dd MMM yyyy HH:mm") : null} />
            <DetailRow label="Harvest Supervisor" value={ticket.harvestSupervisor} />
            <DetailRow label="Harvest Date" value={ticket.harvestDate ? format(ticket.harvestDate, "dd MMM yyyy") : null} />
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <h2 className="px-4 pt-4 text-sm font-semibold text-slate-900">Plots Supplying This Delivery</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Station</th>
              <th className="px-4 py-2 font-medium">Plot/Valve/GH</th>
              <th className="px-4 py-2 font-medium">Matched Field</th>
              <th className="px-4 py-2 font-medium">Variety</th>
              <th className="px-4 py-2 font-medium">Cycle</th>
              <th className="px-4 py-2 font-medium">Planting Year</th>
              <th className="px-4 py-2 font-medium">Cut</th>
              <th className="px-4 py-2 font-medium">Pallets</th>
              <th className="px-4 py-2 font-medium">Crates</th>
              <th className="px-4 py-2 font-medium">Weight (kg)</th>
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
                    <Badge color="slate">Unmatched</Badge>
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
                  No plots recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="h-4" />
      </Card>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold text-slate-900">Packhouse Receipt</h2>
        <p className="mt-1 text-sm text-slate-500">Completed by the decap facility once the tractor arrives.</p>
        <div className="mt-4">
          {ticket.receivedDate ? (
            <div className="grid grid-cols-4 gap-3">
              <DetailRow label="Received Date" value={format(ticket.receivedDate, "dd MMM yyyy")} />
              <DetailRow label="Received Time" value={ticket.receivedTime ? format(ticket.receivedTime, "HH:mm") : null} />
              <DetailRow label="Delivery Number" value={ticket.deliveryNumber} />
              <DetailRow label="Crates Received" value={ticket.cratesReceived} />
              <DetailRow label="Pallets Received" value={ticket.palletsReceived} />
              <DetailRow label="Gross Weight (kg)" value={ticket.grossWeightKg} />
              <DetailRow label="Net Weight (kg)" value={ticket.netWeightKg} />
              <DetailRow label="Electronic Weight Card No." value={ticket.electronicWeightCardNo} />
              <DetailRow label="Product Temp (°C)" value={ticket.productTempC} />
              <DetailRow label="Optimum Temp (°C)" value={ticket.optimumTempC} />
              <DetailRow label="Cold Truck Temp (°C)" value={ticket.coldTruckTempC} />
              <DetailRow label="Received By" value={ticket.receivedByName} />
            </div>
          ) : (
            <ReceiptForm ticketId={ticket.id} />
          )}
        </div>
      </Card>
    </div>
  );
}
