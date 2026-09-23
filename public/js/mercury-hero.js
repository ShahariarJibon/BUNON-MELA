/**
 * Mercury Hero — Canvas-based anti-gravity bowl + ripple animation
 * Creates the RESADEX-inspired mercury liquid surface with a reflective
 * silver bowl that descends, creates ripples, and floats back up.
 */
(function () {
  'use strict';

  const canvas = document.getElementById('mercury-hero');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, cx, cy;
  let time = 0;
  let paused = false;
  let mouseX = 0.5, mouseY = 0.5;

  // Animation state
  const CYCLE_DURATION = 6.0; // seconds per full cycle
  let cycleTime = 0;

  // Ripple state
  const ripples = [];

  // Bowl state
  const bowl = {
    x: 0, y: 0,
    baseY: 0,
    radius: 0,
    phase: 'hover' // hover, descend, contact, rise
  };

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    W = canvas.width = rect.width;
    H = canvas.height = rect.height;
    cx = W / 2;
    cy = H / 2;
    bowl.radius = Math.min(W, H) * 0.07;
    bowl.baseY = cy * 0.35;
  }

  // Easing
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  // Draw the mercury liquid surface (concentric rings)
  function drawSurface() {
    const maxRings = 12;
    const surfaceY = cy * 1.1;

    for (let i = maxRings; i >= 0; i--) {
      const ratio = i / maxRings;
      const ringRadius = (Math.min(W, H) * 0.5) * ratio;

      // Ripple displacement
      let displacement = 0;
      ripples.forEach(r => {
        const dist = Math.abs(ringRadius - r.radius);
        if (dist < r.width) {
          displacement += Math.sin((1 - dist / r.width) * Math.PI) * r.amplitude;
        }
      });

      // Surface shimmer
      const shimmer = Math.sin(time * 1.5 + ratio * 8) * 2;

      const lightness = 78 + ratio * 18;
      const saturation = 3 + ratio * 4;

      ctx.beginPath();
      ctx.ellipse(
        cx + (mouseX - 0.5) * 20,
        surfaceY + displacement + shimmer,
        ringRadius * 1.6 + 10,
        ringRadius * 0.45 + 5,
        0, 0, Math.PI * 2
      );

      const alpha = 0.15 + (1 - ratio) * 0.6;
      ctx.strokeStyle = `hsla(220, ${saturation}%, ${lightness}%, ${alpha})`;
      ctx.lineWidth = 2.5 + (1 - ratio) * 3;
      ctx.stroke();
    }
  }

  // Draw the reflective mercury bowl/sphere
  function drawBowl(x, y, r) {
    // Outer shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = r * 0.8;
    ctx.shadowOffsetY = r * 0.2;

    // Main sphere gradient
    const grad = ctx.createRadialGradient(
      x - r * 0.3, y - r * 0.35, r * 0.05,
      x, y, r
    );
    grad.addColorStop(0, '#f8f9ff');
    grad.addColorStop(0.2, '#e0e4ef');
    grad.addColorStop(0.45, '#a8aec0');
    grad.addColorStop(0.7, '#6b7394');
    grad.addColorStop(0.85, '#3a4060');
    grad.addColorStop(1, '#1a1e35');

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Specular highlight (top-left)
    const specGrad = ctx.createRadialGradient(
      x - r * 0.25, y - r * 0.3, 0,
      x - r * 0.25, y - r * 0.3, r * 0.55
    );
    specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    specGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)');
    specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = specGrad;
    ctx.fill();

    // Bottom reflection
    const bottomGrad = ctx.createRadialGradient(
      x, y + r * 0.6, 0,
      x, y + r * 0.6, r * 0.4
    );
    bottomGrad.addColorStop(0, 'rgba(200, 210, 230, 0.3)');
    bottomGrad.addColorStop(1, 'rgba(200, 210, 230, 0)');

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = bottomGrad;
    ctx.fill();

    // Rim edge
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(180, 190, 210, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Update animation state
  function update(dt) {
    if (paused) return;

    time += dt;
    cycleTime += dt;

    if (cycleTime > CYCLE_DURATION) cycleTime -= CYCLE_DURATION;

    const progress = cycleTime / CYCLE_DURATION;
    const surfaceY = cy * 1.1;

    // Bowl animation phases
    if (progress < 0.3) {
      // Hover phase — float at top with gentle bob
      const t = progress / 0.3;
      bowl.y = bowl.baseY + Math.sin(t * Math.PI * 2) * 8;
      bowl.phase = 'hover';
    } else if (progress < 0.5) {
      // Descend phase
      const t = easeInOutCubic((progress - 0.3) / 0.2);
      bowl.y = bowl.baseY + t * (surfaceY - bowl.baseY - bowl.radius * 0.8);
      bowl.phase = 'descend';

      // Spawn ripples on contact
      if (t > 0.95 && bowl.phase !== 'contacted') {
        for (let i = 0; i < 5; i++) {
          ripples.push({
            radius: 0,
            speed: 80 + i * 30,
            amplitude: 12 - i * 2,
            width: 60 + i * 20,
            life: 0,
            maxLife: 2.5 + i * 0.3
          });
        }
      }
    } else if (progress < 0.6) {
      // Contact phase — slight bounce at surface
      const t = (progress - 0.5) / 0.1;
      const contactY = surfaceY - bowl.radius * 0.8;
      bowl.y = contactY - Math.sin(t * Math.PI) * 15;
      bowl.phase = 'contact';
    } else {
      // Rise phase
      const t = easeOutQuad((progress - 0.6) / 0.4);
      const contactY = surfaceY - bowl.radius * 0.8;
      bowl.y = contactY - t * (contactY - bowl.baseY);
      bowl.phase = 'rise';
    }

    bowl.x = cx + (mouseX - 0.5) * 30;

    // Update ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.life += dt;
      r.radius += r.speed * dt;
      r.amplitude *= 0.995;

      if (r.life > r.maxLife || r.amplitude < 0.3) {
        ripples.splice(i, 1);
      }
    }
  }

  // Main draw
  function draw() {
    // Background — silver mercury surface
    const bgGrad = ctx.createRadialGradient(cx, cy * 0.7, 0, cx, cy, Math.max(W, H) * 0.8);
    bgGrad.addColorStop(0, '#e8ecf2');
    bgGrad.addColorStop(0.4, '#d5dbe6');
    bgGrad.addColorStop(0.7, '#c2cad8');
    bgGrad.addColorStop(1, '#b0b9cc');

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Draw mercury surface rings
    drawSurface();

    // Draw the bowl/sphere
    drawBowl(bowl.x, bowl.y, bowl.radius);

    // Bowl shadow on surface
    if (bowl.phase === 'descend' || bowl.phase === 'contact') {
      const surfaceY = cy * 1.1;
      const shadowDist = surfaceY - bowl.y;
      const shadowAlpha = Math.max(0, 0.3 - shadowDist / (cy * 0.8));
      const shadowSize = bowl.radius * (1 + shadowDist / (cy * 0.5));

      ctx.beginPath();
      ctx.ellipse(bowl.x, surfaceY, shadowSize * 0.8, shadowSize * 0.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(40, 50, 70, ${shadowAlpha})`;
      ctx.fill();
    }
  }

  // Animation loop
  let lastTime = 0;
  function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    update(dt);
    draw();

    // Update progress bar
    const progressBar = document.getElementById('hero-progress');
    if (progressBar) {
      progressBar.style.width = ((cycleTime / CYCLE_DURATION) * 100) + '%';
    }

    requestAnimationFrame(loop);
  }

  // Event listeners
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) / W;
    mouseY = (e.clientY - rect.top) / H;
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      const rect = canvas.getBoundingClientRect();
      mouseX = (e.touches[0].clientX - rect.left) / W;
      mouseY = (e.touches[0].clientY - rect.top) / H;
    }
  }, { passive: true });

  // Pause/play toggle
  const pauseBtn = document.getElementById('hero-pause');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.innerHTML = paused
        ? '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'
        : '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    });
  }

  // Init
  resize();
  requestAnimationFrame(loop);
})();
