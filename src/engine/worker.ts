/// <reference lib="webworker" />

/**
 * Compression worker. One job at a time; the pool decides how many of these
 * exist. Everything heavy — WebAssembly, pixel buffers, the quantiser — lives
 * on this side of the boundary so the interface never blocks.
 */

import { DecodeError, ImageTooLargeError } from './codecs';
import { compressImage, sampleQualities } from './pipeline';
import type { ErrorMessage, WorkerRequest, WorkerResponse } from './protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;

function post(message: WorkerResponse, transfer?: Transferable[]): void {
  scope.postMessage(message, { transfer: transfer ?? [] });
}

function classify(error: unknown): Pick<ErrorMessage, 'message' | 'code'> {
  if (error instanceof ImageTooLargeError) {
    return { message: error.message, code: 'too-large' };
  }
  if (error instanceof DecodeError) {
    return { message: error.message, code: 'decode' };
  }
  if (error instanceof RangeError) {
    return {
      message: 'The browser ran out of memory on this image. Try one file at a time.',
      code: 'oom',
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  // Emscripten reports allocation failure as a plain abort string.
  if (/out of memory|allocation failed|Aborted/i.test(message)) {
    return {
      message: 'The browser ran out of memory on this image. Try one file at a time.',
      code: 'oom',
    };
  }
  return { message: message || 'Compression failed for an unknown reason.', code: 'internal' };
}

scope.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  void handle(request).catch((error: unknown) => {
    post({ type: 'error', id: request.id, ...classify(error) });
  });
});

async function handle(request: WorkerRequest): Promise<void> {
  const input = new Uint8Array(request.bytes);

  if (request.type === 'compress') {
    const { bytes, outcome } = await compressImage(
      input,
      request.mimeType,
      request.settings,
      (phase, value) => post({ type: 'progress', id: request.id, phase, value }),
    );
    // `bytes` may be a view onto the input buffer (the pass-through path), so
    // copy before transferring to avoid detaching something still in use.
    const payload = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
      ? (bytes.buffer as ArrayBuffer)
      : (bytes.slice().buffer as ArrayBuffer);
    post({ type: 'done', id: request.id, bytes: payload, outcome }, [payload]);
    return;
  }

  if (request.type === 'sample') {
    const { samples, width, height } = await sampleQualities(
      input,
      request.mimeType,
      request.format,
      request.qualities,
      request.settings,
      (phase, value) => post({ type: 'progress', id: request.id, phase, value }),
    );
    const payload = samples.map((sample) => ({
      quality: sample.quality,
      bytes: sample.bytes.slice().buffer as ArrayBuffer,
    }));
    post(
      {
        type: 'sampled',
        id: request.id,
        samples: payload,
        width,
        height,
        format: request.format,
      },
      payload.map((sample) => sample.bytes),
    );
    return;
  }

  const exhaustive: never = request;
  throw new Error(`Unknown request: ${JSON.stringify(exhaustive)}`);
}
