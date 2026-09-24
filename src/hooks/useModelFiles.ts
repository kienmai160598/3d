import { useRef, useState, type ChangeEvent } from 'react';
import { OBJ_MAX_BYTES, parseObj } from '../core/formats/obj';
import type { MainWindow } from './mainWindow/MainWindow';

export function useModelFiles(mainWindow: MainWindow) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      if (!/\.obj$/i.test(file.name)) throw new Error('Choose a .obj file.');
      if (file.size > OBJ_MAX_BYTES) throw new Error('OBJ files must be 20 MB or smaller.');
      const scene = parseObj(await file.text());
      mainWindow.replacePreviewWithObj(scene, file.name);
      const triangles = scene.meshes.reduce((sum, mesh) => sum + mesh.indices.length / 3, 0);
      setMessage(
        `Imported ${file.name}: ${triangles.toLocaleString()} triangles.${scene.warnings.length ? ` ${scene.warnings.join(' ')}` : ''}`,
      );
      setError(false);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The OBJ could not be imported.');
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const exportFile = () => {
    try {
      const obj = mainWindow.exportObj();
      const url = URL.createObjectURL(new Blob([obj], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = mainWindow.importedObj?.name ?? 'geometry-preview.obj';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('OBJ exported. Includes mesh geometry and normals; materials and textures are not included.');
      setError(false);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The model could not be exported.');
      setError(true);
    }
  };

  const chooseFile = () => inputRef.current?.click();

  const dismissMessage = () => setMessage('');

  return {
    controls: { inputRef, busy, canExport: mainWindow.canExportObj, chooseFile, importFile, exportFile },
    message,
    error,
    dismissMessage,
  };
}
