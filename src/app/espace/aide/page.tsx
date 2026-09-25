import { Accessibility, HelpCircle } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/kit/page-header";
import { AccessibilityControls } from "@/components/shell/accessibility-controls";
import { SectionTitle } from "@/features/family/components/blocks";
import { Faq, GuideSteps } from "@/features/help/guide-view";
import { GUIDES, guideFor } from "@/features/help/guides";
import { requireUser } from "@/lib/auth/session";
import type { RoleCode } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Guide d'utilisation" };

export default async function HelpPage() {
  const user = await requireUser();
  const mine = guideFor(user.role.code as RoleCode);
  const others = GUIDES.filter((g) => g.key !== mine.key);

  return (
    <>
      <PageHeader title="Guide d'utilisation" description="Les étapes utiles à votre profil, les réglages d'affichage et les réponses aux questions fréquentes." />
      <div className="flex flex-col gap-10">
        <GuideSteps guide={mine} />

        <section aria-labelledby="a11y-title">
          <SectionTitle icon={Accessibility}>
            <span id="a11y-title">Adapter l&apos;affichage et la voix</span>
          </SectionTitle>
          <div className="rounded-card border border-border bg-surface p-4 sm:p-6">
            <AccessibilityControls />
          </div>
        </section>

        <section aria-labelledby="faq-title">
          <SectionTitle icon={HelpCircle}>
            <span id="faq-title">Questions fréquentes</span>
          </SectionTitle>
          <Faq />
        </section>

        <section aria-labelledby="others-title">
          <h2 id="others-title" className="mb-3 text-xl font-bold">
            Les guides des autres utilisateurs
          </h2>
          <ul className="flex flex-col gap-2">
            {others.map((g) => (
              <li key={g.key}>
                <details className="group rounded-card border border-border bg-surface">
                  <summary className="flex min-h-14 items-center px-4 py-3 font-semibold">{g.title}</summary>
                  <div className="border-t border-border p-2 sm:p-3">
                    <GuideSteps guide={g} headingLevel={3} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
