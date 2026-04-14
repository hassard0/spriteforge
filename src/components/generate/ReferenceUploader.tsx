import { useRef, useCallback } from 'react';
import { Upload, X, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface Props {
  preview: string | null;
  onUpload: (dataUrl: string) => void;
  onClear: () => void;
}

export function ReferenceUploader({ preview, onUpload, onClear }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Reference Character
        </label>
        {preview && (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground gap-1" onClick={onClear}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />

      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className={`
          relative flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-all
          ${preview
            ? 'border-primary/30 bg-card p-3 hover:border-primary/50'
            : 'border-border bg-secondary/20 p-8 hover:border-primary/40 hover:bg-secondary/30'
          }
        `}
      >
        {preview ? (
          <div className="flex items-center gap-4 w-full">
            <div className="flex-shrink-0 h-20 w-20 rounded-lg bg-secondary/50 flex items-center justify-center overflow-hidden">
              <img
                src={preview}
                alt="Reference"
                className="max-h-full max-w-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground">Reference uploaded</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Click to replace or drag a new image</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="rounded-xl bg-secondary/50 p-3">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Drop your character image here</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">PNG, JPG, WEBP up to 10MB</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
