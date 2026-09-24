import { Download, Upload } from 'lucide-react';
import type { ModelFileControlsProps } from '../types/modelFiles';
import { Button } from './ui/button';

export function ModelFileControls({
  inputRef,
  busy,
  canExport,
  chooseFile,
  importFile,
  exportFile,
}: ModelFileControlsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept=".obj"
        className="hidden"
        aria-label="Choose OBJ file"
        onChange={importFile}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={chooseFile}
        aria-label="Import OBJ"
        title="Import OBJ to replace the preview; your code is preserved"
      >
        <Upload className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">{busy ? 'Importing…' : 'Import OBJ'}</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={busy || !canExport}
        onClick={exportFile}
        aria-label="Export OBJ"
        title={canExport ? 'Export the active model as OBJ' : 'Create or import a model to export'}
      >
        <Download className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Export OBJ</span>
      </Button>
    </div>
  );
}
