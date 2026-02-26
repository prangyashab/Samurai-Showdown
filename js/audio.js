
// Audio Manager
const audio = {
    // Sound Effects
    start: new Audio('./audio/start.mp3'),
    sword: new Audio('./audio/sword.mp3'),
    hit: new Audio('./audio/hit.mp3'),
    click: new Audio('./audio/click.mp3'),
    countdown: new Audio('./audio/countdown.mp3'),
    victory: new Audio('./audio/victory.mp3'),
    defeat: new Audio('./audio/defeat.mp3'),

    currentVolume: parseFloat(localStorage.getItem('gameVolume')) || 0.6,

    init() {
        Object.values(this).forEach(sound => {
            if (sound instanceof Audio) {
                sound.preload = 'auto';
                sound.volume = this.currentVolume;
            }
        });
    },

    // Methods
    play(soundName) {
        let sound = this[soundName];
        if (sound) {
            // Special handling for click to prevent double-triggering and latency
            if (soundName === 'click') {
                const now = Date.now();
                // Debounce click sounds (50ms) to prevent double-playing from inline + global listeners
                if (this.lastClickTime && (now - this.lastClickTime < 50)) {
                    return;
                }
                this.lastClickTime = now;

                // Low latency replay: Do NOT clone, just reset
                sound.currentTime = 0;
                sound.volume = this.currentVolume;
                sound.play().catch(e => { }); // Ignore interaction errors
                return;
            }

            // For other overlapping sound effects (sword, hit), clone might still be useful
            // but usually currentTime=0 is snappier. Let's strictly use clone for overlapping SFX only if needed.
            // For now, sticking to the existing logic for others but optimizing click.
            if (['sword', 'hit'].includes(soundName)) {
                sound = sound.cloneNode(true);
                sound.volume = this.currentVolume;
            } else {
                sound.currentTime = 0; // Reset existing track
                sound.volume = this.currentVolume; // Ensure reused track has correct volume
            }

            sound.play().catch(e => {
                if (e.name !== 'NotSupportedError' && e.name !== 'AbortError') {
                    // console.log(`Audio error (${soundName}):`, e);
                }
            });
        }
    },

    playAndRedirect(url) {
        this.play('click');
        setTimeout(() => {
            window.location.href = url;
        }, 150); // Reduced delay for snappier feel
    },

    setVolume(level) {
        this.currentVolume = parseFloat(level);
        localStorage.setItem('gameVolume', this.currentVolume);

        // Update all existing Audio objects
        Object.values(this).forEach(sound => {
            if (sound instanceof Audio) {
                sound.volume = this.currentVolume;
            }
        });
    }
};

// Add click listeners to all buttons
// Play click sound ONLY when clicking interactive elements (buttons, links, inputs)
document.addEventListener('click', (event) => {
    // Check if the clicked element or its parent is interactive
    const target = event.target.closest('button, a, input[type="range"], .icon-btn, .btn');

    if (target) {
        // Only play if audio context is allowed (user interaction handles this)
        audio.play('click');
    }
});

// Initialize audio settings
audio.init();
