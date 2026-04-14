import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ART_STYLES } from '@/lib/art-styles';
import { toast } from '@/hooks/use-toast';
import { Save, RotateCcw, Download, Shield } from 'lucide-react';

export default function SettingsPage() {
  const [defaultStyle, setDefaultStyle] = useState('pixel-16bit');
  const [defaultRes, setDefaultRes] = useState('64x64');
  const [autoSave, setAutoSave] = useState(true);
  const [darkGrid, setDarkGrid] = useState(true);
  const [qaStrictness, setQaStrictness] = useState(5);
  const [maxRetries, setMaxRetries] = useState(3);

  const handleSave = () => {
    toast({ title: '✓ Settings saved', description: 'Your preferences have been updated.' });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/30">
        <h1 className="font-pixel text-xs text-primary glow-green tracking-wider">SETTINGS</h1>
        <Button onClick={handleSave} size="sm" className="font-pixel text-[10px] gap-1 h-7">
          <Save className="h-3 w-3" /> SAVE
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Generation Defaults */}
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
                    {ART_STYLES.map(s => (
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

          {/* QA Settings */}
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
              <Slider
                value={[qaStrictness]}
                onValueChange={([v]) => setQaStrictness(v)}
                min={1}
                max={10}
                step={1}
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Higher = stricter checks, more retries. Lower = accept more results.
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Max Auto-Retries</Label>
                <span className="text-[10px] text-primary font-bold">{maxRetries}</span>
              </div>
              <Slider
                value={[maxRetries]}
                onValueChange={([v]) => setMaxRetries(v)}
                min={1}
                max={5}
                step={1}
              />
            </div>
          </section>

          {/* Preferences */}
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

          {/* Data Management */}
          <section className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Data Management
            </h2>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => {
                  toast({ title: 'Data cleared', description: 'Local cache has been reset.' });
                }}
              >
                <RotateCcw className="h-3 w-3" /> Reset Cache
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => {
                  toast({ title: 'Export coming soon', description: 'Bulk export will be available in a future update.' });
                }}
              >
                <Download className="h-3 w-3" /> Export All
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Your sprites and collections are stored securely in the cloud and linked to your account.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
