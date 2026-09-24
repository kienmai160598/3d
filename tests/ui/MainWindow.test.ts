import { parseObj } from '../../src/core/formats/obj';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiTracePanelModel } from '../../src/hooks/apiTrace/ApiTracePanelModel';
import { LinkPanelModel } from '../../src/hooks/linkPanel/LinkPanelModel';
import { MainWindow } from '../../src/hooks/mainWindow/MainWindow';
import { ParameterPanelModel } from '../../src/hooks/parameterPanel/ParameterPanelModel';
import { VariablePanelModel } from '../../src/hooks/variablePanel/VariablePanelModel';
import type { CodeEditorHandle } from '../../src/types/editor';
import type { Viewport3DHandle } from '../../src/types/viewport';

class FakeEditor implements CodeEditorHandle {
  text = '';
  cursor = 0;
  traceLines: { lines: number[]; active: number } = { lines: [], active: -1 };
  focused = false;
  onTextChanged: () => void = () => {};
  onCursorPositionChanged: () => void = () => {};

  #lineStart(line: number): number {
    let position = 0;
    for (let i = 1; i < line; ++i) position = this.text.indexOf('\n', position) + 1;

    return position;
  }

  #setCursor(position: number): void {
    const moved = position !== this.cursor;
    this.cursor = position;
    if (moved) this.onCursorPositionChanged();
  }

  type(text: string, cursorLine: number): void {
    this.text = text;
    this.onTextChanged();
    this.#setCursor(this.#lineStart(cursorLine));
  }

  moveTo(line: number): void {
    this.#setCursor(this.#lineStart(line));
  }

  toPlainText() {
    return this.text;
  }

  clear() {
    this.text = '';
    this.cursor = 0;
    this.onTextChanged();
    this.onCursorPositionChanged();
  }

  currentLine() {
    return this.text.slice(0, this.cursor).split('\n').length;
  }

  blockCount() {
    return this.text.split('\n').length;
  }

  setTraceSourceLines(lines: ReadonlySet<number>, activeLine = -1) {
    this.traceLines = { lines: [...lines].sort((a, b) => a - b), active: activeLine };
  }

  setTextCursorToLine(line: number) {
    this.#setCursor(this.#lineStart(line));
  }

  centerCursor() {}

  cursorBlockText() {
    return this.text.split('\n')[this.currentLine() - 1];
  }

  insertAtCursorBlockEnd(text: string) {
    const start = this.#lineStart(this.currentLine());
    const end = start + this.cursorBlockText().length;
    this.text = this.text.slice(0, end) + text + this.text.slice(end);
    this.onTextChanged();
    this.#setCursor(end + text.length);
  }

  setFocus() {
    this.focused = true;
  }
}

function fakeViewport(log: string[]): Viewport3DHandle {
  let apiFocus = false;

  const record =
    (name: string) =>
    (...args: unknown[]) => {
      const printable = args.map((a) =>
        a instanceof Set
          ? `{${[...a].join(',')}}`
          : Array.isArray(a)
            ? `[${a.length}]`
            : typeof a === 'object'
              ? 'obj'
              : String(a),
      );
      log.push(`${name}(${printable.join(', ')})`);
    };

  return {
    setRuntimeResult: record('setRuntimeResult'),
    setShowPoints: record('setShowPoints'),
    setShowVectors: record('setShowVectors'),
    setShowLabels: record('setShowLabels'),
    setDebugItemVisible: record('setDebugItemVisible'),
    hideAllDebugItems: record('hideAllDebugItems'),
    showAllDebugItems: record('showAllDebugItems'),
    setSelectedVariable: record('setSelectedVariable'),
    setSelectedVariables: record('setSelectedVariables'),
    selectedDebugItems: () => new Set<string>(),
    fitDebugOverlay: record('fitDebugOverlay'),
    setGeometryScene: record('setGeometryScene'),
    setShowGeometry: record('setShowGeometry'),
    setGeometryWireframe: record('setGeometryWireframe'),
    setSelectedApiCall: record('setSelectedApiCall'),
    selectedMeshIndex: () => -1,
    isMeshSelected: () => false,
    hasApiFocus: () => apiFocus,
    hasMeshFocus: () => false,
    setApiFocusIndices: (indices) => {
      apiFocus = true;
      record('setApiFocusIndices')(indices);
    },
    clearApiFocus: () => {
      apiFocus = false;
      record('clearApiFocus')();
    },
    fitScene: record('fitScene'),
    setConnectorPreviews: record('setConnectorPreviews'),
  };
}

