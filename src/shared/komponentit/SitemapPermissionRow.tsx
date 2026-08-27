// Sivukartan yksi rivi oikeuseditorissa. Jaettu: käyttäjähallinta on yhteinen, ja
// GUARD-puolen sivukartta piirretään samalla rivikomponentilla.
import type { SivukarttaSolmu } from '../oikeudet';

type SitemapPermissionRowProps = {
  node: SivukarttaSolmu;
  depth: number;
  permDraft: Record<string, { view?: boolean; edit?: boolean }>;
  onToggle: (nodeId: string, kentta: 'view' | 'edit', arvo: boolean) => void;
  onCascade: (node: SivukarttaSolmu, kentta: 'view' | 'edit', arvo: boolean) => void;
};


export const SitemapPermissionRow = ({ node, depth, permDraft, onToggle, onCascade }: SitemapPermissionRowProps) => {
  const perm = permDraft[node.id] || {};
  const hasChildren = !!(node.children && node.children.length > 0);
  return (
    <div>
      <div
        className={`flex items-center gap-3 py-2 pr-2 ${depth > 0 ? 'border-l-2 border-line-soft' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <span className={`flex-1 text-sm truncate ${hasChildren ? 'font-bold text-ink' : 'font-medium text-ink-body'}`}>
          {node.label}
        </span>
        <label className="flex items-center gap-1.5 text-xs text-ink-body cursor-pointer shrink-0 w-28">
          <input
            type="checkbox"
            checked={!!perm.view}
            onChange={(e) => { onToggle(node.id, 'view', e.target.checked); if (hasChildren) onCascade(node, 'view', e.target.checked); }}
            className="w-4 h-4 text-accent rounded border-line-strong focus:ring-accent"
          />
          Näkyy
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-body cursor-pointer shrink-0 w-32">
          <input
            type="checkbox"
            checked={!!perm.edit}
            onChange={(e) => { onToggle(node.id, 'edit', e.target.checked); if (hasChildren) onCascade(node, 'edit', e.target.checked); }}
            className="w-4 h-4 text-accent rounded border-line-strong focus:ring-accent"
          />
          Muokattavissa
        </label>
      </div>
      {node.children?.map((child) => (
        <SitemapPermissionRow key={child.id} node={child} depth={depth + 1} permDraft={permDraft} onToggle={onToggle} onCascade={onCascade} />
      ))}
    </div>
  );
};
