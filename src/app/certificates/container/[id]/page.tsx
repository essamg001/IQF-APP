import { notFound } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { FORMAT_LABEL } from "@/lib/format";
import { computeContainerCertificateData, type CertificateData } from "@/lib/certificate";
import { PrintButton } from "./print-button";
import { ApproveForm } from "./approve-form";

function fmtPct(v: number | null) {
  return v === null ? "—" : `${v.toFixed(1)}%`;
}

function PassPill({ pass }: { pass: boolean | null }) {
  if (pass === null) {
    return (
      <span className="ca-pill" style={{ background: "#eceae2", color: "#7c8579" }}>
        —
      </span>
    );
  }
  return pass ? (
    <span className="ca-pill">
      <svg viewBox="0 0 10 10" fill="none">
        <path d="M2 5.2L4 7.2L8 2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>{" "}
      Pass
    </span>
  ) : (
    <span className="ca-pill" style={{ background: "#e3423014", color: "#c23a2b" }}>
      Review
    </span>
  );
}

export default async function ContainerCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const result = await computeContainerCertificateData(id);
  if (!result) notFound();
  const { container, gate, data: liveData } = result;

  const isApproved = !!container.certificateApprovedAt;
  const data: CertificateData = isApproved ? (container.certificateSnapshot as CertificateData) : liveData;

  // Not approved yet and conditions aren't met: no certificate content at
  // all, just a status list of what's outstanding.
  if (!isApproved && !gate.ready) {
    return (
      <div style={{ maxWidth: 640, margin: "60px auto", padding: "0 20px", fontFamily: "-apple-system,BlinkMacSystemFont,sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1c211d" }}>Certificate not yet available</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: "#4d5750" }}>
          Container <strong>{container.containerNumber}</strong> can&apos;t be certified until the following are resolved:
        </p>
        <ul style={{ marginTop: 16, paddingLeft: 20, fontSize: 14, color: "#1c211d", lineHeight: 1.8 }}>
          {gate.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
    );
  }

  const canApprove = session?.user && ["QUALITY", "OWNER"].includes(session.user.role);
  const productionDate = data.productionDate ? new Date(data.productionDate) : null;
  const microDate = data.microDate ? new Date(data.microDate) : null;

  return (
    <div className="cert-stage">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .cert-stage { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif; background:#dcdfe0; min-height:100vh; padding:28px 16px 80px; }
        .toolbar-row { max-width:780px; margin:0 auto 18px; display:flex; justify-content:flex-end; align-items:center; gap:12px; }
        .toolbar-print-btn { font:inherit; font-size:13px; font-weight:700; letter-spacing:0.02em; background:#1c211d; color:#f4f3ee; border:none; padding:9px 18px; border-radius:20px; cursor:pointer; }
        .toolbar-print-btn:hover { opacity:0.88; }
        .approve-form { display:flex; align-items:center; gap:8px; }
        .approve-input { font:inherit; font-size:13px; padding:8px 12px; border-radius:20px; border:1px solid #a9a48f; }
        .approve-btn { font:inherit; font-size:13px; font-weight:700; letter-spacing:0.02em; background:#2f6b4f; color:#fff; border:none; padding:9px 18px; border-radius:20px; cursor:pointer; }
        .draft-banner { max-width:780px; margin:0 auto 14px; background:#fff3cd; border:1px solid #e3c56b; color:#7a5d00; font-size:12.5px; font-weight:600; padding:10px 16px; border-radius:6px; text-align:center; letter-spacing:0.02em; }
        .approved-banner { max-width:780px; margin:0 auto 14px; background:#e7f3ec; border:1px solid #2f6b4f; color:#1e4d38; font-size:12.5px; font-weight:600; padding:10px 16px; border-radius:6px; text-align:center; letter-spacing:0.02em; }
        .ca-root {
          --paper:#f4f3ee; --paper-edge:#e6e4da; --ink:#1c211d; --ink-soft:#4d5750; --ink-faint:#7c8579;
          --line:#cdc9b8; --line-strong:#a9a48f; --seal:#7a2331; --good:#2f6b4f; --good-soft:#2f6b4f14;
          --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;
          --mono:ui-monospace,"SF Mono","Cascadia Mono",Consolas,monospace;
          width:100%; max-width:780px; margin:0 auto; background:var(--paper); color:var(--ink);
          box-shadow:0 1px 1px rgba(0,0,0,0.06),0 18px 44px rgba(0,0,0,0.28); padding:46px 52px 38px; position:relative;
          border:1px solid var(--paper-edge);
        }
        .ca-root::before { content:""; position:absolute; inset:10px; border:1px solid var(--line); pointer-events:none; }
        .ca-letterhead { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; padding-bottom:18px; border-bottom:2px solid var(--ink); }
        .ca-brand { display:flex; align-items:center; gap:12px; }
        .ca-brand h1 { font-family:var(--serif); font-size:19px; font-weight:600; margin:0; letter-spacing:0.01em; }
        .ca-brand p { margin:2px 0 0; font-size:10.5px; color:var(--ink-soft); letter-spacing:0.06em; text-transform:uppercase; }
        .ca-meta { text-align:right; font-size:11.5px; color:var(--ink-soft); line-height:1.65; font-variant-numeric:tabular-nums; }
        .ca-meta strong { color:var(--ink); font-weight:600; }
        .ca-title-row { margin:22px 0 26px; text-align:center; }
        .ca-title-row h2 { font-family:var(--serif); font-size:26px; font-weight:600; margin:0; letter-spacing:0.01em; }
        .ca-title-row p { margin:5px 0 0; font-size:11px; color:var(--ink-faint); letter-spacing:0.14em; text-transform:uppercase; }
        .ca-parties { display:grid; grid-template-columns:1fr 1fr; gap:22px; margin-bottom:24px; }
        .ca-field dt { font-size:9.5px; letter-spacing:0.1em; text-transform:uppercase; color:var(--ink-faint); margin-bottom:3px; }
        .ca-field dd { margin:0 0 10px; font-size:13.5px; color:var(--ink); }
        .ca-field dd.mono { font-family:var(--mono); font-size:12.5px; }
        .ca-section-label { font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--seal); margin:26px 0 10px; display:flex; align-items:center; gap:10px; }
        .ca-section-label::after { content:""; flex:1; height:1px; background:var(--line); }
        .ca-results { width:100%; border-collapse:collapse; font-size:12.5px; }
        .ca-results th { text-align:left; font-size:9.5px; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-faint); font-weight:600; padding:6px 10px 7px 0; border-bottom:1px solid var(--line-strong); }
        .ca-results td { padding:7px 10px 7px 0; border-bottom:1px solid var(--line); vertical-align:baseline; }
        .ca-results tbody tr:last-child td { border-bottom:1px solid var(--line-strong); }
        .ca-results td.param { color:var(--ink-soft); }
        .ca-results td.value { font-variant-numeric:tabular-nums; font-weight:600; white-space:nowrap; }
        .ca-results td.spec { color:var(--ink-faint); font-variant-numeric:tabular-nums; white-space:nowrap; }
        .ca-pill { display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:700; letter-spacing:0.03em; padding:2px 8px; border-radius:20px; background:var(--good-soft); color:var(--good); }
        .ca-pill svg { width:9px; height:9px; }
        .ca-lower { display:grid; grid-template-columns:1.1fr 0.9fr; gap:28px; margin-top:30px; align-items:start; }
        .ca-certs { display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; }
        .ca-chip { font-size:10.5px; font-weight:600; letter-spacing:0.04em; padding:5px 10px; border:1px solid var(--line-strong); border-radius:2px; color:var(--ink-soft); background:rgba(255,255,255,0.4); }
        .ca-micro { margin-top:12px; font-size:12px; color:var(--ink-soft); line-height:1.5; }
        .ca-micro strong { color:var(--ink); }
        .ca-seal-wrap { display:flex; flex-direction:column; align-items:center; gap:6px; justify-self:end; }
        .ca-seal-wrap span { font-size:9px; letter-spacing:0.1em; text-transform:uppercase; color:var(--ink-faint); }
        .ca-approvals { margin-top:40px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; }
        .ca-sig { padding-top:8px; border-top:1px solid var(--ink); }
        .ca-sig-name { font-family:var(--serif); font-style:italic; font-size:15px; color:var(--ink); margin-bottom:2px; }
        .ca-sig-role { font-size:10px; letter-spacing:0.05em; text-transform:uppercase; color:var(--ink-faint); }
        .ca-footnote { margin-top:34px; padding-top:14px; border-top:1px solid var(--line); font-size:9.5px; color:var(--ink-faint); line-height:1.6; }
        .ca-footnote .ref { font-family:var(--mono); color:var(--ink-soft); }
        @media (max-width:640px) {
          .ca-root { padding:30px 22px 26px; }
          .ca-parties, .ca-lower { grid-template-columns:1fr; }
          .ca-approvals { grid-template-columns:1fr; gap:26px; }
          .ca-meta { text-align:left; }
          .ca-letterhead { flex-direction:column; }
          .ca-results { font-size:11.5px; }
          .ca-results .spec-col { display:none; }
        }
        @media print {
          .toolbar-row, .draft-banner, .approved-banner { display:none; }
          .cert-stage { background:#fff; padding:0; }
          .ca-root { box-shadow:none; border:none; max-width:none; }
          .ca-root::before { display:none; }
          @page { size:A4; margin:14mm; }
        }
      `,
        }}
      />

      <div className="toolbar-row">
        {!isApproved && canApprove && <ApproveForm containerId={container.id} />}
        <PrintButton />
      </div>

      {!isApproved && <div className="draft-banner">DRAFT — Pending Final Approval</div>}
      {isApproved && (
        <div className="approved-banner">
          Approved by {container.certificateApprovedByName} on{" "}
          {format(container.certificateApprovedAt!, "dd MMM yyyy")} — this is the permanent record for this shipment.
        </div>
      )}

      <div className="ca-root">
        <div className="ca-letterhead">
          <div className="ca-brand">
            <svg width="42" height="42" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M24 4C24 4 14 14 14 24C14 32.5 18.5 40 24 44C29.5 40 34 32.5 34 24C34 14 24 4 24 4Z" stroke="#1c211d" strokeWidth="1.4" />
              <path d="M24 10.5V38" stroke="#1c211d" strokeWidth="1.1" />
              <path d="M24 16C24 16 19 18 18 23" stroke="#1c211d" strokeWidth="1" strokeLinecap="round" />
              <path d="M24 24C24 24 29 26 30 31" stroke="#1c211d" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <div>
              <h1>Magrabi Agriculture</h1>
              <p>IQF Strawberry Export &middot; Damietta, Egypt</p>
            </div>
          </div>
          <div className="ca-meta">
            Certificate No. <strong>{data.certNumber}</strong>
            <br />
            Issue Date <strong>{format(new Date(data.issueDate), "dd MMM yyyy")}</strong>
            <br />
            Page <strong>1 of 1</strong>
          </div>
        </div>

        <div className="ca-title-row">
          <h2>Certificate of Quality</h2>
          <p>
            IQF {FORMAT_LABEL[data.format as keyof typeof FORMAT_LABEL]} Strawberries &mdash; Grade {data.grade}
          </p>
        </div>

        <div className="ca-parties">
          <dl className="ca-field">
            <dt>Consignee</dt>
            <dd>
              {data.client.name}
              <br />
              {data.client.country ?? ""}
              {data.client.contactName ? ` · Attn. ${data.client.contactName}` : ""}
            </dd>
            <dt>Order Reference</dt>
            <dd className="mono">{data.orderNumber}</dd>
          </dl>
          <dl className="ca-field">
            <dt>Product &amp; Variety</dt>
            <dd>
              IQF Strawberries, {FORMAT_LABEL[data.format as keyof typeof FORMAT_LABEL]}
              {data.variety !== "—" ? ` — ${data.variety}` : ""}
            </dd>
            <dt>Container</dt>
            <dd className="mono">{data.containerNumber}</dd>
          </dl>
        </div>

        <div className="ca-parties" style={{ marginBottom: 6 }}>
          <dl className="ca-field">
            <dt>Traceability / Lot Code{data.lotNumbers.length > 1 ? "s" : ""}</dt>
            <dd className="mono">{data.lotNumbers.join(", ")}</dd>
            <dt>Source Field{data.fieldNames.length > 1 ? "s" : ""}</dt>
            <dd>{data.fieldNames.join(", ")}</dd>
          </dl>
          <dl className="ca-field">
            <dt>Production Date</dt>
            <dd>
              {productionDate ? format(productionDate, "dd MMM yyyy") : "—"} &middot; {data.factoryNames.join(", ")}
            </dd>
            <dt>Quantity Shipped</dt>
            <dd>
              {data.palletCount} pallet{data.palletCount === 1 ? "" : "s"} &middot; {data.totalTonnes.toFixed(1)} MT net
            </dd>
          </dl>
        </div>

        <div className="ca-section-label">Inspection Results — {data.isPostPackaging ? "Final Product (Frozen)" : "Raw Material"}</div>
        <table className="ca-results">
          <thead>
            <tr>
              <th style={{ width: "34%" }}>Parameter</th>
              <th>Result</th>
              <th className="spec-col">Client Spec</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="param">Brix (sugar content)</td>
              <td className="value">{data.brix !== null ? `${data.brix.toFixed(1)} °Bx` : "—"}</td>
              <td className="spec spec-col">{data.specBrix ?? "—"}</td>
              <td>
                <PassPill pass={data.brixPass} />
              </td>
            </tr>
            <tr>
              <td className="param">Fruit colour (red to dark red)</td>
              <td className="value">{data.fruitColorPct !== null ? `${data.fruitColorPct.toFixed(0)}% of surface` : "—"}</td>
              <td className="spec spec-col">—</td>
              <td>
                <PassPill pass={null} />
              </td>
            </tr>
            <tr>
              <td className="param">Internal quality</td>
              <td className="value">{fmtPct(data.internalQualityPct)}</td>
              <td className="spec spec-col">{data.specInternalQuality ?? "—"}</td>
              <td>
                <PassPill pass={null} />
              </td>
            </tr>
            <tr>
              <td className="param">Mould</td>
              <td className="value">{fmtPct(data.mouldPct)}</td>
              <td className="spec spec-col">—</td>
              <td>
                <PassPill pass={null} />
              </td>
            </tr>
            <tr>
              <td className="param">Skin damage</td>
              <td className="value">{fmtPct(data.skinDamagePct)}</td>
              <td className="spec spec-col">{data.specMechanicalDamage ?? "—"}</td>
              <td>
                <PassPill pass={null} />
              </td>
            </tr>
            <tr>
              <td className="param">Overmature / soft texture</td>
              <td className="value">{fmtPct(data.overmaturePct)}</td>
              <td className="spec spec-col">—</td>
              <td>
                <PassPill pass={null} />
              </td>
            </tr>
            <tr>
              <td className="param">Foreign odour / taste</td>
              <td className="value">
                {data.foreignOdor} / {data.foreignTaste}
              </td>
              <td className="spec spec-col">NIL</td>
              <td>
                <PassPill pass={data.foreignOdor === "NIL" && data.foreignTaste === "NIL"} />
              </td>
            </tr>
            <tr>
              <td className="param">Product core temperature</td>
              <td className="value">{data.productTemp} °C</td>
              <td className="spec spec-col">−18 °C</td>
              <td>
                <PassPill pass={data.productTemp <= -18} />
              </td>
            </tr>
          </tbody>
        </table>

        <div className="ca-lower">
          <div>
            <div className="ca-section-label" style={{ marginTop: 4 }}>
              Certified Standards
            </div>
            <div className="ca-certs">
              {data.complianceLevels.map((lvl) => (
                <span className="ca-chip" key={lvl}>
                  {lvl === "GLOBALGAP" ? "GLOBALG.A.P" : lvl}
                </span>
              ))}
              {data.complianceLevels.length === 0 && <span className="ca-chip">On file</span>}
            </div>
            <p className="ca-micro">
              <strong>Lab Clearance:</strong>{" "}
              {data.allApproved
                ? `Approved${microDate ? ` ${format(microDate, "dd MMM yyyy")}` : ""}${
                    data.microCerts.length
                      ? ` — certificate ${data.microCerts.map((m) => m.certificateNumber).join(", ")}${
                          data.microCerts[0]?.labName ? ` (${data.microCerts[0].labName})` : ""
                        }`
                      : ""
                  } on file; results compliant with destination-market food safety regulation.`
                : "Pending or not yet approved for this lot — do not rely on this certificate until lab clearance is confirmed."}
            </p>
          </div>
          <div className="ca-seal-wrap">
            <svg width="92" height="92" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Quality assurance seal">
              <defs>
                <path id="sealCircleTop" d="M 8,48 A 40,40 0 0 1 88,48" />
                <path id="sealCircleBottom" d="M 88,48 A 40,40 0 0 1 8,48" />
              </defs>
              <circle cx="48" cy="48" r="44" stroke="#7a2331" strokeWidth="1.2" fill="none" />
              <circle cx="48" cy="48" r="37" stroke="#7a2331" strokeWidth="0.7" fill="none" />
              <text fontSize="7.6" letterSpacing="1.5" fill="#7a2331" fontFamily="ui-sans-serif, system-ui">
                <textPath href="#sealCircleTop" startOffset="50%" textAnchor="middle">
                  MAGRABI AGRICULTURE
                </textPath>
              </text>
              <text fontSize="7.6" letterSpacing="1.5" fill="#7a2331" fontFamily="ui-sans-serif, system-ui">
                <textPath href="#sealCircleBottom" startOffset="50%" textAnchor="middle">
                  QUALITY ASSURANCE
                </textPath>
              </text>
              <path d="M32 49L43 60L66 35" stroke="#7a2331" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <text x="48" y="26" fontSize="6" fill="#7a2331" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" letterSpacing="1">
                APPROVED
              </text>
            </svg>
            <span>Quality Assurance Seal</span>
          </div>
        </div>

        <div className="ca-approvals">
          <div className="ca-sig">
            <p className="ca-sig-name">{data.qualityRepName ?? "—"}</p>
            <p className="ca-sig-role">Quality Manager</p>
          </div>
          <div className="ca-sig">
            <p className="ca-sig-name">{data.loadOutRepName ?? "—"}</p>
            <p className="ca-sig-role">Export / Load-Out</p>
          </div>
          <div className="ca-sig">
            <p className="ca-sig-name">&nbsp;</p>
            <p className="ca-sig-role">Company Stamp</p>
          </div>
        </div>

        <div className="ca-footnote">
          This certificate attests to inspection results recorded at end-of-line packaging under Magrabi Agriculture&apos;s
          quality management system and is issued for the exclusive use of the named consignee for shipment against order{" "}
          <span className="ref">{data.orderNumber}</span> / container <span className="ref">{data.containerNumber}</span>.
          Full pallet-level traceability, raw-material intake inspection, and microbiology reports are retained on file
          and available on request.
        </div>
      </div>
    </div>
  );
}
