'use dom';

import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { forceCollide, forceX, forceY } from 'd3-force-3d';
import { useEffect, useMemo, useRef } from 'react';

type GraphNode = {
  id: string;
  name: string;
  type: string;
  importanceScore: number;
  communityId: string;
  hierarchyDepth: number;
};

type GraphRelation = {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string;
  label: string;
  confidence: number;
  importanceScore: number;
};

type Community = {
  id: string;
  label: string;
  nodeCount: number;
  leaderEntityId: string;
};

type ForceNode = GraphNode & {
  color: string;
  communityLabel: string;
  leader: boolean;
  anchorX: number;
  anchorY: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
};

type ForceLink = GraphRelation & { source: string; target: string };

const palette = ['#8D7CFF', '#53D3F0', '#56D5A0', '#F5A45D', '#F37A96', '#CE91F5'];

function hash(value: string) {
  return [...value].reduce((total, character) => ((total << 5) - total + character.charCodeAt(0)) | 0, 0) >>> 0;
}

function nodeRadius(node: ForceNode) {
  const hierarchyWeight = node.type === 'domain' ? 6 : node.type === 'concept' ? 3 : 0;
  return 4.5 + Math.min(6.5, Math.sqrt(Math.max(0, node.importanceScore)) * 1.15) + hierarchyWeight;
}

function truncate(value: string, max = 22) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function endpointId(endpoint: string | ForceNode) {
  return typeof endpoint === 'string' ? endpoint : endpoint.id;
}

function isHierarchyLink(link: ForceLink) {
  return link.relationType === 'part_of' || link.relationType === 'belongs_to_domain';
}

