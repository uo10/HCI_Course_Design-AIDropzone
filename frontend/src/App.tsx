import { ApiModeBanner } from './components/ApiModeBanner';
import { CardListToolbar } from './components/CardListToolbar';
import { DemoMode } from './components/DemoMode';
import { Dropzone } from './components/Dropzone';
import { ExportDialog } from './components/ExportDialog';
import { FileCard } from './components/FileCard';
import { FloatingBall } from './components/FloatingBall';
import { FloatingShell } from './components/FloatingShell';
import { useShellMode } from './hooks/useShellMode';
import { OperationLog } from './components/OperationLog';
import { PrivacyToggle } from './components/PrivacyToggle';
import { ProcessingModeSwitch } from './components/ProcessingModeSwitch';
import { RenamePreviewList } from './components/RenamePreviewList';
import { TagAggregator } from './components/TagAggregator';
import { Toast } from './components/Toast';
import { useBackendHealth } from './hooks/useBackendHealth';
import { useFilePipeline } from './hooks/useFilePipeline';

function App() {
  const {
    cards,
    visibleCards,
    allTags,
    tagGroups,
    filterTag,
    setFilterTag,
    filterSourceMode,
    setFilterSourceMode,
    sortKey,
    setSortKey,
    expandedCardId,
    toggleExpanded,
    processingMode,
    setProcessingMode,
    privacyMode,
    setPrivacyMode,
    operations,
    undoAvailable,
    isBusy,
    globalError,
    renamePreview,
    renameConfirmed,
    renamableCount,
    toasts,
    dismissToast,
    loadDemoCards,
    exportByTags,
    undoLastOperation,
    simulateDrop,
    handleFilesDropped,
    showToast,
    updateCardTags,
    updateCardSuggestedName,
    previewRename,
    confirmRename,
  } = useFilePipeline();

  useBackendHealth(showToast);

  const shellMode = useShellMode();
  const isElectron = Boolean(window.dropzone?.isElectron);

  if (isElectron && shellMode === 'ball') {
    return (
      <FloatingBall
        onFilesDropped={handleFilesDropped}
        onDropError={(msg) => showToast('error', msg)}
      />
    );
  }

  return (
    <FloatingShell>
      <main className="app">
        <ApiModeBanner />
        <DemoMode onLoadDemo={loadDemoCards} disabled={isBusy} />

        <PrivacyToggle
          enabled={privacyMode}
          onChange={setPrivacyMode}
          disabled={isBusy}
        />

        <ProcessingModeSwitch
          mode={processingMode}
          onChange={setProcessingMode}
          disabled={isBusy}
        />

        <Dropzone
          onSimulateDrop={simulateDrop}
          onFilesDropped={handleFilesDropped}
          onDropError={(msg) => showToast('error', msg)}
          disabled={isBusy}
        />

        {globalError && <p className="app__global-error">{globalError}</p>}

        {cards.length > 0 && (
          <>
            <TagAggregator
              groups={tagGroups}
              activeTag={filterTag}
              onSelectTag={setFilterTag}
            />
            <CardListToolbar
              allTags={allTags}
              filterTag={filterTag}
              onFilterTagChange={setFilterTag}
              filterSourceMode={filterSourceMode}
              onFilterSourceModeChange={setFilterSourceMode}
              sortKey={sortKey}
              onSortKeyChange={setSortKey}
              visibleCount={visibleCards.length}
              totalCount={cards.length}
            />
          </>
        )}

        <div className="app__cards">
          {cards.length === 0 ? (
            <p className="app__empty">
              {isElectron
                ? '将文件拖入上方区域，或加载演示数据'
                : '点击上方按钮模拟拖入，或加载演示数据'}
            </p>
          ) : visibleCards.length === 0 ? (
            <p className="app__empty">当前筛选下没有文件</p>
          ) : (
            visibleCards.map((card) => (
              <FileCard
                key={card.id}
                card={card}
                expanded={expandedCardId === card.id}
                onToggleExpand={() => toggleExpanded(card.id)}
                editable={card.status === 'complete'}
                onTagsChange={(tags) => updateCardTags(card.id, tags)}
                onSuggestedNameChange={(name) =>
                  updateCardSuggestedName(card.id, name)
                }
              />
            ))
          )}
        </div>

        {renamableCount > 0 && (
          <section className="rename-actions">
            <button
              type="button"
              className="rename-actions__btn"
              onClick={() => void previewRename()}
              disabled={isBusy}
            >
              预览改名
            </button>
            <button
              type="button"
              className="rename-actions__btn rename-actions__btn--primary"
              onClick={() => void confirmRename()}
              disabled={isBusy || !renamePreview || renamePreview.length === 0}
            >
              确认改名
            </button>
          </section>
        )}

        {renamePreview && renamePreview.length > 0 && (
          <RenamePreviewList
            entries={renamePreview}
            dryRun={!renameConfirmed}
          />
        )}

        {cards.length > 0 && (
          <ExportDialog
            allTags={allTags}
            onExport={(req) => void exportByTags(req)}
            disabled={isBusy}
          />
        )}

        <OperationLog
          operations={operations}
          onUndo={() => void undoLastOperation()}
          canUndo={undoAvailable}
          disabled={isBusy}
        />

        <Toast toasts={toasts} onDismiss={dismissToast} />
      </main>
    </FloatingShell>
  );
}

export default App;
