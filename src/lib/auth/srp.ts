/**
 * SRP (Secure Remote Password) client-side implementation
 * Uses the secure-remote-password library for SRP-6a protocol
 */

import type { Session as SrpClientSession } from "secure-remote-password/client";
import * as srpClient from "secure-remote-password/client";
import type { LoginChallengeResponse } from "../api/models";

// Generate a random salt for SRP registration
export function generateSalt(): string {
	return hexToBase64(srpClient.generateSalt());
}

// Generate SRP verifier for registration
// The client generates this locally and sends only salt + verifier to the server
export function generateVerifier(
	email: string,
	password: string,
	salt: string,
): string {
	const privateKey = srpClient.derivePrivateKey(
		base64ToHex(salt),
		email,
		password,
	);
	return hexToBase64(srpClient.deriveVerifier(privateKey));
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

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function hexToBase64(hex: string): string {
	return bufferToBase64(hexToBuffer(hex));
}

function base64ToHex(base64: string): string {
	return bytesToHex(base64ToBuffer(base64));
}

function hexToBuffer(hex: string): Uint8Array {
	const normalizedHex = hex.length % 2 === 0 ? hex : `0${hex}`;
	const bytes = new Uint8Array(normalizedHex.length / 2);
	for (let i = 0; i < normalizedHex.length; i += 2) {
		bytes[i / 2] = Number.parseInt(normalizedHex.slice(i, i + 2), 16);
	}
	return bytes;
}

// SRP Login State Machine
export interface SrpLoginState {
	clientPublicKeyA: string;
	clientPublicKeyAHex: string;
	clientPrivateKeyA: string;
	email: string;
	password: string;
	challengeId: string | null;
	salt: string | null;
	serverPublicKeyB: string | null;
	clientSession: SrpClientSession | null;
}

// Initialize SRP login (Step 0: Create client ephemeral keys)
export function initSrpLogin(email: string, password: string): SrpLoginState {
	const ephemeral = srpClient.generateEphemeral();

	return {
		clientPublicKeyA: hexToBase64(ephemeral.public),
		clientPublicKeyAHex: ephemeral.public,
		clientPrivateKeyA: ephemeral.secret,
		email,
		password,
		challengeId: null,
		salt: null,
		serverPublicKeyB: null,
		clientSession: null,
	};
}

export interface SrpClientProof {
	clientPublicKeyA: string;
	clientProofM1: string;
	serverProofM2: string | null;
}

export function computeClientProof(
	state: SrpLoginState,
	challenge: LoginChallengeResponse,
): SrpClientProof {
	// Update state with challenge data
	state.challengeId = challenge.challenge_id;
	state.salt = challenge.srp_salt;
	state.serverPublicKeyB = challenge.server_public_key_b;

	// Derive the shared session key and proof
	const privateKey = srpClient.derivePrivateKey(
		base64ToHex(challenge.srp_salt),
		state.email,
		state.password,
	);

	const clientSession = srpClient.deriveSession(
		state.clientPrivateKeyA,
		base64ToHex(challenge.server_public_key_b),
		base64ToHex(challenge.srp_salt),
		state.email,
		privateKey,
	);

	state.clientSession = clientSession;

	return {
		clientPublicKeyA: state.clientPublicKeyA,
		clientProofM1: hexToBase64(clientSession.proof),
		serverProofM2: null,
	};
}

// Verify server proof M2 (Step 2: Server returns M2, client verifies it)
export function verifyServerProof(
	state: SrpLoginState,
	serverProofM2: string,
): boolean {
	if (!state.serverPublicKeyB || !state.salt || !state.clientSession) {
		return false;
	}

	try {
		srpClient.verifySession(
			state.clientPublicKeyAHex,
			state.clientSession,
			base64ToHex(serverProofM2),
		);
		return true;
	} catch {
		return false;
	}
}

// Cleanup function to wipe sensitive data
export function cleanupSrpState(state: SrpLoginState): void {
	state.password = "";
	state.clientPrivateKeyA = "";
	state.clientSession = null;
}
