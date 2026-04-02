import { QueryClient } from "@tanstack/solid-query";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 2,
			staleTime: 20_000,
			gcTime: 5 * 60_000,
			refetchOnWindowFocus: false,
		},
		mutations: {
			retry: 0,
		},
	},
});
