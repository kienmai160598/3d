import type { PreviewGeometryScene } from '../geometry/PreviewGeometryEngine';
import type { GeometryRange } from '../../types/viewportEngine';
import { isValidIndex } from '../../utils/math';
import { QVector3D } from '../../utils/Vector3D';
import { VertexArray } from './VertexArray';

export function buildGeometryVertices(scene: PreviewGeometryScene): { vertices: VertexArray; ranges: GeometryRange[] } {
  const vertices = new VertexArray(1024);
  const ranges: GeometryRange[] = [];
  let meshIndex = 0;
  for (const mesh of scene.meshes) {
    const range: GeometryRange = { meshIndex: meshIndex++, apiIndex: mesh.apiIndex, start: vertices.size(), count: 0 };

    interface Face {
      indices: [number, number, number];
      areaNormal: QVector3D;
      normal: QVector3D;
    }
    const faces: Face[] = [];
    const adjacentFaces = new Map<string, number[]>();

    const position = (index: number): string => {
      const v = mesh.vertices[index];

      return `${v.x},${v.y},${v.z}`;
    };

    const vertexCount = mesh.vertices.length;
    for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
      const a = mesh.indices[i],
        b = mesh.indices[i + 1],
        c = mesh.indices[i + 2];
      if (!isValidIndex(a, vertexCount) || !isValidIndex(b, vertexCount) || !isValidIndex(c, vertexCount)) continue;
      const va = mesh.vertices[a],
        vb = mesh.vertices[b],
        vc = mesh.vertices[c];
      const areaNormal = QVector3D.crossProduct(
        new QVector3D(vb.x - va.x, vb.y - va.y, vb.z - va.z),
        new QVector3D(vc.x - va.x, vc.y - va.y, vc.z - va.z),
      );
      if (areaNormal.lengthSquared() <= 0) continue;
      const faceIndex = faces.length;
      faces.push({ indices: [a, b, c], areaNormal, normal: areaNormal.normalized() });
      for (const index of [a, b, c]) {
        const key = position(index);
        const adjacent = adjacentFaces.get(key);
        if (adjacent) adjacent.push(faceIndex);
        else adjacentFaces.set(key, [faceIndex]);
      }
    }
    const creaseCosine = 0.819152;
    const smooth = !mesh.preserveNormals && mesh.apiName !== 'makeFacettedCylinder';
    for (const face of faces) {
      for (const index of face.indices) {
        let normal = face.normal;
        if (smooth) {
          let sx = 0,
            sy = 0,
            sz = 0;
          for (const neighbor of adjacentFaces.get(position(index)) ?? []) {
            if (QVector3D.dotProduct(face.normal, faces[neighbor].normal) >= creaseCosine) {
              const n = faces[neighbor].areaNormal;
              sx += n.x;
              sy += n.y;
              sz += n.z;
            }
          }
          const sum = new QVector3D(sx, sy, sz);
          if (sum.lengthSquared() > 0) normal = sum.normalized();
        }
        const v = mesh.vertices[index];
        if (mesh.preserveNormals) normal = new QVector3D(v.nx, v.ny, v.nz);
        vertices.push(v.x, v.y, v.z, mesh.color.r, mesh.color.g, mesh.color.b, normal.x, normal.y, normal.z);
      }
    }

    range.count = vertices.size() - range.start;
    if (range.count > 0) ranges.push(range);
  }

  return { vertices, ranges };
}

export function buildGeometryWireVertices(scene: PreviewGeometryScene): {
  vertices: VertexArray;
  ranges: GeometryRange[];
} {
  interface EdgeData {
    a: number;
    b: number;
    triangleCount: number;
    firstNormal: QVector3D;
    secondNormal: QVector3D;
  }

  const vertices = new VertexArray(1024);
  const ranges: GeometryRange[] = [];
  let meshIndex = 0;
  for (const mesh of scene.meshes) {
    const range: GeometryRange = { meshIndex: meshIndex++, apiIndex: mesh.apiIndex, start: vertices.size(), count: 0 };

    const edges = new Map<string, EdgeData>();
    const vertexCount = mesh.vertices.length;

    const addEdge = (ia: number, ib: number, normal: QVector3D) => {
      if (!isValidIndex(ia, vertexCount) || !isValidIndex(ib, vertexCount) || ia === ib) return;
      const first = Math.min(ia, ib),
        second = Math.max(ia, ib);
      const key = `${first},${second}`;
      let edge = edges.get(key);
      if (!edge) {
        edge = { a: first, b: second, triangleCount: 0, firstNormal: new QVector3D(), secondNormal: new QVector3D() };
        edges.set(key, edge);
      }
      if (edge.triangleCount === 0) edge.firstNormal = normal;
      else if (edge.triangleCount === 1) edge.secondNormal = normal;
      ++edge.triangleCount;
    };

    for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
      const ia = mesh.indices[i];
      const ib = mesh.indices[i + 1];
      const ic = mesh.indices[i + 2];
      if (!isValidIndex(ia, vertexCount) || !isValidIndex(ib, vertexCount) || !isValidIndex(ic, vertexCount)) continue;

      const a = mesh.vertices[ia];
      const b = mesh.vertices[ib];
      const c = mesh.vertices[ic];
      const pa = new QVector3D(a.x, a.y, a.z);
      const pb = new QVector3D(b.x, b.y, b.z);
      const pc = new QVector3D(c.x, c.y, c.z);
      let normal = QVector3D.crossProduct(pb.sub(pa), pc.sub(pa));
      if (normal.lengthSquared() > 1.0e-12) normal = normal.normalize();

      addEdge(ia, ib, normal);
      addEdge(ib, ic, normal);
      addEdge(ic, ia, normal);
    }

    const ordered = [...edges.values()].sort((x, y) => x.a - y.a || x.b - y.b);
    for (const edge of ordered) {
      let feature = edge.triangleCount === 1;
      if (!feature && edge.triangleCount === 2) {
        const d = Math.abs(QVector3D.dotProduct(edge.firstNormal, edge.secondNormal));
        feature = d < 0.9995;
      } else if (edge.triangleCount > 2) {
        feature = true;
      }
      if (!feature) continue;

      const a = mesh.vertices[edge.a];
      const b = mesh.vertices[edge.b];
      vertices.push(a.x, a.y, a.z, mesh.color.r, mesh.color.g, mesh.color.b, 0, 0, 1);
      vertices.push(b.x, b.y, b.z, mesh.color.r, mesh.color.g, mesh.color.b, 0, 0, 1);
    }

    range.count = vertices.size() - range.start;
    if (range.count > 0) ranges.push(range);
  }

  return { vertices, ranges };
}
