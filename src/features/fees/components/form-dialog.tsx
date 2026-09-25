"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const CloseContext = createContext<() => void>(() => {});

// Forms inside a FormDialog call this on success to close it.
export const useCloseDialog = () => useContext(CloseContext);

// A button that opens a dialog holding a form.
export function FormDialog({
  trigger,
  title,
  description,
  variant = "primary",
  size = "md",
  children,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={description}>
        <CloseContext.Provider value={() => setOpen(false)}>{children}</CloseContext.Provider>
      </Dialog>
    </>
  );
}
