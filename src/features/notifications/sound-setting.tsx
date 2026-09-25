"use client";

import { Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/input";

import { playChime, setSoundEnabled, useSoundEnabled } from "./chime";

// "Son des notifications", on by default, stored on this device.
export function NotificationSoundSetting() {
  const on = useSoundEnabled();
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-3 py-2">
      <Switch
        checked={on}
        onChange={(e) => {
          setSoundEnabled(e.target.checked);
          if (e.target.checked) void playChime(true);
        }}
        label="Son des notifications"
        description="Un carillon discret quand une notification arrive pendant que Classéo est ouvert. La cloche s'anime aussi, avec ou sans son."
      />
      <Button type="button" variant="ghost" size="sm" onClick={() => void playChime(true)}>
        <Volume2 aria-hidden /> Écouter
      </Button>
    </div>
  );
}
