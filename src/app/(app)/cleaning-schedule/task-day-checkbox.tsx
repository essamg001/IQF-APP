"use client";

import { useRef, useTransition } from "react";
import { toggleMasterCleaningTaskAction } from "./actions";

export function TaskDayCheckbox({
  factoryId,
  date,
  taskKey,
  defaultChecked,
}: {
  factoryId: string;
  date: string;
  taskKey: string;
  defaultChecked: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const checkedInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form ref={formRef} action={toggleMasterCleaningTaskAction}>
      <input type="hidden" name="factoryId" value={factoryId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="taskKey" value={taskKey} />
      <input ref={checkedInputRef} type="hidden" name="checked" defaultValue={defaultChecked ? "true" : "false"} />
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        disabled={pending}
        onChange={(e) => {
          if (checkedInputRef.current) checkedInputRef.current.value = e.target.checked ? "true" : "false";
          startTransition(() => {
            formRef.current?.requestSubmit();
          });
        }}
        className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
      />
    </form>
  );
}
