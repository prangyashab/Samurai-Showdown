const canvas = document.querySelector('canvas')

if (!canvas) {
  throw new Error("No canvas found - likely on homepage")
}

const c = canvas.getContext('2d')

// Camera / Shake System
const camera = {
  position: {
    x: 0,
    y: 0
  },
  shake: {
    x: 0,
    y: 0,
    intensity: 0,
    duration: 0
  }
}

function triggerShake(intensity, duration) {
  camera.shake.intensity = intensity;
  camera.shake.duration = duration;

  // Trigger mobile device haptic feedback matching the shake
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    const vibrateMs = duration * 15; // Rough frame-to-ms conversion (assuming 60fps)
    if (intensity > 10) {
      // Heavy hit gets a double-pulse vibration pattern
      navigator.vibrate([vibrateMs, 30, vibrateMs]);
    } else {
      // Normal hit gets a standard sharp pulse
      navigator.vibrate(vibrateMs);
    }
  }
}

canvas.width = 1024
canvas.height = 576

// Initial black fill to prevent white flash
c.fillStyle = 'black'
c.fillRect(0, 0, canvas.width, canvas.height)

// Disable image smoothing for crisp pixel art scaling
c.imageSmoothingEnabled = false;

const gravity = 0.7
let groundLevel = canvas.height - 140

// --- LEVEL & DIFFICULTY SCALING (Moved to Top) ---
// --- LEVEL & PROGRESSION SYSTEM ---
function getStartingLevel() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlLevel = parseInt(urlParams.get('level'));
  const savedLevel = parseInt(localStorage.getItem('maxUnlockedLevel')) || 1;

  // Prefer URL level if present, otherwise use saved progress
  return !isNaN(urlLevel) ? urlLevel : savedLevel;
}

const currentLevel = getStartingLevel();
window.gameLevel = currentLevel; // Make it globally accessible for utils
console.log(`Starting game at Level: ${currentLevel}`);

const totalMaps = 5;
const mapIndex = ((currentLevel - 1) % totalMaps) + 1;

const background = new Sprite({
  position: {
    x: 0,
    y: 0
  },
  imageSrc: `./img/background/bg${mapIndex}.png`,
  scale: 1
})

// Override background draw to stretch to fit screen
background.draw = function () {
  if (!this.image) return
  c.drawImage(this.image, 0, 0, canvas.width, canvas.height)
}

// Reliable detect: Check window size + touch, or small width
const isMobile = window.innerWidth < 900 || window.matchMedia('(pointer: coarse)').matches;
const charScale = isMobile ? 2.6 : 4.0;
// Always use original base (3.5) so mobile sprite offsets stay calibrated
const scaleRatio = charScale / 3.5;

function getScaleOffset(originalX, originalY) {
  return {
    x: (originalX + 25) * scaleRatio - 25,
    y: (originalY + 150) * scaleRatio - 150
  };
}

const player = new Fighter({
  position: {
    x: -200, // Start off-screen left
    y: 0
  },
  velocity: {
    x: 0,
    y: 0
  },
  offset: {
    x: 0,
    y: 0
  },
  imageSrc: './img/samuraiMack/Idle.png',
  framesMax: 8,
  scale: charScale,
  offset: getScaleOffset(301, 220),
  sprites: {
    idle: {
      imageSrc: './img/samuraiMack/Idle.png',
      framesMax: 8
    },
    run: {
      imageSrc: './img/samuraiMack/Run.png',
      framesMax: 8
    },
    jump: {
      imageSrc: './img/samuraiMack/Jump.png',
      framesMax: 2
    },
    fall: {
      imageSrc: './img/samuraiMack/Fall.png',
      framesMax: 2
    },
    attack1: {
      imageSrc: './img/samuraiMack/Attack1.png',
      framesMax: 6
    },
    takeHit: {
      imageSrc: './img/samuraiMack/Take Hit - white silhouette.png',
      framesMax: 4
    },
    death: {
      imageSrc: './img/samuraiMack/Death.png',
      framesMax: 6
    }
  },
  attackBox: {
    offset: {
      x: 50,
      y: 50
    },
    width: 370,
    height: 50
  },
  damage: 10
})

// --- LEVEL & DIFFICULTY SCALING ---
// urlParams and currentLevel are defined at the top

