/**
 * S14 reminders through a messaging channel (PRD F-61). Which channel Tempo will use is UNKNOWN
 * (Needs Amit), so this is the seam only: the adapter shape, inert placeholders that can never
 * send, and a registry with no live channel. Plain TypeScript, no network, no keys.
 */

export type ConnectResult =
	| { ok: true }
	| { ok: false; reason: "not_connected" | "not_available" };

export type SendResult =
	| { ok: true }
	| { ok: false; reason: "not_connected" | "empty_text" | "send_failed" };

/** One messaging channel a nag could reach the person through. */
export type ReminderChannel = {
	readonly id: string;
	readonly label: string;
	readonly kind: "messaging";
	connect(): Promise<ConnectResult>;
	/** `to` is the channel's own address for the person; `text` is only their own words (F-60). */
	send(to: string, text: string): Promise<SendResult>;
};

/** What the Settings list and the `reminders.channels` query show for a channel. */
export type ReminderChannelInfo = {
	id: string;
	label: string;
	kind: "messaging";
	connected: boolean;
};

/**
 * A placeholder for a channel nobody has connected. It never touches the network: connecting
 * says it isn't available and sending always answers `not_connected`.
 */
export function notConnectedChannel(
	id: string,
	label: string,
): ReminderChannel {
	return {
		id,
		label,
		kind: "messaging",
		connect: async () => ({ ok: false, reason: "not_available" }),
		send: async () => ({ ok: false, reason: "not_connected" }),
	};
}

type Entry = { channel: ReminderChannel; connected: boolean };

export type ReminderRegistry = {
	/** Every channel, in display order, with whether it is connected. */
	list(): ReminderChannelInfo[];
	/** Whether `id` names a channel in the registry (connected or not). */
	has(id: string): boolean;
	/** The channel only when it is connected; null otherwise. */
	live(id: string): ReminderChannel | null;
};

export function createReminderRegistry(
	entries: readonly Entry[],
): ReminderRegistry {
	const byId = new Map(
		entries.map((entry) => [entry.channel.id, entry] as const),
	);
	return {
		list: () =>
			entries.map(({ channel, connected }) => ({
				id: channel.id,
				label: channel.label,
				kind: channel.kind,
				connected,
			})),
		has: (id) => byId.has(id),
		live: (id) => {
			const entry = byId.get(id);
			return entry?.connected ? entry.channel : null;
		},
	};
}

/**
 * Candidate channels [EXTRAPOLATED from the planned connectors in Settings > Integrations].
 * None is connected and each is an inert placeholder, so nothing here can send.
 */
export const REMINDER_CHANNEL_IDS = ["whatsapp", "telegram", "sms"] as const;

export const reminderRegistry: ReminderRegistry = createReminderRegistry([
	{ channel: notConnectedChannel("whatsapp", "WhatsApp"), connected: false },
	{ channel: notConnectedChannel("telegram", "Telegram"), connected: false },
	{ channel: notConnectedChannel("sms", "SMS"), connected: false },
]);
