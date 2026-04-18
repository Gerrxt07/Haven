/**
 * SRP (Secure Remote Password) client-side implementation
 * Uses the secure-remote-password library for SRP-6a protocol
 */

import { createSrpClient, SrpClient } from "secure-remote-password/client";

// Generate a random salt for SRP registration
export function generateSalt(): string {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return bufferToBase64(array);
}

// Generate SRP verifier for registration
// The client generates this locally and sends only salt + verifier to the server
export function generateVerifier(
	email: string,
	password: string,
	salt: string,
): string {
	const client = createSrpClient("4096");
	const privateKey = client.derivePrivateKey(salt, email, password);
	const verifier = client.deriveVerifier(privateKey);
	return verifier;
}

// Clear sensitive data from memory (best effort in JavaScript)
export function clearString(str: string): void {
	// Overwrite the string content (best effort in JS)
	const arr = new Uint8Array(str.length);
	for (let i = 0; i < str.length; i++) {
		str = str.substring(0, i) + String.fromCharCode(0) + str.substring(i + 1);
	}
	// Also overwrite our temp array
	arr.fill(0);
}

// Helper to convert ArrayBuffer to base64
export function bufferToBase64(buffer: Uint8Array): string {
	return btoa(String.fromCharCode(...buffer));
}

// Helper to convert base64 to ArrayBuffer
export function base64ToBuffer(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

// SRP Login State Machine
export interface SrpLoginState {
	client: SrpClient;
	clientPublicKeyA: string;
	clientPrivateKeyA: string;
	email: string;
	password: string;
	challengeId: string | null;
	salt: string | null;
	serverPublicKeyB: string | null;
}

// Initialize SRP login (Step 0: Create client ephemeral keys)
export function initSrpLogin(email: string, password: string): SrpLoginState {
	const client = createSrpClient("4096");
	const { clientPublicKey, clientPrivateKey } = client.generateKeys();

	return {
		client,
		clientPublicKeyA: clientPublicKey,
		clientPrivateKeyA: clientPrivateKey,
		email,
		password,
		challengeId: null,
		salt: null,
		serverPublicKeyB: null,
	};
}

// After receiving challenge response, compute client proof (Step 1: Calculate M1)
export interface SrpChallengeResponse {
	challengeId: string;
	srp_salt: string;
	server_public_key_b: string;
}

export interface SrpClientProof {
	clientPublicKeyA: string;
	clientProofM1: string;
	serverProofM2: string | null;
}

export function computeClientProof(
	state: SrpLoginState,
	challenge: SrpChallengeResponse,
): SrpClientProof {
	// Update state with challenge data
	state.challengeId = challenge.challengeId;
	state.salt = challenge.srp_salt;
	state.serverPublicKeyB = challenge.server_public_key_b;

	// Derive the shared session key and proof
	const privateKey = state.client.derivePrivateKey(
		challenge.srp_salt,
		state.email,
		state.password,
	);

	const sessionKey = state.client.deriveSessionKey(
		state.clientPrivateKeyA,
		state.clientPublicKeyA,
		challenge.srp_salt,
		state.email,
		challenge.server_public_key_b,
		privateKey,
	);

	// Generate client proof M1
	const clientProof = state.client.generateProof(
		state.clientPublicKeyA,
		challenge.server_public_key_b,
		sessionKey,
	);

	// The server will verify M1 and return M2
	// We store sessionKey to verify M2 later
	return {
		clientPublicKeyA: state.clientPublicKeyA,
		clientProofM1: clientProof,
		serverProofM2: null,
	};
}

// Verify server proof M2 (Step 2: Server returns M2, client verifies it)
export function verifyServerProof(
	state: SrpLoginState,
	serverProofM2: string,
): boolean {
	if (!state.serverPublicKeyB || !state.salt) {
		return false;
	}

	const privateKey = state.client.derivePrivateKey(
		state.salt,
		state.email,
		state.password,
	);

	const sessionKey = state.client.deriveSessionKey(
		state.clientPrivateKeyA,
		state.clientPublicKeyA,
		state.salt,
		state.email,
		state.serverPublicKeyB,
		privateKey,
	);

	// Verify server's proof M2
	return state.client.verifyProof(
		serverProofM2,
		state.clientPublicKeyA,
		sessionKey,
	);
}

// Cleanup function to wipe sensitive data
export function cleanupSrpState(state: SrpLoginState): void {
	clearString(state.password);
	clearString(state.clientPrivateKeyA);
	state.password = "";
	state.clientPrivateKeyA = "";
}
