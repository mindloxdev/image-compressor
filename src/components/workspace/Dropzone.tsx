import { ImagePlus, Upload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { MAX_FILE_BYTES, MAX_FILES } from '@/hooks/useCompressionQueue';

export interface DropzoneProps {
  onFiles: (files: File[]) => void;
  /** Accept attribute for the picker, e.g. `image/jpeg`. */
  accept?: string;
  /** Format names to show as chips. */
  formats?: readonly string[];
  compact?: boolean;
}

/**
 * The upload surface.
 *
 * Dragging is one of two ways in, never the only one: the whole area is a
 * button that opens the file picker, which WCAG 2.2 requires and which is also
 * how most people actually use it.
 */
export function Dropzone({
  onFiles,
  accept = 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,image/tiff',
  formats = ['JPG', 'PNG', 'WebP', 'AVIF', 'GIF', 'BMP'],
  compact = false,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  // Drag events fire for every child element; a counter avoids flicker.
  const depth = useRef(0);

  const open = useCallback(() => inputRef.current?.click(), []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault();
        depth.current -= 1;
        if (depth.current <= 0) {
          depth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={onDrop}
      className={`relative rounded-card border-2 border-dashed transition-colors duration-200 ${
        dragging ? 'border-brand bg-brand-soft' : 'border-line-strong bg-surface'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        aria-label="Choose images to compress"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFiles(files);
          // Reset so picking the same file twice still fires a change event.
          event.target.value = '';
        }}
      />

      <button
        type="button"
        onClick={open}
        className={`flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-card text-center ${
          compact ? 'px-5 py-8' : 'px-6 py-14 sm:py-20'
        }`}
      >
        <span
          className={`flex items-center justify-center rounded-full bg-brand-soft text-brand ${
            compact ? 'h-11 w-11' : 'h-14 w-14'
          }`}
        >
          {dragging ? (
            <Upload size={compact ? 20 : 24} aria-hidden="true" />
          ) : (
            <ImagePlus size={compact ? 20 : 24} aria-hidden="true" />
          )}
        </span>

        <span className={`font-semibold text-ink ${compact ? 'text-base' : 'text-xl sm:text-2xl'}`}>
          {dragging ? 'Drop them here' : 'Drop images here'}
        </span>
        <span className="text-sm text-muted">
          or <span className="font-medium text-brand underline underline-offset-2">browse your files</span>
        </span>
      </button>

      <div className="flex flex-wrap items-center justify-center gap-1.5 px-5 pb-5">
        {formats.map((format) => (
          <span key={format} className="chip">
            {format}
          </span>
        ))}
      </div>

      <p className="px-5 pb-5 text-center text-xs text-faint">
        Up to {MAX_FILES} images at once, {MAX_FILE_BYTES / 1024 / 1024} MB each. Everything is
        processed on this device — nothing is uploaded.
      </p>
    </div>
  );
}
