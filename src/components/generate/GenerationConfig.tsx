import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    <div className="space-y-4">
      <ConfigField label="Canvas size" description="This sets the dimensions for each frame.">
        <Select value={gridSize} onValueChange={v => onGridSizeChange(v as GridSize)}>
          <SelectTrigger className="h-10 border-border bg-background/60 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRID_SIZES.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ConfigField>

      <ConfigField label="Viewing angle" description="Choose the character's camera orientation.">
        <Select value={viewingAngle} onValueChange={v => onViewingAngleChange(v as ViewingAngle)}>
          <SelectTrigger className="h-10 border-border bg-background/60 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIEWING_ANGLES.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ConfigField>

      <ConfigField label="Animation pose" description="Pick the move you want the generator to focus on.">
        <Select value={pose} onValueChange={v => onPoseChange(v as SpritePose)}>
          <SelectTrigger className="h-10 border-border bg-background/60 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POSES.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ConfigField>

      <ConfigField label="Frame count" description="Short loops are faster to iterate and easier to judge.">
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((value) => (
            <Button
              key={value}
              type="button"
              variant={frameCount === value ? 'default' : 'outline'}
              className="h-11 flex-col gap-0 rounded-xl px-0"
              onClick={() => onFrameCountChange(value)}
            >
              <span className="text-sm font-semibold">{value}</span>
              <span className="text-[10px] uppercase tracking-wide opacity-80">frame{value !== 1 ? 's' : ''}</span>
            </Button>
          ))}
        </div>
      </ConfigField>
    </div>
  );
}

function ConfigField({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className="text-sm font-medium text-foreground">{label}</label>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
