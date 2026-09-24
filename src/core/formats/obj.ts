import earcut from 'earcut';
import { defaultPreviewColor, type PreviewGeometryScene, type PreviewMesh } from '../geometry/previewScene';

export const OBJ_MAX_BYTES = 20 * 1024 * 1024;
const MAX_TRIANGLES = 200_000;
type Vector = [number, number, number];

export function parseObj(source: string): PreviewGeometryScene {
  if (source.length > OBJ_MAX_BYTES) throw new Error('OBJ files must be 20 MB or smaller.');
  const positions: Vector[] = [];
  const normals: Vector[] = [];
  let textureCount = 0;
  const meshes: PreviewMesh[] = [];
  const warnings = new Set<string>();
  let name = 'Imported model';
  let mesh: PreviewMesh | undefined;
  let triangleCount = 0;
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);

  for (let line = 0; line < lines.length; line++) {
    const lineNumber = line + 1;
    let text = lines[line];
    while (text.trimEnd().endsWith('\\') && line + 1 < lines.length)
      text = text.trimEnd().slice(0, -1) + ' ' + lines[++line];
    const [command, ...args] = text.split('#')[0].trim().split(/\s+/);
    if (!command) continue;

    const fail = (message: string): never => {
      throw new Error(`Line ${lineNumber}: ${message}`);
    };

    const number = (value: string | undefined): number => {
      const parsed =
        value === undefined || !/^[+-]?(?:\d*\.?\d+|\d+\.?)(?:[eE][+-]?\d+)?$/.test(value) ? NaN : Number(value);
      if (!Number.isFinite(parsed) || Math.abs(parsed) > 1e8) fail('Expected a finite coordinate within ±100000000.');

      return parsed;
    };

    const index = (value: string, count: number): number => {
      if (!/^[+-]?\d+$/.test(value)) fail('Invalid face index.');
      const parsed = Number(value);
      const resolved = parsed < 0 ? count + parsed : parsed - 1;
      if (!Number.isSafeInteger(parsed) || parsed === 0 || resolved < 0 || resolved >= count)
        fail('Face index is out of range.');

      return resolved;
    };

    if (command === 'v') {
      const position: Vector = [number(args[0]), number(args[1]), number(args[2])];
      if (args.length === 4) {
        const weight = number(args[3]);
        if (weight === 0) fail('Vertex weight cannot be zero.');
        for (let axis = 0; axis < 3; axis++) position[axis] = number(String(position[axis] / weight));
      } else if (args.length > 3) warnings.add('Vertex colors are not imported.');
      positions.push(position);
    } else if (command === 'vn') {
      const normal: Vector = [number(args[0]), number(args[1]), number(args[2])];
      const length = Math.hypot(...normal);
      normals.push(length ? (normal.map((value) => value / length) as Vector) : [0, 0, 0]);
    } else if (command === 'vt') {
      if (!args.length) fail('Texture coordinates are missing.');
      args.forEach(number);
      textureCount++;
      warnings.add('Textures and materials are not imported.');
    } else if (command === 'o' || command === 'g') {
      name = args.join(' ') || 'Imported model';
      mesh = undefined;
    } else if (command === 'f') {
      if (args.length < 3 || args.length > 4096) fail('Faces must have between 3 and 4096 corners.');
      const corners = args.map((arg) => {
        const parts = arg.split('/');
        if (parts.length > 3) fail('Invalid face reference.');
        const position = positions[index(parts[0], positions.length)];
        if (parts[1]) index(parts[1], textureCount);
        const normal = parts[2] ? normals[index(parts[2], normals.length)] : undefined;

        return { position, normal };
      });
      const normal: Vector = [0, 0, 0];
      for (let i = 0; i < corners.length; i++) {
        const a = corners[i].position;
        const b = corners[(i + 1) % corners.length].position;
        normal[0] += (a[1] - b[1]) * (a[2] + b[2]);
        normal[1] += (a[2] - b[2]) * (a[0] + b[0]);
        normal[2] += (a[0] - b[0]) * (a[1] + b[1]);
      }
      const length = Math.hypot(...normal);
      if (!length) fail('Face has zero area.');
      for (let axis = 0; axis < 3; axis++) normal[axis] /= length;
      const droppedAxis = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
      const flat = corners.flatMap(({ position }) => position.filter((_, axis) => axis !== droppedAxis));
      const triangles = earcut(flat);
      if (!triangles.length) fail('Face could not be triangulated.');
      triangleCount += triangles.length / 3;
      if (triangleCount > MAX_TRIANGLES) fail('Model exceeds the 200,000 triangle limit.');
      if (!mesh) {
        mesh = {
          apiIndex: -1,
          sourceLine: 0,
          apiName: name,
          color: defaultPreviewColor(),
          preserveNormals: true,
          vertices: [],
          indices: [],
        };
        meshes.push(mesh);
      }
      const offset = mesh.vertices.length;
      for (const corner of corners) {
        const n = corner.normal && Math.hypot(...corner.normal) > 0 ? corner.normal : normal;
        const [x, y, z] = corner.position;
        mesh.vertices.push({ x, y, z, nx: n[0], ny: n[1], nz: n[2] });
      }
      for (let i = 0; i < triangles.length; i += 3) {
        const a = corners[triangles[i]].position;
        const b = corners[triangles[i + 1]].position;
        const c = corners[triangles[i + 2]].position;
        const u = b.map((v, axis) => v - a[axis]);
        const v = c.map((n, axis) => n - a[axis]);
        const dot =
          (u[1] * v[2] - u[2] * v[1]) * normal[0] +
          (u[2] * v[0] - u[0] * v[2]) * normal[1] +
          (u[0] * v[1] - u[1] * v[0]) * normal[2];
        const indices = [triangles[i], triangles[i + 1], triangles[i + 2]];
        if (dot < 0) [indices[1], indices[2]] = [indices[2], indices[1]];
        mesh.indices.push(...indices.map((value) => value + offset));
      }
    } else if (command === 'mtllib' || command === 'usemtl') warnings.add('Textures and materials are not imported.');
    else if (command === 's') {
      if (args[0] !== 'off' && args[0] !== '0')
        warnings.add('Smoothing groups are ignored; supplied normals are preserved.');
    } else warnings.add('Unsupported OBJ records (such as lines or curves) were skipped.');
  }
  if (!meshes.length) throw new Error('No mesh faces found. Choose an OBJ containing polygon faces.');

  return { meshes, warnings: [...warnings] };
}

