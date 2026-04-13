import { useState, useEffect, useCallback } from 'react';
import { SpriteSheet, Collection } from '@/types/sprite';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useSprites() {
  const { user } = useAuth();
  const [sprites, setSprites] = useState<SpriteSheet[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  const fetchSprites = useCallback(async () => {
    if (!user) { setSprites([]); return; }
    const { data } = await supabase
      .from('sprites')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setSprites(data.map(row => ({
        id: row.id,
        name: row.name,
        prompt: row.prompt,
        gridSize: row.grid_size as any,
        viewingAngle: row.viewing_angle as any,
        pose: row.pose as any,
        frameCount: row.frame_count,
        frameWidth: row.frame_width,
        frameHeight: row.frame_height,
        imageData: row.image_data,
        palette: row.palette || [],
        pixelData: (row.pixel_data as any) || [],
        createdAt: row.created_at,
        collectionIds: (row.collection_ids || []) as string[],
        tags: row.tags || [],
        referenceImageUrl: row.reference_image_url || undefined,
      })));
    }
  }, [user]);

  const fetchCollections = useCallback(async () => {
    if (!user) { setCollections([]); return; }
    const { data } = await supabase
      .from('collections')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setCollections(data.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        createdAt: row.created_at,
        color: row.color,
      })));
    }
  }, [user]);

  const refresh = useCallback(() => {
    fetchSprites();
    fetchCollections();
  }, [fetchSprites, fetchCollections]);

  useEffect(() => { refresh(); }, [refresh]);

  const addSprite = useCallback(async (sprite: SpriteSheet) => {
    if (!user) return;
    await supabase.from('sprites').insert({
      user_id: user.id,
      name: sprite.name,
      prompt: sprite.prompt,
      grid_size: sprite.gridSize,
      viewing_angle: sprite.viewingAngle,
      pose: sprite.pose,
      frame_count: sprite.frameCount,
      frame_width: sprite.frameWidth,
      frame_height: sprite.frameHeight,
      image_data: sprite.imageData,
      palette: sprite.palette,
      pixel_data: sprite.pixelData as any,
      tags: sprite.tags,
      reference_image_url: sprite.referenceImageUrl || null,
      collection_ids: sprite.collectionIds,
    });
    fetchSprites();
  }, [user, fetchSprites]);

  const deleteSpritesById = useCallback(async (ids: string[]) => {
    if (!user) return;
    await supabase.from('sprites').delete().in('id', ids);
    fetchSprites();
  }, [user, fetchSprites]);

  const addCollection = useCallback(async (col: Collection) => {
    if (!user) return;
    await supabase.from('collections').insert({
      user_id: user.id,
      name: col.name,
      description: col.description,
      color: col.color,
    });
    fetchCollections();
  }, [user, fetchCollections]);

  const deleteCollectionById = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from('collections').delete().eq('id', id);
    // Remove collection from sprites' collection_ids
    const affectedSprites = sprites.filter(s => s.collectionIds.includes(id));
    for (const s of affectedSprites) {
      await supabase.from('sprites').update({
        collection_ids: s.collectionIds.filter(cid => cid !== id),
      }).eq('id', s.id);
    }
    refresh();
  }, [user, sprites, refresh]);

  const addSpriteToCollection = useCallback(async (spriteId: string, colId: string) => {
    const sprite = sprites.find(s => s.id === spriteId);
    if (!sprite || !user) return;
    if (sprite.collectionIds.includes(colId)) return;
    await supabase.from('sprites').update({
      collection_ids: [...sprite.collectionIds, colId],
    }).eq('id', spriteId);
    fetchSprites();
  }, [user, sprites, fetchSprites]);

  const removeSpriteFromCollection = useCallback(async (spriteId: string, colId: string) => {
    const sprite = sprites.find(s => s.id === spriteId);
    if (!sprite || !user) return;
    await supabase.from('sprites').update({
      collection_ids: sprite.collectionIds.filter(cid => cid !== colId),
    }).eq('id', spriteId);
    fetchSprites();
  }, [user, sprites, fetchSprites]);

  return {
    sprites, collections, refresh,
    addSprite, deleteSpritesById,
    addCollection, deleteCollectionById,
    addSpriteToCollection, removeSpriteFromCollection,
  };
}
