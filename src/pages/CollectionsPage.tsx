import { useState } from 'react';
import { useSprites } from '@/hooks/use-sprites';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, FolderOpen } from 'lucide-react';
import type { Collection } from '@/types/sprite';

const COLORS = [
  'hsl(152, 100%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(185, 80%, 55%)',
  'hsl(280, 60%, 55%)',
  'hsl(45, 100%, 60%)',
  'hsl(25, 100%, 55%)',
];

export default function CollectionsPage() {
  const { collections, sprites, addCollection, deleteCollectionById } = useSprites();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const col: Collection = {
      id: `col-${Date.now()}`,
      name: newName,
      description: newDesc,
      createdAt: new Date().toISOString(),
      color: newColor,
    };
    addCollection(col);
    setShowCreate(false);
    setNewName('');
    setNewDesc('');
  };

  const spritesInCollection = (colId: string) =>
    sprites.filter(s => s.collectionIds.includes(colId));

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-pixel text-lg text-primary glow-green">COLLECTIONS</h1>
        <Button onClick={() => setShowCreate(true)} className="font-pixel text-[10px] gap-1">
          <Plus className="h-3 w-3" /> NEW
        </Button>
      </div>

      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No collections yet</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">Create a collection to organize your sprites</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map(col => {
            const colSprites = spritesInCollection(col.id);
            return (
              <div key={col.id} className="bg-card rounded-lg pixel-border p-4 space-y-3 hover:pixel-border-accent transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: col.color }} />
                    <h3 className="font-bold text-sm">{col.name}</h3>
                  </div>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteCollectionById(col.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {col.description && <p className="text-xs text-muted-foreground">{col.description}</p>}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{colSprites.length} sprites</Badge>
                </div>
                {colSprites.length > 0 && (
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {colSprites.slice(0, 6).map(s => (
                      <div key={s.id} className="flex-shrink-0 w-10 h-10 rounded bg-secondary flex items-center justify-center">
                        <img src={s.imageData} alt={s.name} className="max-w-full max-h-full" style={{ imageRendering: 'pixelated' }} />
                      </div>
                    ))}
                    {colSprites.length > 6 && (
                      <div className="flex-shrink-0 w-10 h-10 rounded bg-secondary flex items-center justify-center text-[10px] text-muted-foreground">
                        +{colSprites.length - 6}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-pixel text-sm text-primary">NEW COLLECTION</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Collection name" value={newName} onChange={e => setNewName(e.target.value)} className="bg-secondary/50" />
            <Input placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="bg-secondary/50" />
            <div>
              <label className="text-[10px] text-muted-foreground uppercase mb-2 block">Color</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    className={`w-7 h-7 rounded-sm transition-transform ${newColor === c ? 'scale-125 ring-2 ring-primary' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