function getLevelData(level) {
  const difficulty = localStorage.getItem('gameDifficulty') || 'LOW';

  // 1. Enemy Count
  let count = 1;

  if (difficulty === 'HIGH') {
    // High Difficulty: Max 5 enemies, appearing earlier
    if (level >= 5) count = 2;
    if (level >= 15) count = 3;
    if (level >= 30) count = 4;
    if (level >= 45) count = 5;
  } else {
    // Low Difficulty: Standard progression (Max 4)
    if (level >= 10) count = 2;
    if (level >= 25) count = 3;
    if (level >= 40) count = 4;
  }

  // 2. Stats Scaling
  // Standard Speed Increase: +0.05 per level
  // Faster in HIGH difficulty
  const speedBonus = difficulty === 'HIGH' ? 1 : 0;
  const speed = 2 + speedBonus + (level * 0.05);

  // Damage Calculation
  let baseDamage = 5 + (level * 0.3);

  // Increase damage for High difficulty
  if (difficulty === 'HIGH') {
    baseDamage *= 1.4; // 40% increase (was 20%)
    baseDamage += (level * 0.1); // Add extra scaling for high diff
  }

  // Reduce individual damage if there are more enemies to avoid instant death
  if (count > 1) baseDamage = baseDamage * 0.65;

  const damage = Math.max(2, baseDamage);

  // Slower Aggression Increase
  const aggressionScaling = difficulty === 'HIGH' ? 0.008 : 0.005;
  const aggression = Math.min(0.02 + (level * aggressionScaling), 0.15);

  return { count, speed, damage, aggression, difficulty };
}

const levelData = getLevelData(currentLevel);
const enemies = [];

// Spawn Enemies
for (let i = 0; i < levelData.count; i++) {
  // Spread them out
  const startX = (canvas.width + 200) + (i * 100);

  enemies.push(new Fighter({
    position: {
      x: startX,
      y: 100
    },
    velocity: {
      x: 0,
      y: 0
    },
    color: 'blue',
    offset: {
      x: -50,
      y: 0
    },
    imageSrc: './img/kenji/Idle.png',
    framesMax: 4,
    scale: charScale,
    offset: getScaleOffset(301, 234),
    sprites: {
      idle: {
        imageSrc: './img/kenji/Idle.png',
        framesMax: 4
      },
      run: {
        imageSrc: './img/kenji/Run.png',
        framesMax: 8
      },
      jump: {
        imageSrc: './img/kenji/Jump.png',
        framesMax: 2
      },
      fall: {
        imageSrc: './img/kenji/Fall.png',
        framesMax: 2
      },
      attack1: {
        imageSrc: './img/kenji/Attack1.png',
        framesMax: 4
      },
      takeHit: {
        imageSrc: './img/kenji/Take hit.png',
        framesMax: 3
      },
      death: {
        imageSrc: './img/kenji/Death.png',
        framesMax: 7
      }
    },
    attackBox: {
      offset: {
        x: 30,
        y: 50
      },
      width: 230,
      height: 50
    },
    damage: levelData.damage, // SCALED DAMAGE
    spritesFlipped: true
  }));
}

// Player Rage Stats
player.rage = 0;
player.isRaging = false;
player.baseDamage = player.damage;


// Resize canvas to full screen
function resizeCanvas() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  // Calculate scale factor to cover the screen
  const scaleX = canvas.width / 1024
  const scaleY = canvas.height / 576
  const scaleFn = Math.max(scaleX, scaleY)

  // Background is now stretched via custom draw(), so no scale/pos updates needed for it.

  // groundLevel: aligned to the visual floor of the background image (~82% down screen).
  // Mobile: ground sits higher (~76%) to keep fighters above on-screen controls.
  // Laptop: ground sits at ~82% to match background's visual floor.
  const visualScaleY = canvas.height / 576
  if (isMobile) {
    // Mobile: Lowered ground to bring characters down (was 140)
    groundLevel = canvas.height - (115 * visualScaleY)
  } else {
    // Laptop: Perfect grounding on the street texture
    groundLevel = canvas.height - (92 * visualScaleY)
  }

  // Shop code removed
  /*
  if (shop) {
    shop.position.x = canvas.width - (424 * (scaleX > 1 ? scaleX * 0.8 : 1))
    shop.scale = 2.75 * scaleFn
    shop.position.y = groundLevel - 128 * shop.scale
  }
  */

  // Update ground position for players if needed (though animate handles gravity)
  // We should force players to ground if they are standing
  // Update ground position for players if needed (though animate handles gravity)
  // We should force players to ground if they are standing
  if (player.velocity.y === 0) {
    player.position.y = groundLevel - player.height
  }

  // Update all enemies
  enemies.forEach(enemy => {
    if (enemy.velocity.y === 0) {
      enemy.position.y = groundLevel - enemy.height
    }
  });
}

window.addEventListener('resize', resizeCanvas)
resizeCanvas()

console.log(player)