export default function GraphForceCanvas({
  nodes,
  relations,
  communities,
  focusedEntityId,
  onFocus,
  dom,
}: {
  nodes: GraphNode[];
  relations: GraphRelation[];
  communities: Community[];
  focusedEntityId?: string;
  onFocus: (id: string) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
}) {
  const graphRef = useRef<ForceGraphMethods<ForceNode, ForceLink> | undefined>(undefined);
  const dataKey = JSON.stringify({ nodes, relations, communities });
  const graphData = useMemo(() => {
    const payload = JSON.parse(dataKey) as { nodes: GraphNode[]; relations: GraphRelation[]; communities: Community[] };
    const communityById = new Map(payload.communities.map((community) => [community.id, community]));
    const visibleCommunities = [...new Set(payload.nodes.map((node) => node.communityId))];
    const anchors = new Map(visibleCommunities.map((communityId, index) => {
      const angle = -Math.PI / 2 + (index / Math.max(1, visibleCommunities.length)) * Math.PI * 2;
      return [communityId, { x: Math.cos(angle) * 150, y: Math.sin(angle) * 108 }];
    }));
    const graphNodes: ForceNode[] = payload.nodes.map((node) => {
      const communityIndex = visibleCommunities.indexOf(node.communityId);
      const seed = hash(node.id);
      const anchor = anchors.get(node.communityId) ?? { x: 0, y: 0 };
      const angle = (seed % 360) * (Math.PI / 180);
      const depth = Math.max(0, node.hierarchyDepth);
      const distance = depth === 0 ? 0 : 28 + depth * 32 + (seed % 16);
      const community = communityById.get(node.communityId);
      return {
        ...node,
        color: palette[communityIndex % palette.length],
        communityLabel: community?.label ?? 'Connected group',
        leader: community?.leaderEntityId === node.id,
        anchorX: anchor.x,
        anchorY: anchor.y,
        x: anchor.x + Math.cos(angle) * distance,
        y: anchor.y + Math.sin(angle) * distance,
      };
    });
    const visibleNodeIds = new Set(graphNodes.map((node) => node.id));
    return {
      nodes: graphNodes,
      links: payload.relations.filter((relation) => visibleNodeIds.has(relation.sourceEntityId) && visibleNodeIds.has(relation.targetEntityId)).map((relation) => ({ ...relation, source: relation.sourceEntityId, target: relation.targetEntityId })),
    };
  }, [dataKey]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.d3Force('x', forceX<ForceNode>((node) => node.anchorX).strength((node: ForceNode) => node.type === 'domain' ? 0.3 : 0.07));
    graph.d3Force('y', forceY<ForceNode>((node) => node.anchorY).strength((node: ForceNode) => node.type === 'domain' ? 0.3 : 0.07));
    graph.d3Force('collide', forceCollide<ForceNode>((node) => nodeRadius(node) + 10).strength(0.92));
    graph.d3Force('charge')?.strength(-92);
    graph.d3Force('link')?.distance((link: ForceLink) => isHierarchyLink(link) ? 48 : 95).strength((link: ForceLink) => isHierarchyLink(link) ? 0.86 : 0.12);
    graph.d3ReheatSimulation();
    const timer = window.setTimeout(() => graph.zoomToFit(450, 42), 110);
    return () => window.clearTimeout(timer);
  }, [dataKey]);

  const selectedLinks = new Set(graphData.links.filter((link) => endpointId(link.source) === focusedEntityId || endpointId(link.target) === focusedEntityId).map((link) => link.id));

  return <div style={{ width: '100%', height: '100%', background: '#090F1D', overflow: 'hidden', touchAction: 'none' }}>
    <ForceGraph2D
      ref={graphRef}
      graphData={graphData}
      backgroundColor="#090F1D"
      nodeId="id"
      linkSource="source"
      linkTarget="target"
      nodeLabel={(node) => `${node.name} · ${node.communityLabel}`}
      linkLabel={(link) => link.label}
      enableNodeDrag
      enableZoomInteraction
      enablePanInteraction
      minZoom={0.25}
      maxZoom={5}
      cooldownTime={2200}
      d3AlphaDecay={0.028}
      d3VelocityDecay={0.32}
      linkColor={(link) => selectedLinks.has(link.id) ? '#D9D4FF' : isHierarchyLink(link) ? '#536887' : '#34425E'}
      linkWidth={(link) => selectedLinks.has(link.id) ? 2 : isHierarchyLink(link) ? Math.max(0.8, link.confidence) : 0.55}
      linkLineDash={(link) => isHierarchyLink(link) ? null : [3, 4]}
      linkDirectionalParticles={(link) => selectedLinks.has(link.id) ? 2 : 0}
      linkDirectionalParticleWidth={1.4}
      linkDirectionalParticleSpeed={0.007}
      linkDirectionalParticleColor={(link) => selectedLinks.has(link.id) ? '#D5D0FF' : '#6073A5'}
      linkCanvasObjectMode="after"
      onRenderFramePre={(ctx, scale) => {
        const groups = new Map<string, ForceNode[]>();
        graphData.nodes.forEach((node) => groups.set(node.communityId, [...(groups.get(node.communityId) ?? []), node]));
        groups.forEach((members) => {
          const positioned = members.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y));
          if (!positioned.length) return;
          const center = positioned.reduce((total, node) => ({ x: total.x + (node.x ?? 0), y: total.y + (node.y ?? 0) }), { x: 0, y: 0 });
          center.x /= positioned.length; center.y /= positioned.length;
          if (positioned.length < 2) return;
          const radius = Math.max(38, ...positioned.map((node) => Math.hypot((node.x ?? 0) - center.x, (node.y ?? 0) - center.y) + nodeRadius(node) + 13));
          ctx.beginPath();
          ctx.fillStyle = `${positioned[0].color}0D`;
          ctx.strokeStyle = `${positioned[0].color}36`;
          ctx.lineWidth = 1 / scale;
          ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }}
      nodeCanvasObject={(node, ctx, scale) => {
        const radius = nodeRadius(node);
        const selected = node.id === focusedEntityId;
        ctx.beginPath();
        ctx.arc(node.x ?? 0, node.y ?? 0, radius + (selected ? 4 : 0), 0, Math.PI * 2);
        ctx.fillStyle = selected ? '#F6F7FF' : `${node.color}44`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
        const structural = node.type === 'domain' || node.type === 'concept';
        if (selected || (structural && scale > 1.05) || scale > 2.05) {
          const label = truncate(node.name, 20);
          const fontSize = (structural || selected ? 10 : 8) / scale;
          ctx.font = `${structural || selected ? '700' : '500'} ${fontSize}px system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const width = ctx.measureText(label).width + 10 / scale;
          ctx.fillStyle = '#09101EDE';
          ctx.fillRect((node.x ?? 0) - width / 2, (node.y ?? 0) - radius - 18 / scale, width, 13 / scale);
          ctx.fillStyle = '#F3F5FF';
          ctx.fillText(label, node.x ?? 0, (node.y ?? 0) - radius - 11.5 / scale);
        }
      }}
      linkCanvasObject={(link, ctx, scale) => {
        if (!selectedLinks.has(link.id) || scale < 1.25) return;
        const source = typeof (link.source as unknown) === 'object' ? link.source as unknown as ForceNode : null;
        const target = typeof (link.target as unknown) === 'object' ? link.target as unknown as ForceNode : null;
        if (!source || !target || !Number.isFinite(source.x) || !Number.isFinite(target.x)) return;
        const label = truncate(link.label, 18);
        const x = ((source.x ?? 0) + (target.x ?? 0)) / 2;
        const y = ((source.y ?? 0) + (target.y ?? 0)) / 2;
        const fontSize = 7 / scale;
        ctx.font = `500 ${fontSize}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const width = ctx.measureText(label).width + 8 / scale;
        ctx.fillStyle = '#09101ED9';
        ctx.fillRect(x - width / 2, y - (fontSize + 3 / scale) / 2, width, fontSize + 3 / scale);
        ctx.fillStyle = selectedLinks.has(link.id) ? '#E3DEFF' : '#9EAECE';
        ctx.fillText(label, x, y);
      }}
      onNodeClick={(node) => {
        graphRef.current?.centerAt(node.x, node.y, 280);
        graphRef.current?.zoom(1.65, 280);
        void onFocus(String(node.id));
      }}
      onNodeDragEnd={(node) => {
        node.fx = node.x;
        node.fy = node.y;
      }}
    />
  </div>;
}
