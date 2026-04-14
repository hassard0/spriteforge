import { useState } from 'react';
import { useSprites } from '@/hooks/use-sprites';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, FolderOpen, Image as ImageIcon, Pencil, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
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
  const { collections, sprites, addCollection, deleteCollectionById, renameCollection, addSpriteToCollection } = useSprites();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/30">
        <div className="flex items-center gap-3">
          <h1 className="font-pixel text-xs text-primary glow-green tracking-wider">COLLECTIONS</h1>
          <span className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
            {collections.length} collection{collections.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="font-pixel text-[10px] gap-1 h-7">
          <Plus className="h-3 w-3" /> NEW
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {collections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="rounded-2xl bg-secondary/50 p-4 mb-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">No collections yet</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1 mb-4">
                Create a collection to organize your sprites into projects
              </p>
              <Button onClick={() => setShowCreate(true)} size="sm" className="text-xs gap-1">
                <Plus className="h-3 w-3" /> Create Collection
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {collections.map(col => {
                const colSprites = spritesInCollection(col.id);
                return (
                  <div
                    key={col.id}
                    onDragOver={(e) => { e.preventDefault(); setDragOverId(col.id); }}
                    onDragLeave={() => setDragOverId((prev) => (prev === col.id ? null : prev))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverId(null);
                      const spriteId = e.dataTransfer.getData('text/sprite-id');
                      if (spriteId) {
                        addSpriteToCollection(spriteId, col.id);
                        toast({ title: 'Added to collection', description: col.name });
                      }
                    }}
                    className={`rounded-xl border bg-card p-4 space-y-3 hover:border-primary/30 transition-all group ${
                      dragOverId === col.id ? 'border-primary ring-2 ring-primary/40' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-3 h-8 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: col.color }}
                        />
                        <div>
                          {editingId === col.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="h-6 text-xs bg-secondary/30"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    if (editingName.trim()) renameCollection(col.id, editingName.trim());
                                    setEditingId(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingId(null);
                                  }
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => {
                                  if (editingName.trim()) renameCollection(col.id, editingName.trim());
                                  setEditingId(null);
                                }}
                                aria-label="Save name"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <h3 className="font-semibold text-sm">{col.name}</h3>
                          )}
                          {col.description && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">{col.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => { setEditingId(col.id); setEditingName(col.name); }}
                          aria-label="Rename collection"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteCollectionById(col.id)}
                          aria-label="Delete collection"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[9px] h-5 gap-1">
                        <ImageIcon className="h-2.5 w-2.5" />
                        {colSprites.length} sprite{colSprites.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>

                    {colSprites.length > 0 && (
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {colSprites.slice(0, 6).map(s => (
                          <div key={s.id} className="flex-shrink-0 w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center overflow-hidden">
                            <img src={s.imageData} alt={s.name} className="max-w-full max-h-full" style={{ imageRendering: 'pixelated' }} />
                          </div>
                        ))}
                        {colSprites.length > 6 && (
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-secondary/30 flex items-center justify-center text-[10px] text-muted-foreground font-medium">
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
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-pixel text-[11px] text-primary">NEW COLLECTION</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase mb-1.5 block">Name</label>
              <Input placeholder="My Project" value={newName} onChange={e => setNewName(e.target.value)} className="bg-secondary/30" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase mb-1.5 block">Description</label>
              <Input placeholder="Optional description" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="bg-secondary/30" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase mb-2 block">Color</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    className={`w-7 h-7 rounded-lg transition-all ${newColor === c ? 'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-card' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
