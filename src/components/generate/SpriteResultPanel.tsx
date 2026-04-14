import { Button } from '@/components/ui/button';
import { SpritePreviewPlayer } from '@/components/SpritePreviewPlayer';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, Copy, Save, RotateCcw, FileJson, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { SpriteSheet } from '@/types/sprite';

interface Props {
  result: SpriteSheet;
  jsonOutput: string | null;
  onSave: () => void;
  onRetry: () => void;
  generating: boolean;
}

function downloadBlob(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function unityMetaYaml(spriteName: string, frameW: number, frameH: number): string {
  return `fileFormatVersion: 2
guid: ${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}
TextureImporter:
  internalIDToNameTable: []
  externalObjects: {}
  serializedVersion: 12
  mipmaps:
    mipMapMode: 0
    enableMipMap: 0
    sRGBTexture: 1
    linearTexture: 0
    fadeOut: 0
    borderMipMap: 0
    mipMapsPreserveCoverage: 0
    alphaTestReferenceValue: 0.5
    mipMapFadeDistanceStart: 1
    mipMapFadeDistanceEnd: 3
  bumpmap:
    convertToNormalMap: 0
    externalNormalMap: 0
    heightScale: 0.25
    normalMapFilter: 0
  isReadable: 0
  streamingMipmaps: 0
  streamingMipmapsPriority: 0
  grayScaleToAlpha: 0
  generateCubemap: 6
  cubemapConvolution: 0
  seamlessCubemap: 0
  textureFormat: 1
  maxTextureSize: 2048
  textureSettings:
    serializedVersion: 2
    filterMode: 0
    aniso: 1
    mipBias: 0
    wrapU: 1
    wrapV: 1
    wrapW: 1
  nPOTScale: 0
  lightmap: 0
  compressionQuality: 50
  spriteMode: 2
  spriteExtrude: 1
  spriteMeshType: 1
  alignment: 0
  spritePivot: {x: 0.5, y: 0.5}
  spritePixelsToUnits: ${frameW}
  spriteBorder: {x: 0, y: 0, z: 0, w: 0}
  spriteGenerateFallbackPhysicsShape: 1
  alphaUsage: 1
  alphaIsTransparency: 1
  spriteTessellationDetail: -1
  textureType: 8
  textureShape: 1
  singleChannelComponent: 0
  flipbookRows: 1
  flipbookColumns: 1
  maxTextureSizeSet: 0
  compressionQualitySet: 0
  textureFormatSet: 0
  ignorePngGamma: 0
  applyGammaDecoding: 0
  cookieLightType: 1
  platformSettings: []
  spriteSheet:
    serializedVersion: 2
    sprites: []
    outline: []
    physicsShape: []
    bones: []
    spriteID: ''
    internalID: 0
    vertices: []
    indices:
    edges: []
    weights: []
    secondaryTextures: []
    nameFileIdTable: {}
  spritePackingTag: ${spriteName}
  pSDRemoveMatte: 0
  pSDShowRemoveMatteOption: 0
  userData:
  assetBundleName:
  assetBundleVariant:
`;
}

function godotImportFile(spriteName: string): string {
  return `[remap]

importer="texture"
type="CompressedTexture2D"
uid="uid://${Math.random().toString(36).slice(2, 15)}"
path="res://.godot/imported/${spriteName}.png-${Math.random().toString(36).slice(2, 15)}.ctex"
metadata={
"vram_texture": false
}

[deps]

source_file="res://${spriteName}.png"
dest_files=["res://.godot/imported/${spriteName}.png-${Math.random().toString(36).slice(2, 15)}.ctex"]

[params]

compress/mode=0
compress/high_quality=false
compress/lossy_quality=0.7
compress/hdr_compression=1
compress/normal_map=0
compress/channel_pack=0
mipmaps/generate=false
mipmaps/limit=-1
roughness/mode=0
roughness/src_normal=""
process/fix_alpha_border=true
process/premult_alpha=false
process/normal_map_invert_y=false
process/hdr_as_srgb=false
process/hdr_clamp_exposure=false
process/size_limit=0
detect_3d/compress_to=0
`;
}

function godotSpriteFramesTres(
  spriteName: string,
  frameCount: number,
  frameW: number,
  frameH: number,
): string {
  const rects = Array.from({ length: frameCount }, (_, i) => i);
  const frameEntries = rects
    .map(
      (i) => `{
"duration": 1.0,
"texture": SubResource("AtlasTexture_${i}")
}`,
    )
    .join(', ');

  const atlasResources = rects
    .map(
      (i) => `[sub_resource type="AtlasTexture" id="AtlasTexture_${i}"]
atlas = ExtResource("1")
region = Rect2(${i * frameW}, 0, ${frameW}, ${frameH})
`,
    )
    .join('\n');

  return `[gd_resource type="SpriteFrames" load_steps=${frameCount + 2} format=3]

[ext_resource type="Texture2D" path="res://${spriteName}.png" id="1"]

${atlasResources}

[resource]
animations = [{
"frames": [${frameEntries}],
"loop": true,
"name": &"default",
"speed": 8.0
}]
`;
}

export function SpriteResultPanel({ result, jsonOutput, onSave, onRetry, generating }: Props) {
  const spriteName = `sprite_${result.pose}_${result.viewingAngle}`;

  const handleDownloadPNG = () => {
    downloadDataUrl(`${spriteName}.png`, result.imageData);
  };

  const handleDownloadJSON = () => {
    if (!jsonOutput) return;
    downloadBlob(`${spriteName}.json`, 'application/json', jsonOutput);
  };

  const handleCopyJSON = () => {
    if (!jsonOutput) return;
    navigator.clipboard.writeText(jsonOutput);
    toast({ title: 'JSON copied to clipboard' });
  };

  const handleDownloadUnity = () => {
    downloadDataUrl(`${spriteName}.png`, result.imageData);
    downloadBlob(`${spriteName}.png.meta`, 'text/yaml', unityMetaYaml(spriteName, result.frameWidth, result.frameHeight));
    toast({ title: 'Unity export', description: 'PNG + .meta downloaded' });
  };

  const handleDownloadGodot = () => {
    downloadDataUrl(`${spriteName}.png`, result.imageData);
    downloadBlob(`${spriteName}.png.import`, 'text/plain', godotImportFile(spriteName));
    downloadBlob(
      `${spriteName}.tres`,
      'text/plain',
      godotSpriteFramesTres(spriteName, result.frameCount, result.frameWidth, result.frameHeight),
    );
    toast({ title: 'Godot export', description: 'PNG + .import + .tres downloaded' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Result</h2>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 text-muted-foreground" onClick={onRetry} disabled={generating} aria-label="Retry generation">
            <RotateCcw className="h-3 w-3" /> Retry
          </Button>
          <div className="h-4 w-px bg-border" />
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={handleDownloadPNG} aria-label="Download PNG">
            <ImageIcon className="h-3 w-3" /> PNG
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={handleDownloadJSON} aria-label="Download JSON">
            <FileJson className="h-3 w-3" /> JSON
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={handleCopyJSON} aria-label="Copy JSON">
            <Copy className="h-3 w-3" /> Copy
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" aria-label="Download for engine">
                <Download className="h-3 w-3" /> Download for… <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownloadPNG}>PNG sheet</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadJSON} disabled={!jsonOutput}>JSON metadata</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadUnity}>Unity sprite sheet (.png + .meta)</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadGodot}>Godot sprite frames (.png + .import + .tres)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="h-4 w-px bg-border" />
          <Button size="sm" className="h-7 text-[10px] gap-1 font-semibold" onClick={onSave} aria-label="Save to library">
            <Save className="h-3 w-3" /> Save
          </Button>
        </div>
      </div>

      <SpritePreviewPlayer
        imageData={result.imageData}
        frameWidth={result.frameWidth}
        frameHeight={result.frameHeight}
        frameCount={result.frameCount}
      />

      {result.palette && result.palette.length > 1 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">Palette</span>
            <span className="text-[10px] text-muted-foreground">{result.palette.length - 1} colors</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {result.palette.filter((c) => c !== 'transparent').map((color, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded border border-border cursor-pointer hover:scale-125 transition-transform"
                style={{ backgroundColor: color }}
                title={color}
                onClick={() => {
                  navigator.clipboard.writeText(color);
                  toast({ title: `Copied ${color}` });
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="grid grid-cols-3 gap-3 text-[10px]">
          <MetaItem label="Style" value={result.tags?.[0] || '—'} />
          <MetaItem label="Pose" value={result.pose} />
          <MetaItem label="Angle" value={result.viewingAngle} />
          <MetaItem label="Grid" value={result.gridSize} />
          <MetaItem label="Frames" value={String(result.frameCount)} />
          <MetaItem label="Size" value={`${result.frameWidth}×${result.frameHeight}`} />
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground uppercase">{label}</span>
      <p className="font-medium text-foreground mt-0.5 truncate">{value}</p>
    </div>
  );
}
