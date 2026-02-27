function rectangularCollision({ rectangle1, rectangle2 }) {
  return (
    rectangle1.attackBox.position.x + rectangle1.attackBox.width >=
    rectangle2.position.x &&
    rectangle1.attackBox.position.x <=
    rectangle2.position.x + rectangle2.width &&
    rectangle1.attackBox.position.y + rectangle1.attackBox.height >=
    rectangle2.position.y &&
    rectangle1.attackBox.position.y <= rectangle2.position.y + rectangle2.height
  )
}


function determineWinner({ player, enemies, timerId, currentLevel }) {
  const lvl = currentLevel || window.gameLevel || 1;
  const modal = document.querySelector('#gameOverModal')
  // Prevent multiple calls if modal is already open
  if (modal.style.display === 'flex') return;

  clearTimeout(timerId)
  const title = document.querySelector('#gptitle')
  const starsContainer = document.querySelector('#gpstars')
  const nextBtn = document.querySelector('#gpnext')
  const homeBtn = document.querySelector('#homeBtn')

  modal.style.display = 'flex'
  if (homeBtn) homeBtn.style.display = 'flex';

  // Hide mobile controls when modal is shown (Aggressive hide)
  const mobileControls = document.querySelector('#mobile-controls')
  if (mobileControls) {
    mobileControls.style.setProperty('display', 'none', 'important');
  }

  // 1. Defeat Condition: Player Dead
  if (player.health <= 0) {
    showDefeat(title, starsContainer, nextBtn);
    return;
  }

  // 2. Victory Condition: All Enemies Dead
  const allEnemiesDead = enemies.every(e => e.health <= 0);
  if (allEnemiesDead) {
    showVictory(title, starsContainer, nextBtn, player.health, lvl);
    return;
  }

  // 3. Timeout Condition
  // If time runs out, compare integrity
  const totalEnemyHealth = enemies.reduce((sum, e) => sum + Math.max(0, e.health), 0);
  if (player.health > totalEnemyHealth) {
    showVictory(title, starsContainer, nextBtn, player.health, lvl);
  } else {
    showDefeat(title, starsContainer, nextBtn);
  }
}

function showVictory(title, starsContainer, nextBtn, playerHealth, currentLevel) {
  title.innerText = 'YOU WIN!'

  if (typeof audio !== 'undefined') audio.play('victory');

  let stars = 1
  if (playerHealth > 80) stars = 3
  else if (playerHealth > 50) stars = 2

  // Robust Level Progression Logic
  const lvl = parseInt(currentLevel) || window.gameLevel || 1;
  const nextLvl = lvl + 1;

  // Persist progress
  const maxUnlocked = parseInt(localStorage.getItem('maxUnlockedLevel')) || 1;
  if (nextLvl > maxUnlocked) {
    localStorage.setItem('maxUnlockedLevel', nextLvl.toString());
    console.log(`Progress Saved: Next Level Unlocked is ${nextLvl}`);
  }

  renderStars(starsContainer, stars);

  if (nextBtn) {
    nextBtn.style.display = 'block';

    // Explicit global function for the button
    window.nextLevel = () => {
      console.log(`Navigating to Level: ${nextLvl}`);
      sessionStorage.setItem('game_access', 'true');
      window.location.href = `game.html?level=${nextLvl}`;
    };

    nextBtn.onclick = window.nextLevel;
  }

  const levelDisplay = document.querySelector('#levelDisplay');
  if (levelDisplay) levelDisplay.innerText = `LEVEL ${nextLvl}`;
}

function showDefeat(title, starsContainer, nextBtn) {
  title.innerText = 'DEFEAT'

  if (typeof audio !== 'undefined') audio.play('defeat');

  renderStars(starsContainer, 0);
  nextBtn.style.display = 'none'
}

function renderStars(container, count) {
  const starSvgPath = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";
  let starsHtml = ''

  for (let i = 0; i < 3; i++) {
    let color = '#fbbf24';
    if (i >= count) color = '#6b7280';

    const yTrans = i === 1 ? '-15px' : '0px';
    const size = i === 1 ? '70px' : '55px';

    starsHtml += `
            <span style="display:inline-block; width: ${size}; height: ${size}; margin: 0 5px; transform: translateY(${yTrans});">
                <svg viewBox="0 0 24 24" style="width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 4px 2px rgba(0,0,0,0.3));">
                    <defs>
                        <linearGradient id="starGradient${i}" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style="stop-color:${i < count ? '#fde047' : '#9ca3af'};stop-opacity:1" />
                            <stop offset="100%" style="stop-color:${i < count ? '#fbbf24' : '#6b7280'};stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    <path d="${starSvgPath}" 
                        fill="url(#starGradient${i})" 
                        stroke="${i < count ? '#b45309' : '#4b5563'}" 
                        stroke-width="1.5" stroke-linejoin="round" />
                </svg>
            </span>
        `;
  }
  container.innerHTML = starsHtml
}

let timer = 60
window.isGamePaused = false;
let timerId

function decreaseTimer() {
  if (timer > 0) {
    timerId = setTimeout(decreaseTimer, 1000)

    // Only count down if the game is NOT paused
    if (!window.isGamePaused) {
      timer--
      document.querySelector('#timer').innerHTML = timer
    }
  }

  // Timer ran out!
  if (timer === 0 && !window.isGamePaused) {
    determineWinner({ player, enemies, timerId, currentLevel: window.gameLevel })
  }
}
