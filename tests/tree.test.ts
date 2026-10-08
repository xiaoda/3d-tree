import { beforeAll, describe, expect, it } from 'vitest';
import { Box3, InstancedMesh, Mesh } from 'three';
import { createTree, type ArtTree } from '../app/src/tree';
import { LEAVES } from '../app/src/config';

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
