import { clamp } from "./utils.js";

export class InputController {
  constructor(rendererElement, config, onReset, onAction) {
    this.rendererElement = rendererElement;
    this.config = config;
    this.onReset = onReset;
    this.onAction = onAction;
    this.state = {
      forward: false,
      back: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      stickX: 0,
      stickY: 0
    };
    this.view = {
      yaw: 0,
      pitch: config.input.initialPitch
    };
    this.lastTouchX = null;
    this.lastTouchY = null;
    this.stickPointerId = null;

    this.bindKeyboard();
    this.bindMouse();
    this.bindMobileButtons();
    this.bindVirtualStick();
    this.bindTouchLook();
    this.bindRotateOverlay();
  }

  bindKeyboard() {
    const keyMap = {
      KeyW: "forward",
      ArrowUp: "forward",
      KeyS: "back",
      ArrowDown: "back",
      KeyA: "left",
      ArrowLeft: "left",
      KeyD: "right",
      ArrowRight: "right",
      Space: "jump",
      ShiftLeft: "sprint",
      ShiftRight: "sprint"
    };

    const actionMap = {
      Digit1: "shoot",
      KeyJ: "shoot",
      Digit2: "shield",
      KeyQ: "shield",
      Digit3: "ascend",
      KeyE: "ascend",
      Digit4: "mine",
      KeyF: "mine",
      KeyP: "pause"
    };

    window.addEventListener("keydown", (event) => {
      if (keyMap[event.code]) {
        this.state[keyMap[event.code]] = true;
        event.preventDefault();
      }

      if (event.code === "KeyR") {
        this.onReset();
      }

      if (actionMap[event.code] && !event.repeat) {
        this.onAction(actionMap[event.code]);
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      if (keyMap[event.code]) {
        this.state[keyMap[event.code]] = false;
        event.preventDefault();
      }
    });
  }

  bindMouse() {
    this.rendererElement.addEventListener("click", () => {
      if (window.innerWidth > 800) {
        this.rendererElement.requestPointerLock();
      }
    });

    document.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement === this.rendererElement) {
        this.view.yaw -= event.movementX * this.config.input.mouseSensitivity;
        this.view.pitch -= event.movementY * this.config.input.mouseSensitivity;
        this.view.pitch = clamp(this.view.pitch, this.config.input.minPitch, this.config.input.maxPitch);
      }
    });

    this.rendererElement.addEventListener("mousedown", (event) => {
      if (event.button === 0 && document.pointerLockElement === this.rendererElement) {
        this.onAction("shoot");
      }
    });
  }

  bindMobileButtons() {
    document.querySelectorAll("[data-input]").forEach((button) => {
      const name = button.dataset.input;

      button.addEventListener("touchstart", (event) => {
        event.preventDefault();
        this.state[name] = true;
      });

      button.addEventListener("touchend", (event) => {
        event.preventDefault();
        this.state[name] = false;
      });

      button.addEventListener("touchcancel", (event) => {
        event.preventDefault();
        this.state[name] = false;
      });
    });

    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("touchstart", (event) => {
        event.preventDefault();
        this.handleAction(button.dataset.action);
      });

      button.addEventListener("click", () => {
        this.handleAction(button.dataset.action);
      });
    });
  }

  bindVirtualStick() {
    const stick = document.getElementById("moveStick");
    const knob = document.getElementById("stickKnob");
    if (!stick || !knob) return;

    const resetStick = () => {
      this.stickPointerId = null;
      this.state.stickX = 0;
      this.state.stickY = 0;
      knob.style.transform = "translate(-50%, -50%)";
    };

    const updateStick = (event) => {
      const rect = stick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxDistance = Math.min(rect.width, rect.height) * 0.34;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const distance = Math.min(Math.sqrt(dx * dx + dy * dy), maxDistance);
      const angle = Math.atan2(dy, dx);
      const knobX = Math.cos(angle) * distance;
      const knobY = Math.sin(angle) * distance;

      this.state.stickX = maxDistance > 0 ? knobX / maxDistance : 0;
      this.state.stickY = maxDistance > 0 ? -knobY / maxDistance : 0;
      knob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
    };

    stick.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.stickPointerId = event.pointerId;
      stick.setPointerCapture(event.pointerId);
      updateStick(event);
    });

    stick.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.stickPointerId) return;
      event.preventDefault();
      updateStick(event);
    });

    stick.addEventListener("pointerup", (event) => {
      if (event.pointerId === this.stickPointerId) resetStick();
    });

    stick.addEventListener("pointercancel", (event) => {
      if (event.pointerId === this.stickPointerId) resetStick();
    });
  }

  bindTouchLook() {
    this.rendererElement.addEventListener("touchstart", (event) => {
      if (event.touches.length === 1) {
        this.lastTouchX = event.touches[0].clientX;
        this.lastTouchY = event.touches[0].clientY;
      }
    });

    this.rendererElement.addEventListener("touchmove", (event) => {
      if (event.touches.length === 1 && this.lastTouchX !== null) {
        const touch = event.touches[0];
        const dx = touch.clientX - this.lastTouchX;
        const dy = touch.clientY - this.lastTouchY;

        this.view.yaw -= dx * this.config.input.touchSensitivity;
        this.view.pitch -= dy * this.config.input.touchSensitivity;
        this.view.pitch = clamp(this.view.pitch, this.config.input.minPitch, this.config.input.maxPitch);

        this.lastTouchX = touch.clientX;
        this.lastTouchY = touch.clientY;
      }
    });

    this.rendererElement.addEventListener("touchend", () => {
      this.lastTouchX = null;
      this.lastTouchY = null;
    });
  }

  bindRotateOverlay() {
    const rotateOverlay = document.getElementById("rotateOverlay");
    rotateOverlay.addEventListener("click", () => this.requestLandscapeLock());
    rotateOverlay.addEventListener("touchstart", (event) => {
      event.preventDefault();
      this.requestLandscapeLock();
    });
  }

  handleAction(action) {
    if (action === "reset") this.onReset();
    if (action === "lock") this.requestLandscapeLock();
    if (["shoot", "shield", "ascend", "mine", "pause"].includes(action)) {
      this.onAction(action);
    }
  }

  async requestLandscapeLock() {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      if (screen.orientation?.lock) {
        await screen.orientation.lock("landscape");
      }
    } catch (error) {
      // Some mobile browsers only allow manual rotation; the overlay still blocks portrait play.
    }
  }
}
