const urlParamsMult = new URLSearchParams(window.location.search);
const urlMode = urlParamsMult.get('mode');
const storedMode = sessionStorage.getItem('multiplayerMode');
const mode = (urlMode === 'host' || urlMode === 'join')
    ? urlMode
    : ((storedMode === 'host' || storedMode === 'join') ? storedMode : null);
const hostCode = urlParamsMult.get('host') || sessionStorage.getItem('multiplayerHostCode');

if (mode === 'host' || mode === 'join') {
    sessionStorage.setItem('multiplayerMode', mode);
}
if (mode === 'join' && hostCode) {
    sessionStorage.setItem('multiplayerHostCode', hostCode);
}

window.isMultiplayer = mode === 'host' || mode === 'join';
window.isHost = mode === 'host';

let peer;
let peerConn = null;
let syncIntervalId = null;
let roundEnded = false;
let localRematchRequested = false;
let remoteRematchRequested = false;
let peerPaused = false;

function setPeerPauseOverlay(visible) {
    const overlay = document.getElementById('peer-pause-overlay');
    if (!overlay) return;
    overlay.style.display = visible ? 'flex' : 'none';
}

function applyPeerPauseState(isPaused) {
    peerPaused = !!isPaused;
    window.isPeerPauseLock = peerPaused;
    setPeerPauseOverlay(peerPaused);
}

if (window.isMultiplayer) {
    document.getElementById('multiplayer-lobby').style.display = 'flex';

    // Null check for element before modifying
    const levelIndicator = document.getElementById('level-indicator');
    if (levelIndicator) {
        levelIndicator.innerText = "1v1 DEATHMATCH";
        levelIndicator.style.display = "block";
    }

    peer = new Peer();

    peer.on('error', () => {
        alert('MULTIPLAYER CONNECTION FAILED. PLEASE TRY AGAIN.');
        window.location.href = 'index.html';
    });

    peer.on('open', (id) => {
        if (window.isHost) {
            document.getElementById('inviteCodeDisplay').innerText = id;
            sessionStorage.setItem('multiplayerMode', 'host');
            sessionStorage.setItem('multiplayerHostCode', id);
        } else {
            document.getElementById('inviteCodeDisplay').innerText = `CONNECTING TO HOST...`;
            peerConn = peer.connect(hostCode);
            setupConnection(peerConn);
        }
    });

    if (window.isHost) {
        peer.on('connection', (connection) => {
            if (peerConn) return; // Only allow one connection
            peerConn = connection;
            setupConnection(peerConn);
        });
    }
}

function setupConnection(connection) {
    connection.on('open', () => {
        document.getElementById('multiplayer-lobby').style.display = 'none';

        if (window.isHost) {
            player.isRemoteControlled = false;
            enemies[0].isRemoteControlled = true;
        } else {
            player.isRemoteControlled = true;
            enemies[0].isRemoteControlled = false;

            // GUEST VIEW: Swap initial spawn positions so guest's character starts on LEFT
            enemies[0].position.x = -200;
            enemies[0].position.y = 0;
            enemies[0].facing = 'right';
            player.position.x = canvas.width + 200;
            player.position.y = 0;
            player.facing = 'left';
        }

        applyPeerPauseState(false);

        roundEnded = false;
        localRematchRequested = false;
        remoteRematchRequested = false;

        // Trigger the 3..2..1 FIGHT countdown now that a player joined!
        if (!window.gameStarted && typeof window.startSequence === 'function') {
            window.startSequence();
        }

        // Host controls player (Samurai), Guest controls enemies[0] (Kenji)
        // Set up infinite interval to sync states
        if (syncIntervalId) {
            clearInterval(syncIntervalId);
        }
        syncIntervalId = setInterval(() => {
            syncState();
        }, 30); // ~33fps state sync
    });

    connection.on('data', (data) => {
        if (!data || !data.type) return;

        if (data.type === 'REMATCH_REQUEST') {
            remoteRematchRequested = true;
            maybeStartRematch();
            return;
        }

        if (data.type === 'START_REMATCH') {
            beginRematch();
            return;
        }

        if (data.type === 'PAUSE_STATE') {
            applyPeerPauseState(!!data.paused);
            return;
        }

        if (data.type === 'SYNC') {
            if (peerPaused) return;

            // GUEST VIEW MIRROR: flip X so opponent appears on the right
            if (!window.isHost) {
                data.pos.x = canvas.width - data.pos.x - 50;
                data.vel.x = -(data.vel.x || 0);
                data.facing = data.facing === 'left' ? 'right' : 'left';
            }

            // Normalize Y: convert ground-relative offset back to local screen coordinates
            const localGround = typeof groundLevel !== 'undefined' ? groundLevel : canvas.height - 140;
            const yFromGround = data.yOffset != null ? data.yOffset : 0;
            data.pos.y = localGround - 150 + yFromGround; // 150 = fighter height

            const remoteFighter = window.isHost ? enemies[0] : player;
            remoteFighter.position = data.pos;
            remoteFighter.velocity = data.vel;
            remoteFighter.health = data.health;
            remoteFighter.facing = data.facing;
            remoteFighter.isDashing = data.isDashing;

            if (remoteFighter.spriteName !== data.sprite) {
                remoteFighter.spriteName = data.sprite;
                remoteFighter.switchSprite(data.sprite);
            }

            if (data.isAttacking && !remoteFighter.isAttacking) {
                remoteFighter.attack();
            }
            if (data.dead && !remoteFighter.dead) {
                remoteFighter.switchSprite('death');
                remoteFighter.dead = true;
            }
        }
    });

    connection.on('close', () => {
        if (syncIntervalId) {
            clearInterval(syncIntervalId);
            syncIntervalId = null;
        }
        alert("PLAYER DISCONNECTED!");
        window.location.href = "index.html";
    });
}

