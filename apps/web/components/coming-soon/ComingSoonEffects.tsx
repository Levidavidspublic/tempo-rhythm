"use client";

import { useEffect } from "react";

const DEMO_STEPS = 3;
const DEMO_INTERVAL_MS = 5200;

/**
 * The behaviour of the design export's inline script, kept the same:
 * - cards with .tf-play start their scene once, when they scroll into view;
 * - the pointer moves the layered art a few pixels (fine pointers only);
 * - the three demo tabs switch on click and step on their own until a tab is clicked.
 * Motion is skipped under prefers-reduced-motion. Renders nothing.
 */
export function ComingSoonEffects() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".tf-root");
    if (!root) {
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: Array<() => void> = [];

    const scenes = root.querySelectorAll(".tf-play");
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("tf-on");
              observer.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.35 }
      );
      for (const scene of scenes) {
        observer.observe(scene);
      }
      cleanups.push(() => observer.disconnect());
    } else {
      for (const scene of scenes) {
        scene.classList.add("tf-on");
      }
    }

    if (!reduce && window.matchMedia("(pointer: fine)").matches) {
      let frame = 0;
      let x = 0;
      let y = 0;
      const onMove = (event: PointerEvent) => {
        x = (event.clientX / window.innerWidth) * 2 - 1;
        y = (event.clientY / window.innerHeight) * 2 - 1;
        if (frame) {
          return;
        }
        frame = requestAnimationFrame(() => {
          frame = 0;
          root.style.setProperty("--mx", x.toFixed(3));
          root.style.setProperty("--my", y.toFixed(3));
        });
      };
      root.addEventListener("pointermove", onMove);
      cleanups.push(() => {
        root.removeEventListener("pointermove", onMove);
        cancelAnimationFrame(frame);
      });
    }

    const panels = root.querySelectorAll<HTMLElement>("[data-step]");
    const tabs = root.querySelectorAll<HTMLElement>("[data-go]");
    let step = 1;
    let manual = false;
    const go = (next: number) => {
      step = next;
      for (const panel of panels) {
        panel.hidden = Number(panel.dataset.step) !== next;
      }
      for (const tab of tabs) {
        tab.setAttribute("aria-selected", Number(tab.dataset.go) === next ? "true" : "false");
      }
    };
    for (const tab of tabs) {
      const onClick = () => {
        manual = true;
        go(Number(tab.dataset.go));
      };
      tab.addEventListener("click", onClick);
      cleanups.push(() => tab.removeEventListener("click", onClick));
    }
    if (!reduce && panels.length > 0) {
      const timer = window.setInterval(() => {
        if (!manual) {
          go((step % DEMO_STEPS) + 1);
        }
      }, DEMO_INTERVAL_MS);
      cleanups.push(() => window.clearInterval(timer));
    }

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, []);

  return null;
}
