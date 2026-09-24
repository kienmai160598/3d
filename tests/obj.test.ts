import { buildGeometryVertices } from '../src/core/viewport/geometryVertices';
import { describe, expect, it } from 'vitest';
import { parseObj, writeObj } from '../src/core/formats/obj';
const triangle = 'v 0 0 0\nv 2 0 0\nv 0 2 0\nf 1 2 3';

describe('OBJ mesh exchange', () => {
  it('imports positions, generates normals, and keeps imported meshes separate from code', () => {
    const mesh = parseObj(triangle).meshes[0];
    expect(mesh.apiIndex).toBe(-1);
    expect(mesh.indices).toHaveLength(3);
    expect(mesh.vertices[1]).toEqual({ x: 2, y: 0, z: 0, nx: 0, ny: 0, nz: 1 });
  });
  it('supports relative indices, texture references, normals and named objects', () => {
    const scene = parseObj('o Part\nv 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvn 0 0 2\nf -3/1/1 -2/1/1 -1/1/1');
    expect(scene.meshes[0].apiName).toBe('Part');
    expect(scene.meshes[0].vertices[0].nz).toBe(1);
    expect(scene.warnings).toContain('Textures and materials are not imported.');
  });
  it('triangulates concave polygons without filling the notch, preserving winding', () => {
    const scene = parseObj('v 0 0 0\nv 0 2 0\nv 1 1 0\nv 2 2 0\nv 2 0 0\nf 1 2 3 4 5');
    const mesh = scene.meshes[0];
    let area = 0;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = mesh.indices.slice(i, i + 3).map((index) => mesh.vertices[index]);
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      expect(cross).toBeLessThan(0);
      area += Math.abs(cross) / 2;
    }
    expect(area).toBe(3);
  });
  it('passes supplied OBJ normals to the renderer unchanged', () => {
    const scene = parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\nvn 1 0 0\nf 1//1 2//1 3//1');
    const vertices = buildGeometryVertices(scene).vertices.data();
    expect(Array.from(vertices.slice(6, 9))).toEqual([1, 0, 0]);
  });

  it('round trips multiple objects with independent index offsets', () => {
    const source = triangle + '\no second\nf 3 2 1';
    const restored = parseObj(writeObj(parseObj(source)));
    expect(restored.meshes).toHaveLength(2);
    expect(restored.meshes[1].vertices[0].nz).toBe(-1);
    expect(restored.meshes.reduce((n, m) => n + m.indices.length, 0)).toBe(6);
  });
  it.each(['f 0 2 3', 'f 1 2 99', 'f 1 2', 'f 1//9 2//9 3//9', 'f 1.2 2 3'])('rejects malformed faces: %s', (face) => {
    expect(() => parseObj('v 0 0 0\nv 1 0 0\nv 0 1 0\n' + face)).toThrow(/Line 4/);
  });
  it('triangulates faces outside the XY plane', () => {
    const mesh = parseObj('v 0 0 0\nv 0 1 0\nv 0 1 1\nv 0 0 1\nf 1 2 3 4').meshes[0];
    expect(mesh.indices).toHaveLength(6);
    expect(mesh.vertices[0].nx).toBe(1);
  });

  it('enforces input and face-size limits before processing geometry', () => {
    expect(() => parseObj(' '.repeat(20 * 1024 * 1024 + 1))).toThrow(/20 MB/);
    expect(() => parseObj('f ' + Array(4097).fill('1').join(' '))).toThrow(/4096 corners/);
  });

  it('rejects empty and non-finite geometry', () => {
    expect(() => parseObj('v 0 0 0')).toThrow(/No mesh faces/);
    expect(() => parseObj('v NaN 0 0')).toThrow(/Line 1/);
    expect(() => writeObj({ meshes: [], warnings: [] })).toThrow(/no mesh/);
  });
});
