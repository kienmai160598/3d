import type { ChangeEvent, RefObject } from 'react';

export interface ModelFileControlsProps {
  inputRef: RefObject<HTMLInputElement | null>;
  busy: boolean;
  canExport: boolean;
  chooseFile: () => void;
  importFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  exportFile: () => void;
}

export interface WorkspaceHeaderProps {
  files: ModelFileControlsProps;
}
