import type { Metadata } from "next";

import { PageHeader } from "@/components/kit/page-header";
import { AccessibilityControls } from "@/components/shell/accessibility-controls";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationSoundSetting } from "@/features/notifications/sound-setting";
import { OfflinePanel } from "@/features/offline/offline-panel";
import { VoiceInfo } from "@/features/languages/voice-info";
import { PushToggle } from "@/features/push/push-toggle";
import { pushPublicKey } from "@/lib/channels/push";

export const metadata: Metadata = { title: "Préférences" };

export default function PreferencesPage() {
  const pushKey = pushPublicKey();
  return (
    <>
      <PageHeader title="Préférences" description="Adaptez l'affichage, la voix et les notifications à vos besoins. Ces réglages valent pour cet appareil." />
      <div className="flex max-w-2xl flex-col gap-5">
        <Card aria-labelledby="prefs-display">
          <CardHeader>
            <CardTitle id="prefs-display">Affichage et voix</CardTitle>
          </CardHeader>
          <CardBody>
            <AccessibilityControls />
            <VoiceInfo />
          </CardBody>
        </Card>
        <Card aria-labelledby="prefs-push">
          <CardHeader>
            <CardTitle id="prefs-push">Notifications</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col divide-y divide-border px-2 py-2">
            <NotificationSoundSetting />
            {pushKey && <PushToggle publicKey={pushKey} explain />}
          </CardBody>
        </Card>
        {pushKey && (
          <p className="text-sm text-muted">
            Quand Classéo est fermé, les notifications du téléphone ou de l&apos;ordinateur sonnent avec le son choisi dans les réglages de l&apos;appareil : un site ne
            peut pas le changer.
          </p>
        )}
        <Card aria-labelledby="prefs-offline" id="hors-ligne" className="scroll-mt-24">
          <CardHeader>
            <CardTitle id="prefs-offline">Hors ligne</CardTitle>
          </CardHeader>
          <CardBody>
            <OfflinePanel />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
