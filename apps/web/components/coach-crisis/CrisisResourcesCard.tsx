"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { Component, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import {
  COACH_NOT_THERAPIST,
  FALLBACK_CARD,
  type CrisisCardCopy,
} from "./crisisCopy";

function CrisisCardView({ card }: { card: CrisisCardCopy }) {
  // CrisisCard (DESIGN.md §9, coach-thread.html): fixed text written by people, no animation.
  return (
    <section role="alert" className="tp-crisis" data-component="CrisisCard">
      <h2 className="tp-crisis__title">{card.title}</h2>
      <p className="tp-crisis__body">{card.body}</p>
      {card.resources.length > 0 ? (
        <ul className="tp-crisis__list">
          {card.resources.map((resource, index) => (
            <li className="tp-crisis__item" key={`${resource.label}-${index}`}>
              <span className="tp-crisis__item-text">
                <span className="tp-crisis__name">{resource.label}</span>
                <span className="tp-crisis__detail">{resource.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="tp-crisis__note">{COACH_NOT_THERAPIST}</p>
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
