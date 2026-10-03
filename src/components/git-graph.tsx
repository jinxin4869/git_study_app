'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { GitState } from '@/types/git';
import { calculateGraphLayout } from '@/utils/graph-layout';

interface GitGraphProps {
  state: GitState;
}

export function GitGraph({ state }: GitGraphProps) {
  const reducedMotion = useReducedMotion();
  const { nodes, links } = useMemo(() => {
    return calculateGraphLayout(state);
  }, [state]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const headLabelRef = useRef<SVGRectElement>(null);
  const headId = state.HEAD.type === 'branch' ? state.branches[state.HEAD.value] : state.HEAD.value;
  const headNode = nodes.find(node => node.id === headId);
  const branchLabels = Object.entries(state.branches).flatMap(([name, id], index) => {
    const node = nodes.find(node => node.id === id);
    if (!node) return [];
    const isHead = state.HEAD.type === 'branch' && state.HEAD.value === name;
    const text = isHead ? `${name} (HEAD)` : name;
    // Allow room for the whole label, including HEAD and non-ASCII branch names.
    const width = [...text].reduce((sum, char) => sum + (char.charCodeAt(0) > 127 ? 12 : 7), 16);
    return [{ name, node, isHead, text, width, y: node.y - 15 + index * 20 }];
  });
  const graphWidth = Math.max(800, nodes.length * 100, ...branchLabels.map(label => label.node.x + 10 + label.width + 24));
  const graphHeight = Math.max(400, ...nodes.map(node => node.y + 60), ...branchLabels.map(label => label.y + 50));

  useEffect(() => {
    const viewport = viewportRef.current;
    const label = headLabelRef.current;
    if (!viewport || !label) return;
    const bounds = label.getBBox();
    const left = (headNode?.x ?? bounds.x) - 16;
    const right = bounds.x + bounds.width + 16;
    if (left < viewport.scrollLeft || right > viewport.scrollLeft + viewport.clientWidth - 32) {
      viewport.scrollLeft = Math.max(0, right - viewport.clientWidth + 32);
    }
    if (bounds.y < viewport.scrollTop || bounds.y + bounds.height > viewport.scrollTop + viewport.clientHeight - 32) {
      viewport.scrollTop = Math.max(0, bounds.y - 32);
    }
  }, [headId, state.HEAD.value, headNode?.x, headNode?.y]);

  return (
    <div ref={viewportRef} role="region" aria-label="コミットグラフ" tabIndex={0} className="focus-visible:outline-2 focus-visible:outline-blue-400 w-full h-full bg-gray-900 overflow-auto p-4">
      <svg role="img" aria-label="コミットの親子とブランチの位置" width={graphWidth} height={graphHeight} className="min-w-full min-h-full">
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
        {branchLabels.map(({ name, node, isHead, text, width, y }) => (
          <g key={`branch-${name}`}>
            <rect
              ref={isHead ? headLabelRef : undefined}
              x={node.x + 10}
              y={y}
              width={width}
              height={18}
              rx={4}
              fill={isHead ? '#047857' : '#4B5563'}
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
  );
}
