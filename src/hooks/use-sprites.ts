import { useState, useEffect, useCallback } from 'react';
import { SpriteSheet, Collection } from '@/types/sprite';
import * as store from '@/lib/sprite-store';
import { getMockSprites, getMockCollections } from '@/lib/mock-sprites';

const INIT_KEY = 'sprite-gen-initialized';

function ensureInitialized() {
  if (!localStorage.getItem(INIT_KEY)) {
    store.saveSprites(getMockSprites());
    store.saveCollections(getMockCollections());
    localStorage.setItem(INIT_KEY, 'true');
  }
}

export function useSprites() {
  const [sprites, setSprites] = useState<SpriteSheet[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    ensureInitialized();
    setSprites(store.getSprites());
    setCollections(store.getCollections());
  }, []);

  const refresh = useCallback(() => {
    setSprites(store.getSprites());
    setCollections(store.getCollections());
  }, []);

  const addSprite = useCallback((sprite: SpriteSheet) => {
    store.addSprite(sprite);
    refresh();
  }, [refresh]);

  const deleteSpritesById = useCallback((ids: string[]) => {
    store.deleteSprites(ids);
    refresh();
  }, [refresh]);

  const addCollection = useCallback((col: Collection) => {
    store.addCollection(col);
    refresh();
  }, [refresh]);

  const deleteCollectionById = useCallback((id: string) => {
    store.deleteCollection(id);
    refresh();
  }, [refresh]);

  const addSpriteToCollection = useCallback((spriteId: string, colId: string) => {
    store.addSpriteToCollection(spriteId, colId);
    refresh();
  }, [refresh]);

  const removeSpriteFromCollection = useCallback((spriteId: string, colId: string) => {
    store.removeSpriteFromCollection(spriteId, colId);
    refresh();
  }, [refresh]);

  return {
    sprites, collections, refresh,
    addSprite, deleteSpritesById,
    addCollection, deleteCollectionById,
    addSpriteToCollection, removeSpriteFromCollection,
  };
}
