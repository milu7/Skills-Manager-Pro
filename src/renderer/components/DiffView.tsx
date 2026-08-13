import { diffLines } from 'diff';
import clsx from 'clsx';

export function DiffView({ before, after, compact = false }: { before: string; after: string; compact?: boolean }) {
  const parts = diffLines(before, after);
  let oldLine = 1;
  let newLine = 1;
  return (
    <div className={clsx('diff-view', compact && 'is-compact')}>
      {parts.map((part, index) => {
        const lines = part.value.replace(/\n$/, '').split('\n');
        return lines.map((line, lineIndex) => {
          const oldNumber = part.added ? '' : oldLine++;
          const newNumber = part.removed ? '' : newLine++;
          return (
            <div key={`${index}-${lineIndex}`} className={clsx('diff-line', part.added && 'is-added', part.removed && 'is-removed')}>
              <span>{oldNumber}</span><span>{newNumber}</span><i>{part.added ? '+' : part.removed ? '−' : ' '}</i><code>{line || ' '}</code>
            </div>
          );
        });
      })}
    </div>
  );
}
