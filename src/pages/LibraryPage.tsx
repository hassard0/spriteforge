import { useState, useMemo } from 'react';
import { useSprites } from '@/hooks/use-sprites';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SpritePreviewPlayer } from '@/components/SpritePreviewPlayer';
import { Badge } from '@/components/ui/badge';
import { Search, Trash2, Download, X } from 'lucide-react';
import type { SpriteSheet, AnimationType } from '@/types/sprite';

function SpriteCard({ sprite, selected, onToggle, onClick }: {
  sprite: SpriteSheet;
  selected: boolean;
  onToggle: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className={`group relative bg-card rounded-lg pixel-border overflow-hidden cursor-pointer transition-all hover:pixel-border-accent ${
        selected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onClick}
    >
      <div className="absolute top-2 left-2 z-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={e => { e.stopPropagation(); onToggle(); }}
          onClick={e => e.stopPropagation()}
          className="accent-primary"
        />
      </div>
      <div className="aspect-square bg-secondary/50 flex items-center justify-center p-2 grid-bg">
        <img
          src={sprite.imageData}
          alt={sprite.name}
          className="max-w-full max-h-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-bold truncate">{sprite.name}</h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="secondary" className="text-[10px]">{sprite.pose}</Badge>
          <Badge variant="outline" className="text-[10px]">{sprite.gridSize}</Badge>
        </div>
        <p className="text-[10px] text-muted-foreground">{sprite.frameCount} frames · {sprite.viewingAngle}</p>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const { sprites, deleteSpritesById } = useSprites();
  const [search, setSearch] = useState('');
  const [filterAnim, setFilterAnim] = useState<string>('all');
  const [filterStyle, setFilterStyle] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailSprite, setDetailSprite] = useState<SpriteSheet | null>(null);

  const filtered = useMemo(() => {
    return sprites.filter(s => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.prompt.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterAnim !== 'all' && s.pose !== filterAnim) return false;
      if (filterStyle !== 'all' && s.viewingAngle !== filterStyle) return false;
      return true;
    });
  }, [sprites, search, filterAnim, filterStyle]);

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
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-pixel text-lg text-primary glow-green">LIBRARY</h1>
        <span className="text-xs text-muted-foreground">{sprites.length} sprites</span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sprites..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50"
          />
        </div>
        <Select value={filterAnim} onValueChange={setFilterAnim}>
          <SelectTrigger className="w-[130px] bg-secondary/50"><SelectValue placeholder="Animation" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="idle">Idle</SelectItem>
            <SelectItem value="walk">Walk</SelectItem>
            <SelectItem value="run">Run</SelectItem>
            <SelectItem value="attack">Attack</SelectItem>
            <SelectItem value="jump">Jump</SelectItem>
            <SelectItem value="death">Death</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStyle} onValueChange={setFilterStyle}>
          <SelectTrigger className="w-[130px] bg-secondary/50"><SelectValue placeholder="Style" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Styles</SelectItem>
            <SelectItem value="pixel-art">Pixel Art</SelectItem>
            <SelectItem value="chibi">Chibi</SelectItem>
            <SelectItem value="cel-shaded">Cel-Shaded</SelectItem>
          </SelectContent>
        </Select>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <Button variant="secondary" size="sm" className="text-xs gap-1" onClick={handleDownloadSelected}>
              <Download className="h-3 w-3" /> Export
            </Button>
            <Button variant="destructive" size="sm" className="text-xs gap-1" onClick={handleDelete}>
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelected(new Set())}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground">No sprites found</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">Generate some sprites or adjust your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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

      {/* Detail dialog */}
      <Dialog open={!!detailSprite} onOpenChange={open => !open && setDetailSprite(null)}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-pixel text-sm text-primary">{detailSprite?.name}</DialogTitle>
          </DialogHeader>
          {detailSprite && (
            <div className="space-y-4">
              <SpritePreviewPlayer
                imageData={detailSprite.imageData}
                frameCount={detailSprite.frameCount}
                frameWidth={detailSprite.frameWidth}
                frameHeight={detailSprite.frameHeight}
              />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Prompt:</span> {detailSprite.prompt}</div>
                <div><span className="text-muted-foreground">Pose:</span> {detailSprite.pose}</div>
                <div><span className="text-muted-foreground">Angle:</span> {detailSprite.viewingAngle}</div>
                <div><span className="text-muted-foreground">Grid:</span> {detailSprite.gridSize}</div>
                <div><span className="text-muted-foreground">Frames:</span> {detailSprite.frameCount}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
