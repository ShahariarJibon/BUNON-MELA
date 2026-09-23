/**
 * Animated Mesh Gradient & Shader Showcase Engine — Full Website Fixed Luxury White Mode
 * Speed: 0.3x slower, gentle ambient organic motion
 * Stays fixed across the full screen while contents scroll up/down
 * Theme: Bunonmela Luxury Haute Couture (Amethyst, Lilac, Imperial Gold, Rose Silk)
 */
(function () {
  'use strict';

  function initShader() {
    const canvas = document.getElementById('shader-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouse = { x: width * 0.5, y: height * 0.5, targetX: width * 0.5, targetY: height * 0.5 };
    let time = 0;
    let animId;

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);

    window.addEventListener('mousemove', (e) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
    });

    window.addEventListener('mouseleave', () => {
      mouse.targetX = width * 0.5;
      mouse.targetY = height * 0.5;
    });

    // Color nodes — 0.3x velocity, luxury palette for white boutique mode
    const nodes = [
      { x: 0.20, y: 0.30, vx: 0.00018, vy: 0.00024, color: 'rgba(147, 51, 234, 0.35)', radius: 0.65 },
      { x: 0.80, y: 0.25, vx: -0.00021, vy: 0.00015, color: 'rgba(245, 158, 11, 0.28)', radius: 0.60 },
      { x: 0.50, y: 0.65, vx: 0.00015, vy: -0.00021, color: 'rgba(236, 72, 153, 0.25)', radius: 0.70 },
      { x: 0.25, y: 0.80, vx: -0.00018, vy: -0.00012, color: 'rgba(192, 132, 252, 0.30)', radius: 0.75 },
      { x: 0.75, y: 0.80, vx: 0.00021, vy: 0.00018, color: 'rgba(251, 146, 60, 0.25)', radius: 0.55 }
    ];

    function drawMeshGradient() {
      // Base background: pure white
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Smooth mouse interpolation
      mouse.x += (mouse.targetX - mouse.x) * 0.03;
      mouse.y += (mouse.targetY - mouse.y) * 0.03;

      // 0.3x slower animation speed (0.0045)
      time += 0.0045;

      // Draw liquid gradient nodes with multiply blend mode on white
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';

      nodes.forEach((node, i) => {
        // Floating wave motion (0.3x pace)
        const curX = (node.x + Math.sin(time * 0.6 + i) * 0.10) * width + (mouse.x - width * 0.5) * 0.04;
        const curY = (node.y + Math.cos(time * 0.7 + i * 1.5) * 0.10) * height + (mouse.y - height * 0.5) * 0.04;
        const curRadius = node.radius * Math.min(width, height) * (1 + 0.08 * Math.sin(time + i));

        const grad = ctx.createRadialGradient(curX, curY, 0, curX, curY, curRadius);
        grad.addColorStop(0, node.color);
        grad.addColorStop(0.6, node.color.replace(/[\d\.]+\)$/, '0.12)'));
        grad.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(curX, curY, curRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Ambient warm silk glow near cursor
      const mouseGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, width * 0.30);
      mouseGrad.addColorStop(0, 'rgba(245, 158, 11, 0.12)');
      mouseGrad.addColorStop(0.5, 'rgba(192, 132, 252, 0.06)');
      mouseGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = mouseGrad;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, width * 0.30, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Subtle luxury wireframe overlay
      ctx.save();
      ctx.strokeStyle = 'rgba(147, 51, 234, 0.05)';
      ctx.lineWidth = 0.75;

      const cols = 16;
      const rows = 10;
      const stepX = width / cols;
      const stepY = height / rows;

      // Draw horizontal undulating lines (0.3x speed)
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        for (let c = 0; c <= cols; c++) {
          const px = c * stepX;
          const distMouse = Math.hypot(px - mouse.x, r * stepY - mouse.y);
          const mouseDisp = Math.max(0, 1 - distMouse / 350) * 12;
          const py = r * stepY + Math.sin(time * 0.8 + c * 0.35 + r * 0.25) * 5 - mouseDisp;

          if (c === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Draw vertical undulating lines
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        for (let r = 0; r <= rows; r++) {
          const px = c * stepX + Math.cos(time * 0.7 + r * 0.3 + c * 0.2) * 4;
          const distMouse = Math.hypot(c * stepX - mouse.x, r * stepY - mouse.y);
          const mouseDisp = Math.max(0, 1 - distMouse / 350) * 12;
          const py = r * stepY - mouseDisp;

          if (r === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      ctx.restore();

      animId = requestAnimationFrame(drawMeshGradient);
    }

    drawMeshGradient();

    // Pulsing Border Canvas at bottom right
    const pulseCanvas = document.getElementById('pulse-border-canvas');
    if (pulseCanvas) {
      const pCtx = pulseCanvas.getContext('2d');
      const pSize = 70;
      pulseCanvas.width = pSize;
      pulseCanvas.height = pSize;
      let pTime = 0;

      const pulseColors = ['#7E22CE', '#A855F7', '#F59E0B', '#EC4899', '#C084FC', '#FBBF24'];

      function drawPulsingBorder() {
        pTime += 0.015;
        pCtx.clearRect(0, 0, pSize, pSize);

        const cx = pSize / 2;
        const cy = pSize / 2;
        const radius = pSize * 0.38;

        for (let i = 0; i < pulseColors.length; i++) {
          const angle = (pTime + (i * Math.PI * 2) / pulseColors.length);
          const spotX = cx + Math.cos(angle) * (radius * (0.8 + 0.2 * Math.sin(pTime * 1.5 + i)));
          const spotY = cy + Math.sin(angle) * (radius * (0.8 + 0.2 * Math.sin(pTime * 1.5 + i)));

          const grad = pCtx.createRadialGradient(spotX, spotY, 0, spotX, spotY, 16);
          grad.addColorStop(0, pulseColors[i]);
          grad.addColorStop(1, 'rgba(255,255,255,0)');

          pCtx.fillStyle = grad;
          pCtx.beginPath();
          pCtx.arc(spotX, spotY, 16, 0, Math.PI * 2);
          pCtx.fill();
        }

        // Inner mask
        pCtx.save();
        pCtx.globalCompositeOperation = 'destination-out';
        pCtx.beginPath();
        pCtx.arc(cx, cy, radius * 0.65, 0, Math.PI * 2);
        pCtx.fill();
        pCtx.restore();

        requestAnimationFrame(drawPulsingBorder);
      }
      drawPulsingBorder();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShader);
  } else {
    initShader();
  }
})();
