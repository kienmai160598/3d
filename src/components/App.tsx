import { Button } from './ui/button';
import { Box, CodeXml } from 'lucide-react';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { useDockArea } from '../hooks/useDockArea';
import { useMainWindow } from '../hooks/useMainWindow';
import { ApiTracePanel } from './ApiTracePanel';
import { CodeEditor } from './CodeEditor';
import { DockArea } from './DockArea';
import { LinkPanel } from './LinkPanel';
import { PanelHeader } from './PanelHeader';
import { WorkspaceHeader } from './WorkspaceHeader';
import { ParameterPanel } from './ParameterPanel';
import { ResizeHandle } from './ResizeHandle';
import { Splitter } from './Splitter';
import { ToolBar } from './ToolBar';
import { VariablePanel } from './VariablePanel';
import { Viewport3D } from './Viewport3D';

export function App() {
  const mainWindow = useMainWindow();
  const compact = useCompactLayout();
  const { mainAreaRef, dockHeight, onSeparatorPointerDown, onSeparatorKeyDown, minimum, maximum, title, tabs } =
    useDockArea(mainWindow.raisedDock, mainWindow.raiseDock);

  return (
    <div className="flex h-dvh w-full flex-col overflow-x-hidden overflow-y-auto bg-window select-none">
      <WorkspaceHeader files={mainWindow.files.controls} />
      {mainWindow.files.message && (
        <div
          role={mainWindow.files.error ? 'alert' : 'status'}
          className="flex items-center gap-2 border-b border-line bg-base px-3 py-2 text-xs"
        >
          <span
            className={mainWindow.files.error ? 'min-w-0 flex-1 text-error' : 'min-w-0 flex-1 text-muted-foreground'}
          >
            {mainWindow.files.message}
          </span>
          <Button variant="ghost" size="sm" onClick={mainWindow.files.dismissMessage}>
            Dismiss
          </Button>
        </div>
      )}
      <main className="flex min-h-[1000px] flex-1 flex-col p-3 md:min-h-[600px]">
        <div className="min-h-0 flex-1">
          <Splitter
            label="Resize editor and viewport"
            orientation={compact ? 'vertical' : 'horizontal'}
            initialSizes={compact ? [320, 680] : [330, 670]}
            stretchFactors={compact ? [0, 1] : [33, 67]}
          >
            <section
              aria-label="Code Editor"
              className="workspace-panel flex h-full min-w-0 flex-col overflow-hidden border border-line bg-base shadow-xs"
            >
              <PanelHeader icon={CodeXml} title="Code Editor">
                <span className="workspace-surface bg-secondary px-2 py-1 font-code text-xs text-muted-foreground">
                  C++
                </span>
              </PanelHeader>
              <div className="workspace-surface min-h-0 flex-1 overflow-hidden">
                <CodeEditor {...mainWindow.editor} />
              </div>
            </section>
            <div className="flex h-full min-w-0 flex-col">
              <div ref={mainAreaRef} className="flex min-h-0 flex-1 flex-col">
                <section
                  aria-label="3D Viewport"
                  className="workspace-panel @container/preview flex min-h-0 flex-1 flex-col overflow-hidden border border-line bg-base shadow-xs"
                >
                  <PanelHeader icon={Box} title="3D Viewport">
                    <ToolBar items={mainWindow.toolbarItems} />
                  </PanelHeader>
                  <div className="workspace-surface relative min-h-0 flex-1 overflow-hidden bg-viewport">
                    <Viewport3D {...mainWindow.viewport} />
                    {mainWindow.importedObj && (
                      <div className="absolute top-2 right-2 left-2 flex items-center gap-2 rounded-md border border-line bg-base/95 p-2 text-xs">
                        <span className="min-w-0 flex-1 truncate" title={mainWindow.importedObj.name}>
                          OBJ preview · {mainWindow.importedObj.name}
                        </span>
                        <Button size="sm" variant="outline" onClick={mainWindow.returnToCodePreview}>
                          Return to code
                        </Button>
                      </div>
                    )}
                  </div>
                </section>
                <ResizeHandle
                  orientation="horizontal"
                  label="Resize inspector"
                  value={dockHeight}
                  min={minimum}
                  max={maximum}
                  onPointerDown={onSeparatorPointerDown}
                  onKeyDown={onSeparatorKeyDown}
                />
                {mainWindow.importedObj ? (
                  <section
                    aria-label="Imported model inspector"
                    style={{ height: dockHeight }}
                    className="workspace-panel flex shrink-0 flex-col items-center justify-center gap-2 border border-line bg-base p-3 text-center text-xs"
                  >
                    <p className="font-medium">Imported OBJ model</p>
                    <p className="text-muted-foreground">OBJ contains mesh geometry, not editable C++ parameters.</p>
                    <Button size="sm" variant="outline" onClick={mainWindow.returnToCodePreview}>
                      Return to code preview
                    </Button>
                  </section>
                ) : null}
                <div className={mainWindow.importedObj ? 'hidden' : 'contents'}>
                  <DockArea
                    counts={mainWindow.inspectorCounts}
                    height={dockHeight}
                    title={title}
                    tabs={tabs}
                    panels={{
                      VariablesDock: <VariablePanel {...mainWindow.variables} />,
                      ParametersDock: <ParameterPanel {...mainWindow.parameters} />,
                      ApiTraceDock: <ApiTracePanel {...mainWindow.apiTrace} />,
                      LinkDock: <LinkPanel {...mainWindow.links} />,
                    }}
                  />
                </div>
              </div>
            </div>
          </Splitter>
        </div>
      </main>
    </div>
  );
}
