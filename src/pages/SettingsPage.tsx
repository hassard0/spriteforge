import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { ART_STYLES } from '@/lib/art-styles';
import { toast } from '@/hooks/use-toast';
import { Save, RotateCcw, Download, Upload, Shield, Trash2 } from 'lucide-react';
import * as store from '@/lib/sprite-store';

const SETTINGS_KEY = 'sprite-gen-settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function SettingsPage() {
  const initial = loadSettings() || {};
  const [defaultStyle, setDefaultStyle] = useState<string>(initial.defaultStyle || 'pixel-16bit');
  const [defaultRes, setDefaultRes] = useState<string>(initial.defaultRes || '64x64');
  const [autoSave, setAutoSave] = useState<boolean>(initial.autoSave ?? true);
  const [darkGrid, setDarkGrid] = useState<boolean>(initial.darkGrid ?? true);
  const [qaStrictness, setQaStrictness] = useState<number>(initial.qaStrictness ?? 5);
  const [maxRetries, setMaxRetries] = useState<number>(initial.maxRetries ?? 3);
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState<any>(null);
  const [showReset, setShowReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ defaultStyle, defaultRes, autoSave, darkGrid, qaStrictness, maxRetries }),
    );
    toast({ title: 'Settings saved' });
  };

  const handleExport = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      sprites: store.getSprites(),
      collections: store.getCollections(),
      settings: { defaultStyle, defaultRes, autoSave, darkGrid, qaStrictness, maxRetries },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spriteforge-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported data' });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        setImportData(parsed);
        setShowImport(true);
      } catch {
        toast({ title: 'Invalid JSON file' });
      }
    };
    reader.readAsText(file);
    // reset input
    e.target.value = '';
  };

  const doImport = (mode: 'merge' | 'overwrite') => {
    if (!importData) return;
    try {
      const sprites = Array.isArray(importData.sprites) ? importData.sprites : [];
      const collections = Array.isArray(importData.collections) ? importData.collections : [];
      if (mode === 'overwrite') {
        store.saveSprites(sprites);
        store.saveCollections(collections);
      } else {
        const existingSprites = store.getSprites();
        const spriteIds = new Set(existingSprites.map((s) => s.id));
        const mergedSprites = [...existingSprites, ...sprites.filter((s: any) => !spriteIds.has(s.id))];
        store.saveSprites(mergedSprites);
        const existingCols = store.getCollections();
        const colIds = new Set(existingCols.map((c) => c.id));
        const mergedCols = [...existingCols, ...collections.filter((c: any) => !colIds.has(c.id))];
        store.saveCollections(mergedCols);
      }
      if (importData.settings) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(importData.settings));
      }
      setShowImport(false);
      setImportData(null);
      toast({ title: 'Imported', description: `${mode === 'overwrite' ? 'Overwrote' : 'Merged'} data — reload to see changes.` });
    } catch (err: any) {
      toast({ title: 'Import failed', description: err?.message || 'Unknown error' });
    }
  };

  const handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/30">
        <h1 className="font-pixel text-xs text-primary glow-green tracking-wider">SETTINGS</h1>
        <Button onClick={handleSave} size="sm" className="font-pixel text-[10px] gap-1 h-7" aria-label="Save settings">
          <Save className="h-3 w-3" /> SAVE
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">
          <section className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Generation Defaults
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Default Style</Label>
                <Select value={defaultStyle} onValueChange={setDefaultStyle}>
                  <SelectTrigger className="mt-1.5 bg-secondary/30 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ART_STYLES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.icon} {s.shortName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Default Resolution</Label>
                <Select value={defaultRes} onValueChange={setDefaultRes}>
                  <SelectTrigger className="mt-1.5 bg-secondary/30 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="32x32">32×32</SelectItem>
                    <SelectItem value="64x64">64×64</SelectItem>
                    <SelectItem value="128x128">128×128</SelectItem>
                    <SelectItem value="256x256">256×256</SelectItem>
                    <SelectItem value="512x512">512×512</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quality Assurance
              </h2>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">QA Strictness</Label>
                <span className="text-[10px] text-primary font-bold">{qaStrictness}/10</span>
              </div>
              <Slider value={[qaStrictness]} onValueChange={([v]) => setQaStrictness(v)} min={1} max={10} step={1} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Max Auto-Retries</Label>
                <span className="text-[10px] text-primary font-bold">{maxRetries}</span>
              </div>
              <Slider value={[maxRetries]} onValueChange={([v]) => setMaxRetries(v)} min={1} max={5} step={1} />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Preferences
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Auto-save generated sprites</Label>
                <p className="text-[10px] text-muted-foreground">Automatically save sprites to library after generation</p>
              </div>
              <Switch checked={autoSave} onCheckedChange={setAutoSave} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Pixel grid overlay</Label>
                <p className="text-[10px] text-muted-foreground">Show grid in preview by default</p>
              </div>
              <Switch checked={darkGrid} onCheckedChange={setDarkGrid} />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Data Management
            </h2>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" size="sm" className="text-xs gap-1.5" onClick={handleExport} aria-label="Export all data">
                <Download className="h-3 w-3" /> Export all
              </Button>
              <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
              <Button
                variant="secondary"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Import data"
              >
                <Upload className="h-3 w-3" /> Import
              </Button>
              <Button variant="destructive" size="sm" className="text-xs gap-1.5" onClick={() => setShowReset(true)} aria-label="Reset all data">
                <Trash2 className="h-3 w-3" /> Reset all
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              All sprites and collections are stored locally in your browser. Export regularly to back up.
            </p>
          </section>
        </div>
      </div>

      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import data</DialogTitle>
            <DialogDescription>
              Merge combines the imported data with existing data (keeping existing on ID conflicts).
              Overwrite replaces all local sprites and collections with the imported set.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setShowImport(false)}>Cancel</Button>
            <Button variant="secondary" size="sm" onClick={() => doImport('merge')}>Merge</Button>
            <Button variant="destructive" size="sm" onClick={() => doImport('overwrite')}>Overwrite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReset} onOpenChange={setShowReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset all data?</DialogTitle>
            <DialogDescription>
              This clears all local sprites, collections, and settings and reloads the app. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setShowReset(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="h-3 w-3" /> Reset all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
