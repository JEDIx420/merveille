/**
 * Strict Mono 16 kHz 16-bit PCM WAV validator (Stage N03, NAC-008).
 * Validates RIFF/WAVE header, PCM format, channel count, sample rate, bit depth,
 * declared data length vs actual bytes, and derives duration server-side.
 */

import { AuthorizationError } from "@/server/auth/policy";

export const MAX_VOICE_DURATION_SECONDS = 30;
export const EXPECTED_SAMPLE_RATE = 16000;
export const EXPECTED_CHANNELS = 1;
export const EXPECTED_BITS_PER_SAMPLE = 16;
export const MAX_WAV_BYTES = 44 + MAX_VOICE_DURATION_SECONDS * EXPECTED_SAMPLE_RATE * 2 + 4096; // ~964 KB

export interface ValidatedWavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataBytes: number;
  durationSeconds: number;
}

export function validateMono16kPcmWav(bytes: Uint8Array): ValidatedWavInfo {
  if (!bytes || bytes.byteLength < 44) {
    throw new AuthorizationError("Audio payload is empty or too short to be a valid WAV file.", "INVALID_AUDIO");
  }
  if (bytes.byteLength > MAX_WAV_BYTES) {
    throw new AuthorizationError("Audio exceeds maximum 30-second capture limit.", "AUDIO_TOO_LARGE");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = readAscii(bytes, 0, 4);
  const wave = readAscii(bytes, 8, 4);
  if (riff !== "RIFF" || wave !== "WAVE") {
    throw new AuthorizationError("Unsupported audio container. Mono 16 kHz 16-bit PCM WAV is required.", "INVALID_AUDIO");
  }

  let offset = 12;
  let fmtFound = false;
  let dataBytes = -1;
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;

  while (offset + 8 <= bytes.byteLength) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataStart = offset + 8;

    if (chunkDataStart + chunkSize > bytes.byteLength) {
      throw new AuthorizationError("Malformed WAV chunk length exceeds payload size.", "INVALID_AUDIO");
    }

    if (chunkId === "fmt ") {
      if (chunkSize < 16) {
        throw new AuthorizationError("Malformed WAV fmt chunk.", "INVALID_AUDIO");
      }
      audioFormat = view.getUint16(chunkDataStart, true);
      channels = view.getUint16(chunkDataStart + 2, true);
      sampleRate = view.getUint32(chunkDataStart + 4, true);
      bitsPerSample = view.getUint16(chunkDataStart + 14, true);
      fmtFound = true;
    } else if (chunkId === "data") {
      dataBytes = chunkSize;
      break;
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  if (!fmtFound || dataBytes <= 0) {
    throw new AuthorizationError("WAV file is missing required fmt or audio data chunk.", "INVALID_AUDIO");
  }
  if (audioFormat !== 1) {
    throw new AuthorizationError("Only uncompressed PCM WAV audio is supported.", "INVALID_AUDIO");
  }
  if (channels !== EXPECTED_CHANNELS) {
    throw new AuthorizationError("Audio must be mono (1 channel).", "INVALID_AUDIO");
  }
  if (sampleRate !== EXPECTED_SAMPLE_RATE) {
    throw new AuthorizationError("Audio sample rate must be 16000 Hz.", "INVALID_AUDIO");
  }
  if (bitsPerSample !== EXPECTED_BITS_PER_SAMPLE) {
    throw new AuthorizationError("Audio bit depth must be 16-bit PCM.", "INVALID_AUDIO");
  }

  const durationSeconds = dataBytes / (EXPECTED_SAMPLE_RATE * EXPECTED_CHANNELS * (EXPECTED_BITS_PER_SAMPLE / 8));
  if (durationSeconds <= 0 || durationSeconds > MAX_VOICE_DURATION_SECONDS) {
    throw new AuthorizationError(
      `Audio duration (${durationSeconds.toFixed(1)}s) must be between 0.1s and ${MAX_VOICE_DURATION_SECONDS}s.`,
      "AUDIO_TOO_LARGE"
    );
  }

  return {
    sampleRate,
    channels,
    bitsPerSample,
    dataBytes,
    durationSeconds,
  };
}

function readAscii(bytes: Uint8Array, start: number, len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += String.fromCharCode(bytes[start + i]);
  }
  return out;
}
