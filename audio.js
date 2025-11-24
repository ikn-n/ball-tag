// Advanced Techno Synthesizer using Web Audio API
(function () {
    // --- Configuration ---
    const BPM = 128;
    const SECONDS_PER_BEAT = 60 / BPM;
    const STEPS_PER_BEAT = 4; // 16th notes
    const STEP_TIME = SECONDS_PER_BEAT / STEPS_PER_BEAT;
    const LOOKAHEAD = 0.1; // Seconds
    const SCHEDULE_AHEAD_TIME = 0.2; // Seconds

    // --- Audio Context & State ---
    let audioCtx = null;
    let masterGain = null;
    let compressor = null;

    let isPlaying = false;
    let currentStep = 0;
    let nextStepTime = 0;
    let schedulerTimer = null;
    let currentTrack = null;

    // --- Sound Generation ---

    // 1. Kick Drum: Punchy sine sweep
    function playKick(time) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';

        // Pitch Envelope (Drop)
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

        // Amplitude Envelope
        gain.gain.setValueAtTime(1.0, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

        osc.connect(gain);
        gain.connect(compressor);

        osc.start(time);
        osc.stop(time + 0.5);
    }

    // 2. Hi-Hat: Filtered White Noise (Lo-Fi: Bandpass)
    let noiseBuffer = null;
    function createNoiseBuffer() {
        if (noiseBuffer) return;
        const bufferSize = audioCtx.sampleRate * 2; // 2 seconds of noise
        noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }

    function playHiHat(time, open = false) {
        if (!noiseBuffer) createNoiseBuffer();

        const source = audioCtx.createBufferSource();
        source.buffer = noiseBuffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass'; // Lo-fi: Bandpass instead of highpass
        filter.frequency.value = 4000; // Focused midrange, cutting off harsh highs
        filter.Q.value = 1;

        const gain = audioCtx.createGain();

        // Envelope
        const duration = open ? 0.4 : 0.05;
        const volume = open ? 0.4 : 0.3;

        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(compressor);

        source.start(time);
        source.stop(time + duration);
    }

    // 3. Bass: Low Sawtooth with Filter Envelope
    function playBass(time, freq, duration) {
        const osc = audioCtx.createOscillator();
        const filter = audioCtx.createBiquadFilter();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.value = freq;

        // Filter Envelope (Wow effect) - Lowered for lo-fi feel
        filter.type = 'lowpass';
        filter.Q.value = 5;
        filter.frequency.setValueAtTime(150, time);
        filter.frequency.linearRampToValueAtTime(600, time + 0.1);
        filter.frequency.exponentialRampToValueAtTime(150, time + duration - 0.05);

        // Amp Envelope
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.1);
        gain.gain.linearRampToValueAtTime(0, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(compressor);

        osc.start(time);
        osc.stop(time + duration);
    }

    // 4. Synth Lead: Detuned Squares with Delay (Lo-Fi: Lowpass)
    let delayNode = null;
    let delayFeedback = null;

    function setupEffects() {
        if (delayNode) return;
        delayNode = audioCtx.createDelay();
        delayNode.delayTime.value = SECONDS_PER_BEAT * 0.75; // Dotted 8th note delay

        delayFeedback = audioCtx.createGain();
        delayFeedback.gain.value = 0.4;

        const delayFilter = audioCtx.createBiquadFilter();
        delayFilter.type = 'lowpass';
        delayFilter.frequency.value = 1200; // Darker delay repeats

        delayNode.connect(delayFeedback);
        delayFeedback.connect(delayFilter);
        delayFilter.connect(delayNode);

        delayNode.connect(masterGain); // Wet signal
    }

    function playLead(time, freq, duration) {
        setupEffects();
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const filter = audioCtx.createBiquadFilter();
        const gain = audioCtx.createGain();

        osc1.type = 'square';
        osc2.type = 'square';

        osc1.frequency.value = freq;
        osc2.frequency.value = freq * 1.01; // Detune

        filter.type = 'lowpass';
        filter.frequency.value = 1000; // Lo-fi: Much lower cutoff (was 2500)
        filter.Q.value = 1; // Less resonance

        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(compressor); // Dry
        gain.connect(delayNode);  // Send to Delay

        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + duration);
        osc2.stop(time + duration);
    }

    // --- Sequencer Data ---

    // Note Frequencies
    const NOTES = {
        F2: 87.31, G2: 98.00, A2: 110.00, Bb2: 116.54, C3: 130.81, D3: 146.83, Eb3: 155.56,
        G4: 392.00, A4: 440.00, Bb4: 466.16, C5: 523.25, D5: 587.33, Eb5: 622.25, F5: 698.46, G5: 783.99
    };

    const TRACKS = [
        {
            name: "Acid Roll",
            kick: [
                1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0,
                1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1
            ],
            hat: [
                0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0,
                0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1
            ],
            bass: [
                NOTES.C3, 0, 0, NOTES.C3, 0, NOTES.Eb3, 0, 0, NOTES.C3, 0, 0, NOTES.C3, 0, NOTES.G2, 0, 0,
                NOTES.C3, 0, 0, NOTES.C3, 0, NOTES.Eb3, 0, 0, NOTES.F2, 0, NOTES.G2, 0, NOTES.Bb2, 0, NOTES.C3, 0
            ],
            lead: [
                0, 0, 0, 0, NOTES.C5, 0, 0, 0, 0, 0, 0, 0, NOTES.Eb5, 0, NOTES.D5, 0,
                0, 0, 0, 0, NOTES.C5, 0, 0, 0, NOTES.G4, 0, NOTES.Bb4, 0, NOTES.C5, 0, 0, 0
            ]
        }
    ];

    // 32-step pattern
    const PATTERN_LENGTH = 32;

    function scheduleStep(stepNumber, time) {
        if (!currentTrack) return;

        // Loop step number
        const step = stepNumber % PATTERN_LENGTH;

        if (currentTrack.kick[step]) playKick(time);
        if (currentTrack.hat[step]) playHiHat(time, step % 8 === 7); // Open hat occasionally

        const bassNote = currentTrack.bass[step];
        if (bassNote) playBass(time, bassNote, STEP_TIME * 1.5);

        const leadNote = currentTrack.lead[step];
        if (leadNote) playLead(time, leadNote, STEP_TIME * 2);
    }

    function scheduler() {
        if (!isPlaying) return;

        // Schedule ahead
        while (nextStepTime < audioCtx.currentTime + SCHEDULE_AHEAD_TIME) {
            scheduleStep(currentStep, nextStepTime);
            nextStepTime += STEP_TIME;
            currentStep++;
        }

        schedulerTimer = setTimeout(scheduler, LOOKAHEAD * 1000);
    }

    // --- Public Interface ---

    function ensureContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            // Master Chain
            masterGain = audioCtx.createGain();
            masterGain.gain.value = 0.4; // Overall volume

            compressor = audioCtx.createDynamicsCompressor();
            compressor.threshold.value = -24;
            compressor.knee.value = 30;
            compressor.ratio.value = 12;
            compressor.attack.value = 0.003;
            compressor.release.value = 0.25;

            compressor.connect(masterGain);
            masterGain.connect(audioCtx.destination);
        }
    }

    function start() {
        ensureContext();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        if (isPlaying) return;
        isPlaying = true;

        // Pick a random track
        currentTrack = TRACKS[Math.floor(Math.random() * TRACKS.length)];
        console.log("Playing Track:", currentTrack.name);

        currentStep = 0;
        nextStepTime = audioCtx.currentTime + 0.1;

        // Fade in
        masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
        masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
        masterGain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 1.0);

        scheduler();
    }

    function pause() {
        if (!isPlaying) return;
        isPlaying = false;
        if (schedulerTimer) clearTimeout(schedulerTimer);

        // Fade out
        if (audioCtx && masterGain) {
            masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
            masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
        }
    }

    function stop() {
        pause();
        currentStep = 0;
    }

    // Expose to global scope
    window.chiptuneMusic = {
        start,
        pause,
        stop
    };

})();
