import { authSession } from "../auth/session";
import { chatSyncService } from "../chat";
import { friendsService } from "../friends/service";
import { realtimeManager } from "../realtime";
import { setSessionSnapshot } from "../state";

let initialized = false;
let activeUserId: number | null = null;

export async function initRuntimeServices(): Promise<void> {
	if (initialized) {
		return;
	}

	initialized = true;
	authSession.onChange((state) => {
		setSessionSnapshot(state);
		const nextUserId = state.currentUser?.id ?? null;
		if (nextUserId !== activeUserId) {
			activeUserId = nextUserId;
			friendsService.destroy();
			if (nextUserId !== null) {
				void friendsService.init();
			}
		}
	});
	await authSession.bootstrapFromStorage();
	chatSyncService.attachRealtimeHandlers();
	realtimeManager.connect();
}
