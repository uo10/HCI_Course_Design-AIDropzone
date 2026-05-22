import type { OperationLogEntry } from '../hooks/useFilePipeline';

interface OperationLogProps {
  operations: OperationLogEntry[];
  onUndo: () => void;
  canUndo: boolean;
  disabled?: boolean;
}

export function OperationLog({
  operations,
  onUndo,
  canUndo,
  disabled = false,
}: OperationLogProps) {
  return (
    <section className="operation-log">
      <div className="operation-log__header">
        <h3 className="operation-log__title">操作记录</h3>
        <button
          type="button"
          className="operation-log__undo"
          onClick={onUndo}
          disabled={disabled || !canUndo}
        >
          撤销改名
        </button>
      </div>
      {operations.length === 0 ? (
        <p className="operation-log__empty">暂无操作记录</p>
      ) : (
        <ul className="operation-log__list scroll-themed">
          {operations.map((op) => (
            <li key={op.id} className="operation-log__item">
              <span className="operation-log__time">{op.time}</span>
              <span className="operation-log__msg">{op.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
