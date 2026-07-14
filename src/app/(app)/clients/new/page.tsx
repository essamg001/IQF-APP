import { ClientForm } from "../client-form";
import { createClientAction } from "../actions";

export default function NewClientPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">New Client</h1>
      <div className="mt-6 max-w-4xl">
        <ClientForm action={createClientAction} submitLabel="Create client" />
      </div>
    </div>
  );
}
