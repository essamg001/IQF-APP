"use client";

import { useActionState } from "react";
import { approveCertificateAction } from "./actions";

export function ApproveForm({ containerId }: { containerId: string }) {
  const [error, formAction, pending] = useActionState(approveCertificateAction.bind(null, containerId), undefined);

  return (
    <div>
      <form action={formAction} className="approve-form">
        <input className="approve-input" type="text" name="approverName" placeholder="Your name" required />
        <button className="approve-btn" type="submit" disabled={pending}>
          {pending ? "Approving…" : "Approve Certificate"}
        </button>
      </form>
      {error && <p style={{ fontSize: 12, color: "#c23a2b", marginTop: 6, textAlign: "right" }}>{error}</p>}
    </div>
  );
}
