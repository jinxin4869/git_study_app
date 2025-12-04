'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { GitState } from '@/types/git';
import { calculateGraphLayout } from '@/utils/graph-layout';

interface GitGraphProps {
  state: GitState;
}

export function GitGraph({ state }: GitGraphProps) {
  const { nodes, links } = useMemo(() => {
    return calculateGraphLayout(state);
  }, [state]);

  return (
    <div className="w-full h-full bg-gray-900 overflow-auto p-4">
      <svg width={Math.max(800, nodes.length * 100)} height={Math.max(400, (Object.keys(state.branches).length + 1) * 60)} className="min-w-full min-h-full">
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
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
        ))}

        {/* Nodes */}
        {nodes.map((node) => (
          <motion.g
            key={node.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
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
        {Object.entries(state.branches).map(([branchName, commitId], i) => {
          const node = nodes.find(n => n.id === commitId);
          if (!node) return null;
          
          const isHead = state.HEAD.type === 'branch' && state.HEAD.value === branchName;
          
          return (
            <motion.g
              key={`branch-${branchName}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <rect
                x={node.x + 10}
                y={node.y - 15 + (i * 15)} // Stack labels if multiple on same commit
                width={branchName.length * 8 + 20}
                height={18}
                rx={4}
                fill={isHead ? '#10B981' : '#6B7280'}
              />
              <text
                x={node.x + 15}
                y={node.y - 3 + (i * 15)}
                fill="white"
                fontSize="10"
                fontWeight="bold"
              >
                {branchName} {isHead && '(HEAD)'}
              </text>
            </motion.g>
          );
        })}
        
        {/* Detached HEAD */}
        {state.HEAD.type === 'commit' && (
           (() => {
             const node = nodes.find(n => n.id === state.HEAD.value);
             if (!node) return null;
             return (
              <motion.g
                key="detached-head"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <rect
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
