"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import {
  clampDial,
  dialLabel,
  panicMinutesLeft,
  releaseDial,
  settleDialSave,
  type DialFlight,
} from "./dial";

const SAVE_ERROR = "That didn't save. Try again?";
const PANIC_FALLBACK = "Take a breath. Nothing is due right now.";

function minutesCopy(minutes: number): string {
  if (minutes <= 0) return "Under a minute left";
  if (minutes === 1) return "1 minute left";
  return `${minutes} minutes left`;
}

export function CoachControls() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const settings = useQuery(api.coach.getSettings, isAuthenticated ? {} : "skip");
  const setDial = useMutation(api.coach.setDial);
  const pressPanic = useMutation(api.coach.pressPanic);
  const clearPanic = useMutation(api.coach.clearPanic);

  const [draft, setDraft] = useState<number | null>(null);
  const [savedDial, setSavedDial] = useState<number | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionText, setActionText] = useState<string | null>(null);
  const [panicOverride, setPanicOverride] = useState<number | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const [panicBusy, setPanicBusy] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const flightRef = useRef<DialFlight>({ inFlight: null, pending: null });
  const draftRef = useRef<number | null>(null);
  const panicLock = useRef(false);
  const clearLock = useRef(false);
  const serverDial = settings ? clampDial(settings.dial) : null;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (serverDial === null || savedDial === null || serverDial !== savedDial) return;
    setSavedDial(null);
  }, [serverDial, savedDial]);

  if (authLoading || (isAuthenticated && settings === undefined)) {
    return (
      <section aria-busy="true" aria-labelledby="coach-controls-heading" className="max-w-xl">
        <h2
          id="coach-controls-heading"
          className="font-heading text-xl font-semibold text-foreground"
        >
          How the coach pushes
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">Loading your coach settings.</p>
      </section>
    );
  }

  if (!isAuthenticated || settings === undefined) {
    return null;
  }

  const persisted = savedDial ?? serverDial ?? clampDial(settings.dial);
  const shown = draft ?? persisted;
  const label = dialLabel(shown);
  const panicUntil = panicOverride !== undefined ? panicOverride : settings.panicUntil;
  const panicActive = panicUntil !== null && panicUntil > now;
  const minutes = panicMinutesLeft(panicUntil, now);
  const cardText = actionText && actionText.trim().length > 0 ? actionText : PANIC_FALLBACK;

  const runDialSave = (value: number) => {
    const pending = flightRef.current.pending;
    flightRef.current = {
      inFlight: value,
      pending: pending === value ? null : pending,
    };
    setSavedFlash(false);
    void setDial({ dial: value })
      .then(() => {
        const settled = settleDialSave(flightRef.current, value, true, draftRef.current);
        flightRef.current = settled.flight;
        setSavedDial(value);
        setError(null);
        if (settled.flashSaved) {
          draftRef.current = null;
          setDraft(null);
          setSavedFlash(true);
        } else {
          setSavedFlash(false);
        }
        if (settled.save !== null) runDialSave(settled.save);
      })
      .catch(() => {
        const settled = settleDialSave(flightRef.current, value, false, draftRef.current);
        flightRef.current = settled.flight;
        setSavedFlash(false);
        if (settled.revertDraft) {
          draftRef.current = null;
          setDraft(null);
          setError(SAVE_ERROR);
        }
        if (settled.save !== null) runDialSave(settled.save);
      });
  };

  const commitDial = (raw: number) => {
    const result = releaseDial(flightRef.current, raw, persisted);
    flightRef.current = result.flight;
    if (result.release.action === "ignore") {
      if (result.flight.inFlight === null) {
        draftRef.current = null;
        setDraft(null);
      }
      return;
    }
    draftRef.current = result.release.value;
    setDraft(result.release.value);
    setSavedFlash(false);
    setError(null);
    if (result.release.action === "save") runDialSave(result.release.value);
  };

  const onPanic = () => {
    if (panicLock.current) return;
    panicLock.current = true;
    setPanicBusy(true);
    setError(null);
    void pressPanic({})
      .then((result) => {
        setPanicOverride(result.panicUntil);
        const text = result.action.text.trim();
        setActionText(text.length > 0 ? result.action.text : null);
        setNow(Date.now());
        setError(null);
      })
      .catch(() => {
        setError(SAVE_ERROR);
      })
      .finally(() => {
        panicLock.current = false;
        setPanicBusy(false);
      });
  };

  const onClear = () => {
    if (clearLock.current) return;
    clearLock.current = true;
    setClearBusy(true);
    setError(null);
    void clearPanic({})
      .then(() => {
        setPanicOverride(null);
        setActionText(null);
        setNow(Date.now());
        setError(null);
      })
      .catch(() => {
        setError(SAVE_ERROR);
      })
      .finally(() => {
        clearLock.current = false;
        setClearBusy(false);
      });
  };

  return (
    <section aria-labelledby="coach-controls-heading" className="max-w-xl space-y-6">
      <div>
        <h2
          id="coach-controls-heading"
          className="font-heading text-xl font-semibold text-foreground"
        >
          How the coach pushes
        </h2>
        <p id="coach-push-dial-hint" className="mt-1 text-sm text-muted-foreground">
          0 is gentle. 10 is firm. Let go of the slider to save.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="coach-push-dial">How the coach pushes</Label>
          <p className="text-sm text-foreground">
            <span className="font-medium">{label}</span>
            <span className="text-muted-foreground"> {shown}</span>
          </p>
        </div>
        <input
          id="coach-push-dial"
          type="range"
          min={0}
          max={10}
          step={1}
          value={shown}
          aria-valuetext={`${label}, ${shown}`}
          aria-describedby="coach-push-dial-hint"
          onChange={(event) => {
            const next = clampDial(Number(event.target.value));
            draftRef.current = next;
            setSavedFlash(false);
            setError(null);
            setDraft(next);
          }}
          onPointerUp={(event) => {
            commitDial(Number(event.currentTarget.value));
          }}
          onKeyUp={(event) => {
            if (event.key === "Tab") return;
            commitDial(Number(event.currentTarget.value));
          }}
          onBlur={(event) => {
            commitDial(Number(event.currentTarget.value));
          }}
          className="w-full accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <output className="block min-h-5 text-sm text-muted-foreground">
          {savedFlash ? "Saved" : ""}
        </output>
      </div>

      {panicActive ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-3xl font-semibold leading-tight">
              {cardText}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{minutesCopy(minutes)}</p>
          </CardContent>
          <CardFooter>
            <Button type="button" variant="outline" onClick={onClear} disabled={clearBusy}>
              I&rsquo;m okay now
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="space-y-2">
          <Button type="button" variant="secondary" onClick={onPanic} disabled={panicBusy}>
            Panic
          </Button>
          <p className="text-sm text-muted-foreground">
            One small action, then the coach stays quiet until you clear it.
          </p>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
