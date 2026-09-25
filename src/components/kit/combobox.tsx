"use client";

import { useState } from "react";

import { ComboboxCore, type ComboboxCoreProps, type ComboOption } from "@/components/ui/combobox";

export type { ComboOption };

// Searchable choice for long lists built from data (students, schools,
// communes): the value is submitted with the form through a hidden input of
// the same name. Pages that already render a <Select> with <option>s get the
// same field automatically from six options on (components/ui/select.tsx).
export function Combobox({
  name,
  defaultValue = "",
  value: controlled,
  onValueChange,
  ...props
}: Omit<ComboboxCoreProps, "value" | "onValueChange"> & {
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  const [own, setOwn] = useState(defaultValue);
  const value = controlled ?? own;
  return (
    <>
      <ComboboxCore
        {...props}
        value={value}
        onValueChange={(v) => {
          setOwn(v);
          onValueChange?.(v);
        }}
      />
      {name && <input type="hidden" name={name} value={value} />}
    </>
  );
}
