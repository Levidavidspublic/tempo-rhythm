export type ChecklistStep = {
  id: string;
  text: string;
  completed: boolean;
};

export function undoFeedback(result: { success: boolean }) {
  return result.success
    ? "Task restored."
    : "That undo has expired, so the task stays deleted.";
}

export function addStep(
  steps: readonly ChecklistStep[],
  text: string,
  id: string,
): ChecklistStep[] {
  const trimmedText = text.trim();
  if (!trimmedText) return [...steps];

  return [...steps, { id, text: trimmedText, completed: false }];
}

export function toggleStep(steps: readonly ChecklistStep[], id: string): ChecklistStep[] {
  return steps.map((step) =>
    step.id === id ? { ...step, completed: !step.completed } : step,
  );
}

export function renameStep(
  steps: readonly ChecklistStep[],
  id: string,
  text: string,
): ChecklistStep[] {
  const trimmedText = text.trim();
  if (!trimmedText) return [...steps];

  return steps.map((step) => (step.id === id ? { ...step, text: trimmedText } : step));
}

export function removeStep(steps: readonly ChecklistStep[], id: string): ChecklistStep[] {
  return steps.filter((step) => step.id !== id);
}

export function progress(steps: readonly ChecklistStep[]) {
  return {
    completed: steps.filter((step) => step.completed).length,
    total: steps.length,
  };
}
