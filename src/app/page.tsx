'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { GitGraph, Terminal, ArrowRight, Code, GitBranch } from 'lucide-react';

export default function Home() {
  const reducedMotion = useReducedMotion();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-gray-100 px-4 py-8 overflow-hidden relative">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[100px]" />
      </div>

      <div className="z-10 max-w-4xl w-full flex flex-col items-center text-center space-y-12">
        {/* Header / Logo Area */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center space-y-6"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/30 blur-xl rounded-full" />
            <div className="relative bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-2xl">
              <GitGraph className="w-16 h-16 text-blue-400" />
            </div>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
            Gitを操作して学ぶ
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl leading-relaxed">
            ブラウザ内の模擬Gitと139の演習で練習できます。
            <br className="hidden md:block" />
            段階ヒントと未達の条件を確認しながら、操作と復旧を学べます。
          </p>
        </motion.div>

        {/* Feature Grid */}
        <motion.div 
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full"
        >
          {[
            { icon: Terminal, title: "コマンドで練習", desc: "ブラウザ内の模擬Gitで、安全に操作を試せます。" },
            { icon: GitBranch, title: "履歴を目で確認", desc: "コミットとブランチの位置を、操作しながら確認できます。" },
            { icon: Code, title: "競合から復旧", desc: "競合する内容を選び、続行・中断の方法を学べます。" }
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
          initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.5, delay: 0.4 }}
        >
          <Link 
            href="/game" 
            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
          >
            学習を始める
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div 
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reducedMotion ? { duration: 0 } : { delay: 1, duration: 1 }}
        className="relative mt-12 text-gray-400 text-sm text-center"
      >
        進捗はこのブラウザに保存します。実リポジトリには接続しません。
      </motion.div>
    </main>
  );
}
