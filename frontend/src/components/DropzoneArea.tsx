import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';
import { dropzoneGetFilesFromEvent } from '../utils/dropzoneGetFilesFromEvent';

interface Props {
  hasFiles: boolean;
  onDropFiles: (files: File[]) => void;
  children?: ReactNode;
}

export function DropzoneArea({ hasFiles, onDropFiles, children }: Props) {
  const getFilesFromEvent = useMemo(() => dropzoneGetFilesFromEvent, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    getFilesFromEvent,
    onDrop: accepted => {
      if (accepted.length) onDropFiles(accepted);
    },
    preventDropOnDocument: true,
    multiple: true,
    noClick: hasFiles,
    noKeyboard: hasFiles,
  });

  const { ref, ...rootProps } = getRootProps();

  const activeClass = isDragActive
    ? 'border-[#0078d4]/60 bg-[#0078d4]/[0.06] shadow-inner shadow-[#0078d4]/10'
    : 'border-slate-300/70 bg-white/25 hover:border-[#0078d4]/35 hover:bg-white/35';

  return (
    <div
      ref={ref}
      {...rootProps}
      className={`electron-no-drag relative flex min-h-0 flex-1 flex-col outline-none ${
        hasFiles ? 'min-h-[200px]' : ''
      }`}
    >
      <input {...getInputProps()} />

      {hasFiles && isDragActive && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-blue-400 bg-blue-100/35 backdrop-blur-[2px]"
        >
          <span className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-blue-600 shadow-lg">
            松开以添加文件
          </span>
        </div>
      )}

      {!hasFiles ? (
        <div className="flex flex-1 flex-col py-2">
          <motion.div
            layout
            layoutId="dropzone-visual"
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="mx-4 flex flex-1"
            style={{ minHeight: 300 }}
          >
            <div
              className={`flex h-full w-full flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed transition-colors ${activeClass} ${
                isDragActive ? 'scale-[1.01]' : ''
              }`}
              style={{ minHeight: 300 }}
            >
              <motion.div
                layout
                animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className={`flex h-14 w-14 items-center justify-center rounded-full ring-1 ${
                  isDragActive
                    ? 'bg-[#0078d4]/10 ring-[#0078d4]/30'
                    : 'bg-white/90 ring-black/[0.06] shadow-sm'
                }`}
              >
                <Upload
                  className={`h-7 w-7 ${isDragActive ? 'text-[#0078d4]' : 'text-[#0078d4]/70'}`}
                  strokeWidth={1.75}
                />
              </motion.div>
              <div className="pointer-events-none text-center">
                <p
                  className={`text-sm font-medium ${isDragActive ? 'text-[#0078d4]' : 'text-slate-700'}`}
                >
                  {isDragActive ? '松开以添加文件' : '将文件拖拽至此，或点击上传'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
        <>
          <div className="shrink-0 p-3 pb-0">
            <motion.div
              layout
              layoutId="dropzone-visual"
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="mb-3"
              style={{ minHeight: 44 }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={e => {
                  e.stopPropagation();
                  open();
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    open();
                  }
                }}
                className={`flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 transition-colors ${activeClass}`}
              >
                <Upload
                  className={`h-4 w-4 shrink-0 ${isDragActive ? 'text-blue-600' : 'text-slate-400'}`}
                />
                <span
                  className={`text-xs font-semibold ${isDragActive ? 'text-blue-600' : 'text-slate-500'}`}
                >
                  {isDragActive ? '松开以添加文件' : '继续拖入文件（可拖到列表区域）'}
                </span>
              </div>
            </motion.div>
          </div>
          {children && (
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">{children}</div>
          )}
        </>
      )}
    </div>
  );
}
