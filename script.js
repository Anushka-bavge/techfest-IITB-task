/**
 * ABYSSUS - IMMERSIVE DEEP SEA DESCENT PARALLAX ENGINE
 * Implementation using requestAnimationFrame, canvas particle systems,
 * dynamic depth mapping, and Web Audio API synthesized ambient audio.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- State & DOM Selection ---
    const body = document.body;
    const parallaxContainer = document.getElementById('parallax-container');
    const zones = document.querySelectorAll('.zone');
    const depthNumber = document.getElementById('depth-number');
    const depthZoneName = document.getElementById('depth-zone-name');
    const gaugeFill = document.getElementById('gauge-fill');
    const gaugeSub = document.getElementById('gauge-sub');
    const gaugeMarkers = document.querySelectorAll('.gauge-marker');
    const scrollPrompt = document.getElementById('scroll-prompt');
    const mobileDepthNumber = document.getElementById('mobile-depth-number');
    const mobileDepthZone = document.getElementById('mobile-depth-zone');
    
    const audioToggle = document.getElementById('audio-toggle');
    const motionToggle = document.getElementById('motion-toggle');
    const btnAscend = document.getElementById('btn-ascend');
    const glowingArtifact = document.querySelector('.glowing-artifact');

    let currentScrollY = window.scrollY;
    let targetScrollY = window.scrollY;
    let isParallaxActive = true;
    let isAudioActive = false;
    let isMobile = window.innerWidth <= 768;

    // Check media queries for prefers-reduced-motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
        setMotionState(false);
    }

    // --- Intersection Observer for Card Reveals ---
    const revealOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -100px 0px' // Trigger slightly before center
    };

    const cardObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, revealOptions);

    document.querySelectorAll('.reveal-card').forEach(card => {
        cardObserver.observe(card);
    });

    // --- Sound Synthesis Engine (Web Audio API) ---
    let audioCtx = null;
    let mainGain = null;
    let humOsc = null;
    let rumbleOsc = null;
    let sonarInterval = null;

    function initAudio() {
        if (audioCtx) return;

        // Create Audio Context
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();

        // Main gain node
        mainGain = audioCtx.createGain();
        mainGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        mainGain.connect(audioCtx.destination);

        // 1. Deep Sea Hum (Low frequency oscillator)
        humOsc = audioCtx.createOscillator();
        humOsc.type = 'sine';
        humOsc.frequency.setValueAtTime(55, audioCtx.currentTime); // A1 hum
        
        const humGain = audioCtx.createGain();
        humGain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        
        humOsc.connect(humGain);
        humGain.connect(mainGain);
        humOsc.start();

        // 2. Ambient Water Rumble (Triangle oscillator + Bandpass filter)
        rumbleOsc = audioCtx.createOscillator();
        rumbleOsc.type = 'triangle';
        rumbleOsc.frequency.setValueAtTime(90, audioCtx.currentTime);

        const rumbleFilter = audioCtx.createBiquadFilter();
        rumbleFilter.type = 'bandpass';
        rumbleFilter.Q.setValueAtTime(1.5, audioCtx.currentTime);
        rumbleFilter.frequency.setValueAtTime(60, audioCtx.currentTime);

        const rumbleGain = audioCtx.createGain();
        rumbleGain.gain.setValueAtTime(0.2, audioCtx.currentTime);

        rumbleOsc.connect(rumbleFilter);
        rumbleFilter.connect(rumbleGain);
        rumbleGain.connect(mainGain);
        rumbleOsc.start();

        // 3. Sonar Pings (High sine + feedback delay + exponential decay)
        scheduleSonarPing();
    }

    function scheduleSonarPing() {
        const pingTime = 8000 + Math.random() * 6000; // Ping every 8-14s
        
        sonarInterval = setTimeout(() => {
            if (isAudioActive && audioCtx && audioCtx.state === 'running') {
                triggerSonarPing();
            }
            scheduleSonarPing();
        }, pingTime);
    }

    function triggerSonarPing() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;

        const pingOsc = audioCtx.createOscillator();
        const pingGain = audioCtx.createGain();
        
        pingOsc.type = 'sine';
        // Base frequency drops slightly as depth increases
        const depthRatio = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
        const baseFreq = 950 - (depthRatio * 350); // Sonar pings sound deeper the lower you go
        
        pingOsc.frequency.setValueAtTime(baseFreq, now);

        // Exponential decay envelope
        pingGain.gain.setValueAtTime(0.0, now);
        pingGain.gain.linearRampToValueAtTime(0.12, now + 0.05);
        pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0); // 3 seconds decay

        // Simple Delay for Underwater Echo
        const delay = audioCtx.createDelay(1.0);
        delay.delayTime.setValueAtTime(0.4, now);

        const delayFeedback = audioCtx.createGain();
        delayFeedback.gain.setValueAtTime(0.4, now);

        // Connections
        pingOsc.connect(pingGain);
        pingGain.connect(mainGain); // Dry signal
        
        // Feed into delay
        pingGain.connect(delay);
        delay.connect(delayFeedback);
        delayFeedback.connect(delay); // Loop back
        delayFeedback.connect(mainGain); // Wet signal

        pingOsc.start(now);
        pingOsc.stop(now + 3.2);
    }

    function setAudioState(active) {
        isAudioActive = active;
        if (active) {
            initAudio();
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            // Fade in ambient audio
            mainGain.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 1.5);
            audioToggle.querySelector('.icon').textContent = '🔊';
            audioToggle.querySelector('.label').textContent = 'Sound On';
            audioToggle.classList.add('active');
        } else {
            if (mainGain) {
                // Fade out ambient audio
                mainGain.gain.linearRampToValueAtTime(0.0, audioCtx.currentTime + 0.5);
                setTimeout(() => {
                    if (!isAudioActive && audioCtx) {
                        audioCtx.suspend();
                    }
                }, 600);
            }
            audioToggle.querySelector('.icon').textContent = '🔇';
            audioToggle.querySelector('.label').textContent = 'Sound Off';
            audioToggle.classList.remove('active');
        }
    }

    // Audio frequency tuning based on scroll position
    function updateAudioHum(depthRatio) {
        if (!audioCtx || !humOsc || !rumbleOsc) return;
        
        // Deeper scrolling = deeper, heavier synth frequencies
        const baseHum = 55 - (depthRatio * 20); // 55Hz down to 35Hz
        const baseRumble = 90 - (depthRatio * 30); // 90Hz down to 60Hz
        
        humOsc.frequency.setTargetAtTime(baseHum, audioCtx.currentTime, 0.2);
        rumbleOsc.frequency.setTargetAtTime(baseRumble, audioCtx.currentTime, 0.2);
    }

    audioToggle.addEventListener('click', () => {
        setAudioState(!isAudioActive);
    });


    // --- Parallax Motion Control & Toggles ---
    function setMotionState(active) {
        isParallaxActive = active;
        if (active) {
            body.classList.remove('no-parallax-forced');
            motionToggle.querySelector('.icon').textContent = '✨';
            motionToggle.querySelector('.label').textContent = 'Parallax On';
            motionToggle.classList.remove('inactive');
        } else {
            body.classList.add('no-parallax-forced');
            motionToggle.querySelector('.icon').textContent = '💤';
            motionToggle.querySelector('.label').textContent = 'Parallax Off';
            motionToggle.classList.add('inactive');
            
            // Clear inline translations
            document.querySelectorAll('.layer').forEach(layer => {
                layer.style.transform = '';
            });
        }
    }

    motionToggle.addEventListener('click', () => {
        setMotionState(!isParallaxActive);
    });

    motionQuery.addEventListener('change', (e) => {
        setMotionState(!e.matches);
    });


    // --- Depth Calculation & UI Mapping ---
    const depthZones = [
        { name: "Epipelagic", limit: 200, label: "Sunlight Zone" },
        { name: "Mesopelagic", limit: 1000, label: "Twilight Zone" },
        { name: "Bathypelagic", limit: 4000, label: "Midnight Zone" },
        { name: "Abyssopelagic", limit: 6000, label: "The Abyss" },
        { name: "Hadalpelagic", limit: 11034, label: "Hadal Zone" }
    ];

    function updateDepthUI(scrollTop, scrollHeight) {
        const viewportHeight = window.innerHeight;
        const totalScrollable = scrollHeight - viewportHeight;
        
        // Calculate scroll ratio (0 to 1)
        let ratio = 0;
        if (totalScrollable > 0) {
            ratio = Math.min(Math.max(scrollTop / totalScrollable, 0), 1);
        }

        // Map to depth (0m to 11,034m)
        const currentDepth = Math.round(ratio * 11034);
        
        // Format depth with thousands separator
        depthNumber.textContent = currentDepth.toLocaleString();

        // Identify current zone name
        let zone = depthZones[0];
        for (let i = 0; i < depthZones.length; i++) {
            if (currentDepth <= depthZones[i].limit) {
                zone = depthZones[i];
                break;
            }
        }
        depthZoneName.textContent = zone.name;
        if (mobileDepthNumber) {
            mobileDepthNumber.textContent = currentDepth.toLocaleString();
        }
        if (mobileDepthZone) {
            mobileDepthZone.textContent = zone.name;
        }

        // Update depth gauge sidebar
        gaugeFill.style.height = `${ratio * 100}%`;
        gaugeSub.style.top = `${ratio * 100}%`;

        // Highlight active markers
        let activeIndex = 0;
        if (ratio < 0.15) activeIndex = 0; // sunlight
        else if (ratio < 0.38) activeIndex = 1; // twilight
        else if (ratio < 0.62) activeIndex = 2; // midnight
        else if (ratio < 0.85) activeIndex = 3; // abyss
        else activeIndex = 4; // hadal

        gaugeMarkers.forEach((marker, idx) => {
            if (idx === activeIndex) {
                marker.classList.add('active');
            } else {
                marker.classList.remove('active');
            }
        });

        // Hide scroll prompt once user starts scrolling
        if (scrollTop > 50) {
            scrollPrompt.classList.add('fade-out');
        } else {
            scrollPrompt.classList.remove('fade-out');
        }

        // Adjust Audio frequencies dynamically based on depth ratio
        updateAudioHum(ratio);
    }


    // --- Canvas Particle Systems ---
    const canvasContainers = {
        sunlight: { canvas: document.getElementById('canvas-sunlight'), particles: [], color: 'rgba(56, 189, 248, ', speedY: -1, type: 'bubble' },
        twilight: { canvas: document.getElementById('canvas-twilight'), particles: [], color: 'rgba(94, 234, 212, ', speedY: -0.4, type: 'marine-snow' },
        midnight: { canvas: document.getElementById('canvas-midnight'), particles: [], color: 'rgba(52, 211, 153, ', speedY: -0.15, type: 'biolum' },
        abyss: { canvas: document.getElementById('canvas-abyss'), particles: [], color: 'rgba(248, 250, 252, ', speedY: 0.6, type: 'snow' },
        hadal: { canvas: document.getElementById('canvas-hadal'), particles: [], color: 'rgba(250, 204, 21, ', speedY: 0.25, type: 'fissure-sparks' }
    };

    class Particle {
        constructor(w, h, config) {
            this.w = w;
            this.h = h;
            this.config = config;
            this.reset();
            // Start at random height
            this.y = Math.random() * h;
        }

        reset() {
            this.x = Math.random() * this.w;
            this.size = Math.random() * (this.config.type === 'bubble' ? 5 : 2.5) + 0.5;
            this.alpha = Math.random() * 0.4 + 0.1;
            
            // Base speed parameters
            if (this.config.type === 'bubble') {
                this.y = this.h + 10;
                this.speedX = Math.random() * 0.8 - 0.4;
                this.speedY = Math.random() * -1.5 - 0.6;
                this.wobble = Math.random() * 20;
                this.wobbleSpeed = Math.random() * 0.05 + 0.02;
            } else if (this.config.type === 'biolum') {
                this.y = Math.random() * this.h;
                this.speedX = Math.random() * 0.4 - 0.2;
                this.speedY = Math.random() * -0.3 - 0.1;
                this.pulseSpeed = Math.random() * 0.02 + 0.01;
                this.pulseTime = Math.random() * Math.PI;
                // Specific glowing colors for biolum
                const colors = ['rgba(56, 189, 248, ', 'rgba(52, 211, 153, ', 'rgba(96, 165, 250, '];
                this.color = colors[Math.floor(Math.random() * colors.length)];
            } else {
                // Falling snow / debris
                this.y = -10;
                this.speedX = Math.random() * 0.6 - 0.3;
                this.speedY = Math.random() * this.config.speedY + 0.2;
            }
        }

        update() {
            if (this.config.type === 'bubble') {
                this.y += this.speedY;
                this.wobble += this.wobbleSpeed;
                this.x += this.speedX + Math.sin(this.wobble) * 0.3;
                
                if (this.y < -20 || this.x < -20 || this.x > this.w + 20) {
                    this.reset();
                }
            } else if (this.config.type === 'biolum') {
                this.y += this.speedY;
                this.x += this.speedX;
                this.pulseTime += this.pulseSpeed;
                // Pulse opacity
                this.alpha = (Math.sin(this.pulseTime) + 1) * 0.3 + 0.1;
                
                if (this.y < -20 || this.x < -20 || this.x > this.w + 20) {
                    this.reset();
                }
            } else {
                // Falling Snow (Abyss/Trench)
                this.y += this.speedY;
                this.x += this.speedX;
                
                if (this.y > this.h + 20 || this.x < -20 || this.x > this.w + 20) {
                    this.reset();
                }
            }
        }

        draw(ctx) {
            ctx.beginPath();
            const colorStr = this.color || this.config.color;
            ctx.fillStyle = colorStr + this.alpha + ')';
            
            if (this.config.type === 'bubble') {
                // Draw circle bubble
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
                // Add highlight glint on bubble
                if (this.size > 2) {
                    ctx.beginPath();
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                    ctx.arc(this.x - this.size * 0.3, this.y - this.size * 0.3, this.size * 0.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (this.config.type === 'biolum') {
                // Draw soft glowing blob
                const radGrd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 3);
                radGrd.addColorStop(0, colorStr + this.alpha + ')');
                radGrd.addColorStop(0.5, colorStr + (this.alpha * 0.4) + ')');
                radGrd.addColorStop(1, colorStr + '0)');
                
                ctx.fillStyle = radGrd;
                ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Standard marine snow specs
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function initCanvases() {
        Object.keys(canvasContainers).forEach(key => {
            const container = canvasContainers[key];
            const canvas = container.canvas;
            if (!canvas) return;

            const updateSize = () => {
                const parent = canvas.parentElement;
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
            };
            
            updateSize();
            
            // Populate particles
            container.particles = [];
            const numParticles = isMobile ? 25 : 60;
            for (let i = 0; i < numParticles; i++) {
                container.particles.push(new Particle(canvas.width, canvas.height, container));
            }
        });
    }

    function animateParticles() {
        Object.keys(canvasContainers).forEach(key => {
            const container = canvasContainers[key];
            const canvas = container.canvas;
            if (!canvas) return;

            // Only clear & draw if section is visible to conserve power!
            const rect = canvas.parentElement.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight && rect.bottom > 0;

            if (isVisible && isParallaxActive) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                container.particles.forEach(p => {
                    p.update();
                    p.draw(ctx);
                });
            }
        });
        
        requestAnimationFrame(animateParticles);
    }


    // --- Core Parallax Scroll Loop (requestAnimationFrame) ---
    let tick = false;

    function onScroll() {
        targetScrollY = window.scrollY;
        if (!tick) {
            requestAnimationFrame(updateParallax);
            tick = true;
        }
    }

    function updateParallax() {
        // Smoothly interpolate scroll value for momentum effect (inertia)
        currentScrollY += (targetScrollY - currentScrollY) * 0.15;
        
        // Limit precision issues when very close to target
        if (Math.abs(targetScrollY - currentScrollY) < 0.1) {
            currentScrollY = targetScrollY;
        }

        const scrollHeight = document.documentElement.scrollHeight;
        updateDepthUI(currentScrollY, scrollHeight);

        if (isParallaxActive && !isMobile) {
            const viewportHeight = window.innerHeight;
            const viewportCenter = currentScrollY + viewportHeight / 2;

            zones.forEach(zone => {
                const zoneTop = zone.offsetTop;
                const zoneHeight = zone.offsetHeight;
                const zoneBottom = zoneTop + zoneHeight;

                // Check if the zone is in viewport before doing heavy translations
                if (currentScrollY + viewportHeight > zoneTop && currentScrollY < zoneBottom) {
                    const zoneCenter = zoneTop + zoneHeight / 2;
                    const offsetFromCenter = viewportCenter - zoneCenter;

                    // Translate layers within this zone
                    const layers = zone.querySelectorAll('.layer:not(.layer-content)');
                    layers.forEach(layer => {
                        const speed = parseFloat(layer.getAttribute('data-speed')) || 0;
                        
                        // Background layers move slowly (translate down), foreground layers move quickly (translate up)
                        // If speed is set, calculate translation
                        if (speed !== 0) {
                            let yTranslate = offsetFromCenter * speed;
                            
                            // If it's a foreground layer, move it faster in the opposite direction
                            if (layer.classList.contains('layer-fg')) {
                                yTranslate = offsetFromCenter * -speed;
                            }
                            
                            layer.style.transform = `translate3d(0, ${yTranslate}px, 0)`;
                        }
                    });
                }
            });
        }

        // Loop standard scroll calculations
        if (Math.abs(targetScrollY - currentScrollY) > 0.15) {
            requestAnimationFrame(updateParallax);
        } else {
            tick = false;
        }
    }

    // Nav navigation: Click indicators to jump to zones
    gaugeMarkers.forEach(marker => {
        marker.addEventListener('click', (e) => {
            const targetId = marker.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Ascend button logic
    btnAscend.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Fun Micro-interaction on artifact click
    glowingArtifact.addEventListener('click', () => {
        glowingArtifact.classList.add('activated');
        // Synthesize an "active discovery chime"
        if (audioCtx && isAudioActive) {
            const now = audioCtx.currentTime;
            
            // Major pentatonic arpeggio chime
            const notes = [523.25, 587.33, 659.25, 783.99, 880.00]; // C5, D5, E5, G5, A5
            notes.forEach((freq, idx) => {
                const time = now + idx * 0.15;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, time);
                
                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(0.08, time + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.8);
                
                osc.connect(gain);
                gain.connect(mainGain);
                
                osc.start(time);
                osc.stop(time + 0.9);
            });
        }
        
        setTimeout(() => {
            glowingArtifact.classList.remove('activated');
        }, 1200);
    });

    // Resize triggers
    window.addEventListener('resize', () => {
        isMobile = window.innerWidth <= 768;
        initCanvases();
        onScroll();
    });

    // --- Bootstrapping ---
    window.addEventListener('scroll', onScroll, { passive: true });
    
    initCanvases();
    animateParticles();
    onScroll(); // Run initially to align elements
});