function beginRematch() {
    roundEnded = false;
    localRematchRequested = false;
    remoteRematchRequested = false;
    applyPeerPauseState(false);

    if (window.isHost) {
        player.isRemoteControlled = false;
        enemies[0].isRemoteControlled = true;
    } else {
        player.isRemoteControlled = true;
        enemies[0].isRemoteControlled = false;
    }

    if (typeof window.resetMultiplayerRound === 'function') {
        window.resetMultiplayerRound();
    }
}

function maybeStartRematch() {
    if (!roundEnded || !localRematchRequested || !remoteRematchRequested) return;

    if (window.isHost) {
        if (peerConn && peerConn.open) {
            peerConn.send({ type: 'START_REMATCH' });
        }
        beginRematch();
    }
}

window.onMultiplayerRoundEnd = function onMultiplayerRoundEnd() {
    roundEnded = true;
    localRematchRequested = false;
    remoteRematchRequested = false;
};

window.requestMultiplayerRematch = function requestMultiplayerRematch(rematchButton) {
    if (!roundEnded) return;

    localRematchRequested = true;

    if (rematchButton) {
        rematchButton.disabled = true;
        rematchButton.style.opacity = '0.7';
        const label = rematchButton.querySelector('span');
        if (label) {
            label.innerText = 'WAITING...';
        }
    }

    if (peerConn && peerConn.open) {
        peerConn.send({ type: 'REMATCH_REQUEST' });
    }

    maybeStartRematch();
};

window.sendPauseStateToPeer = function sendPauseStateToPeer(isPaused) {
    if (!window.isMultiplayer || !peerConn || !peerConn.open) return;
    peerConn.send({
        type: 'PAUSE_STATE',
        paused: !!isPaused
    });
};

// Track previous attack state so we only trigger attack once per press
let lastAttack = false;

function syncState() {
    if (!peerConn || !peerConn.open) return;

    // Host reports player state, Guest reports enemies[0] state
    const localFighter = window.isHost ? player : enemies[0];

    // Deduce current sprite key based on the active image
    let currentSprite = 'idle';
    for (const [key, spriteObj] of Object.entries(localFighter.sprites)) {
        if (localFighter.image === spriteObj.image) {
            currentSprite = key;
            localFighter.spriteName = key;
            break;
        }
    }

    // Send Y as offset from groundLevel for cross-screen normalization
    const localGround = typeof groundLevel !== 'undefined' ? groundLevel : canvas.height - 140;
    const yOffset = localFighter.position.y - (localGround - 150); // 150 = fighter height

    const payload = {
        type: 'SYNC',
        pos: { x: localFighter.position.x, y: localFighter.position.y },
        vel: { x: localFighter.velocity.x, y: localFighter.velocity.y },
        yOffset: yOffset,
        health: localFighter.health,
        facing: localFighter.facing,
        sprite: currentSprite,
        isAttacking: localFighter.isAttacking && !lastAttack,
        isDashing: localFighter.isDashing,
        dead: localFighter.dead
    };

    // GUEST VIEW MIRROR: flip X before sending so host sees correct right-side position
    if (!window.isHost) {
        payload.pos.x = canvas.width - payload.pos.x - 50;
        payload.vel.x = -(payload.vel.x);
        payload.facing = payload.facing === 'left' ? 'right' : 'left';
    }

    lastAttack = localFighter.isAttacking;
    peerConn.send(payload);
}

// Override Local Fighter controls for Guest
// Guest controls enemies[0] instead of player!
window.addEventListener('keydown', (event) => {
    if (!window.isMultiplayer || window.isHost) return; // Host uses normal index.js player controls
    if (player.dead || enemies[0].dead) return;

    // We intercept input meant for player and map it to enemies[0]
    switch (event.key) {
        case 'ArrowRight':
            enemies[0].velocity.x = 5;
            enemies[0].facing = 'right';
            enemies[0].switchSprite('run');
            break;
        case 'ArrowLeft':
            enemies[0].velocity.x = -5;
            enemies[0].facing = 'left';
            enemies[0].switchSprite('run');
            break;
        case 'ArrowUp':
            if (enemies[0].jumps > 0) {
                enemies[0].velocity.y = -15;
                enemies[0].jumps--;
            }
            break;
        case 'ArrowDown':
            const now = Date.now();
            if (!enemies[0].isDashing && now - (enemies[0].lastDashTime || 0) > 2000) {
                enemies[0].isDashing = true;
                enemies[0].lastDashTime = now;
                const dashDir = (enemies[0].facing === 'left') ? -1 : 1;
                enemies[0].velocity.x = dashDir * 35;
                setTimeout(() => {
                    if (enemies[0].isDashing) {
                        enemies[0].isDashing = false;
                        enemies[0].velocity.x = 0;
                    }
                }, 300);
            }
            break;
        case ' ':
            if (!enemies[0].isAttacking) enemies[0].attack();
            break;
    }
});

// For releasing keys for guest
window.addEventListener('keyup', (event) => {
    if (!window.isMultiplayer || window.isHost) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        enemies[0].velocity.x = 0;
        enemies[0].switchSprite('idle');
    }
});
