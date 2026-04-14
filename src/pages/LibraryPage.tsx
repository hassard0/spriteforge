import { useState, useMemo } from 'react';
import { useSprites } from '@/hooks/use-sprites';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SpritePreviewPlayer } from '@/components/SpritePreviewPlayer';
import { Badge } from '@/components/ui/badge';
import { ART_STYLES } from '@/lib/art-styles';
import { Search, Trash2, Download, X, Sparkles, Filter } from 'lucide-react';
import type { SpriteSheet } from '@/types/sprite';

function SpriteCard({ sprite, selected, onToggle, onClick }: {
  sprite: SpriteSheet;
  selected: boolean;
  onToggle: () => void;
  onClick: () => void;
}) {
  const styleInfo = ART_STYLES.find(s => sprite.tags?.includes(s.id));

  return (
    <div
      className={`group relative rounded-xl border overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:shadow-primary/5 ${
        selected
          ? 'border-primary ring-1 ring-primary bg-primary/5'
          : 'border-border bg-card hover:border-primary/40'
      }`}
      onClick={onClick}
    >
      {/* Checkbox */}
      <div className="absolute top-2 left-2 z-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={e => { e.stopPropagation(); onToggle(); }}
          onClick={e => e.stopPropagation()}
          className="accent-primary h-3.5 w-3.5 rounded"
        />
      </div>

      {/* Thumbnail */}
      <div className="aspect-square bg-secondary/30 flex items-center justify-center p-3 relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <img
          src={sprite.imageData}
          alt={sprite.name}
          className="relative max-w-full max-h-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5 border-t border-border/50">
        <h3 className="text-xs font-semibold truncate">{sprite.name}</h3>
        <div className="flex items-center gap-1 flex-wrap">
          {styleInfo && (
            <Badge variant="secondary" className="text-[9px] gap-0.5 h-4 px-1.5">
              <span>{styleInfo.icon}</span> {styleInfo.shortName}
            </Badge>
          )}
          <Badge variant="outline" className="text-[9px] h-4 px-1.5">{sprite.gridSize}</Badge>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {sprite.frameCount} frame{sprite.frameCount !== 1 ? 's' : ''} · {sprite.pose}
        </p>
      </div>
    </div>
  );
}

const POSE_OPTIONS = [
  'idle', 'walking', 'running', 'jumping', 'falling',
  'attacking-melee', 'attacking-ranged', 'magic-casting',
  'blocking', 'crouching', 'climbing', 'swimming',
  'dying', 'hurt', 'celebrating', 'sitting', 'sleeping',
  'dashing', 'flying', 'charging',
];

export default function LibraryPage() {
  const { sprites, deleteSpritesById } = useSprites();
  const [search, setSearch] = useState('');
  const [filterPose, setFilterPose] = useState<string>('all');
  const [filterStyle, setFilterStyle] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailSprite, setDetailSprite] = useState<SpriteSheet | null>(null);

  const filtered = useMemo(() => {
    return sprites.filter(s => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.prompt.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterPose !== 'all' && s.pose !== filterPose) return false;
      if (filterStyle !== 'all' && !s.tags?.includes(filterStyle)) return false;
      return true;
    });
  }, [sprites, search, filterPose, filterStyle]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDelete = () => {
    deleteSpritesById([...selected]);
    setSelected(new Set());
  };

  const handleDownloadSelected = () => {
    filtered.filter(s => selected.has(s.id)).forEach(s => {
      const a = document.createElement('a');
      a.href = s.imageData;
      a.download = `${s.name.replace(/\s+/g, '_')}.png`;
      a.click();
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/30">
        <div className="flex items-center gap-3">
          <h1 className="font-pixel text-xs text-primary glow-green tracking-wider">LIBRARY</h1>
          <span className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
            {sprites.length} sprite{sprites.length !== 1 ? 's' : ''}
          </span>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{selected.size} selected</span>
            <Button variant="secondary" size="sm" className="h-7 text-[10px] gap-1" onClick={handleDownloadSelected}>
              <Download className="h-3 w-3" /> Export
            </Button>
            <Button variant="destructive" size="sm" className="h-7 text-[10px] gap-1" onClick={handleDelete}>
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(new Set())}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search sprites..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-secondary/30 h-8 text-xs border-border"
              />
            </div>
            <Select value={filterPose} onValueChange={setFilterPose}>
              <SelectTrigger className="w-[130px] bg-secondary/30 h-8 text-xs">
                <SelectValue placeholder="Pose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Poses</SelectItem>
                {POSE_OPTIONS.map(p => (
                  <SelectItem key={p} value={p}>{p.replace(/-/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStyle} onValueChange={setFilterStyle}>
              <SelectTrigger className="w-[130px] bg-secondary/30 h-8 text-xs">
                <SelectValue placeholder="Style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Styles</SelectItem>
                {ART_STYLES.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.icon} {s.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No sprites found</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Generate some sprites or adjust your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map(s => (
                <SpriteCard
                  key={s.id}
                  sprite={s}
                  selected={selected.has(s.id)}
                  onToggle={() => toggleSelect(s.id)}
                  onClick={() => setDetailSprite(s)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detailSprite} onOpenChange={open => !open && setDetailSprite(null)}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-pixel text-[11px] text-primary">{detailSprite?.name}</DialogTitle>
          </DialogHeader>
          {detailSprite && (
            <div className="space-y-4">
              <SpritePreviewPlayer
                imageData={detailSprite.imageData}
                frameWidth={detailSprite.frameWidth}
                frameHeight={detailSprite.frameHeight}
              />
              <div className="grid grid-cols-3 gap-3 text-[10px] rounded-lg border border-border p-3">
                <div>
                  <span className="text-muted-foreground uppercase">Prompt</span>
                  <p className="mt-0.5 text-foreground">{detailSprite.prompt}</p>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase">Pose</span>
                  <p className="mt-0.5 text-foreground">{detailSprite.pose}</p>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase">Angle</span>
                  <p className="mt-0.5 text-foreground">{detailSprite.viewingAngle}</p>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase">Grid</span>
                  <p className="mt-0.5 text-foreground">{detailSprite.gridSize}</p>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase">Frames</span>
                  <p className="mt-0.5 text-foreground">{detailSprite.frameCount}</p>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase">Created</span>
                  <p className="mt-0.5 text-foreground">{new Date(detailSprite.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
