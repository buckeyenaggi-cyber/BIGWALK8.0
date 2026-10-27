// 小球和摆锤的运动放在这里，距离用米，时间用秒
(function (root) {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // 只看松手前这一小段，不然瞄得越久反而扔得越轻
  function gestureSpeed(samples, now, height) {
    if (samples.length < 2 || height <= 0) return 0;
    const end = samples[samples.length - 1], cutoff = now - 160;
    if (end.t <= cutoff) return 0;
    let start = samples[0];
    for (let i = 1; i < samples.length; i++) {
      const next = samples[i];
      if (next.t > cutoff) {
        if (start.t < cutoff) {
          const f = (cutoff - start.t) / (next.t - start.t);
          start = { x: start.x + (next.x - start.x) * f, y: start.y + (next.y - start.y) * f, t: cutoff };
        }
        break;
      }
      start = next;
    }
    return clamp(Math.hypot(end.x - start.x, end.y - start.y) / height / .16, 0, 4);
  }
  function launch(origin, target, duration, gravity = 5.4) {
    return {
      x: origin.x, y: origin.y, z: origin.z,
      vx: (target.x - origin.x) / duration,
      vy: (target.y - origin.y + .5 * gravity * duration * duration) / duration,
      vz: (target.z - origin.z) / duration,
      gravity
    };
  }
  function step(body, dt) {
    body.x += body.vx * dt;
    body.y += body.vy * dt - .5 * body.gravity * dt * dt;
    body.z += body.vz * dt;
    body.vy -= body.gravity * dt;
    return body;
  }
  function arc(body, t) {
    return { x: body.x + body.vx * t, y: body.y + body.vy * t - .5 * body.gravity * t * t, z: body.z + body.vz * t };
  }
  // 穿环判定用 AI 帮忙拆了一下，帧数低也不能漏掉飞过去的球
  function crossing(previous, next, oldRing, ring, radius, tube, ballRadius) {
    if (previous.z * next.z > 0 || Math.abs(next.z - previous.z) < 1e-8) return null;
    const fraction = -previous.z / (next.z - previous.z);
    if (fraction < 0 || fraction > 1) return null;
    const x = previous.x + (next.x - previous.x) * fraction;
    const y = previous.y + (next.y - previous.y) * fraction;
    const cx = oldRing.x + (ring.x - oldRing.x) * fraction;
    const cy = oldRing.y + (ring.y - oldRing.y) * fraction;
    const clearance = radius - tube - ballRadius;
    return { x, y, z: 0, dx: x - cx, dy: y - cy, hit: Math.hypot(x - cx, y - cy) <= clearance };
  }
  // 擦边就弹开，不能碰一下也算投进了
  function collideRim(body, ring, radius, tube, ballRadius) {
    const dx = body.x - ring.x, dy = body.y - ring.y, radial = Math.hypot(dx, dy);
    if (radial < 1e-7) return false;
    const qx = ring.x + dx / radial * radius, qy = ring.y + dy / radial * radius;
    let nx = body.x - qx, ny = body.y - qy, nz = body.z;
    const distance = Math.hypot(nx, ny, nz), limit = tube + ballRadius;
    if (distance >= limit || distance < 1e-7) return false;
    nx /= distance; ny /= distance; nz /= distance;
    body.x = qx + nx * limit; body.y = qy + ny * limit; body.z = nz * limit;
    const dot = body.vx * nx + body.vy * ny + body.vz * nz;
    if (dot < 0) { body.vx -= 1.6 * dot * nx; body.vy -= 1.6 * dot * ny; body.vz -= 1.6 * dot * nz; }
    return true;
  }
  // 想让圆环有一点弹性，碰到后晃一下再慢慢停住
  function spring(state, dt, frequency = 2.6, damping = .62) {
    const omega = Math.PI * 2 * frequency, decay = omega * damping;
    const wd = omega * Math.sqrt(1 - damping * damping), t = Math.max(0, dt);
    const e = Math.exp(-decay * t), c = Math.cos(wd * t), s = Math.sin(wd * t);
    return { x: e * (state.x * c + (state.v + decay * state.x) / wd * s), v: e * (state.v * c - (decay * state.v + omega * omega * state.x) / wd * s) };
  }
  // 松手以后才让摆锤自己摆，拖着碰铃铛不算完成
  function pendulum(state, dt, length = 1.15) {
    const result = { ...state }, steps = Math.max(1, Math.ceil(dt / .006)), step = dt / steps;
    for (let i = 0; i < steps; i++) {
      result.v += (-5.4 / length * Math.sin(result.angle) - .18 * result.v) * step;
      result.angle += result.v * step;
      if (Math.abs(result.angle) > 1.12) { result.angle = clamp(result.angle, -1.12, 1.12); result.v *= -.5; }
    }
    return result;
  }
  const api = { clamp, gestureSpeed, launch, step, arc, crossing, collideRim, spring, pendulum };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BeaconPhysics = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
