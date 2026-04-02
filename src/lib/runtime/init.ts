import { authSession } from "../auth/session";
import { chatSyncService } from "../chat";
import { realtimeManager } from "../realtime";

let initialized = false;

export async function initRuntimeServices(): Promise<void> {
	if (initialized) {
		return;
	}

	initialized = true;
	await authSession.bootstrapFromStorage();
	chatSyncService.attachRealtimeHandlers();
	realtimeManager.connect();
}
