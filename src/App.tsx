/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Download,
  Code,
  Trophy,
  RotateCcw,
  Sparkles,
  Check,
  HelpCircle,
  X,
} from 'lucide-react';
import {
  FlappyBirdCanvas,
  DifficultyMode,
  TimeOfDay,
  GameState,
} from './components/FlappyBirdCanvas';
import { sound } from './utils/audio';
import { getStandaloneHtml } from './utils/standaloneHtml';

export default function App() {
  const [difficulty, setDifficulty] = useState<DifficultyMode>('classic');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day');
  const [isMuted, setIsMuted] = useState<boolean>(sound.isMuted);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('flappy_best_score') || '0', 10) || 0;
    } catch {
      return 0;
    }
  });
  const [gameState, setGameState] = useState<GameState>('START');
  const [showCodeModal, setShowCodeModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const toggleSound = () => {
    const newState = sound.toggleMute();
    setIsMuted(newState);
  };

  const toggleTheme = () => {
    setTimeOfDay(prev => (prev === 'day' ? 'night' : 'day'));
  };

  const downloadStandaloneHtml = () => {
    const htmlContent = getStandaloneHtml();
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'index.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    const htmlContent = getStandaloneHtml();
    try {
      await navigator.clipboard.writeText(htmlContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Outfit'] selection:bg-amber-500 selection:text-white">
      {/* 
        TOP BAR CONTRACT:
        Zone 1: Wordmark
        Zone 2: 4-6 text links / info items
        Zone 3: 1-2 primary actions
      */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between z-20 shrink-0">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300 bg-clip-text text-transparent">
            Flappy Bird Arcade
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            onClick={() => setShowHelpModal(true)}
            className="hover:text-amber-400 transition-colors cursor-pointer"
          >
            How to Play
          </button>
          <span className="text-slate-700" aria-hidden="true">·</span>
          <button
            onClick={() => setShowCodeModal(true)}
            className="hover:text-amber-400 transition-colors cursor-pointer"
          >
            View Single-File HTML
          </button>
          <span className="text-slate-700" aria-hidden="true">·</span>
          <span className="text-slate-400">
            High Score: <strong className="text-amber-400 tabular-nums">{highScore}</strong>
          </span>
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleSound}
            aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
            title={isMuted ? 'Unmute sound (M)' : 'Mute sound (M)'}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${timeOfDay === 'day' ? 'night' : 'day'} mode`}
            title={`Switch to ${timeOfDay === 'day' ? 'night' : 'day'} mode`}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 cursor-pointer"
          >
            {timeOfDay === 'day' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>

          <button
            onClick={downloadStandaloneHtml}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 transition-all shadow-md shadow-amber-500/20 whitespace-nowrap cursor-pointer"
            title="Download complete standalone index.html to run anywhere offline"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Standalone HTML</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </header>

      {/* MAIN GAME VIEWPORT */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 overflow-hidden relative">
        {/* Subtle Ambient Background Glow */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-3xl" />
        </div>

        {/* ARCADE CABINET WRAPPER */}
        <div className="relative z-10 flex flex-col items-center max-w-full">
          {/* Top Control Bar with Difficulty Selector & Score Summary */}
          <div className="w-full max-w-[360px] flex items-center justify-between mb-3 px-1">
            {/* Difficulty Tabs */}
            <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-xs">
              {(['casual', 'classic', 'hardcore'] as DifficultyMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setDifficulty(mode)}
                  className={`px-2.5 py-1 rounded-md capitalize transition-colors font-medium cursor-pointer ${
                    difficulty === mode
                      ? 'bg-slate-800 text-amber-400 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Score Indicators */}
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-1">
                <span>Score:</span>
                <span className="text-white font-bold tabular-nums text-sm">{currentScore}</span>
              </div>
              <span className="text-slate-700" aria-hidden="true">·</span>
              <div className="flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400 font-bold tabular-nums">{highScore}</span>
              </div>
            </div>
          </div>

          {/* Canvas Game Area */}
          <FlappyBirdCanvas
            difficulty={difficulty}
            timeOfDay={timeOfDay}
            onScoreChange={setCurrentScore}
            onHighScoreChange={setHighScore}
            onStateChange={setGameState}
          />

          {/* Quick Controls & Shortcuts Bar */}
          <div className="mt-3 flex items-center justify-center gap-3 sm:gap-4 text-xs text-slate-400 text-center">
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-300">Space</kbd>
              or <span className="text-slate-300 font-medium">Click / Tap</span> to Jump
            </span>
            <span className="text-slate-700" aria-hidden="true">·</span>
            <button
              onClick={() => setShowHelpModal(true)}
              className="text-slate-400 hover:text-amber-400 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Game Rules
            </button>
            <span className="text-slate-700" aria-hidden="true">·</span>
            <button
              onClick={() => setShowCodeModal(true)}
              className="text-slate-400 hover:text-amber-400 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Get HTML File
            </button>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="h-10 border-t border-slate-900 px-6 flex items-center justify-between text-xs text-slate-500 z-10 shrink-0">
        <div className="flex items-center gap-2">
          <span>HTML5 Canvas 60 FPS Engine</span>
          <span aria-hidden="true">·</span>
          <span>Web Audio API Synthesizer</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Zero External Assets</span>
          <span aria-hidden="true">·</span>
          <span>100% Offline Compatible</span>
        </div>
      </footer>

      {/* HOW TO PLAY MODAL */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              How to Play Flappy Bird
            </h3>

            <div className="space-y-4 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</span>
                <div>
                  <strong className="text-white block mb-0.5">Jump & Flap</strong>
                  Press the <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-xs">Spacebar</kbd> or left-click/tap anywhere on screen to make the bird flap upward.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</span>
                <div>
                  <strong className="text-white block mb-0.5">Navigate Pipes</strong>
                  Guide the bird safely through the gaps in the moving green pipes. Each pair passed awards <strong className="text-amber-400">+1 Point</strong>.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</span>
                <div>
                  <strong className="text-white block mb-0.5">Avoid Collisions</strong>
                  Touching any pipe, hitting the ground, or flying off the top of the screen ends the game immediately.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">4</span>
                <div>
                  <strong className="text-white block mb-0.5">Earn Medals</strong>
                  Score 10+ for <span className="text-amber-700 font-semibold">Bronze</span>, 20+ for <span className="text-slate-300 font-semibold">Silver</span>, 30+ for <span className="text-amber-400 font-semibold">Gold</span>, and 40+ for <span className="text-cyan-400 font-semibold">Platinum</span>!
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Got It, Let's Play!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE-FILE HTML MODAL */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">Standalone Self-Contained HTML File</h3>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-3 mb-3">
              This is the 100% complete, self-contained single HTML file containing embedded CSS, JavaScript, HTML5 Canvas, and Web Audio synthesizers. You can save it as <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded">index.html</code> and double-click to play anywhere offline in any browser.
            </p>

            <div className="flex-1 overflow-auto rounded-lg bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] text-slate-300 leading-relaxed">
              <pre>{getStandaloneHtml()}</pre>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">Zero external dependencies · 100% self-contained</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Code'}</span>
                </button>
                <button
                  onClick={downloadStandaloneHtml}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download index.html</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
