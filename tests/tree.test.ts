import { beforeAll, describe, expect, it } from 'vitest';
import { Box3, InstancedMesh, Mesh, MeshPhysicalMaterial, PerspectiveCamera, Vector3 } from 'three';
import { createTree, type ArtTree } from '../app/src/tree';
import { LEAVES } from '../app/src/config';
import { cameraAt, FPS } from '../app/src/timeline';

describe('完整艺术树', () => {
  let tree: ArtTree;
  beforeAll(() => { tree = createTree(); });
  it('生成全部叶片及实际三维细节', () => {
    expect(tree.leaves).toHaveLength(LEAVES.length);
    expect(tree.stats.discs).toBeGreaterThan(1000);
    expect(tree.stats.fibers).toBeGreaterThan(500);
    const box = new Box3().setFromObject(tree.group);
    expect(box.max.y).toBeGreaterThan(8);
    expect(box.min.y).toBeGreaterThan(-0.5);
  });
  it('所有几何及实例矩阵均有效', () => {
    let checked = 0;
    tree.group.traverse(object => {
      if (object instanceof Mesh) {
        const array = object.geometry.getAttribute('position').array;
        expect(array.every(Number.isFinite)).toBe(true); checked++;
      }
      if (object instanceof InstancedMesh) {
        expect(object.instanceMatrix.array.every(Number.isFinite)).toBe(true);
        expect(object.boundingSphere).not.toBeNull();
      }
    });
    expect(checked).toBeGreaterThan(50);
  });
  it('任意时间跳转后恢复完全相同的叶片姿态', () => {
    tree.update(3.25);
    const before = tree.leaves.map(leaf => leaf.quaternion.toArray());
    tree.update(80); tree.update(0); tree.update(3.25);
    expect(tree.leaves.map(leaf => leaf.quaternion.toArray())).toEqual(before);
  });
  it('树冠横向和纵深都展开，而不是仅正面的一片扇形', () => {
    const crown = new Box3();
    tree.leaves.forEach(leaf => crown.union(new Box3().setFromObject(leaf)));
    const width = crown.max.x - crown.min.x, depth = crown.max.z - crown.min.z;
    expect(width).toBeGreaterThan(18);
    expect(depth).toBeGreaterThan(18);
    expect(Math.min(width, depth) / Math.max(width, depth)).toBeGreaterThan(0.8);
  });
  it('每片叶子的背面都有实体叶脉', () => {
    tree.leaves.forEach(leaf => expect(leaf.getObjectByName('背面叶脉')).toBeDefined());
  });
  it('叶片和纤维具备独立织纹与克制的布料光泽', () => {
    const leaf = tree.leaves[0].getObjectByName('叶片实体') as Mesh;
    const fiber = tree.group.getObjectByName('彩色纤维 1') as Mesh;
    const leafMaterial = leaf.material as MeshPhysicalMaterial, fiberMaterial = fiber.material as MeshPhysicalMaterial;
    expect(leafMaterial).toBeInstanceOf(MeshPhysicalMaterial);
    expect(fiberMaterial).toBeInstanceOf(MeshPhysicalMaterial);
    expect(leafMaterial.sheen).toBeGreaterThan(0);
    expect(leafMaterial.sheen).toBeLessThan(0.5);
    expect(leafMaterial.map).toBeDefined();
    expect(leafMaterial.roughnessMap).toBeDefined();
    expect(leafMaterial.bumpMap).not.toBe(fiberMaterial.bumpMap);
  });
  it('艺术馆版成树阶段每一帧都保留完整叶面和底座', () => {
    const camera = new PerspectiveCamera(72, 9 / 16, 0.1, 100), point = new Vector3();
    const meshes = tree.leaves.map(leaf => leaf.getObjectByName('叶片实体') as Mesh);
    meshes.push(tree.group.getObjectByName('叠层年轮 1') as Mesh);
    let maxX = 0, maxY = 0;
    for (let frame = 240; frame < 360; frame++) {
      const time = frame / FPS, pose = cameraAt(time, 'portrait');
      tree.update(time, 'film'); tree.group.updateMatrixWorld(true);
      camera.position.set(...pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld();
      for (const mesh of meshes) {
        const positions = mesh.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
          point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).project(camera);
          maxX = Math.max(maxX, Math.abs(point.x)); maxY = Math.max(maxY, Math.abs(point.y));
        }
      }
    }
    expect(maxX).toBeLessThan(0.99); expect(maxY).toBeLessThan(0.95);
    tree.update(0, 'study');
  });
  it('树干和底座具备实际多色色层', () => {
    const trunk = tree.group.getObjectByName('连续树干') as Mesh;
    expect(trunk.geometry.getAttribute('color')).toBeDefined();
    expect(tree.group.children.filter(child => child.name.startsWith('叠层年轮'))).toHaveLength(15);
  });
  it('生长支持正反跳转，完整造型可以恢复', () => {
    const sample = () => tree.leaves.map(leaf => ({ visible: leaf.visible, scale: leaf.scale.toArray(), rotation: leaf.quaternion.toArray() }));
    tree.update(20, 'film');
    expect(tree.leaves.every(leaf => leaf.visible && leaf.scale.x === 1 && leaf.scale.y === 1)).toBe(true);
    tree.update(0, 'film');
    expect(tree.leaves.every(leaf => !leaf.visible)).toBe(true);
    tree.update(7.5, 'film'); const before = sample();
    tree.update(20, 'film'); tree.update(0, 'film'); tree.update(7.5, 'film');
    expect(sample()).toEqual(before);
    tree.update(0, 'study');
    expect(tree.leaves.every(leaf => leaf.visible && leaf.scale.x === 1)).toBe(true);
  });
  it('生长不改写静态圆片矩阵，逆序渲染一致且未生长的树有匹配阴影', () => {
    const discs: InstancedMesh[] = [];
    tree.group.traverse(object => { if (object instanceof InstancedMesh) discs.push(object); });
    tree.update(0, 'study');
    const rest = discs.map(mesh => Array.from(mesh.instanceMatrix.array));
    tree.update(12, 'film'); const middle = discs.map(mesh => Array.from(mesh.instanceMatrix.array));
    expect(middle).not.toEqual(rest);
    tree.update(0, 'film'); tree.update(19, 'film'); tree.update(12, 'film');
    expect(discs.map(mesh => Array.from(mesh.instanceMatrix.array))).toEqual(middle);
    tree.update(20, 'film');
    expect(discs.map(mesh => Array.from(mesh.instanceMatrix.array))).toEqual(rest);
    const trunk = tree.group.getObjectByName('连续树干') as Mesh;
    expect(trunk.geometry.hasAttribute('birthTime')).toBe(true);
    expect(trunk.customDepthMaterial).toBeDefined();
    expect(trunk.customDistanceMaterial).toBeDefined();
    tree.update(0, 'study');
  });
});
