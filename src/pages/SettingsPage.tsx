import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';

export default function SettingsPage() {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [defaultRes, setDefaultRes] = useState('32x32');
  const [defaultPalette, setDefaultPalette] = useState('nes');
  const [autoSave, setAutoSave] = useState(true);
  const [darkGrid, setDarkGrid] = useState(true);

  const handleSave = () => {
    toast({ title: '✓ Settings saved', description: 'Your preferences have been updated.' });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in">
      <h1 className="font-pixel text-lg text-primary glow-green mb-6">SETTINGS</h1>

      <div className="space-y-6">
        {/* API Configuration */}
        <div className="bg-card rounded-lg pixel-border p-5 space-y-4">
          <h2 className="font-pixel text-[10px] text-muted-foreground uppercase tracking-wider">API Configuration</h2>
          <div>
            <Label className="text-xs text-muted-foreground">API Endpoint URL</Label>
            <Input
              placeholder="https://api.example.com/generate"
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              className="mt-1 bg-secondary/50"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">API Key</Label>
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="mt-1 bg-secondary/50"
            />
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            Connect your ML inference endpoint for real sprite generation. Currently using mock generation.
          </p>
        </div>

        {/* Defaults */}
        <div className="bg-card rounded-lg pixel-border p-5 space-y-4">
          <h2 className="font-pixel text-[10px] text-muted-foreground uppercase tracking-wider">Defaults</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Default Resolution</Label>
              <Select value={defaultRes} onValueChange={setDefaultRes}>
                <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="16x16">16×16</SelectItem>
                  <SelectItem value="32x32">32×32</SelectItem>
                  <SelectItem value="48x48">48×48</SelectItem>
                  <SelectItem value="64x64">64×64</SelectItem>
                  <SelectItem value="128x128">128×128</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Default Palette</Label>
              <Select value={defaultPalette} onValueChange={setDefaultPalette}>
                <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nes">NES</SelectItem>
                  <SelectItem value="snes">SNES</SelectItem>
                  <SelectItem value="gameboy">Game Boy</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-card rounded-lg pixel-border p-5 space-y-4">
          <h2 className="font-pixel text-[10px] text-muted-foreground uppercase tracking-wider">Preferences</h2>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Auto-save generated sprites</Label>
              <p className="text-[10px] text-muted-foreground">Automatically save sprites to library after generation</p>
            </div>
            <Switch checked={autoSave} onCheckedChange={setAutoSave} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Dark grid overlay</Label>
              <p className="text-[10px] text-muted-foreground">Show dark pixel grid in preview by default</p>
            </div>
            <Switch checked={darkGrid} onCheckedChange={setDarkGrid} />
          </div>
        </div>

        {/* Data */}
        <div className="bg-card rounded-lg pixel-border p-5 space-y-4">
          <h2 className="font-pixel text-[10px] text-muted-foreground uppercase tracking-wider">Data</h2>
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" className="text-xs" onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}>
              Reset All Data
            </Button>
            <Button variant="secondary" size="sm" className="text-xs" onClick={() => {
              const data = {
                sprites: localStorage.getItem('sprite-gen-sprites'),
                collections: localStorage.getItem('sprite-gen-collections'),
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'spritegen-backup.json';
              a.click();
            }}>
              Export Backup
            </Button>
          </div>
        </div>

        <Button onClick={handleSave} className="w-full font-pixel text-xs gap-2">
          <Save className="h-3.5 w-3.5" /> SAVE SETTINGS
        </Button>
      </div>
    </div>
  );
}
