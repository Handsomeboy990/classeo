import type { Metadata } from "next";

import { PageHeader } from "@/components/kit/page-header";
import { AccessibilityControls } from "@/components/shell/accessibility-controls";
import { Card, CardBody } from "@/components/ui/card";

export const metadata: Metadata = { title: "Accessibilité" };

export default function PreferencesPage() {
  return (
    <>
      <PageHeader title="Accessibilité" description="Adaptez l'affichage et la voix à vos besoins. Les réglages restent enregistrés sur cet appareil." />
      <Card className="max-w-2xl">
        <CardBody>
          <AccessibilityControls />
        </CardBody>
      </Card>
    </>
  );
}
