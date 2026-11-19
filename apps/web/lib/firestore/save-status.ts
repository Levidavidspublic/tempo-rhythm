export const SAVE_COPY_KEYS = [
  "fs.save.saving",
  "fs.save.saved",
  "fs.save.on-device",
  "fs.save.loading",
] as const;

export type SaveState = "loading" | "saving" | "saved" | "on-device";

export type SaveStatus = {
  state: SaveState;
  copyKey: (typeof SAVE_COPY_KEYS)[number];
};

const SAVE_STATUSES: Record<SaveState, SaveStatus> = {
  loading: { state: "loading", copyKey: "fs.save.loading" },
  saving: { state: "saving", copyKey: "fs.save.saving" },
  saved: { state: "saved", copyKey: "fs.save.saved" },
  "on-device": { state: "on-device", copyKey: "fs.save.on-device" },
};

export function readSaveStatus(input: {
  hasSnapshot: boolean;
  hasPendingWrites: boolean;
  fromCache: boolean;
  online: boolean;
}): SaveStatus {
  if (!input.hasSnapshot) return SAVE_STATUSES.loading;
  if (!input.hasPendingWrites) return SAVE_STATUSES.saved;
  return input.online ? SAVE_STATUSES.saving : SAVE_STATUSES["on-device"];
}

const SAVE_STATE_PRIORITY: Record<SaveState, number> = {
  "on-device": 0,
  saving: 1,
  loading: 2,
  saved: 3,
};

export function mergeSaveStatus(statuses: readonly SaveStatus[]): SaveStatus {
  if (statuses.length === 0) return SAVE_STATUSES.loading;

  return statuses.reduce((worst, status) =>
    SAVE_STATE_PRIORITY[status.state] < SAVE_STATE_PRIORITY[worst.state] ? status : worst,
  );
}
