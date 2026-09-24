import { useModelFiles } from './useModelFiles';
import { useEffect, useState } from 'react';
import { MainWindow } from './mainWindow/MainWindow';
import { useObservable } from './useObservable';

export function useMainWindow() {
  const [mainWindow] = useState(() => new MainWindow());
  useObservable(mainWindow);
  const files = useModelFiles(mainWindow);

  useEffect(() => {
    document.title = 'Geometry Preview';

    const onKeyDown = (event: KeyboardEvent) => mainWindow.handleKeyDown(event);

    window.addEventListener('keydown', onKeyDown);
    mainWindow.start();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      mainWindow.dispose();
    };
  }, [mainWindow]);

  return {
    files,
    importedObj: mainWindow.importedObj,
    returnToCodePreview: mainWindow.returnToCodePreview,
    menus: mainWindow.menus,
    toolbarItems: mainWindow.toolbarItems,
    inspectorCounts: mainWindow.inspectorCounts,
    raisedDock: mainWindow.raisedDock(),
    raiseDock: mainWindow.raiseDock,
    editor: {
      ref: mainWindow.bindEditor,
      onTextChanged: mainWindow.onEditorTextChanged,
      onCursorPositionChanged: mainWindow.onEditorCursorPositionChanged,
    },
    viewport: {
      ref: mainWindow.bindViewport,
      onSelectionChanged: mainWindow.onViewportSelectionChanged,
      onPointCreation: mainWindow.onViewportPointCreation,
      onMeshSelection: mainWindow.onViewportMeshSelection,
      onConnectorSelection: mainWindow.onViewportConnectorSelection,
    },
    variables: { ref: mainWindow.bindVariables, onSelectionChanged: mainWindow.onVariableSelectionChanged },
    parameters: { ref: mainWindow.bindParameters, onChanged: mainWindow.onParametersChanged },
    apiTrace: {
      ref: mainWindow.bindApiTrace,
      onSelectionChanged: mainWindow.onApiTraceSelectionChanged,
      onSourceActivated: mainWindow.onApiTraceSourceActivated,
      onHistorySourceActivated: mainWindow.onApiTraceHistorySourceActivated,
    },
    links: {
      ref: mainWindow.bindLinks,
      expressionEvaluator: mainWindow.linkExpressionEvaluator,
      onPreviewChanged: mainWindow.onLinkPreviewChanged,
    },
  };
}