const keys = {
  ArrowRight: {
    pressed: false
  },
  ArrowLeft: {
    pressed: false
  }
}

// decreaseTimer() // Don't start timer yet
let gameStarted = false;

function startSequence() {
  let countdown = 3;
  document.querySelector('#displayText').style.display = 'flex';
  document.querySelector('#displayText').innerText = `LEVEL ${currentLevel}`;
  // Delay countdown start to show level
  setTimeout(() => {
    document.querySelector('#displayText').innerHTML = countdown;
    const countInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        document.querySelector('#displayText').innerHTML = countdown;

        // Play tick sound
        if (countdown > 0 && typeof audio !== 'undefined') audio.play('countdown');
      } else if (countdown === 0) {
        document.querySelector('#displayText').innerText = 'FIGHT!';
        // Play Fight Start Sound
        if (typeof audio !== 'undefined') audio.play('start');
      } else {
        clearInterval(countInterval);
        // Premium Fade Out
        gsap.to('#displayText', {
          opacity: 0,
          duration: 0.8,
          onComplete: () => {
            document.querySelector('#displayText').style.display = 'none';
            document.querySelector('#displayText').style.opacity = '1';
          }
        });
        gameStarted = true;
        decreaseTimer();
      }
    }, 1000);
  }, 1000); // 1.5s delay for Level Text
}

// startSequence(); replaced by window.startGameSequence called from game.html
let lastTime = 0;
const fps = 60;
const nextFrameTime = 1000 / fps;

