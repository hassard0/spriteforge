import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { GridSize, ViewingAngle, SpritePose } from '@/types/sprite';

const GRID_SIZES: { value: GridSize; label: string }[] = [
  { value: '32x32', label: '32×32' },
  { value: '64x64', label: '64×64' },
  { value: '128x128', label: '128×128' },
  { value: '256x256', label: '256×256' },
  { value: '512x512', label: '512×512' },
];

const VIEWING_ANGLES: { value: ViewingAngle; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'left-side', label: 'Left' },
  { value: 'right-side', label: 'Right' },
  { value: 'three-quarter-front-left', label: '¾ Front L' },
  { value: 'three-quarter-front-right', label: '¾ Front R' },
  { value: 'three-quarter-back-left', label: '¾ Back L' },
  { value: 'three-quarter-back-right', label: '¾ Back R' },
  { value: 'top-down', label: 'Top Down' },
  { value: 'isometric', label: 'Isometric' },
];

const POSES: { value: SpritePose; label: string }[] = [
  { value: 'idle', label: 'Idle' },
  { value: 'walking', label: 'Walk' },
  { value: 'running', label: 'Run' },
  { value: 'jumping', label: 'Jump' },
  { value: 'falling', label: 'Fall' },
  { value: 'attacking-melee', label: 'Melee' },
  { value: 'attacking-ranged', label: 'Ranged' },
  { value: 'magic-casting', label: 'Magic' },
  { value: 'blocking', label: 'Block' },
  { value: 'crouching', label: 'Crouch' },
  { value: 'climbing', label: 'Climb' },
  { value: 'swimming', label: 'Swim' },
  { value: 'dying', label: 'Die' },
  { value: 'hurt', label: 'Hurt' },
  { value: 'celebrating', label: 'Celebrate' },
  { value: 'sitting', label: 'Sit' },
  { value: 'sleeping', label: 'Sleep' },
  { value: 'dashing', label: 'Dash' },
  { value: 'flying', label: 'Fly' },
  { value: 'charging', label: 'Charge' },
];

interface Props {
  gridSize: GridSize;
  viewingAngle: ViewingAngle;
  pose: SpritePose;
  frameCount: number;
  onGridSizeChange: (v: GridSize) => void;
  onViewingAngleChange: (v: ViewingAngle) => void;
  onPoseChange: (v: SpritePose) => void;
  onFrameCountChange: (v: number) => void;
}

export function GenerationConfig({
  gridSize, viewingAngle, pose, frameCount,
  onGridSizeChange, onViewingAngleChange, onPoseChange, onFrameCountChange,
}: Props) {
  return (
    <div className="space-y-2.5">
      <CompactSelect label="Size" value={gridSize} onChange={v => onGridSizeChange(v as GridSize)} options={GRID_SIZES} />
      <CompactSelect label="Angle" value={viewingAngle} onChange={v => onViewingAngleChange(v as ViewingAngle)} options={VIEWING_ANGLES} />
      <CompactSelect label="Pose" value={pose} onChange={v => onPoseChange(v as SpritePose)} options={POSES} />
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-muted-foreground">Frames</label>
          <span className="text-[10px] text-primary font-bold">{frameCount}</span>
        </div>
        <Slider value={[frameCount]} onValueChange={([v]) => onFrameCountChange(v)} min={1} max={4} step={1} />
      </div>
    </div>
  );
}

function CompactSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] text-muted-foreground w-10 flex-shrink-0">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-7 bg-secondary/40 text-[10px] flex-1 border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
