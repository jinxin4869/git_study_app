'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { GitState } from '@/types/git';
import { CommitDetails } from './commit-details';
import { trackingStatus } from '@/learning/repository-view';
import { calculateGraphLayout } from '@/utils/graph-layout';

interface GitGraphProps {
  state: GitState;
}

export function GitGraph({ state }: GitGraphProps) {
  const reducedMotion = useReducedMotion();
  const { nodes, links } = useMemo(() => {
    const layout = calculateGraphLayout(state);
    const counts = new Map<number, number>();
    for (const id of [...Object.values(state.branches), ...Object.values(state.remoteBranches), ...Object.values(state.tags ?? {}).map(tag => tag.commitId)]) {
      const node = layout.nodes.find(item => item.id === id);
      if (node) counts.set(node.y, (counts.get(node.y) ?? 0) + 1);
    }
    // Reserve separate label rows within each lane, including refs on different commits.
    const spacing = Math.max(50, Math.max(1, ...counts.values()) * 20 + 35);
    for (const node of layout.nodes) node.y = 50 + ((node.y - 50) / 50) * spacing;
    return layout;
  }, [state]);

  const [zoom,setZoom] = useState(1);
  const [selectedId,setSelectedId] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const headCircleRef = useRef<SVGCircleElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const headLabelRef = useRef<SVGRectElement>(null);
  const headId = state.HEAD.type === 'branch' ? state.branches[state.HEAD.value] : state.HEAD.value;
  const headNode = nodes.find(node => node.id === headId);
  const labelRows = new Map<number, number>();
  const references = [
    ...Object.entries(state.branches).map(([name, id]) => ({ name, id, kind: 'local' })),
    ...Object.entries(state.remoteBranches).map(([name, id]) => ({ name, id, kind: 'remote' })),
    ...Object.entries(state.tags ?? {}).map(([name, tag]) => ({ name, id: tag.commitId, kind: 'tag' })),
  ];
  const branchLabels = references.flatMap(({ name, id, kind }) => {
    const node = nodes.find(node => node.id === id);
    if (!node) return [];
    const isHead = kind === 'local' && state.HEAD.type === 'branch' && state.HEAD.value === name;
    const text = isHead ? `${name} (HEAD)` : kind === 'remote' ? `${name} (remote)` : kind === 'tag' ? `tag: ${name}` : name;
    const width = [...text].reduce((sum, char) => sum + (char.charCodeAt(0) > 127 ? 12 : 7), 16);
    const row = labelRows.get(node.y) ?? 0;
    labelRows.set(node.y, row + 1);
    return [{ name: `${kind}:${name}`, node, isHead, text, width, y: node.y - 15 + row * 20, kind }];
  });
  const graphWidth = Math.max(800, nodes.length * 100, ...branchLabels.map(label => label.node.x + 10 + label.width + 24));
  const graphHeight = Math.max(400, ...nodes.map(node => node.y + 60), ...branchLabels.map(label => label.y + 50));

  const focusHead = useCallback(() => {
    const viewport=viewportRef.current;
    const label=headLabelRef.current;
    if(!viewport || !label)return;
    const visible=viewport.getBoundingClientRect();
    const bounds=label.getBoundingClientRect();
    const circle=headCircleRef.current?.getBoundingClientRect() ?? bounds;
    const left=Math.min(bounds.left,circle.left),right=Math.max(bounds.right,circle.right);
    const top=Math.min(bounds.top,circle.top),bottom=Math.max(bounds.bottom,circle.bottom);
    if(left<visible.left+16)viewport.scrollLeft+=left-visible.left-16;
    else if(right>visible.left+viewport.clientWidth-16)viewport.scrollLeft+=right-visible.left-viewport.clientWidth+16;
    if(top<visible.top+16)viewport.scrollTop+=top-visible.top-16;
    else if(bottom>visible.top+viewport.clientHeight-16)viewport.scrollTop+=bottom-visible.top-viewport.clientHeight+16;
  },[]);
  useEffect(focusHead,[focusHead,headId,state.HEAD.value,headNode?.x,headNode?.y]);
  const fitAll = () => {
    const viewport=viewportRef.current,svg=svgRef.current;
    if(!viewport || !svg)return;
    const offset=svg.getBoundingClientRect().top-viewport.getBoundingClientRect().top+viewport.scrollTop;
    const width=Math.max(1,viewport.clientWidth-32),height=Math.max(1,viewport.clientHeight-offset-16);
    setZoom(Math.min(1,width/graphWidth,height/graphHeight));
    viewport.scrollLeft=0;viewport.scrollTop=0;
  };
  const selected=state.commits[selectedId];

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div role="group" aria-label="グラフの表示操作" className="shrink-0 flex flex-wrap items-center gap-2 border-b border-gray-700 px-3 text-sm">
        <button type="button" tabIndex={0} aria-label="グラフを縮小" disabled={!nodes.length || zoom<=0.1} onClick={()=>setZoom(value=>Math.max(0.1,value/1.25))} className="min-h-11 px-2 underline disabled:opacity-50">−</button>
        <output aria-label="グラフの拡大率" aria-live="polite">{Math.round(zoom*100)}%</output>
        <button type="button" tabIndex={0} aria-label="グラフを拡大" disabled={!nodes.length || zoom>=2} onClick={()=>setZoom(value=>Math.min(2,value*1.25))} className="min-h-11 px-2 underline disabled:opacity-50">＋</button>
        <button type="button" tabIndex={0} onClick={()=>setZoom(1)} className="min-h-11 underline">100%に戻す</button>
        <button type="button" tabIndex={0} disabled={!nodes.length} onClick={fitAll} className="min-h-11 underline disabled:opacity-50">全体を表示</button>
        <button type="button" tabIndex={0} disabled={!headNode} onClick={focusHead} className="min-h-11 underline disabled:opacity-50">HEADへ戻る</button>
        <label className="flex items-center gap-2 min-w-0">コミットを選ぶ<select aria-label="コミットを選ぶ" value={selected ? selectedId : ''} onChange={event=>setSelectedId(event.target.value)} className="min-h-11 max-w-48 min-w-0 bg-gray-950 border border-gray-600 rounded"><option value="">詳細を表示</option>{nodes.map(node=><option key={node.id} value={node.id}>{node.id.slice(0,7)}: {node.commit.message}</option>)}</select></label>
      </div>
    <div ref={viewportRef} role="region" aria-label="コミットグラフ" tabIndex={0} className="focus-visible:outline-2 focus-visible:outline-blue-400 w-full flex-1 min-h-0 bg-gray-900 overflow-auto p-4">
      <div aria-label="リモートとの比較" className="mb-3 text-sm text-gray-200">
        <p>ローカル・remote（取得済みの参照）・tagを表示します。remoteはfetchするまで更新されません。</p>
        {trackingStatus(state).map(item => <p key={item.branch}>{item.branch} → {item.upstream}: {item.available ? `ahead ${item.ahead} / behind ${item.behind}` : '参照未取得'}</p>)}
      </div>
      <svg ref={svgRef} role="img" aria-label="コミットの親子とブランチの位置" viewBox={`0 0 ${graphWidth} ${graphHeight}`} width={graphWidth*zoom} height={graphHeight*zoom} className="block max-w-none">
        <desc>{`HEADは${state.HEAD.type === 'branch' ? 'ブランチ' : 'コミット'} ${state.HEAD.value}。` +
          Object.entries(state.branches).map(([name, id]) => `ブランチ ${name} は ${id || '未作成のコミット'}。`).join('') +
          nodes.map(node => { const commit = state.commits[node.id]; return `${node.id}: ${commit.message}。親は${commit.parents.join('、') || 'なし'}。`; }).join('')}</desc>
        {/* Links */}
        {links.map((link, i) => (
          <motion.line
            key={`link-${i}`}
            x1={link.source.x}
            y1={link.source.y}
            x2={link.target.x}
            y2={link.target.y}
            stroke="#4B5563"
            strokeWidth="2"
            initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.5 }}
          />
        ))}

        {/* Nodes */}
        {nodes.map((node) => (
          <motion.g
            key={node.id}
            initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20 }}
          >
            <circle
              ref={node.id===headId ? headCircleRef : undefined}
              cx={node.x}
              cy={node.y}
              r={6}
              fill="#3B82F6"
              stroke="#1F2937"
              strokeWidth="2"
            />
            <text
              x={node.x}
              y={node.y + 20}
              textAnchor="middle"
              fill="#9CA3AF"
              fontSize="10"
              className="font-mono"
            >
              {node.id.substring(0, 7)}
            </text>
            <text
              x={node.x}
              y={node.y - 10}
              textAnchor="middle"
              fill="#D1D5DB"
              fontSize="10"
              className="font-sans"
            >
              {node.commit.message}
            </text>
          </motion.g>
        ))}
        
        {/* Branch Labels & HEAD */}
        {branchLabels.map(({ name, node, isHead, text, width, y, kind }) => (
          <g key={`branch-${name}`}>
            <rect
              ref={isHead ? headLabelRef : undefined}
              x={node.x + 10}
              y={y}
              width={width}
              height={18}
              rx={4}
              fill={isHead ? '#047857' : kind === 'remote' ? '#1e40af' : kind === 'tag' ? '#92400e' : '#4B5563'}
            />
            <text x={node.x + 18} y={y + 12} fill="white" fontSize="10" fontWeight="bold" className="font-mono">
              {text}
            </text>
          </g>
        ))}

        {/* Detached HEAD */}
        {state.HEAD.type === 'commit' && (
           (() => {
             const node = nodes.find(n => n.id === state.HEAD.value);
             if (!node) return null;
             return (
              <motion.g
                key="detached-head"
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <rect
                  ref={headLabelRef}
                  x={node.x + 10}
                  y={node.y - 30}
                  width={60}
                  height={18}
                  rx={4}
                  fill="#F59E0B"
                />
                <text
                  x={node.x + 15}
                  y={node.y - 18}
                  fill="black"
                  fontSize="10"
                  fontWeight="bold"
                >
                  HEAD
                </text>
              </motion.g>
             );
           })()
        )}
      </svg>
    </div>
    {selected ? <CommitDetails commit={selected} parent={state.commits[selected.parents[0]]} onClose={()=>setSelectedId('')} /> : null}
    </div>
  );
}
