declare module 'd3-force-3d' {
  export function forceX<NodeDatum>(target: (node: NodeDatum) => number): any;
  export function forceY<NodeDatum>(target: (node: NodeDatum) => number): any;
  export function forceCollide<NodeDatum>(radius: (node: NodeDatum) => number): any;
}
