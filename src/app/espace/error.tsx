"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { ErrorState } from "@/components/kit/states";
import { Button } from "@/components/ui/button";

export default function SpaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <ErrorState
      action={
        <Button onClick={reset}>
          <RotateCcw aria-hidden /> Réessayer
        </Button>
      }
    />
  );
}
