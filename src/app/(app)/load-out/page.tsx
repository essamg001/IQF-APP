import { redirect } from "next/navigation";

// This page's whole job -- the order-readiness triage list -- now lives at
// the top of /logistics (it had no loading controls of its own; every
// action here just forwarded to /logistics/new or /logistics/[id], and a
// station: "LOAD_OUT" account already landed on /logistics, not here). Kept
// as a redirect so any existing links/bookmarks still land somewhere real.
export default function LoadOutPage() {
  redirect("/logistics");
}
