'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { GitGraph, Terminal, ArrowRight, Code, Cpu, GitBranch } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-gray-100 p-4 overflow-hidden relative">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[100px]" />
      </div>

      <div className="z-10 max-w-4xl w-full flex flex-col items-center text-center space-y-12">
        {/* Header / Logo Area */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center space-y-6"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/30 blur-xl rounded-full" />
            <div className="relative bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-2xl">
              <GitGraph className="w-16 h-16 text-blue-400" />
            </div>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
            Git Learning App
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl leading-relaxed">
            Master Git commands through interactive visualization. 
            <br className="hidden md:block" />
            Solve conflicts, manage branches, and understand the graph.
          </p>
        </motion.div>

        {/* Feature Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full"
        >
          {[
            { icon: Terminal, title: "Interactive Terminal", desc: "Execute real Git commands in a safe sandbox environment." },
            { icon: GitBranch, title: "Visual Graph", desc: "See your commit history and branches update in real-time." },
            { icon: Code, title: "Conflict Resolution", desc: "Practice solving merge conflicts with a built-in editor." }
          ].map((feature, i) => (
            <div key={i} className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl backdrop-blur-sm hover:bg-gray-800/50 transition-colors">
              <feature.icon className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Link 
            href="/game" 
            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
          >
            Start Learning
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-6 text-gray-500 text-sm"
      >
        Built for developers, by developers.
      </motion.div>
    </main>
  );
}
