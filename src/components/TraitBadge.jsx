import { CareIcon } from './CareIcon';
import { traitCopy } from '../lib/plantSchema';

const tones = {
  amber: 'border-amber-300/50 bg-amber-100 text-amber-950',
  cyan: 'border-cyan-300/50 bg-cyan-100 text-cyan-950',
  emerald: 'border-emerald-300/50 bg-emerald-100 text-emerald-950',
  green: 'border-emerald-300/50 bg-emerald-100 text-emerald-950',
  lime: 'border-lime-300/50 bg-lime-100 text-lime-950',
  orange: 'border-orange-300/50 bg-orange-100 text-orange-950',
  rose: 'border-rose-300/50 bg-rose-100 text-rose-950',
  sky: 'border-sky-300/50 bg-sky-100 text-sky-950',
  slate: 'border-slate-300/50 bg-slate-100 text-slate-950',
  stone: 'border-stone-300/50 bg-stone-100 text-stone-950',
  yellow: 'border-yellow-300/50 bg-yellow-100 text-yellow-950',
};

export function TraitBadge({ value, compact = false }) {
  const meta = traitCopy[value] || {
    label: value,
    description: 'Care detail',
    tone: 'slate',
    icon: 'beginner_friendly',
  };

  return (
    <div className={`flex items-start gap-3 rounded-[12px] border p-3 shadow-sm ${tones[meta.tone] || tones.slate}`}>
      <CareIcon name={meta.icon} className="mt-0.5 h-6 w-6 shrink-0" />
      <div>
        <p className="text-sm font-extrabold">{meta.label}</p>
        {!compact && <p className="mt-1 text-xs leading-relaxed opacity-80">{meta.description}</p>}
      </div>
    </div>
  );
}
