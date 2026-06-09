import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ForwardedRef,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { FileIcon } from '../utils/fileIcon';
import {
  canUseFileActions,
  copyFileToClipboard,
  cutFileToClipboard,
  openFilePath,
  resolveActionPath,
  revealFileInFolder,
} from '../utils/fileActions';

interface MenuItem {
  id: string;
  label: string;
  action: () => Promise<void>;
}

interface Props {
  sourcePath: string;
  extension: string;
  className?: string;
  iconClassName?: string;
  onActionError?: (message: string) => void;
}

export function FileIconActions({
  sourcePath,
  extension,
  className = '',
  iconClassName = 'h-5 w-5',
  onActionError,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const notifyError = useCallback(
    (err: unknown) => {
      let message = err instanceof Error ? err.message : '文件操作失败';
      if (message.includes('Command failed:')) {
        message = '复制/剪切失败，请确认文件存在且有访问权限';
      }
      if (message.length > 80) {
        message = `${message.slice(0, 80)}…`;
      }
      onActionError?.(message);
    },
    [onActionError],
  );

  const runAction = useCallback(
    async (action: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      setMenu(null);
      try {
        if (!canUseFileActions()) {
          throw new Error('请在 Electron 桌面版中使用文件操作');
        }
        if (!resolveActionPath(sourcePath)) {
          throw new Error('无法获取文件路径，请从桌面或资源管理器直接拖入');
        }
        await action();
      } catch (err) {
        notifyError(err);
      } finally {
        setBusy(false);
      }
    },
    [busy, notifyError, sourcePath],
  );

  const menuItems: MenuItem[] = [
    { id: 'open', label: '打开', action: () => openFilePath(sourcePath) },
    {
      id: 'reveal',
      label: '在文件夹中显示',
      action: () => revealFileInFolder(sourcePath),
    },
    { id: 'copy', label: '复制', action: () => copyFileToClipboard(sourcePath) },
    { id: 'cut', label: '剪切', action: () => cutFileToClipboard(sourcePath) },
  ];

  useEffect(() => {
    if (!menu) return;

    function closeMenu() {
      setMenu(null);
    }

    function onClickOutside(event: globalThis.MouseEvent) {
      const target = event.target as Node | null;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMenu();
    }

    // 用 click 而非 capture 阶段 pointerdown，避免 Electron 拖拽区吞掉菜单点击
    const timer = window.setTimeout(() => {
      window.addEventListener('click', onClickOutside);
    }, 0);

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('click', onClickOutside);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menu]);

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY });
  }

  function handleDoubleClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    void runAction(() => openFilePath(sourcePath));
  }

  return (
    <>
      <div
        ref={rootRef}
        role="button"
        tabIndex={-1}
        title="双击打开，右键更多操作"
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        className={`cursor-pointer select-none ${className}`}
      >
        <FileIcon extension={extension} className={iconClassName} />
      </div>

      {menu &&
        createPortal(
          <ContextMenu
            ref={menuRef}
            x={menu.x}
            y={menu.y}
            items={menuItems}
            disabled={busy}
            onSelect={item => void runAction(item.action)}
          />,
          document.body,
        )}
    </>
  );
}

const ContextMenu = forwardRef(function ContextMenu(
  {
    x,
    y,
    items,
    disabled,
    onSelect,
  }: {
    x: number;
    y: number;
    items: MenuItem[];
    disabled: boolean;
    onSelect: (item: MenuItem) => void;
  },
  ref: ForwardedRef<HTMLDivElement>,
) {
  const style = {
    left: Math.min(x, window.innerWidth - 180),
    top: Math.min(y, window.innerHeight - items.length * 36 - 12),
  };

  return (
    <div
      ref={ref}
      role="menu"
      className="file-action-menu electron-no-drag fixed z-[9999] min-w-[168px] overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 py-1 shadow-xl backdrop-blur-md"
      style={style}
      onMouseDown={event => event.stopPropagation()}
      onContextMenu={event => event.preventDefault()}
    >
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={disabled}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            onSelect(item);
          }}
          className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
});
