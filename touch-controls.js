// Touch Controls Module for Ball Tag
// Provides virtual joystick and touch input handling for mobile devices

(function () {
    'use strict';

    // Virtual Joystick Configuration
    const JOYSTICK_CONFIG = {
        outerRadius: 60,
        innerRadius: 25,
        maxDistance: 50,
        deadZone: 5,
        opacity: 0.6,
        colors: {
            outer: 'rgba(255, 255, 255, 0.2)',
            outerBorder: 'rgba(255, 255, 255, 0.4)',
            inner: 'rgba(255, 80, 80, 0.8)',
            innerBorder: 'rgba(255, 255, 255, 0.6)'
        }
    };

    // Touch state
    let touchActive = false;
    let joystickCenter = { x: 0, y: 0 };
    let joystickKnob = { x: 0, y: 0 };
    let touchInput = { x: 0, y: 0 };
    let activeTouchId = null;

    // Track which elements should be ignored for joystick
    const ignoredElements = new Set(['BUTTON', 'A']);

    function shouldIgnoreTouch(touch) {
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!element) return false;

        // Check if touch is on a button or inside a button
        if (ignoredElements.has(element.tagName)) return true;
        if (element.closest('button')) return true;
        if (element.closest('#mobile-controls')) return true;

        return false;
    }

    // Mobile detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || window.innerWidth <= 768;

    // Touch event handlers
    function handleTouchStart(event) {
        // Prevent default to avoid scrolling, zooming, etc.
        event.preventDefault();

        // Only handle first touch for movement, and ignore touches on buttons
        if (activeTouchId !== null) return;

        // Find first touch that's not on a button
        let touch = null;
        for (let i = 0; i < event.changedTouches.length; i++) {
            const t = event.changedTouches[i];
            if (!shouldIgnoreTouch(t)) {
                touch = t;
                break;
            }
        }

        if (!touch) return;

        activeTouchId = touch.identifier;

        // Set joystick center at touch location
        joystickCenter.x = touch.clientX;
        joystickCenter.y = touch.clientY;
        joystickKnob.x = touch.clientX;
        joystickKnob.y = touch.clientY;

        touchActive = true;
        updateTouchInput(touch.clientX, touch.clientY);
    }

    function handleTouchMove(event) {
        event.preventDefault();

        // Find the active touch
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            if (touch.identifier === activeTouchId) {
                updateTouchInput(touch.clientX, touch.clientY);
                break;
            }
        }
    }

    function handleTouchEnd(event) {
        event.preventDefault();

        // Check if our active touch ended
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            if (touch.identifier === activeTouchId) {
                resetTouch();
                break;
            }
        }
    }

    function handleTouchCancel(event) {
        event.preventDefault();
        resetTouch();
    }

    function updateTouchInput(touchX, touchY) {
        // Calculate offset from joystick center
        const dx = touchX - joystickCenter.x;
        const dy = touchY - joystickCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Apply dead zone
        if (distance < JOYSTICK_CONFIG.deadZone) {
            touchInput.x = 0;
            touchInput.y = 0;
            joystickKnob.x = joystickCenter.x;
            joystickKnob.y = joystickCenter.y;
            return;
        }

        // Clamp to max distance
        const clampedDistance = Math.min(distance, JOYSTICK_CONFIG.maxDistance);
        const angle = Math.atan2(dy, dx);

        // Update knob position
        joystickKnob.x = joystickCenter.x + Math.cos(angle) * clampedDistance;
        joystickKnob.y = joystickCenter.y + Math.sin(angle) * clampedDistance;

        // Normalize input to -1 to 1 range
        touchInput.x = (clampedDistance / JOYSTICK_CONFIG.maxDistance) * Math.cos(angle);
        touchInput.y = (clampedDistance / JOYSTICK_CONFIG.maxDistance) * Math.sin(angle);
    }

    function resetTouch() {
        touchActive = false;
        touchInput.x = 0;
        touchInput.y = 0;
        activeTouchId = null;
    }

    // Rendering
    function renderJoystick(ctx) {
        if (!touchActive) return;

        ctx.save();

        // Draw outer circle
        ctx.globalAlpha = JOYSTICK_CONFIG.opacity;
        ctx.fillStyle = JOYSTICK_CONFIG.colors.outer;
        ctx.strokeStyle = JOYSTICK_CONFIG.colors.outerBorder;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(joystickCenter.x, joystickCenter.y, JOYSTICK_CONFIG.outerRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw inner knob
        ctx.fillStyle = JOYSTICK_CONFIG.colors.inner;
        ctx.strokeStyle = JOYSTICK_CONFIG.colors.innerBorder;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(joystickKnob.x, joystickKnob.y, JOYSTICK_CONFIG.innerRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    // Initialize touch event listeners
    function init(canvas) {
        if (!canvas) {
            console.error('Touch controls: Canvas element required for initialization');
            return;
        }

        // Add touch event listeners
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', handleTouchCancel, { passive: false });

        // Prevent context menu on long press
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        console.log('Touch controls initialized');
    }

    // Public API
    window.TouchControls = {
        init: init,

        getTouchInput: function () {
            return { x: touchInput.x, y: touchInput.y };
        },

        isTouchActive: function () {
            return touchActive;
        },

        render: function (ctx) {
            renderJoystick(ctx);
        },

        reset: function () {
            resetTouch();
        },

        isMobile: function () {
            return isMobile;
        }
    };
})();