function createMainWindow() {
  const mw = new MainWindow();
  const log: string[] = [];
  const editor = new FakeEditor();
  const variables = new VariablePanelModel();
  const parameters = new ParameterPanelModel();
  const apiTrace = new ApiTracePanelModel();
  const links = new LinkPanelModel();
  const viewport = fakeViewport(log);
  mw.bindEditor(editor);
  mw.bindViewport(viewport);
  mw.bindVariables(variables);
  mw.bindParameters(parameters);
  mw.bindApiTrace(apiTrace);
  mw.bindLinks(links);
  editor.onTextChanged = mw.onEditorTextChanged;
  editor.onCursorPositionChanged = mw.onEditorCursorPositionChanged;
  variables.setSelectionChangedCallback(mw.onVariableSelectionChanged);
  parameters.setChangedCallback(mw.onParametersChanged);
  apiTrace.setSelectionChangedCallback(mw.onApiTraceSelectionChanged);
  apiTrace.setSourceActivatedCallback(mw.onApiTraceSourceActivated);
  apiTrace.setHistorySourceActivatedCallback(mw.onApiTraceHistorySourceActivated);
  links.setExpressionEvaluator(mw.linkExpressionEvaluator);
  links.setPreviewChangedCallback(mw.onLinkPreviewChanged);

  return { mw, log, editor, variables, parameters, apiTrace, links };
}

const kSource = [
  'double w = 2;',
  'get_val("Width", w);',
  'FdPoint3d p0(1, 2, 3);',
  'FdVector3d n(0, 0, 1);',
  'makeDisc(p0, n, w, 1, 8, false);',
  'double after = 1;',
].join('\n');

const isMac = /Mac|iPhone|iPad|iPod/i.test(globalThis.navigator?.platform || globalThis.navigator?.userAgent || '');

