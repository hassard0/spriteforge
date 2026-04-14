import { useRef, useCallback } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  preview: string | null;
  onUpload: (dataUrl: string) => void;
  onClear: () => void;
}

export function ReferenceUploader({ preview, onUpload, onClear }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please upload an image file' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Image must be under 10MB' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onUpload(reader.result as string);
    reader.readAsDataURL(file);
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />

      <div
        onClick={openPicker}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className={cn(
          'group relative overflow-hidden rounded-2xl border-2 border-dashed transition-all',
          preview
            ? 'border-primary/30 bg-card p-3 hover:border-primary/50'
            : 'border-border bg-secondary/10 p-5 hover:border-primary/40 hover:bg-secondary/20'
        )}
      >
        {preview ? (
          <div className="w-full space-y-3">
            <div className="overflow-hidden rounded-xl border border-border bg-background/50 p-3">
              <img
                src={preview}
                alt="Reference"
                className="h-44 w-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">Reference locked in</p>
                <p className="text-xs text-muted-foreground">Click the card or replace it with another character image.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    openPicker();
                  }}
                >
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    onClear();
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-background/30 px-4 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Drop character art here</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">PNG, JPG, or WEBP up to 10MB</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-9 text-xs"
              onClick={(event) => {
                event.stopPropagation();
                openPicker();
              }}
            >
              Browse image
            </Button>
          </div>
        )}
      </div>

      <p className="text-[11px] leading-4 text-muted-foreground">
        Use a clean, full-body character reference for the best silhouette and pose consistency.
      </p>
    </div>
  );
}
