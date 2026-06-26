"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Generic delete button. Pass a bound server action, e.g.
 *   <DeleteButton action={deletePolicy.bind(null, policy.id)} />
 */
export function DeleteButton({
  action,
  confirmText = "Na pewno usunąć? Tej operacji nie można cofnąć.",
}: {
  action: () => Promise<void>;
  confirmText?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <Button variant="ghost" size="icon" type="submit" title="Usuń">
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </form>
  );
}
