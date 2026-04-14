import { useRef, useCallback } from 'react';
import { Upload, X } from 'lucide-react';
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Reference
        </span>
        {preview && (
          <Button variant="ghost" size="sm" className="h-5 text-[9px] text-muted-foreground px-1.5 gap-0.5" onClick={onClear}>
            <X className="h-2.5 w-2.5" /> Clear
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
          flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-all
          ${preview
            ? 'border-primary/30 bg-card p-2 hover:border-primary/50'
            : 'border-border bg-secondary/10 p-4 hover:border-primary/40 hover:bg-secondary/20'
          }
        `}
      >
        {preview ? (
          <img
            src={preview}
            alt="Reference"
            className="max-h-[100px] max-w-full object-contain rounded"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-center">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground">Drop image here</p>
          </div>
        )}
      </div>
    </div>
  );
}