function keyEvent(
  key: string,
  modifiers: { control?: boolean; shift?: boolean } = {},
  target: 'input' | 'tree' | 'dialog' = 'tree',
) {
  const matches: Record<string, string> = { input: 'input', tree: '.tree-view', dialog: '[data-floating-window]' };

  return {
    key,
    shiftKey: !!modifiers.shift,
    ctrlKey: !isMac && !!modifiers.control,
    metaKey: isMac && !!modifiers.control,
    altKey: false,
    target: { closest: (selectors: string) => (selectors.includes(matches[target]) ? {} : null) },
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
}

describe('MainWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps OBJ preview independent from code edits and restores code on request', () => {
    const { mw, editor, log } = createMainWindow();
    mw.start();
    editor.type(kSource, 6);
    vi.advanceTimersByTime(220);
    const imported = parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3');
    mw.replacePreviewWithObj(imported, 'triangle.obj');
    expect(editor.text).toBe(kSource);
    expect(mw.canExportObj).toBe(true);
    expect(parseObj(mw.exportObj()).meshes[0].indices).toHaveLength(3);
    log.length = 0;
    editor.type(kSource.replace('double w = 2', 'double w = 4'), 6);
    vi.advanceTimersByTime(220);
    expect(log).not.toContain('setGeometryScene(obj)');
    expect(log).not.toContain('setRuntimeResult(obj)');
    expect(mw.importedObj?.name).toBe('triangle.obj');
    mw.returnToCodePreview();
    expect(mw.importedObj).toBeNull();
    expect(log).toContain('setGeometryScene(obj)');
    expect(parseObj(mw.exportObj()).meshes[0].indices.length).toBeGreaterThan(3);
    mw.dispose();
  });

  it('starts like the Qt constructor and debounces edits by 220 ms', () => {
    const { mw, log, editor, variables } = createMainWindow();
    mw.start();
    expect(mw.statusBar().currentMessage()).toBe('Geometry Preview ready');
    expect(log.slice(0, 2)).toEqual(['setSelectedApiCall(-1, false)', 'clearApiFocus()']);

    log.length = 0;
    editor.type(kSource, 6);
    vi.advanceTimersByTime(219);
    expect(log).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(log.indexOf('setGeometryScene(obj)')).toBeLessThan(log.indexOf('setRuntimeResult(obj)'));
    expect(log.indexOf('setRuntimeResult(obj)')).toBeLessThan(log.indexOf('setConnectorPreviews([0], -1)'));
    expect(mw.m_currentPreviewLine).toBe(6);
    expect(variables.summary).toMatch(/^State after line 6 {2}\| {2}\d+ variable\(s\)/);
    expect(mw.statusBar().currentMessage()).toMatch(/^Line 6 \| 1 live mesh\(es\) \| 1 API call\(s\)$/);
    vi.advanceTimersByTime(2600);
    expect(mw.statusBar().currentMessage()).toBe('');
    mw.dispose();
  });

  it('discovers get_val parameters from the whole source, independent of the cursor', () => {
    const { mw, editor, parameters } = createMainWindow();
    mw.start();
    editor.type(kSource, 1);
    vi.advanceTimersByTime(220);
    expect(mw.m_currentPreviewLine).toBe(1);
    expect(parameters.rows.map((row) => row.texts[0])).toEqual(['Width']);
    expect(mw.m_lastResult.apiCalls).toHaveLength(0);
    mw.dispose();
  });

  it('keeps the preview line while browsing trace sources and resumes on manual navigation', () => {
    const { mw, editor, apiTrace } = createMainWindow();
    mw.start();
    editor.type(kSource, 6);
    vi.advanceTimersByTime(220);
    expect(mw.m_lastResult.apiCalls.map((call) => call.name)).toEqual(['makeDisc']);

    const api = apiTrace.m_tree.topLevelItem(0);
    apiTrace.m_tree.mousePressEvent({
      item: api,
      column: 1,
      modifiers: { shift: false, control: false },
      onDecoration: false,
    });
    expect(mw.statusBar().currentMessage()).toBe('API #1 makeDisc | 2 point/vector input(s), 1 call(s) in focus');
    apiTrace.m_tree.mouseReleaseEvent({
      item: api,
      column: 1,
      modifiers: { shift: false, control: false },
      onDecoration: false,
    });
    expect(editor.currentLine()).toBe(5);
    expect(editor.traceLines).toEqual({ lines: [5], active: 5 });
    expect(mw.m_browsingTrace).toBe(true);
    expect(mw.statusBar().currentMessage()).toBe('Source line 5 - keeping preview at line 6');

    mw.runPreview();
    expect(mw.m_currentPreviewLine).toBe(6);
    expect(apiTrace.selectedApiCall()).toBe(0);

    editor.moveTo(2);
    expect(mw.m_browsingTrace).toBe(false);
    expect(editor.traceLines.lines).toEqual([]);
    vi.advanceTimersByTime(220);
    expect(mw.m_currentPreviewLine).toBe(2);
    mw.dispose();
  });

  it('selects variables from the viewport and navigates to their last assignment', () => {
    const { mw, log, editor, variables } = createMainWindow();
    mw.start();
    editor.type(kSource, 6);
    vi.advanceTimersByTime(220);
    log.length = 0;
    mw.onViewportSelectionChanged(new Set(['n']));
    expect(log).toContain('setSelectedVariables({n})');
    expect(variables.selectedVariable()).toBe('n');
    expect(editor.currentLine()).toBe(4);
    expect(editor.traceLines).toEqual({ lines: [4], active: 4 });
    mw.dispose();
  });

  it('inserts a real declaration for a point created in the viewport', () => {
    const { mw, editor } = createMainWindow();
    mw.start();
    editor.type('FdPoint3d pPreview1(0, 0, 0);\n', 1);
    mw.onViewportPointCreation({ x: 1.25, y: -0.0004, z: 2.0004 });
    expect(editor.text).toBe('FdPoint3d pPreview1(0, 0, 0);\nFdPoint3d pPreview2(1.25, 0, 2);\n\n');
    expect(editor.currentLine()).toBe(3);
    expect(editor.focused).toBe(true);
    expect(mw.statusBar().currentMessage()).toBe('Inserted pPreview2 from viewport: FdPoint3d pPreview2(1.25, 0, 2);');
    mw.dispose();
  });

  it('Esc exits the Link preview and clears the API focus', () => {
    const { mw, log, editor, apiTrace, links } = createMainWindow();
    mw.start();
    editor.type(kSource, 6);
    vi.advanceTimersByTime(220);
    links.addConnector();
    links.sizeTextChanged('diameter', 'w');
    links.testSelection();
    expect(log).toContain('setConnectorPreviews([1], 1)');
    expect(log.at(-1)).toBe('fitScene()');

    apiTrace.selectMeshApiCall(0);
    log.length = 0;
    mw.handleKeyDown(keyEvent('Escape'));
    expect(log).toContain('setConnectorPreviews([0], 1)');
    expect(log).toContain('clearApiFocus()');
    expect(apiTrace.selectedApiCall()).toBe(-1);
    expect(apiTrace.meshApiCall()).toBe(-1);
    mw.dispose();
  });

  it('dispatches action shortcuts, letting single-key shortcuts yield to text input', () => {
    const { mw, log } = createMainWindow();
    mw.start();
    vi.advanceTimersByTime(220);
    log.length = 0;
    const inInput = keyEvent('f', {}, 'input');
    mw.handleKeyDown(inInput);
    expect(log).toEqual([]);
    expect(inInput.preventDefault).not.toHaveBeenCalled();

    const inTree = keyEvent('f', {}, 'tree');
    mw.handleKeyDown(inTree);
    expect(log).toEqual(['fitDebugOverlay()']);
    expect(inTree.preventDefault).toHaveBeenCalled();

    log.length = 0;
    const run = keyEvent('r', { control: true }, 'input');
    mw.handleKeyDown(run);
    expect(run.preventDefault).toHaveBeenCalled();
    expect(log).toContain('setRuntimeResult(obj)');

    log.length = 0;
    mw.handleKeyDown(keyEvent('f', {}, 'dialog'));
    expect(log).toEqual([]);
    mw.dispose();
  });
});
