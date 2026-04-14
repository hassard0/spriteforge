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
  { value: 'left-side', label: 'Left Side' },
  { value: 'right-side', label: 'Right Side' },
  { value: 'three-quarter-front-left', label: '¾ Front Left' },
  { value: 'three-quarter-front-right', label: '¾ Front Right' },
  { value: 'three-quarter-back-left', label: '¾ Back Left' },
  { value: 'three-quarter-back-right', label: '¾ Back Right' },
  { value: 'top-down', label: 'Top Down' },
  { value: 'isometric', label: 'Isometric' },
];

const POSES: { value: SpritePose; label: string }[] = [
  { value: 'idle', label: 'Idle' },
  { value: 'walking', label: 'Walking' },
  { value: 'running', label: 'Running' },
  { value: 'jumping', label: 'Jumping' },
  { value: 'falling', label: 'Falling' },
  { value: 'attacking-melee', label: 'Melee Attack' },
  { value: 'attacking-ranged', label: 'Ranged Attack' },
  { value: 'magic-casting', label: 'Magic Casting' },
  { value: 'blocking', label: 'Blocking' },
  { value: 'crouching', label: 'Crouching' },
  { value: 'climbing', label: 'Climbing' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'dying', label: 'Dying' },
  { value: 'hurt', label: 'Hurt' },
  { value: 'celebrating', label: 'Celebrating' },
  { value: 'sitting', label: 'Sitting' },
  { value: 'sleeping', label: 'Sleeping' },
  { value: 'dashing', label: 'Dashing' },
  { value: 'flying', label: 'Flying' },
  { value: 'charging', label: 'Charging' },
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
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Configuration
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ConfigSelect
          label="Grid Size"
          value={gridSize}
          onChange={v => onGridSizeChange(v as GridSize)}
          options={GRID_SIZES}
        />
        <ConfigSelect
          label="Viewing Angle"
          value={viewingAngle}
          onChange={v => onViewingAngleChange(v as ViewingAngle)}
          options={VIEWING_ANGLES}
        />
        <ConfigSelect
          label="Pose / Action"
          value={pose}
          onChange={v => onPoseChange(v as SpritePose)}
          options={POSES}
        />
        <div>
          <label className="text-[10px] text-muted-foreground uppercase mb-1.5 block">
            Frames: <span className="text-primary font-bold">{frameCount}</span>
          </label>
          <div className="pt-2.5 px-1">
            <Slider
              value={[frameCount]}
              onValueChange={([v]) => onFrameCountChange(v)}
              min={1}
              max={4}
              step={1}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground uppercase mb-1.5 block">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-secondary/50 h-9 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
