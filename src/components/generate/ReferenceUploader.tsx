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
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (w < 32 || h < 32) {
          toast({ title: 'Image too small', description: `Minimum 32×32 (got ${w}×${h})` });
          return;
        }
        if (w < 50 || h < 50 || w > 2000 || h > 2000) {
          toast({ title: 'Unusual dimensions', description: `Recommended 50–2000 px (got ${w}×${h})` });
        }
        onUpload(dataUrl);
      };
      img.onerror = () => toast({ title: 'Could not read image' });
      img.src = dataUrl;
    };
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
    <div>
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
        className={`flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-all ${
          preview
            ? 'border-primary/30 bg-card p-1.5 hover:border-primary/50'
            : 'border-border bg-secondary/10 p-4 hover:border-primary/40 hover:bg-secondary/20'
        }`}
      >
        {preview ? (
          <div className="relative">
            <img src={preview} alt="Reference" className="max-h-[100px] max-w-full object-contain rounded" style={{ imageRendering: 'pixelated' }} />
            <Button type="button" variant="ghost" size="icon" className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-card border border-border text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); onClear(); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
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
