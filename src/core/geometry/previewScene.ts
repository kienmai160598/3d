export interface PreviewColor {
  r: number;
  g: number;
  b: number;
}

export function defaultPreviewColor(): PreviewColor {
  return { r: 1.0, g: Math.fround(176.0 / 255.0), b: 0.0 };
}

export interface PreviewMeshVertex {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

export interface PreviewMesh {
  preserveNormals?: boolean;
  apiIndex: number;
  sourceLine: number;
  apiName: string;
  color: PreviewColor;
  vertices: PreviewMeshVertex[];
  indices: number[];
}

export interface PreviewGeometryScene {
  meshes: PreviewMesh[];
  warnings: string[];
}
