import { useState, useEffect, useCallback } from 'react';
import { SpriteSheet, Collection } from '@/types/sprite';
import * as store from '@/lib/sprite-store';
import { toast } from '@/hooks/use-toast';

/**
 * LocalStorage-backed sprite & collection store hook. Public API matches the
 * previous Supabase-backed version 1:1 so existing call sites compile
 * unchanged.
 */
export function useSprites() {
  const [sprites, setSprites] = useState<SpriteSheet[]>(() => store.getSprites());
  const [collections, setCollections] = useState<Collection[]>(() => store.getCollections());

  const refresh = useCallback(() => {
    setSprites(store.getSprites());
    setCollections(store.getCollections());
  }, []);

  // Listen for cross-tab changes via the storage event.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && (e.key.includes('sprite-gen-sprites') || e.key.includes('sprite-gen-collections'))) {
        refresh();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const addSprite = useCallback((sprite: SpriteSheet) => {
    try {
      const next = store.addSprite(sprite);
      setSprites(next);
    } catch (err: any) {
      console.error('addSprite failed', err);
      toast({
        title: 'Could not save sprite',
        description:
          err?.name === 'QuotaExceededError'
            ? 'LocalStorage is full — delete older sprites and try again.'
            : (err?.message || 'Unknown error saving to local storage.'),
      });
    }
  }, []);

  const deleteSpritesById = useCallback((ids: string[]) => {
    try {
      const next = store.deleteSprites(ids);
      setSprites(next);
    } catch (err: any) {
      console.error('deleteSpritesById failed', err);
      toast({ title: 'Could not delete sprites', description: err?.message || 'Unknown error' });
    }
  }, []);

  const addCollection = useCallback((col: Collection) => {
    try {
      const next = store.addCollection(col);
      setCollections(next);
    } catch (err: any) {
      console.error('addCollection failed', err);
      toast({ title: 'Could not create collection', description: err?.message || 'Unknown error' });
    }
  }, []);

  const deleteCollectionById = useCallback((id: string) => {
    try {
      const { collections: nextCols, sprites: nextSprites } = store.deleteCollection(id);
      setCollections(nextCols);
      setSprites(nextSprites);
    } catch (err: any) {
      console.error('deleteCollectionById failed', err);
      toast({ title: 'Could not delete collection', description: err?.message || 'Unknown error' });
    }
  }, []);

  const addSpriteToCollection = useCallback((spriteId: string, colId: string) => {
    try {
      const next = store.addSpriteToCollection(spriteId, colId);
      setSprites(next);
    } catch (err: any) {
      console.error('addSpriteToCollection failed', err);
      toast({ title: 'Could not update collection', description: err?.message || 'Unknown error' });
    }
  }, []);

  const removeSpriteFromCollection = useCallback((spriteId: string, colId: string) => {
    try {
      const next = store.removeSpriteFromCollection(spriteId, colId);
      setSprites(next);
    } catch (err: any) {
      console.error('removeSpriteFromCollection failed', err);
      toast({ title: 'Could not update collection', description: err?.message || 'Unknown error' });
    }
  }, []);

  return {
    sprites,
    collections,
    refresh,
    addSprite,
    deleteSpritesById,
    addCollection,
    deleteCollectionById,
    addSpriteToCollection,
    removeSpriteFromCollection,
  };
}
