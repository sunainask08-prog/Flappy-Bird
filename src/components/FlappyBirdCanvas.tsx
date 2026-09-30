import React, { useEffect, useRef, useState, useCallback } from 'react';
import { sound } from '../utils/audio';

export type GameState = 'START' | 'PLAYING' | 'GAME_OVER';
export type DifficultyMode = 'casual' | 'classic' | 'hardcore';
export type TimeOfDay = 'day' | 'night';

interface FlappyBirdCanvasProps {
  difficulty: DifficultyMode;
  timeOfDay: TimeOfDay;
  onScoreChange?: (score: number) => void;
  onHighScoreChange?: (highScore: number) => void;
  onStateChange?: (state: GameState) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  type: 'feather' | 'star' | 'smoke';
}

interface PipePair {
  x: number;
  topHeight: number;
  bottomHeight: number;
  gap: number;
  passed: boolean;
  width: number;
}

interface Cloud {
  x: number;
  y: number;
  speed: number;
  scale: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
}

export const FlappyBirdCanvas: React.FC<FlappyBirdCanvasProps> = ({
  difficulty,
  timeOfDay,
  onScoreChange,
  onHighScoreChange,
  onStateChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // High score tracking
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('flappy_best_score');
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [currentScore, setCurrentScore] = useState<number>(0);
  const [gameState, setGameState] = useState<GameState>('START');
  const [isNewHigh, setIsNewHigh] = useState<boolean>(false);

  // References for game loop mutable state
  const stateRef = useRef({
    gameState: 'START' as GameState,
    score: 0,
    highScore: highScore,
    isNewHighScore: false,
    screenShake: 0,
    flashAlpha: 0,

    // Bird state
    bird: {
      x: 100,
      y: 280,
      radius: 14,
      width: 36,
      height: 26,
      vy: 0,
      angle: 0,
      targetAngle: 0,
      wingTimer: 0,
      wingFrame: 0, // 0: down, 1: mid, 2: up
      flapSpeed: 6,
    },

    // Physics parameters based on difficulty
    gravity: 0.36,
    jumpImpulse: -7.0,
    maxFallSpeed: 9.0,
    pipeSpeed: 2.5,
    pipeGap: 135,
    pipeSpacing: 210,

    // Dimensions
    width: 360,
    height: 600,
    groundHeight: 90,

    // Entities
    pipes: [] as PipePair[],
    particles: [] as Particle[],
    clouds: [] as Cloud[],
    stars: [] as Star[],

    // Background offset
    groundOffset: 0,
    cityOffset: 0,

    // Animation frame handle
    animId: 0,
    lastTime: 0,
    tick: 0,

    // Restart button bounding rect in canvas coordinates
    restartBtn: { x: 95, y: 395, width: 170, height: 48 },
  });

  // Keep stateRef synced with props/state
  useEffect(() => {
    stateRef.current.highScore = highScore;
  }, [highScore]);

  useEffect(() => {
    if (difficulty === 'casual') {
      stateRef.current.gravity = 0.32;
      stateRef.current.jumpImpulse = -6.4;
      stateRef.current.pipeSpeed = 2.0;
      stateRef.current.pipeGap = 152;
      stateRef.current.pipeSpacing = 230;
    } else if (difficulty === 'hardcore') {
      stateRef.current.gravity = 0.40;
      stateRef.current.jumpImpulse = -7.5;
      stateRef.current.pipeSpeed = 3.1;
      stateRef.current.pipeGap = 120;
      stateRef.current.pipeSpacing = 195;
    } else {
      // Classic
      stateRef.current.gravity = 0.36;
      stateRef.current.jumpImpulse = -7.0;
      stateRef.current.pipeSpeed = 2.5;
      stateRef.current.pipeGap = 135;
      stateRef.current.pipeSpacing = 210;
    }
  }, [difficulty]);

  // Spawn initial background scenery
  const initScenery = useCallback(() => {
    const s = stateRef.current;
    s.clouds = [
      { x: 30, y: 80, speed: 0.4, scale: 1.0 },
      { x: 190, y: 130, speed: 0.3, scale: 0.75 },
      { x: 310, y: 60, speed: 0.5, scale: 1.1 },
    ];
    s.stars = [];
    for (let i = 0; i < 40; i++) {
      s.stars.push({
        x: Math.random() * s.width,
        y: Math.random() * (s.height - s.groundHeight - 120),
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 0.05 + 0.02,
      });
    }
  }, []);

  // Jump Action
  const triggerJump = useCallback(() => {
    const s = stateRef.current;

    if (s.gameState === 'START') {
      s.gameState = 'PLAYING';
      setGameState('PLAYING');
      onStateChange?.('PLAYING');
      sound.playSwoosh();
      s.bird.vy = s.jumpImpulse;
      s.bird.targetAngle = -0.45;
      sound.playJump();
      spawnFeathers(s.bird.x, s.bird.y);
      return;
    }

    if (s.gameState === 'PLAYING') {
      s.bird.vy = s.jumpImpulse;
      s.bird.targetAngle = -0.45;
      sound.playJump();
      spawnFeathers(s.bird.x, s.bird.y);
      return;
    }

    // If GAME_OVER and clicked restart
  }, [onStateChange]);

  // Restart Action
  const restartGame = useCallback(() => {
    const s = stateRef.current;
    sound.playSwoosh();

    s.gameState = 'START';
    s.score = 0;
    s.isNewHighScore = false;
    s.screenShake = 0;
    s.flashAlpha = 0;

    s.bird.x = 95;
    s.bird.y = s.height * 0.44;
    s.bird.vy = 0;
    s.bird.angle = 0;
    s.bird.targetAngle = 0;
    s.bird.wingTimer = 0;
    s.bird.wingFrame = 1;

    s.pipes = [];
    s.particles = [];

    setCurrentScore(0);
    setIsNewHigh(false);
    setGameState('START');
    onScoreChange?.(0);
    onStateChange?.('START');
  }, [onScoreChange, onStateChange]);

  // Particle Generators
  const spawnFeathers = (x: number, y: number) => {
    const s = stateRef.current;
    for (let i = 0; i < 4; i++) {
      s.particles.push({
        x: x - 10,
        y: y + (Math.random() * 8 - 4),
        vx: -(Math.random() * 1.5 + 0.5),
        vy: Math.random() * 1.5 - 0.75,
        size: Math.random() * 4 + 3,
        color: '#fef08a',
        alpha: 0.9,
        life: 0,
        maxLife: 24,
        type: 'feather',
      });
    }
  };

  const spawnStars = (x: number, y: number) => {
    const s = stateRef.current;
    const colors = ['#fde047', '#facc15', '#ffffff', '#fb923c'];
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.2;
      const speed = Math.random() * 2.5 + 1.2;
      s.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: colors[i % colors.length],
        alpha: 1,
        life: 0,
        maxLife: 30,
        type: 'star',
      });
    }
  };

  const spawnImpact = (x: number, y: number) => {
    const s = stateRef.current;
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      s.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 3,
        color: '#e2e8f0',
        alpha: 1,
        life: 0,
        maxLife: 20,
        type: 'smoke',
      });
    }
  };

  // Trigger Game Over
  const triggerGameOver = useCallback((hitPipe: boolean) => {
    const s = stateRef.current;
    if (s.gameState === 'GAME_OVER') return;

    s.gameState = 'GAME_OVER';
    setGameState('GAME_OVER');
    onStateChange?.('GAME_OVER');

    s.screenShake = 12;
    s.flashAlpha = 0.65;

    spawnImpact(s.bird.x, s.bird.y);

    if (hitPipe) {
      sound.playHit();
      // Drop immediately
      s.bird.vy = 4;
    } else {
      sound.playDie();
    }

    // High score check
    if (s.score > s.highScore) {
      s.isNewHighScore = true;
      setIsNewHigh(true);
      s.highScore = s.score;
      setHighScore(s.score);
      onHighScoreChange?.(s.score);
      try {
        localStorage.setItem('flappy_best_score', String(s.score));
      } catch {
        // ignore
      }
      setTimeout(() => {
        sound.playFanfare();
      }, 350);
    }
  }, [onHighScoreChange, onStateChange]);

  // Main Canvas Setup and Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    initScenery();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = stateRef.current.width * dpr;
    canvas.height = stateRef.current.height * dpr;
    ctx.scale(dpr, dpr);

    let animationId: number;

    const gameLoop = () => {
      const s = stateRef.current;
      s.tick++;

      // ==========================================
      // UPDATE PHYSICS & ENTITIES
      // ==========================================
      const groundY = s.height - s.groundHeight;

      if (s.screenShake > 0) {
        s.screenShake *= 0.85;
        if (s.screenShake < 0.2) s.screenShake = 0;
      }

      if (s.flashAlpha > 0) {
        s.flashAlpha -= 0.04;
        if (s.flashAlpha < 0) s.flashAlpha = 0;
      }

      // Parallax scenery motion
      s.groundOffset = (s.groundOffset + (s.gameState === 'GAME_OVER' ? 0 : s.pipeSpeed)) % 24;
      s.cityOffset = (s.cityOffset + (s.gameState === 'GAME_OVER' ? 0 : s.pipeSpeed * 0.2)) % 360;

      s.clouds.forEach(c => {
        if (s.gameState !== 'GAME_OVER') {
          c.x -= c.speed;
          if (c.x < -100) c.x = s.width + 50;
        }
      });

      // State-specific bird updates
      if (s.gameState === 'START') {
        // Gentle hover bobbing
        s.bird.y = s.height * 0.44 + Math.sin(s.tick * 0.08) * 8;
        s.bird.angle = 0;
        s.bird.wingTimer++;
        if (s.bird.wingTimer % s.bird.flapSpeed === 0) {
          s.bird.wingFrame = (s.bird.wingFrame + 1) % 3;
        }
      } else if (s.gameState === 'PLAYING') {
        // Wing flapping
        s.bird.wingTimer++;
        if (s.bird.wingTimer % s.bird.flapSpeed === 0) {
          s.bird.wingFrame = (s.bird.wingFrame + 1) % 3;
        }

        // Velocity & Gravity
        s.bird.vy += s.gravity;
        if (s.bird.vy > s.maxFallSpeed) s.bird.vy = s.maxFallSpeed;
        s.bird.y += s.bird.vy;

        // Smooth rotation
        if (s.bird.vy < 0) {
          s.bird.targetAngle = -0.45; // ~ -26 degrees
        } else {
          // Gradual nose dive
          s.bird.targetAngle = Math.min(Math.PI / 2, s.bird.targetAngle + 0.05);
        }
        s.bird.angle += (s.bird.targetAngle - s.bird.angle) * 0.22;

        // Check ceiling
        if (s.bird.y - s.bird.radius <= 0) {
          s.bird.y = s.bird.radius;
          s.bird.vy = 0;
          triggerGameOver(true);
        }

        // Check ground hit
        if (s.bird.y + s.bird.radius >= groundY) {
          s.bird.y = groundY - s.bird.radius;
          triggerGameOver(false);
        }

        // Pipe spawning
        const lastPipe = s.pipes[s.pipes.length - 1];
        if (!lastPipe || s.width - lastPipe.x >= s.pipeSpacing) {
          const minPipeH = 55;
          const availableH = groundY - s.pipeGap - minPipeH * 2;
          const topH = minPipeH + Math.floor(Math.random() * availableH);
          const bottomH = groundY - topH - s.pipeGap;

          s.pipes.push({
            x: s.width + 10,
            topHeight: topH,
            bottomHeight: bottomH,
            gap: s.pipeGap,
            passed: false,
            width: 62,
          });
        }

        // Pipe motion & collisions
        for (let i = s.pipes.length - 1; i >= 0; i--) {
          const pipe = s.pipes[i];
          pipe.x -= s.pipeSpeed;

          // Check score pass
          if (!pipe.passed && s.bird.x > pipe.x + pipe.width) {
            pipe.passed = true;
            s.score += 1;
            setCurrentScore(s.score);
            onScoreChange?.(s.score);
            sound.playScore();
            spawnStars(s.bird.x + 10, s.bird.y);
          }

          // Collision detection with circle vs box
          // Top pipe rect: x: pipe.x, y: 0, w: pipe.width, h: pipe.topHeight
          // Bottom pipe rect: x: pipe.x, y: groundY - pipe.bottomHeight, w: pipe.width, h: pipe.bottomHeight
          const birdBox = {
            left: s.bird.x - s.bird.radius + 3,
            right: s.bird.x + s.bird.radius - 3,
            top: s.bird.y - s.bird.radius + 3,
            bottom: s.bird.y + s.bird.radius - 3,
          };

          const topPipeBox = {
            left: pipe.x,
            right: pipe.x + pipe.width,
            top: 0,
            bottom: pipe.topHeight,
          };

          const bottomPipeBox = {
            left: pipe.x,
            right: pipe.x + pipe.width,
            top: groundY - pipe.bottomHeight,
            bottom: groundY,
          };

          const hitTop =
            birdBox.right > topPipeBox.left &&
            birdBox.left < topPipeBox.right &&
            birdBox.top < topPipeBox.bottom;

          const hitBottom =
            birdBox.right > bottomPipeBox.left &&
            birdBox.left < bottomPipeBox.right &&
            birdBox.bottom > bottomPipeBox.top;

          if (hitTop || hitBottom) {
            triggerGameOver(true);
          }

          // Remove offscreen pipes
          if (pipe.x + pipe.width < -30) {
            s.pipes.splice(i, 1);
          }
        }
      } else if (s.gameState === 'GAME_OVER') {
        // Fall down to ground if not already there
        if (s.bird.y + s.bird.radius < groundY) {
          s.bird.vy += s.gravity * 1.2;
          s.bird.y += s.bird.vy;
          s.bird.targetAngle = Math.PI / 2;
          s.bird.angle += (s.bird.targetAngle - s.bird.angle) * 0.25;

          if (s.bird.y + s.bird.radius >= groundY) {
            s.bird.y = groundY - s.bird.radius;
            s.bird.vy = 0;
            sound.playDie();
          }
        }
      }

      // Update particles
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha = 1 - p.life / p.maxLife;

        if (p.type === 'feather') {
          p.vy += 0.05; // slight drag
        } else if (p.type === 'smoke') {
          p.size *= 1.02;
        }

        if (p.life >= p.maxLife) {
          s.particles.splice(i, 1);
        }
      }

      // ==========================================
      // RENDER
      // ==========================================
      ctx.save();

      // Camera Shake
      if (s.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * s.screenShake;
        const shakeY = (Math.random() - 0.5) * s.screenShake;
        ctx.translate(shakeX, shakeY);
      }

      // 1. SKY BACKGROUND
      const isNight = timeOfDay === 'night';
      const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      if (isNight) {
        skyGrad.addColorStop(0, '#0c1222');
        skyGrad.addColorStop(0.65, '#1e293b');
        skyGrad.addColorStop(1, '#334155');
      } else {
        skyGrad.addColorStop(0, '#38bdf8');
        skyGrad.addColorStop(0.7, '#7dd3fc');
        skyGrad.addColorStop(1, '#bae6fd');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, s.width, groundY);

      // Night Stars & Moon
      if (isNight) {
        s.stars.forEach(star => {
          star.alpha += (Math.random() - 0.5) * star.twinkleSpeed;
          if (star.alpha > 1) star.alpha = 1;
          if (star.alpha < 0.2) star.alpha = 0.2;
          ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
          ctx.fillRect(star.x, star.y, star.size, star.size);
        });

        // Crescent Moon
        ctx.save();
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(s.width - 65, 80, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(s.width - 55, 74, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Clouds (Day)
      if (!isNight) {
        s.clouds.forEach(c => {
          drawCloud(ctx, c.x, c.y, c.scale);
        });
      }

      // Distant City Skyline & Mountain silhouettes
      drawCitySkyline(ctx, s.cityOffset, groundY, isNight, s.width);

      // 2. PIPES
      s.pipes.forEach(pipe => {
        drawPipePair(ctx, pipe.x, pipe.topHeight, pipe.bottomHeight, pipe.width, pipe.gap, groundY);
      });

      // 3. PARTICLES (Behind bird)
      s.particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        if (p.type === 'star') {
          drawStar(ctx, p.x, p.y, 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // 4. BIRD
      drawBird(ctx, s.bird.x, s.bird.y, s.bird.angle, s.bird.wingFrame);

      // 5. GROUND
      drawGround(ctx, s.groundOffset, groundY, s.groundHeight, s.width, isNight);

      // 6. SCREEN FLASH ON COLLISION
      if (s.flashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.flashAlpha})`;
        ctx.fillRect(0, 0, s.width, s.height);
      }

      // 7. HUD / OVERLAYS BASED ON STATE
      if (s.gameState === 'PLAYING') {
        drawScoreHUD(ctx, s.score, s.width);
      } else if (s.gameState === 'START') {
        drawStartScreen(ctx, s.width, s.height, s.highScore, s.tick);
      } else if (s.gameState === 'GAME_OVER') {
        drawGameOverScreen(
          ctx,
          s.width,
          s.height,
          s.score,
          s.highScore,
          s.isNewHighScore,
          s.restartBtn,
          s.tick
        );
      }

      ctx.restore();

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [timeOfDay, triggerGameOver, initScenery]);

  // Click / Touch Handler on Canvas
  const handleCanvasInteraction = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const scaleX = stateRef.current.width / rect.width;
    const scaleY = stateRef.current.height / rect.height;
    const clickX = (clientX - rect.left) * scaleX;
    const clickY = (clientY - rect.top) * scaleY;

    const s = stateRef.current;

    if (s.gameState === 'GAME_OVER') {
      const btn = s.restartBtn;
      // Allow clicking the restart button or anywhere in game over after slight delay
      const hitRestart =
        clickX >= btn.x &&
        clickX <= btn.x + btn.width &&
        clickY >= btn.y &&
        clickY <= btn.y + btn.height;

      // Restart when clicking button or anywhere after game over has settled
      if (hitRestart || s.bird.y >= s.height - s.groundHeight - s.bird.radius - 2) {
        restartGame();
      }
      return;
    }

    triggerJump();
  };

  // Keyboard Listeners: Space, ArrowUp, Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === ' ' || e.key === 'w') {
        e.preventDefault();
        const s = stateRef.current;
        if (s.gameState === 'GAME_OVER') {
          restartGame();
        } else {
          triggerJump();
        }
      } else if (e.code === 'Enter') {
        if (stateRef.current.gameState === 'GAME_OVER') {
          e.preventDefault();
          restartGame();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [triggerJump, restartGame]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center select-none"
    >
      {/* Canvas Element with Responsive Aspect Ratio */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-700 bg-slate-950">
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasInteraction}
          onTouchStart={handleCanvasInteraction}
          className="cursor-pointer block touch-none"
          style={{
            width: '360px',
            height: '600px',
            maxWidth: '100vw',
            maxHeight: '75vh',
            objectFit: 'contain',
          }}
          aria-label="Flappy Bird Game Canvas"
        />

        {/* Accessible Fallback Overlay Controls for mobile/assistive click */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute bottom-16 left-0 right-0 flex justify-center pointer-events-auto">
            <button
              onClick={restartGame}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold rounded-xl shadow-lg border-2 border-white/60 active:scale-95 transition-transform flex items-center gap-2 font-['Outfit']"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
              </svg>
              <span>Play Again</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// CANVAS RENDERING UTILITIES (Crisp Retro Style)
// =========================================================================

function drawBird(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, wingFrame: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Bird Dimensions
  const bodyW = 34;
  const bodyH = 25;

  // 1. Bird Main Body Shadow
  ctx.fillStyle = '#b45309'; // Dark golden outline/shadow
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyW / 2 + 2, bodyH / 2 + 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Bird Yellow Body
  const bodyGrad = ctx.createLinearGradient(0, -bodyH / 2, 0, bodyH / 2);
  bodyGrad.addColorStop(0, '#fef08a');
  bodyGrad.addColorStop(0.5, '#facc15');
  bodyGrad.addColorStop(1, '#eab308');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3. Belly highlight
  ctx.fillStyle = '#fef9c3';
  ctx.beginPath();
  ctx.ellipse(2, -4, bodyW / 3, bodyH / 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 4. Wing with animated flutter
  ctx.save();
  ctx.fillStyle = '#ca8a04'; // Wing border
  let wingOffsetY = 0;
  let wingAngle = 0;

  if (wingFrame === 0) {
    // Wing down
    wingOffsetY = 3;
    wingAngle = 0.25;
  } else if (wingFrame === 2) {
    // Wing up
    wingOffsetY = -4;
    wingAngle = -0.35;
  }

  ctx.translate(-7, 2 + wingOffsetY);
  ctx.rotate(wingAngle);

  // Wing outline
  ctx.fillStyle = '#854d0e';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wing inner
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.ellipse(0, 0, 8.5, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 5. Cartoon Eye
  ctx.save();
  ctx.translate(8, -6);

  // Eye socket outline
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.ellipse(0, 0, 6.5, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sclera (White)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, 0, 5.5, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupil (Dark with glint)
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(2, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Pupil Reflection
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(2.8, -1.2, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 6. Orange Beak
  ctx.save();
  ctx.translate(12, 2);

  // Beak outline
  ctx.fillStyle = '#9a3412';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(13, 0);
  ctx.lineTo(0, 7);
  ctx.closePath();
  ctx.fill();

  // Top beak
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(11, 0);
  ctx.lineTo(0, 1);
  ctx.closePath();
  ctx.fill();

  // Bottom beak
  ctx.fillStyle = '#c2410c';
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.lineTo(10, 1);
  ctx.lineTo(0, 6);
  ctx.closePath();
  ctx.fill();

  // Beak highlight
  ctx.fillStyle = '#fdba74';
  ctx.beginPath();
  ctx.moveTo(1, -3);
  ctx.lineTo(6, -0.5);
  ctx.lineTo(1, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 7. Rosy Cheek
  ctx.fillStyle = 'rgba(248, 113, 113, 0.45)';
  ctx.beginPath();
  ctx.ellipse(4, 5, 4.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPipePair(
  ctx: CanvasRenderingContext2D,
  x: number,
  topHeight: number,
  bottomHeight: number,
  width: number,
  gap: number,
  groundY: number
) {
  const capHeight = 24;
  const capOverhang = 3;

  // ------------------------------------
  // Top Pipe (Hanging down)
  // ------------------------------------
  // Shaft
  drawPipeShaft(ctx, x, 0, width, topHeight - capHeight);
  // Cap (at bottom of top pipe)
  drawPipeCap(ctx, x - capOverhang, topHeight - capHeight, width + capOverhang * 2, capHeight);

  // ------------------------------------
  // Bottom Pipe (Growing up from ground)
  // ------------------------------------
  const bottomY = groundY - bottomHeight;
  // Cap (at top of bottom pipe)
  drawPipeCap(ctx, x - capOverhang, bottomY, width + capOverhang * 2, capHeight);
  // Shaft
  drawPipeShaft(ctx, x, bottomY + capHeight, width, bottomHeight - capHeight);
}

function drawPipeShaft(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  if (h <= 0) return;

  // Outer border
  ctx.fillStyle = '#1e3a12';
  ctx.fillRect(x, y, w, h);

  // Inner gradient
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, '#558222');
  grad.addColorStop(0.18, '#8de538');
  grad.addColorStop(0.45, '#73bf2e');
  grad.addColorStop(0.85, '#558222');
  grad.addColorStop(1, '#3b5c16');

  ctx.fillStyle = grad;
  ctx.fillRect(x + 2, y, w - 4, h);

  // Bright highlight stripe
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillRect(x + 8, y, 5, h);

  // Shadow stripe
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(x + w - 10, y, 7, h);
}

function drawPipeCap(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Border
  ctx.fillStyle = '#1e3a12';
  ctx.fillRect(x, y, w, h);

  // Gradient
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, '#558222');
  grad.addColorStop(0.18, '#9de659');
  grad.addColorStop(0.45, '#73bf2e');
  grad.addColorStop(0.85, '#558222');
  grad.addColorStop(1, '#2c4611');

  ctx.fillStyle = grad;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

  // Top highlight edge
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillRect(x + 2, y + 2, w - 4, 3);

  // Highlight stripe
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillRect(x + 9, y + 2, 6, h - 4);

  // Shadow stripe
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(x + w - 12, y + 2, 8, h - 4);

  // Bottom lip shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(x + 2, y + h - 3, w - 4, 2);
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  offset: number,
  groundY: number,
  groundH: number,
  width: number,
  isNight: boolean
) {
  // Ground Top Grass Bar
  ctx.fillStyle = isNight ? '#22543d' : '#22c55e'; // Grass rim
  ctx.fillRect(0, groundY, width, 14);

  // Dark outline below grass
  ctx.fillStyle = isNight ? '#143828' : '#15803d';
  ctx.fillRect(0, groundY + 12, width, 3);

  // Dirt Body
  ctx.fillStyle = isNight ? '#33271e' : '#ded895';
  ctx.fillRect(0, groundY + 15, width, groundH - 15);

  // Repeating diagonal stripes on soil
  ctx.save();
  ctx.fillStyle = isNight ? '#281e17' : '#cfc778';
  const stripeWidth = 14;
  const startX = -offset - 30;

  for (let x = startX; x < width + 30; x += stripeWidth * 2) {
    ctx.beginPath();
    ctx.moveTo(x, groundY + 15);
    ctx.lineTo(x + stripeWidth, groundY + 15);
    ctx.lineTo(x + stripeWidth - 12, groundY + groundH);
    ctx.lineTo(x - 12, groundY + groundH);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Top border line
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, groundY, width, 2);
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.arc(22, -6, 24, 0, Math.PI * 2);
  ctx.arc(44, 0, 18, 0, Math.PI * 2);
  ctx.arc(60, 4, 14, 0, Math.PI * 2);
  ctx.fill();

  // Cloud flat base
  ctx.fillRect(-10, 4, 75, 14);
  ctx.restore();
}

function drawCitySkyline(
  ctx: CanvasRenderingContext2D,
  offset: number,
  groundY: number,
  isNight: boolean,
  width: number
) {
  ctx.save();
  const baseColor = isNight ? 'rgba(30, 41, 59, 0.7)' : 'rgba(125, 211, 252, 0.45)';
  ctx.fillStyle = baseColor;

  // Buildings pattern
  const buildings = [
    { w: 26, h: 55 },
    { w: 32, h: 80 },
    { w: 22, h: 45 },
    { w: 38, h: 95 },
    { w: 28, h: 65 },
    { w: 34, h: 75 },
    { w: 24, h: 50 },
    { w: 42, h: 105 },
    { w: 30, h: 60 },
  ];

  let currentX = -offset;
  while (currentX < width + 100) {
    for (const b of buildings) {
      ctx.fillRect(currentX, groundY - b.h, b.w, b.h);

      // Night windows
      if (isNight && b.h > 60) {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
        for (let wy = groundY - b.h + 10; wy < groundY - 15; wy += 14) {
          ctx.fillRect(currentX + 5, wy, 4, 6);
          ctx.fillRect(currentX + b.w - 9, wy, 4, 6);
        }
        ctx.fillStyle = baseColor;
      }

      currentX += b.w + 6;
      if (currentX >= width + 100) break;
    }
  }

  // Cute green bushes layer in front of buildings
  ctx.fillStyle = isNight ? '#143828' : '#86efac';
  let bushX = -(offset * 1.5) % 60;
  while (bushX < width + 60) {
    ctx.beginPath();
    ctx.arc(bushX, groundY, 18, Math.PI, 0);
    ctx.arc(bushX + 24, groundY, 24, Math.PI, 0);
    ctx.arc(bushX + 48, groundY, 16, Math.PI, 0);
    ctx.fill();
    bushX += 70;
  }

  ctx.restore();
}

function drawScoreHUD(ctx: CanvasRenderingContext2D, score: number, width: number) {
  ctx.save();
  const text = String(score);

  // Large retro arcade number centered
  ctx.font = '900 48px "Outfit", "Press Start 2P", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Thick black drop shadow / outline
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#0f172a';
  ctx.strokeText(text, width / 2, 45);

  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, width / 2, 45);

  ctx.restore();
}

function drawStartScreen(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  highScore: number,
  tick: number
) {
  ctx.save();

  // Floating bounce title: "FLAPPY BIRD"
  const titleY = 120 + Math.sin(tick * 0.05) * 5;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Title shadow
  ctx.font = '900 38px "Outfit", sans-serif';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#0f172a';
  ctx.strokeText('FLAPPY BIRD', width / 2, titleY);

  // Title gradient
  const titleGrad = ctx.createLinearGradient(0, titleY - 20, 0, titleY + 20);
  titleGrad.addColorStop(0, '#fde047');
  titleGrad.addColorStop(1, '#f97316');
  ctx.fillStyle = titleGrad;
  ctx.fillText('FLAPPY BIRD', width / 2, titleY);

  // "GET READY" banner
  const getReadyY = 200;
  ctx.font = '800 24px "Outfit", sans-serif';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#0f172a';
  ctx.strokeText('GET READY!', width / 2, getReadyY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('GET READY!', width / 2, getReadyY);

  // Tap or Space Indicator Prompt with pulsating animation
  const pulse = Math.sin(tick * 0.1) * 0.15 + 0.85;
  ctx.save();
  ctx.translate(width / 2, 380);
  ctx.scale(pulse, pulse);

  // Tap Icon circle
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.beginPath();
  ctx.arc(0, -25, 30, 0, Math.PI * 2);
  ctx.fill();

  // White hand pointer icon
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  // Hand shape
  ctx.arc(0, -32, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-6, -30, 12, 18);
  ctx.restore();

  // Instructions text
  ctx.font = '700 16px "Outfit", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('TAP OR PRESS SPACE', width / 2, 425);
  ctx.font = '600 13px "Outfit", sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('to flap wings and fly', width / 2, 448);

  // High score reminder at bottom
  if (highScore > 0) {
    ctx.font = '700 13px "Outfit", sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(`BEST SCORE: ${highScore}`, width / 2, 485);
  }

  ctx.restore();
}

function drawGameOverScreen(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  score: number,
  highScore: number,
  isNewHigh: boolean,
  restartBtn: { x: number; y: number; width: number; height: number },
  tick: number
) {
  ctx.save();

  // Title: "GAME OVER"
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleY = 125;

  ctx.font = '900 36px "Outfit", sans-serif';
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#0f172a';
  ctx.strokeText('GAME OVER', width / 2, titleY);

  const titleGrad = ctx.createLinearGradient(0, titleY - 15, 0, titleY + 15);
  titleGrad.addColorStop(0, '#f87171');
  titleGrad.addColorStop(1, '#dc2626');
  ctx.fillStyle = titleGrad;
  ctx.fillText('GAME OVER', width / 2, titleY);

  // Scoreboard Panel Card
  const cardX = 45;
  const cardY = 175;
  const cardW = width - 90; // 270px
  const cardH = 175;

  // Card Outer Shadow / Border
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, cardX - 3, cardY - 3, cardW + 6, cardH + 6, 16);
  ctx.fill();

  // Card Body Background
  const cardGrad = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
  cardGrad.addColorStop(0, '#fdfbf7');
  cardGrad.addColorStop(1, '#e2d8b5');
  ctx.fillStyle = cardGrad;
  roundRect(ctx, cardX, cardY, cardW, cardH, 14);
  ctx.fill();

  // Card Inner Border
  ctx.strokeStyle = '#d6c593';
  ctx.lineWidth = 2;
  roundRect(ctx, cardX + 6, cardY + 6, cardW - 12, cardH - 12, 10);
  ctx.stroke();

  // MEDAL Section (Left)
  ctx.font = '700 12px "Outfit", sans-serif';
  ctx.fillStyle = '#854d0e';
  ctx.textAlign = 'center';
  ctx.fillText('MEDAL', cardX + 55, cardY + 30);

  // Medal Coin drawing
  drawMedal(ctx, cardX + 55, cardY + 85, score, tick);

  // SCORES Section (Right)
  ctx.textAlign = 'right';

  // Current Score Label
  ctx.font = '700 12px "Outfit", sans-serif';
  ctx.fillStyle = '#b45309';
  ctx.fillText('SCORE', cardX + cardW - 20, cardY + 30);

  // Current Score Value
  ctx.font = '900 28px "Outfit", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(String(score), cardX + cardW - 20, cardY + 62);

  // Best Score Label
  ctx.font = '700 12px "Outfit", sans-serif';
  ctx.fillStyle = '#b45309';
  ctx.fillText('BEST', cardX + cardW - 20, cardY + 98);

  // Best Score Value
  ctx.font = '900 28px "Outfit", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(String(highScore), cardX + cardW - 20, cardY + 130);

  // "NEW" Badge if beat record
  if (isNewHigh) {
    const flash = Math.sin(tick * 0.2) > 0;
    ctx.save();
    ctx.translate(cardX + cardW - 85, cardY + 115);
    ctx.fillStyle = flash ? '#ef4444' : '#f97316';
    roundRect(ctx, -18, -10, 36, 18, 4);
    ctx.fill();
    ctx.font = '800 10px "Outfit", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('NEW', 0, 3);
    ctx.restore();
  }

  // RESTART BUTTON (Rendered on Canvas)
  const btn = restartBtn;
  // Button Drop Shadow
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, btn.x, btn.y + 4, btn.width, btn.height, 14);
  ctx.fill();

  // Button Face
  const btnGrad = ctx.createLinearGradient(0, btn.y, 0, btn.y + btn.height);
  btnGrad.addColorStop(0, '#f59e0b');
  btnGrad.addColorStop(1, '#ea580c');
  ctx.fillStyle = btnGrad;
  roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 14);
  ctx.fill();

  // Button Highlight Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  roundRect(ctx, btn.x + 2, btn.y + 2, btn.width - 4, btn.height - 4, 12);
  ctx.stroke();

  // Button Text
  ctx.font = '800 18px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('RESTART', btn.x + btn.width / 2, btn.y + btn.height / 2);

  // Shortcut key note below button
  ctx.font = '600 12px "Outfit", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Press SPACE or TAP to play', width / 2, btn.y + btn.height + 22);

  ctx.restore();
}

function drawMedal(ctx: CanvasRenderingContext2D, x: number, y: number, score: number, tick: number) {
  // Determine medal tier: Bronze (10+), Silver (20+), Gold (30+), Platinum (40+)
  let outerColor = '#cbd5e1';
  let innerColor1 = '#f1f5f9';
  let innerColor2 = '#94a3b8';
  let label = '';

  if (score >= 40) {
    outerColor = '#67e8f9';
    innerColor1 = '#cffafe';
    innerColor2 = '#06b6d4';
    label = 'PLATINUM';
  } else if (score >= 30) {
    outerColor = '#ca8a04';
    innerColor1 = '#fef08a';
    innerColor2 = '#eab308';
    label = 'GOLD';
  } else if (score >= 20) {
    outerColor = '#64748b';
    innerColor1 = '#f8fafc';
    innerColor2 = '#cbd5e1';
    label = 'SILVER';
  } else if (score >= 10) {
    outerColor = '#78350f';
    innerColor1 = '#fed7aa';
    innerColor2 = '#b45309';
    label = 'BRONZE';
  }

  // Draw Base Empty Coin Socket if < 10
  if (score < 10) {
    ctx.save();
    ctx.fillStyle = '#d6c593';
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#c5b27e';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '600 10px "Outfit", sans-serif';
    ctx.fillStyle = '#8c7e56';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NO MEDAL', x, y);
    ctx.restore();
    return;
  }

  // Render Earned Medal
  ctx.save();
  // Outer Coin Rim
  ctx.fillStyle = outerColor;
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, Math.PI * 2);
  ctx.fill();

  // Inner Gradient
  const grad = ctx.createLinearGradient(x - 20, y - 20, x + 20, y + 20);
  grad.addColorStop(0, innerColor1);
  grad.addColorStop(1, innerColor2);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.fill();

  // Embossed Star in center of medal
  ctx.fillStyle = outerColor;
  drawStar(ctx, x, y, 5, 12, 6);

  // Sparkle glint on medal
  if (Math.sin(tick * 0.15) > 0.4) {
    const glintX = x + Math.cos(tick * 0.08) * 14;
    const glintY = y + Math.sin(tick * 0.08) * 14;
    ctx.fillStyle = '#ffffff';
    drawStar(ctx, glintX, glintY, 4, 4, 1.5);
  }

  ctx.restore();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
