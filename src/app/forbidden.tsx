import { ForbiddenState } from "@/components/kit/states";
import { ButtonLink } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <div className="mx-auto max-w-xl py-10">
      <ForbiddenState />
      <div className="flex justify-center">
        <ButtonLink href="/espace" variant="secondary">
          Retour au tableau de bord
        </ButtonLink>
      </div>
    </div>
  );
}
