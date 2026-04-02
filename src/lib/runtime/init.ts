import { authSession } from "../auth/session";
import { chatSyncService } from "../chat";
import { realtimeManager } from "../realtime";
import { setSessionSnapshot } from "../state";

let initialized = false;

export async function initRuntimeServices(): Promise<void> {
	if (initialized) {
		return;
	}

	initialized = true;
	authSession.onChange((state) => {
		setSessionSnapshot(state);
	});
	await authSession.bootstrapFromStorage();
	chatSyncService.attachRealtimeHandlers();
	realtimeManager.connect();
}
