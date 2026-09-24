import type { WorkspaceHeaderProps } from '../types/modelFiles';
import { ModelFileControls } from './ModelFileControls';
import { Button } from './ui/button';
import { Box, Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export function WorkspaceHeader({ files }: WorkspaceHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const ThemeIcon = theme === 'light' ? Moon : Sun;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 bg-base px-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Box className="size-[19px]" strokeWidth={1.7} aria-hidden />
      </div>
      <h1 className="truncate text-sm font-semibold tracking-tight sm:text-[15px]">Geometry Preview</h1>
      <div className="flex-1" />
      <ModelFileControls {...files} />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="text-muted-foreground"
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        onClick={toggleTheme}
      >
        <ThemeIcon className="size-4" aria-hidden />
      </Button>
    </header>
  );
}