function animate(timestamp) {
  window.requestAnimationFrame(animate)

  // FPS CAP: Calculate elapsed time since last draw
  const elapsed = timestamp - lastTime;

  // If not enough time has passed for 60fps, skip this frame
  if (elapsed < nextFrameTime) return;

  // Adjust lastTime to stay synced (modulo ensures we don't drift)
  lastTime = timestamp - (elapsed % nextFrameTime);

  // 1. Clear Screen (Black) to avoid trails during shake
  c.fillStyle = 'black'
  c.fillRect(0, 0, canvas.width, canvas.height)

  c.save() // Start Camera Transform

  // 2. Apply Camera Shake
  if (camera.shake.duration > 0) {
    const dx = (Math.random() - 0.5) * camera.shake.intensity
    const dy = (Math.random() - 0.5) * camera.shake.intensity
    c.translate(dx, dy)
    camera.shake.duration--
  }

  background.update()
  // shop.update()

  // Minimal dark overlay to reduce brightness as requested
  c.fillStyle = 'rgba(0, 0, 0, 0.35)'
  c.fillRect(0, 0, canvas.width, canvas.height)

  // Always update (draw) sprites so they don't vanish
  player.update()
  enemies.forEach(enemy => enemy.update());

  // RAGE VISUALS (Ghost Trail)
  if (player.isRaging) {
    c.save();
    c.globalAlpha = 0.3; // Faint ghost
    c.fillStyle = '#22d3ee'; // Cyan tint
    // Draw simplified shape or previous pos could be stored
    // For now, just a tint on the player is better handled inside update class or complex shader
    // We will simulate speed lines
    c.fillStyle = 'rgba(6, 182, 212, 0.5)';
    c.fillRect(player.position.x, player.position.y, 50, 150); // Simple speed trail
    c.restore();
  }

  // --- Cinematic Start Sequence Movement ---
  if (!gameStarted) {
    const playerStopPos = isMobile ? canvas.width * 0.2 : 300;
    const enemyStopPos = isMobile ? canvas.width * 0.8 : canvas.width - 350;

    // Move Player to position
    if (player.position.x < playerStopPos) {
      player.velocity.x = 12;
      player.switchSprite('run');
      player.facing = 'right';
    } else {
      player.velocity.x = 0;
      player.switchSprite('idle');
      player.facing = 'right';
    }

    // Move Enemy to position
    enemies.forEach((enemy, index) => {
      // Stagger them slightly
      const target = enemyStopPos + (index * 50);
      if (enemy.position.x > target) {
        enemy.velocity.x = -12;
        enemy.switchSprite('run');
        enemy.facing = 'left';
      } else {
        enemy.velocity.x = 0;
        enemy.switchSprite('idle');
        enemy.facing = 'left';
      }
    });

    return; // Skip combat logic during intro
  }

  // Define first living enemy for camera/focus (optional)
  const activeEnemy = enemies.find(e => !e.dead);

  // Victory Condition: All enemies dead
  const removeDead = enemies.filter(e => e.dead).length;
  if (player.health <= 0 || removeDead === enemies.length) {
    // Pass a dummy enemy object for the utils function or update utils
    // For now, we simulate the 'main' enemy for the modal logic
    // Pass the actual level to avoid URL mismatch errors
    determineWinner({ player, enemies, timerId, currentLevel: window.gameLevel })
    player.velocity.x = 0
    enemies.forEach(e => e.velocity.x = 0);
    return
  }

  // Normal Game Logic (Movement, AI, Combat)
  // player.velocity.x = 0 // Moved inside player movement block to support dash persistence
  enemies.forEach(e => e.velocity.x = 0);

  // Player Movement Speed Boost in Rage/Difficulty
  const baseMoveSpeed = levelData.difficulty === 'HIGH' ? 6 : 5;
  const moveSpeed = player.isRaging ? (baseMoveSpeed * 2) : baseMoveSpeed;

  // Player Movement
  if (!player.dead) {
    if (player.isDashing) {
      player.switchSprite('run');
      // Velocity is maintained from the dash event
    } else {
      player.velocity.x = 0; // Reset velocity only if not dashing

      if (keys.ArrowLeft.pressed && player.lastKey === 'ArrowLeft') {
        player.velocity.x = -moveSpeed
        player.switchSprite('run')
        player.facing = 'left'
      } else if (keys.ArrowRight.pressed && player.lastKey === 'ArrowRight') {
        player.velocity.x = moveSpeed
        player.switchSprite('run')
        player.facing = 'right'
      } else {
        player.switchSprite('idle')
      }
    }

    if (player.velocity.y < 0) {
      player.switchSprite('jump')
    } else if (player.velocity.y > 0) {
      player.switchSprite('fall')
    }
  }

  // Prevent player from going off-screen
  if (player.position.x < 0) {
    player.position.x = 0;
    if (player.isDashing) player.isDashing = false; // Stop dash if hitting wall
  } else if (player.position.x + player.width > canvas.width) {
    player.position.x = canvas.width - player.width;
    if (player.isDashing) player.isDashing = false;
  }

  // Enemy AI Movement - LOOP for all enemies
  enemies.forEach(enemy => {
    if (!enemy.dead) {
      const distanceX = player.position.x - enemy.position.x
      const distanceY = player.position.y - enemy.position.y
      const absDistanceX = Math.abs(distanceX)

      // AI Logic (Scaled with levelData.speed)
      const chaseSpeed = levelData.speed;

      // 1. Retreat
      if (absDistanceX < 50) {
        if (distanceX > 0) {
          enemy.velocity.x = -chaseSpeed
          enemy.switchSprite('run')
          enemy.facing = 'left'
        } else {
          enemy.velocity.x = chaseSpeed
          enemy.switchSprite('run')
          enemy.facing = 'right'
        }
      }
      // 2. Approach
      else if (absDistanceX > 120) {
        if (Math.random() < 0.95) {
          if (distanceX > 0) {
            enemy.velocity.x = chaseSpeed
            enemy.switchSprite('run')
            enemy.facing = 'right'
          } else {
            enemy.velocity.x = -chaseSpeed
            enemy.switchSprite('run')
            enemy.facing = 'left'
          }
        } else {
          enemy.switchSprite('idle')
        }
      }
      // 3. Combat
      else {
        if (Math.random() < 0.1) {
          if (distanceX > 0) {
            enemy.velocity.x = 1
            enemy.switchSprite('run')
            enemy.facing = 'right'
          } else {
            enemy.velocity.x = -1
            enemy.switchSprite('run')
            enemy.facing = 'left'
          }
        } else {
          enemy.switchSprite('idle')
          if (distanceX > 0) enemy.facing = 'right'
          else enemy.facing = 'left'
        }
      }

      // Attack (Scaled Aggression)
      if (Math.abs(distanceX) < 220 && Math.abs(distanceY) < 100) {
        if (Math.random() < levelData.aggression) {
          enemy.attack()
        }
      }

      // Jump
      if (Math.random() < 0.005) {
        if (enemy.position.y + enemy.height >= groundLevel) {
          enemy.velocity.y = -20
        }
      }

      if (enemy.velocity.y < 0) {
        enemy.switchSprite('jump')
      } else if (enemy.velocity.y > 0) {
        enemy.switchSprite('fall')
      }

      // Collision Checks (Player hits Enemy)
      if (
        rectangularCollision({
          rectangle1: player,
          rectangle2: enemy
        }) &&
        player.isAttacking &&
        player.framesCurrent === 4
      ) {
        const enemyWasAlive = enemy.health > 0;
        enemy.takeHit(player.damage)

        // TRIGGER SHAKE ON HIT
        triggerShake(10, 10); // Medium shake for player hits

        // HEAL ON KILL (Multi-Enemy Levels)
        if (enemyWasAlive && enemy.health <= 0 && enemies.length > 1) {
          player.health = Math.min(100, player.health + 15); // Heal 15 HP on kill
          document.querySelector('#playerHealth').style.width = player.health + '%';
        }

        player.isAttacking = false

        // BUILD RAGE
        if (!player.isRaging) {
          player.rage = Math.min(player.rage + 10, 100);
          document.querySelector('#playerEnergy').style.width = player.rage + '%';
          if (player.rage === 100) {
            document.querySelector('#rageText').style.display = 'block';
          }
        }

        // Update Total Enemy Health UI
        const currentTotalHealth = enemies.reduce((sum, e) => sum + Math.max(0, e.health), 0);
        const maxTotalHealth = enemies.length * 100; // Each has 100 base

        const healthPercent = Math.max(0, (currentTotalHealth / maxTotalHealth) * 100);
        document.querySelector('#enemyHealth').style.width = healthPercent + '%';
      }

      // Enemy hits Player
      if (
        rectangularCollision({
          rectangle1: enemy,
          rectangle2: player
        }) &&
        enemy.isAttacking &&
        enemy.framesCurrent === 2
      ) {
        player.takeHit(enemy.damage)

        // TRIGGER SHAKE ON DAMAGE TAKEN
        triggerShake(15, 15); // Heavier shake when player gets hit

        enemy.isAttacking = false
        document.querySelector('#playerHealth').style.width = Math.max(0, player.health) + '%';

        // Gain small rage on taking damage
        if (!player.isRaging) {
          player.rage = Math.min(player.rage + 5, 100);
          document.querySelector('#playerEnergy').style.width = player.rage + '%';
        }
      }

      if (enemy.isAttacking && enemy.framesCurrent === 2) {
        enemy.isAttacking = false
      }
    } // end enemy dead check
  }); // end enemy loop

  if (player.isAttacking && player.framesCurrent === 4) {
    player.isAttacking = false
  }

  c.restore() // End Camera Transform (Restore original context)
} // end animate

