import { useState } from 'react';

interface ExportDialogProps {
  allTags: string[];
  onExport: (req: {
    tags: string[];
    output_dir: string;
    package_name?: string;
    include_manifest?: boolean;
  }) => void;
  disabled?: boolean;
}

const DEFAULT_OUTPUT_DIR = 'C:\\Users\\demo\\Desktop\\exports';

export function ExportDialog({ allTags, onExport, disabled = false }: ExportDialogProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [outputDir, setOutputDir] = useState(DEFAULT_OUTPUT_DIR);
  const [packageName, setPackageName] = useState('demo_export');

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleExport = () => {
    onExport({
      tags: selectedTags,
      output_dir: outputDir,
      package_name: packageName.trim() || 'export',
      include_manifest: true,
    });
  };

  if (allTags.length === 0) {
    return (
      <section className="export-dialog">
        <h3 className="export-dialog__title">按标签导出</h3>
        <p className="export-dialog__hint">当前没有可导出的标签，请先为文件添加标签。</p>
      </section>
    );
  }

  return (
    <section className="export-dialog">
      <h3 className="export-dialog__title">按标签导出</h3>
      <p className="export-dialog__hint">
        后端只在仓库内 <code>backend/workspace</code> 文件夹中，按<strong>文件名</strong>里的标签扫描（须包含你勾选的全部标签）。
        拖入桌面/其他目录改名后，请先把文件<strong>复制进 workspace</strong> 再导出；否则 zip 里可能只有空的 manifest.json。
      </p>

      <div className="export-dialog__tags">
        {allTags.map((tag) => (
          <label key={tag} className="export-dialog__tag-option">
            <input
              type="checkbox"
              checked={selectedTags.includes(tag)}
              onChange={() => toggleTag(tag)}
              disabled={disabled}
            />
            {tag}
          </label>
        ))}
      </div>

      <label className="export-dialog__field">
        <span className="export-dialog__label">输出目录</span>
        <input
          type="text"
          className="export-dialog__input"
          value={outputDir}
          onChange={(e) => setOutputDir(e.target.value)}
          disabled={disabled}
        />
      </label>

      <label className="export-dialog__field">
        <span className="export-dialog__label">包名（不含 .zip）</span>
        <input
          type="text"
          className="export-dialog__input"
          value={packageName}
          onChange={(e) => setPackageName(e.target.value)}
          disabled={disabled}
        />
      </label>

      <button
        type="button"
        className="export-dialog__btn"
        onClick={handleExport}
        disabled={disabled || selectedTags.length === 0}
      >
        导出
      </button>
    </section>
  );
}