export function writeObj(scene: PreviewGeometryScene): string {
  const output = ['# Geometry Preview OBJ export', '# Mesh geometry and normals; no materials or textures'];
  let offset = 1;
  let faceCount = 0;
  for (const mesh of scene.meshes) {
    if (!mesh.indices.length) continue;
    output.push(`o ${mesh.apiName.replace(/[^\w.-]+/g, '_') || 'mesh'}`);
    for (const vertex of mesh.vertices) {
      if (![vertex.x, vertex.y, vertex.z, vertex.nx, vertex.ny, vertex.nz].every(Number.isFinite))
        throw new Error('Cannot export non-finite geometry.');
      output.push(`v ${vertex.x} ${vertex.y} ${vertex.z}`);
    }
    for (const vertex of mesh.vertices) output.push(`vn ${vertex.nx} ${vertex.ny} ${vertex.nz}`);
    if (mesh.indices.length % 3 !== 0) throw new Error('Cannot export incomplete triangles.');
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const face = mesh.indices.slice(i, i + 3).map((index) => {
        if (!Number.isInteger(index) || index < 0 || index >= mesh.vertices.length)
          throw new Error('Cannot export invalid mesh indices.');

        return `${index + offset}//${index + offset}`;
      });
      output.push(`f ${face.join(' ')}`);
      faceCount++;
    }
    offset += mesh.vertices.length;
  }
  if (!faceCount) throw new Error('There is no mesh geometry to export.');

  return output.join('\n') + '\n';
}