window.startGameSequence = () => {
  lastTime = performance.now(); // Reset timer to current time
  startSequence();
  animate(lastTime);
};


window.addEventListener('keydown', (event) => {
  if (!gameStarted) return; // Block input during intro

  if (!player.dead) {
    switch (event.key) {
      case 'ArrowRight':
        keys.ArrowRight.pressed = true
        player.lastKey = 'ArrowRight'
        break
      case 'ArrowLeft':
        keys.ArrowLeft.pressed = true
        player.lastKey = 'ArrowLeft'
        break
      case 'ArrowUp':
        if (player.jumps > 0) {
          player.velocity.y = -15
          player.jumps--
        }
        break
      case 'ArrowDown':
        // DASH MECHANIC
        const now = Date.now();
        if (!player.isDashing && now - (player.lastDashTime || 0) > 2000) {
          player.isDashing = true;
          player.lastDashTime = now;
          // Dash in facing direction or movement direction
          const dashDir = (player.facing === 'left') ? -1 : 1;
          player.velocity.x = dashDir * 50; // Super fast (Screen Cross)

          // End dash after 500ms
          setTimeout(() => {
            player.isDashing = false;
            player.velocity.x = 0; // Stop immediately after dash
          }, 500);
        }
        break
      case ' ':
        player.attack()
        break
      case 'Shift':
        if (player.rage >= 100 && !player.isRaging) {
          player.isRaging = true;
          player.damage = player.baseDamage * 2; // Double Damage
          document.querySelector('#rageText').innerText = 'RAGE ACTIVE!';
          document.querySelector('#playerEnergy').style.background = '#fff'; // Flash white

          setTimeout(() => {
            player.isRaging = false;
            player.rage = 0;
            player.damage = player.baseDamage;
            document.querySelector('#playerEnergy').style.width = '0%';
            document.querySelector('#playerEnergy').style.background = 'linear-gradient(90deg, #06b6d4, #22d3ee)';
            document.querySelector('#rageText').innerText = 'RAGE READY [SHIFT]';
            document.querySelector('#rageText').style.display = 'none';
          }, 6000); // 6 Seconds Duration
        }
        break
    }
  }

  // Enemy AI is now automatic, removing manual controls
  // enemies check is in loop
})

window.addEventListener('keyup', (event) => {
  switch (event.key) {
    case 'ArrowRight':
      keys.ArrowRight.pressed = false
      break
    case 'ArrowLeft':
      keys.ArrowLeft.pressed = false
      break
  }

  // enemy keys
  // removed arrow keys for AI control
})
