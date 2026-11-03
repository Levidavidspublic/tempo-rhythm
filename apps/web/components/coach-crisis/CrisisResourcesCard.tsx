"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { Component, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import {
  COACH_NOT_THERAPIST,
  FALLBACK_CARD,
  formatResource,
  type CrisisCardCopy,
} from "./crisisCopy";

function CrisisCardView({ card }: { card: CrisisCardCopy }) {
  return (
    <section role="alert" className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <h2 className="font-heading text-xl font-semibold text-foreground">{card.title}</h2>
      <p className="mt-2 text-sm text-foreground">{card.body}</p>
      {card.resources.length > 0 ? (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-foreground">
          {card.resources.map((resource, index) => (
            <li key={`${resource.label}-${index}`}>{formatResource(resource)}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-sm text-muted-foreground">{COACH_NOT_THERAPIST}</p>
    </section>
  );
}

type BoundaryProps = { children: ReactNode };
type BoundaryState = { failed: boolean };

class CrisisCardBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <CrisisCardView card={FALLBACK_CARD} />;
    }
    return this.props.children;
  }
}

function CrisisResourcesCardQuery() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const card = useQuery(api.crisis.resourcesCard, isAuthenticated ? {} : "skip");

  if (isLoading || card === undefined) {
    return <CrisisCardView card={FALLBACK_CARD} />;
  }

  return <CrisisCardView card={card} />;
}

export function CrisisResourcesCard() {
  return (
    <CrisisCardBoundary>
      <CrisisResourcesCardQuery />
    </CrisisCardBoundary>
  );
}
