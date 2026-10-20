/**
 * The message contract between the UI and the compression workers.
 * Imported by both sides, so it must stay free of any codec import.
 */

import type { EncodableFormat } from './formats';
import type { CompressionOutcome, CompressionSettings } from './types';

export interface CompressRequest {
  type: 'compress';
  id: string;
  /** Transferred, not copied — the UI keeps its own copy of the file. */
  bytes: ArrayBuffer;
  mimeType: string;
  settings: CompressionSettings;
}

export interface SampleRequest {
  type: 'sample';
  id: string;
  bytes: ArrayBuffer;
  mimeType: string;
  format: EncodableFormat;
  qualities: number[];
  /** Resize and codec settings are honoured so the sizes are the real ones. */
  settings: CompressionSettings;
}

export type WorkerRequest = CompressRequest | SampleRequest;

export type ProgressPhase = 'decoding' | 'resizing' | 'encoding' | 'searching' | 'optimising';

export interface ProgressMessage {
  type: 'progress';
  id: string;
  phase: ProgressPhase;
  /** 0–1. Monotonic within a job. */
  value: number;
}

export interface CompressDoneMessage {
  type: 'done';
  id: string;
  bytes: ArrayBuffer;
  outcome: CompressionOutcome;
}

export interface SampleDoneMessage {
  type: 'sampled';
  id: string;
  samples: { quality: number; bytes: ArrayBuffer }[];
  width: number;
  height: number;
  /** Format the samples were written in — drives the preview blob type. */
  format: EncodableFormat;
}

export interface ErrorMessage {
  type: 'error';
  id: string;
  message: string;
  /** Set when the failure is a known, explainable condition. */
  code?: 'decode' | 'too-large' | 'unsupported' | 'oom' | 'internal';
}

export type WorkerResponse =
  | ProgressMessage
  | CompressDoneMessage
  | SampleDoneMessage
  | ErrorMessage;
