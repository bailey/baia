// TouchTexture class
class TouchTexture {
  constructor() {
    this.size = 64;
    this.width = this.height = this.size;
    this.maxAge = 64;
    this.radius = 0.25 * this.size;
    this.speed = 1 / this.maxAge;
    this.trail = [];
    this.last = null;
    this.initTexture();
  }

  initTexture() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext("2d");
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.texture = new THREE.Texture(this.canvas);
  }

  update() {
    this.clear();
    let speed = this.speed;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const point = this.trail[i];
      let f = point.force * speed * (1 - point.age / this.maxAge);
      point.x += point.vx * f;
      point.y += point.vy * f;
      point.age++;
      if (point.age > this.maxAge) {
        this.trail.splice(i, 1);
      } else {
        this.drawPoint(point);
      }
    }
    this.texture.needsUpdate = true;
  }

  clear() {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  addTouch(point) {
    let force = 0;
    let vx = 0;
    let vy = 0;
    const last = this.last;
    if (last) {
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      if (dx === 0 && dy === 0) return;
      const dd = dx * dx + dy * dy;
      let d = Math.sqrt(dd);
      vx = dx / d;
      vy = dy / d;
      force = Math.min(dd * 20000, 2.0);
    }
    this.last = { x: point.x, y: point.y };
    this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
  }

  drawPoint(point) {
    const pos = {
      x: point.x * this.width,
      y: (1 - point.y) * this.height
    };

    let intensity = 1;
    if (point.age < this.maxAge * 0.3) {
      intensity = Math.sin((point.age / (this.maxAge * 0.3)) * (Math.PI / 2));
    } else {
      const t = 1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7);
      intensity = -t * (t - 2);
    }
    intensity *= point.force;

    const radius = this.radius;
    let color = `${((point.vx + 1) / 2) * 255}, ${
      ((point.vy + 1) / 2) * 255
    }, ${intensity * 255}`;
    let offset = this.size * 5;
    this.ctx.shadowOffsetX = offset;
    this.ctx.shadowOffsetY = offset;
    this.ctx.shadowBlur = radius * 1;
    this.ctx.shadowColor = `rgba(${color},${0.2 * intensity})`;

    this.ctx.beginPath();
    this.ctx.fillStyle = "rgba(255,0,0,1)";
    this.ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

// GradientBackground class
class GradientBackground {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.mesh = null;
    this.uniforms = {
      uTime: { value: 0 },
      uResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight)
      },
      uColor1: { value: new THREE.Vector3(0.945, 0.353, 0.133) },
      uColor2: { value: new THREE.Vector3(0.039, 0.055, 0.153) },
      uColor3: { value: new THREE.Vector3(0.945, 0.353, 0.133) },
      uColor4: { value: new THREE.Vector3(0.039, 0.055, 0.153) },
      uColor5: { value: new THREE.Vector3(0.945, 0.353, 0.133) },
      uColor6: { value: new THREE.Vector3(0.039, 0.055, 0.153) },
      uSpeed: { value: 1.2 },
      uIntensity: { value: 1.8 },
      uTouchTexture: { value: null },
      uGrainIntensity: { value: 0.08 },
      uZoom: { value: 1.0 },
      uDarkNavy: { value: new THREE.Vector3(0.039, 0.055, 0.153) },
      uGradientSize: { value: 1.0 },
      uGradientCount: { value: 6.0 },
      uColor1Weight: { value: 1.0 },
      uColor2Weight: { value: 1.0 }
    };
  }

  init() {
    const viewSize = this.sceneManager.getViewSize();
    const geometry = new THREE.PlaneGeometry(
      viewSize.width,
      viewSize.height,
      1,
      1
    );

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
            varying vec2 vUv;
            void main() {
              vec3 pos = position.xyz;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
              vUv = uv;
            }
          `,
      fragmentShader: `
            uniform float uTime;
            uniform vec2 uResolution;
            uniform vec3 uColor1;
            uniform vec3 uColor2;
            uniform vec3 uColor3;
            uniform vec3 uColor4;
            uniform vec3 uColor5;
            uniform vec3 uColor6;
            uniform float uSpeed;
            uniform float uIntensity;
            uniform sampler2D uTouchTexture;
            uniform float uGrainIntensity;
            uniform float uZoom;
            uniform vec3 uDarkNavy;
            uniform float uGradientSize;
            uniform float uGradientCount;
            uniform float uColor1Weight;
            uniform float uColor2Weight;
            
            varying vec2 vUv;
            
            #define PI 3.14159265359
            
            float grain(vec2 uv, float time) {
              vec2 grainUv = uv * uResolution * 0.5;
              float grainValue = fract(sin(dot(grainUv + time, vec2(12.9898, 78.233))) * 43758.5453);
              return grainValue * 2.0 - 1.0;
            }
            
            vec3 getGradientColor(vec2 uv, float time) {
              float gradientRadius = uGradientSize;
              
              vec2 center1 = vec2(
                0.5 + sin(time * uSpeed * 0.4) * 0.4,
                0.5 + cos(time * uSpeed * 0.5) * 0.4
              );
              vec2 center2 = vec2(
                0.5 + cos(time * uSpeed * 0.6) * 0.5,
                0.5 + sin(time * uSpeed * 0.45) * 0.5
              );
              vec2 center3 = vec2(
                0.5 + sin(time * uSpeed * 0.35) * 0.45,
                0.5 + cos(time * uSpeed * 0.55) * 0.45
              );
              vec2 center4 = vec2(
                0.5 + cos(time * uSpeed * 0.5) * 0.4,
                0.5 + sin(time * uSpeed * 0.4) * 0.4
              );
              vec2 center5 = vec2(
                0.5 + sin(time * uSpeed * 0.7) * 0.35,
                0.5 + cos(time * uSpeed * 0.6) * 0.35
              );
              vec2 center6 = vec2(
                0.5 + cos(time * uSpeed * 0.45) * 0.5,
                0.5 + sin(time * uSpeed * 0.65) * 0.5
              );
              
              vec2 center7 = vec2(
                0.5 + sin(time * uSpeed * 0.55) * 0.38,
                0.5 + cos(time * uSpeed * 0.48) * 0.42
              );
              vec2 center8 = vec2(
                0.5 + cos(time * uSpeed * 0.65) * 0.36,
                0.5 + sin(time * uSpeed * 0.52) * 0.44
              );
              vec2 center9 = vec2(
                0.5 + sin(time * uSpeed * 0.42) * 0.41,
                0.5 + cos(time * uSpeed * 0.58) * 0.39
              );
              vec2 center10 = vec2(
                0.5 + cos(time * uSpeed * 0.48) * 0.37,
                0.5 + sin(time * uSpeed * 0.62) * 0.43
              );
              vec2 center11 = vec2(
                0.5 + sin(time * uSpeed * 0.68) * 0.33,
                0.5 + cos(time * uSpeed * 0.44) * 0.46
              );
              vec2 center12 = vec2(
                0.5 + cos(time * uSpeed * 0.38) * 0.39,
                0.5 + sin(time * uSpeed * 0.56) * 0.41
              );
              
              float dist1 = length(uv - center1);
              float dist2 = length(uv - center2);
              float dist3 = length(uv - center3);
              float dist4 = length(uv - center4);
              float dist5 = length(uv - center5);
              float dist6 = length(uv - center6);
              float dist7 = length(uv - center7);
              float dist8 = length(uv - center8);
              float dist9 = length(uv - center9);
              float dist10 = length(uv - center10);
              float dist11 = length(uv - center11);
              float dist12 = length(uv - center12);
              
              float influence1 = 1.0 - smoothstep(0.0, gradientRadius, dist1);
              float influence2 = 1.0 - smoothstep(0.0, gradientRadius, dist2);
              float influence3 = 1.0 - smoothstep(0.0, gradientRadius, dist3);
              float influence4 = 1.0 - smoothstep(0.0, gradientRadius, dist4);
              float influence5 = 1.0 - smoothstep(0.0, gradientRadius, dist5);
              float influence6 = 1.0 - smoothstep(0.0, gradientRadius, dist6);
              float influence7 = 1.0 - smoothstep(0.0, gradientRadius, dist7);
              float influence8 = 1.0 - smoothstep(0.0, gradientRadius, dist8);
              float influence9 = 1.0 - smoothstep(0.0, gradientRadius, dist9);
              float influence10 = 1.0 - smoothstep(0.0, gradientRadius, dist10);
              float influence11 = 1.0 - smoothstep(0.0, gradientRadius, dist11);
              float influence12 = 1.0 - smoothstep(0.0, gradientRadius, dist12);
              
              vec2 rotatedUv1 = uv - 0.5;
              float angle1 = time * uSpeed * 0.15;
              rotatedUv1 = vec2(
                rotatedUv1.x * cos(angle1) - rotatedUv1.y * sin(angle1),
                rotatedUv1.x * sin(angle1) + rotatedUv1.y * cos(angle1)
              );
              rotatedUv1 += 0.5;
              
              vec2 rotatedUv2 = uv - 0.5;
              float angle2 = -time * uSpeed * 0.12;
              rotatedUv2 = vec2(
                rotatedUv2.x * cos(angle2) - rotatedUv2.y * sin(angle2),
                rotatedUv2.x * sin(angle2) + rotatedUv2.y * cos(angle2)
              );
              rotatedUv2 += 0.5;
              
              float radialGradient1 = length(rotatedUv1 - 0.5);
              float radialGradient2 = length(rotatedUv2 - 0.5);
              float radialInfluence1 = 1.0 - smoothstep(0.0, 0.8, radialGradient1);
              float radialInfluence2 = 1.0 - smoothstep(0.0, 0.8, radialGradient2);
              
              vec3 color = vec3(0.0);
              color += uColor1 * influence1 * (0.55 + 0.45 * sin(time * uSpeed)) * uColor1Weight;
              color += uColor2 * influence2 * (0.55 + 0.45 * cos(time * uSpeed * 1.2)) * uColor2Weight;
              color += uColor3 * influence3 * (0.55 + 0.45 * sin(time * uSpeed * 0.8)) * uColor1Weight;
              color += uColor4 * influence4 * (0.55 + 0.45 * cos(time * uSpeed * 1.3)) * uColor2Weight;
              color += uColor5 * influence5 * (0.55 + 0.45 * sin(time * uSpeed * 1.1)) * uColor1Weight;
              color += uColor6 * influence6 * (0.55 + 0.45 * cos(time * uSpeed * 0.9)) * uColor2Weight;
              
              if (uGradientCount > 6.0) {
                color += uColor1 * influence7 * (0.55 + 0.45 * sin(time * uSpeed * 1.4)) * uColor1Weight;
                color += uColor2 * influence8 * (0.55 + 0.45 * cos(time * uSpeed * 1.5)) * uColor2Weight;
                color += uColor3 * influence9 * (0.55 + 0.45 * sin(time * uSpeed * 1.6)) * uColor1Weight;
                color += uColor4 * influence10 * (0.55 + 0.45 * cos(time * uSpeed * 1.7)) * uColor2Weight;
              }
              if (uGradientCount > 10.0) {
                color += uColor5 * influence11 * (0.55 + 0.45 * sin(time * uSpeed * 1.8)) * uColor1Weight;
                color += uColor6 * influence12 * (0.55 + 0.45 * cos(time * uSpeed * 1.9)) * uColor2Weight;
              }
              
              color += mix(uColor1, uColor3, radialInfluence1) * 0.45 * uColor1Weight;
              color += mix(uColor2, uColor4, radialInfluence2) * 0.4 * uColor2Weight;
              
              color = clamp(color, vec3(0.0), vec3(1.0)) * uIntensity;
              
              float luminance = dot(color, vec3(0.299, 0.587, 0.114));
              color = mix(vec3(luminance), color, 1.35);
              
              color = pow(color, vec3(0.92));
              
              float brightness1 = length(color);
              float mixFactor1 = max(brightness1 * 1.2, 0.15);
              color = mix(uDarkNavy, color, mixFactor1);
              
              float maxBrightness = 1.0;
              float brightness = length(color);
              if (brightness > maxBrightness) {
                color = color * (maxBrightness / brightness);
              }
              
              return color;
            }
            
            void main() {
              vec2 uv = vUv;
              
              vec4 touchTex = texture2D(uTouchTexture, uv);
              float vx = -(touchTex.r * 2.0 - 1.0);
              float vy = -(touchTex.g * 2.0 - 1.0);
              float intensity = touchTex.b;
              uv.x += vx * 0.8 * intensity;
              uv.y += vy * 0.8 * intensity;
              
              vec2 center = vec2(0.5);
              float dist = length(uv - center);
              float ripple = sin(dist * 20.0 - uTime * 3.0) * 0.04 * intensity;
              float wave = sin(dist * 15.0 - uTime * 2.0) * 0.03 * intensity;
              uv += vec2(ripple + wave);
              
              vec3 color = getGradientColor(uv, uTime);
              
              float grainValue = grain(uv, uTime);
              color += grainValue * uGrainIntensity;
              
              float timeShift = uTime * 0.5;
              color.r += sin(timeShift) * 0.02;
              color.g += cos(timeShift * 1.4) * 0.02;
              color.b += sin(timeShift * 1.2) * 0.02;
              
              float brightness2 = length(color);
              float mixFactor2 = max(brightness2 * 1.2, 0.15);
              color = mix(uDarkNavy, color, mixFactor2);
              
              color = clamp(color, vec3(0.0), vec3(1.0));
              
              float maxBrightness = 1.0;
              float brightness = length(color);
              if (brightness > maxBrightness) {
                color = color * (maxBrightness / brightness);
              }
              
              gl_FragColor = vec4(color, 1.0);
            }
          `
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.z = 0;
    this.sceneManager.scene.add(this.mesh);
  }

  update(delta) {
    if (this.uniforms.uTime) {
      this.uniforms.uTime.value += delta;
    }
  }

  onResize(width, height) {
    const viewSize = this.sceneManager.getViewSize();
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.PlaneGeometry(
        viewSize.width,
        viewSize.height,
        1,
        1
      );
    }
    if (this.uniforms.uResolution) {
      this.uniforms.uResolution.value.set(width, height);
    }
  }
}

// App class
class App {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
      stencil: false,
      depth: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setAnimationLoop(null);
    document.body.appendChild(this.renderer.domElement);
    this.renderer.domElement.id = "webGLApp";
    this.renderer.domElement.style.pointerEvents = "none";

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );
    this.camera.position.z = 50;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e27);
    this.clock = new THREE.Clock();

    this.touchTexture = new TouchTexture();
    this.gradientBackground = new GradientBackground(this);
    this.gradientBackground.uniforms.uTouchTexture.value = this.touchTexture.texture;

    this.colorSchemes = {
      1: {
        color1: new THREE.Vector3(0.945, 0.353, 0.133),
        color2: new THREE.Vector3(0.039, 0.055, 0.153)
      },
      2: {
        color1: new THREE.Vector3(1.0, 0.424, 0.314),
        color2: new THREE.Vector3(0.251, 0.878, 0.816)
      },
      3: {
        color1: new THREE.Vector3(0.945, 0.353, 0.133),
        color2: new THREE.Vector3(0.039, 0.055, 0.153),
        color3: new THREE.Vector3(0.251, 0.878, 0.816)
      },
      4: {
        color1: new THREE.Vector3(0.949, 0.4, 0.2),
        color2: new THREE.Vector3(0.176, 0.42, 0.427),
        color3: new THREE.Vector3(0.82, 0.686, 0.612)
      },
      5: {
        color1: new THREE.Vector3(0.945, 0.353, 0.133),
        color2: new THREE.Vector3(0.0, 0.259, 0.22),
        color3: new THREE.Vector3(0.945, 0.353, 0.133),
        color4: new THREE.Vector3(0.0, 0.0, 0.0),
        color5: new THREE.Vector3(0.945, 0.353, 0.133),
        color6: new THREE.Vector3(0.0, 0.0, 0.0)
      }
    };
    this.currentScheme = 1;

    this.init();
  }

  setColorScheme(scheme) {
    if (!this.colorSchemes[scheme]) return;
    this.currentScheme = scheme;
    const colors = this.colorSchemes[scheme];
    const uniforms = this.gradientBackground.uniforms;

    if (scheme === 3) {
      uniforms.uColor1.value.copy(colors.color1);
      uniforms.uColor2.value.copy(colors.color2);
      uniforms.uColor3.value.copy(colors.color3);
      uniforms.uColor4.value.copy(colors.color1);
      uniforms.uColor5.value.copy(colors.color2);
      uniforms.uColor6.value.copy(colors.color3);
    } else if (scheme === 4) {
      uniforms.uColor1.value.copy(colors.color1);
      uniforms.uColor2.value.copy(colors.color2);
      uniforms.uColor3.value.copy(colors.color3);
      uniforms.uColor4.value.copy(colors.color1);
      uniforms.uColor5.value.copy(colors.color2);
      uniforms.uColor6.value.copy(colors.color3);
    } else if (scheme === 5) {
      uniforms.uColor1.value.copy(colors.color1);
      uniforms.uColor2.value.copy(colors.color2);
      uniforms.uColor3.value.copy(colors.color3);
      uniforms.uColor4.value.copy(colors.color4);
      uniforms.uColor5.value.copy(colors.color5);
      uniforms.uColor6.value.copy(colors.color6);
    } else {
      uniforms.uColor1.value.copy(colors.color1);
      uniforms.uColor2.value.copy(colors.color2);
      uniforms.uColor3.value.copy(colors.color1);
      uniforms.uColor4.value.copy(colors.color2);
      uniforms.uColor5.value.copy(colors.color1);
      uniforms.uColor6.value.copy(colors.color2);
    }

    if (scheme === 1) {
      this.scene.background = new THREE.Color(0x0a0e27);
      uniforms.uDarkNavy.value.set(0.039, 0.055, 0.153);
      uniforms.uGradientSize.value = 0.45;
      uniforms.uGradientCount.value = 12.0;
      uniforms.uSpeed.value = 1.5;
      uniforms.uColor1Weight.value = 0.5;
      uniforms.uColor2Weight.value = 1.8;
    } else if (scheme === 2) {
      this.scene.background = new THREE.Color(0x0a0e27);
      uniforms.uDarkNavy.value.set(0.039, 0.055, 0.153);
      uniforms.uGradientSize.value = 1.0;
      uniforms.uGradientCount.value = 6.0;
      uniforms.uSpeed.value = 1.2;
      uniforms.uColor1Weight.value = 1.0;
      uniforms.uColor2Weight.value = 1.0;
    } else {
      this.scene.background = new THREE.Color(0x0a0e27);
      uniforms.uDarkNavy.value.set(0.039, 0.055, 0.153);
      uniforms.uGradientSize.value = 1.0;
      uniforms.uGradientCount.value = 6.0;
      uniforms.uSpeed.value = 1.2;
      uniforms.uColor1Weight.value = 1.0;
      uniforms.uColor2Weight.value = 1.0;
    }
  }

  init() {
    this.gradientBackground.init();
    this.setColorScheme(1);

    this.render();
    this.tick();

    window.addEventListener("resize", () => this.onResize());
    window.addEventListener("mousemove", (ev) => this.onMouseMove(ev));
    window.addEventListener("touchmove", (ev) => this.onTouchMove(ev));

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.render();
      }
    });

    const wakeUpAnimation = () => {
      this.render();
      window.removeEventListener("click", wakeUpAnimation);
      window.removeEventListener("touchstart", wakeUpAnimation);
      window.removeEventListener("mousemove", wakeUpAnimation);
    };
    window.addEventListener("click", wakeUpAnimation, { once: true });
    window.addEventListener("touchstart", wakeUpAnimation, { once: true });
    window.addEventListener("mousemove", wakeUpAnimation, { once: true });
  }

  onTouchMove(ev) {
    const touch = ev.touches[0];
    this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
  }

  onMouseMove(ev) {
    this.mouse = {
      x: ev.clientX / window.innerWidth,
      y: 1 - ev.clientY / window.innerHeight
    };
    this.touchTexture.addTouch(this.mouse);
  }

  getViewSize() {
    const fovInRadians = (this.camera.fov * Math.PI) / 180;
    const height = Math.abs(
      this.camera.position.z * Math.tan(fovInRadians / 2) * 2
    );
    return { width: height * this.camera.aspect, height };
  }

  update(delta) {
    this.touchTexture.update();
    this.gradientBackground.update(delta);
  }

  render() {
    const delta = this.clock.getDelta();
    const clampedDelta = Math.min(delta, 0.1);
    this.renderer.render(this.scene, this.camera);
    this.update(clampedDelta);
  }

  tick() {
    this.render();
    requestAnimationFrame(() => this.tick());
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.gradientBackground.onResize(window.innerWidth, window.innerHeight);
  }
}

// Start the app
const app = new App();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    app.render();
  });
} else {
  setTimeout(() => app.render(), 0);
}

// GameShelf nav link: animated navigation on plain left-click only
const gameshelfLink = document.getElementById("gameshelfLink");
const gameshelfTransition = document.getElementById("gameshelfTransition");

if (gameshelfLink && gameshelfTransition) {
  gameshelfLink.addEventListener("click", (e) => {
    // Let modified clicks / middle-click / etc. behave like a normal <a>
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) {
      return;
    }

    e.preventDefault();
    const destination = gameshelfLink.href;

    // Iris grows from wherever the link actually sits (varies by page/line)
    const rect = gameshelfLink.getBoundingClientRect();
    const originX = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
    const originY = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
    gameshelfTransition.style.setProperty("--iris-x", `${originX.toFixed(2)}%`);
    gameshelfTransition.style.setProperty("--iris-y", `${originY.toFixed(2)}%`);

    let navigated = false;
    const goToGameshelf = () => {
      if (navigated) return;
      navigated = true;
      window.location.href = destination;
    };

    gameshelfLink.classList.add("is-leaving");
    gameshelfTransition.classList.add("is-active");
    document.body.classList.add("is-navigating");

    gameshelfTransition.addEventListener("transitionend", goToGameshelf, {
      once: true,
    });

    // Fallback in case the transition never fires
    setTimeout(goToGameshelf, 600);
  });
}

// OS shell: desktop icons open a single floating window
const osDesktopIcons = document.querySelectorAll(".os-icon[data-window]");
const osWindow = document.getElementById("osWindow");
const osWindowTitle = document.getElementById("osWindowTitle");
const osWindowClose = document.getElementById("osWindowClose");
const osWindowMinimize = document.getElementById("osWindowMinimize");
const osWindowExpand = document.getElementById("osWindowExpand");
const osTaskbarChip = document.getElementById("osTaskbarChip");
const osViews = document.querySelectorAll(".os-view");

const osWindowTitles = {
  home: "ABOUT.TXT",
  projects: "PROJECTS.SYS",
  resume: "RESUME.SYS",
  pong: "PONG.EXE",
  thewall: "THE WALL.EXE",
};

function openOsWindow(name) {
  osViews.forEach((view) =>
    view.classList.toggle("is-active", view.id === `view-${name}`)
  );
  osDesktopIcons.forEach((i) =>
    i.classList.toggle("is-active", i.getAttribute("data-window") === name)
  );
  osWindowTitle.textContent = `BAILEY // ${osWindowTitles[name] || "OS 2.0"}`;
  osWindow.classList.add("is-open");
  if (osTaskbarChip) {
    osTaskbarChip.textContent = osWindowTitles[name] || name.toUpperCase();
    osTaskbarChip.hidden = false;
  }
}

function closeOsWindow() {
  osWindow.classList.remove("is-open");
  osDesktopIcons.forEach((i) => i.classList.remove("is-active"));
  if (osTaskbarChip) osTaskbarChip.hidden = true;
}

// real minimize, now gated behind the genie's "Yes, Mr. Genie." dialogue choice
function minimizeOsWindow() {
  if (!osWindow.classList.contains("is-open")) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    closeOsWindow();
    return;
  }

  osWindow.classList.add("is-minimizing");
  osWindow.addEventListener(
    "animationend",
    () => {
      osWindow.classList.remove("is-open", "is-minimizing");
      osDesktopIcons.forEach((i) => i.classList.remove("is-active"));
      if (osTaskbarChip) osTaskbarChip.hidden = true;
    },
    { once: true }
  );
}

if (osDesktopIcons.length && osWindow) {
  osDesktopIcons.forEach((icon) => {
    icon.addEventListener("click", () => {
      const target = icon.getAttribute("data-window");
      const alreadyOpenOnThis =
        osWindow.classList.contains("is-open") &&
        icon.classList.contains("is-active");
      if (alreadyOpenOnThis) {
        closeOsWindow();
      } else {
        openOsWindow(target);
      }
    });
  });

  if (osWindowClose) {
    osWindowClose.addEventListener("click", closeOsWindow);
  }
  if (osWindowMinimize) {
    osWindowMinimize.addEventListener("click", triggerGenieEasterEgg);
  }
  if (osWindowExpand) {
    osWindowExpand.addEventListener("click", () => triggerGlitchEasterEgg(osWindowExpand));
  }
}

// titlebar easter egg: minimize summons a genie who immediately has second thoughts
const osGenieOverlay = document.getElementById("osGenieOverlay");
const osGenieBottle = document.getElementById("osGenieBottle");
const osGenieFigure = document.getElementById("osGenieFigure");
const osGenieDialogue = document.getElementById("osGenieDialogue");
const osGenieLine = document.getElementById("osGenieLine");
const osGenieChoiceYes = document.getElementById("osGenieChoiceYes");
const osGenieChoiceNo = document.getElementById("osGenieChoiceNo");
let genieRunning = false;
let genieDismissTimeout = null;

function spawnGenieSparkles(x, y) {
  const layer = document.getElementById("cursorTrailLayer");
  if (!layer) return;
  for (let i = 0; i < 14; i++) {
    const el = document.createElement("span");
    el.textContent = Math.random() < 0.5 ? "✦" : "•";
    el.style.position = "absolute";
    el.style.left = "0";
    el.style.top = "0";
    el.style.color = "#7ee8ff";
    el.style.fontSize = `${10 + Math.random() * 10}px`;
    el.style.textShadow = "0 0 8px rgba(126,232,255,0.9)";
    layer.appendChild(el);

    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 60;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;

    const anim = el.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(0.6)`, opacity: 1 },
        { transform: `translate(${x + dx}px, ${y + dy}px) scale(1.1)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 300, easing: "ease-out", fill: "forwards" }
    );
    anim.onfinish = () => el.remove();
  }
}

function triggerGenieEasterEgg() {
  if (!osGenieOverlay || genieRunning) return;
  genieRunning = true;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    showOsModal(
      "THE GENIE",
      "You sure about that?\n\n> Yes, Mr. Genie. (minimizes the window)\n> Wait, no— (nevermind)"
    );
    genieRunning = false;
    return;
  }

  // matches .os-genie-bottle's fixed right/bottom/size in index_style.css
  const cornerX = window.innerWidth - 94;
  const cornerY = window.innerHeight - 126;
  osGenieFigure.style.setProperty("--gx", `${cornerX - window.innerWidth / 2}px`);
  osGenieFigure.style.setProperty("--gy", `${cornerY - window.innerHeight / 2}px`);

  osGenieOverlay.classList.add("is-active");
  osGenieBottle.classList.add("is-visible");
  osGenieFigure.classList.add("is-visible");
  osGenieLine.textContent = "";
  osGenieDialogue.classList.remove("is-visible");

  spawnGenieSparkles(cornerX, cornerY);

  setTimeout(() => osGenieFigure.classList.add("is-centered"), 350);

  setTimeout(() => {
    osGenieLine.textContent = "You sure about that?";
    osGenieDialogue.classList.add("is-visible");
  }, 1100);

  // safety net: if she's ignored entirely, quietly dismiss with no side effects
  genieDismissTimeout = setTimeout(() => resolveGenie(false), 12000);
}

function resolveGenie(shouldMinimize) {
  if (!genieRunning) return;
  clearTimeout(genieDismissTimeout);

  osGenieDialogue.classList.remove("is-visible");
  osGenieFigure.classList.remove("is-centered", "is-visible");

  setTimeout(() => {
    osGenieBottle.classList.remove("is-visible");
    osGenieOverlay.classList.remove("is-active");
    genieRunning = false;
  }, 500);

  if (shouldMinimize) {
    minimizeOsWindow();
  }
}

if (osGenieChoiceYes) {
  osGenieChoiceYes.addEventListener("click", () => resolveGenie(true));
}
if (osGenieChoiceNo) {
  osGenieChoiceNo.addEventListener("click", () => resolveGenie(false));
}

// titlebar easter egg: expand triggers a glitchy square burst and a reality check
const osGlitchMessage = document.getElementById("osGlitchMessage");
let glitchRunning = false;

function triggerGlitchEasterEgg(originEl) {
  if (glitchRunning) return;
  glitchRunning = true;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    showOsModal("SYSTEM", "whoa there buddy, you're in a WEB BROWSER. relax.");
    glitchRunning = false;
    return;
  }

  const rect = originEl.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  const palette = ["#ff5f87", "#5eead4", "#ffd166", "#9d8cff", "#7cf29c", "#ff8b5e"];

  for (let i = 0; i < 18; i++) {
    const el = document.createElement("div");
    el.className = "os-glitch-square";
    const size = 10 + Math.random() * 14;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${originX}px`;
    el.style.top = `${originY}px`;
    el.style.background = palette[Math.floor(Math.random() * palette.length)];
    document.body.appendChild(el);

    const angle = Math.random() * Math.PI * 2;
    const dist = 120 + Math.random() * 420;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const spin = 180 + Math.random() * 180;
    const scale = 3 + Math.random() * 7;
    const duration = 420 + Math.random() * 260;

    const anim = el.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.4) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5}px)) scale(${scale * 0.6}) rotate(${spin}deg)`,
          opacity: 1,
          offset: 0.55,
        },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale}) rotate(${spin * 2}deg)`,
          opacity: 0,
        },
      ],
      { duration, easing: "steps(5, end)", fill: "forwards" }
    );
    anim.onfinish = () => el.remove();
  }

  setTimeout(() => {
    if (osGlitchMessage) osGlitchMessage.classList.add("is-visible");
  }, 180);
  setTimeout(() => {
    if (osGlitchMessage) osGlitchMessage.classList.remove("is-visible");
  }, 2756);
  setTimeout(() => {
    glitchRunning = false;
  }, 3006);
}

// OS shell: cursor-tracked 3d tilt on every icon (layers on top of the CSS orbit)
const osTiltIcons = document.querySelectorAll(".os-icon");
const osReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

osTiltIcons.forEach((icon) => {
  const inner = icon.querySelector(".os-icon-inner");
  if (!inner) return;

  icon.addEventListener("mousemove", (e) => {
    if (osReduceMotion.matches) return;
    const rect = icon.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    const maxTilt = 18;
    inner.style.transform = `rotateX(${(-py * maxTilt).toFixed(2)}deg) rotateY(${(px * maxTilt).toFixed(2)}deg)`;
  });

  icon.addEventListener("mouseleave", () => {
    inner.style.transform = "rotateX(0deg) rotateY(0deg)";
  });
});

// OS shell: taskbar clock
const osClock = document.getElementById("osClock");
if (osClock) {
  const updateClock = () => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    osClock.textContent = `${hours}:${minutes} ${ampm}`;
  };
  updateClock();
  setInterval(updateClock, 15000);
}

// ---------- taskbar: live "N ONLINE" presence tracker (Upstash Redis via /api/presence) ----------
const osOnlineCount = document.getElementById("osOnlineCount");
if (osOnlineCount) {
  const PRESENCE_ID_KEY = "bailey-presence-id";
  let presenceId = sessionStorage.getItem(PRESENCE_ID_KEY);
  if (!presenceId) {
    presenceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(PRESENCE_ID_KEY, presenceId);
  }

  async function sendPresenceHeartbeat() {
    try {
      const res = await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: presenceId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.count === "number") {
        osOnlineCount.textContent = data.count;
      }
    } catch (err) {
      // silently fail; keep last known count
    }
  }

  sendPresenceHeartbeat();
  setInterval(sendPresenceHeartbeat, 15000);

  window.addEventListener("pagehide", () => {
    if (!navigator.sendBeacon) return;
    navigator.sendBeacon(
      "/api/presence",
      new Blob([JSON.stringify({ id: presenceId, leaving: true })], { type: "application/json" })
    );
  });
}

// ---------- cursor system: 5 selectable modes, persisted, default "rainbow" ----------
const cursorTrailLayer = document.getElementById("cursorTrailLayer");

if (cursorTrailLayer) {
  const CURSOR_MODES = ["arrow", "sparkle", "rainbow", "floppy", "star"];
  const CURSOR_STORAGE_KEY = "bailey-cursor-mode";
  let currentCursorMode =
    localStorage.getItem(CURSOR_STORAGE_KEY) &&
    CURSOR_MODES.includes(localStorage.getItem(CURSOR_STORAGE_KEY))
      ? localStorage.getItem(CURSOR_STORAGE_KEY)
      : "rainbow";

  const rainbowHues = [0, 45, 90, 160, 200, 260, 310];
  let rainbowIndex = 0;
  let lastTrailSpawn = 0;

  function applyCursorMode(mode) {
    CURSOR_MODES.forEach((m) => document.body.classList.remove(`cursor-${m}`));
    document.body.classList.add(`cursor-${mode}`);
    currentCursorMode = mode;
    localStorage.setItem(CURSOR_STORAGE_KEY, mode);

    document
      .querySelectorAll(".os-startmenu-item[data-cursor]")
      .forEach((btn) => {
        btn.classList.toggle(
          "is-selected",
          btn.getAttribute("data-cursor") === mode
        );
      });
  }

  function spawnParticle(x, y, kind) {
    const el = document.createElement("span");
    el.style.position = "absolute";
    el.style.left = "0";
    el.style.top = "0";

    if (kind === "sparkle") {
      el.textContent = "✦";
      el.style.color = "#ffd166";
      el.style.fontSize = "18px";
      el.style.textShadow = "0 0 6px rgba(255,209,102,0.8)";
    } else if (kind === "rainbow") {
      el.style.width = "10px";
      el.style.height = "10px";
      el.style.borderRadius = "50%";
      el.style.background = `hsl(${rainbowHues[rainbowIndex % rainbowHues.length]}, 90%, 65%)`;
      el.style.boxShadow = `0 0 8px hsl(${rainbowHues[rainbowIndex % rainbowHues.length]}, 90%, 65%)`;
      rainbowIndex++;
    } else if (kind === "burst") {
      el.textContent = "★";
      el.style.color = "#c97b5f";
      el.style.fontSize = "14px";
    }

    cursorTrailLayer.appendChild(el);

    const dx = (Math.random() - 0.5) * 30;
    const dy = kind === "burst" ? (Math.random() - 0.5) * 30 : 20 + Math.random() * 10;

    const anim = el.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 },
        {
          transform: `translate(${x + dx}px, ${y + dy}px) scale(0.4)`,
          opacity: 0,
        },
      ],
      { duration: 650, easing: "ease-out", fill: "forwards" }
    );

    anim.onfinish = () => el.remove();
  }

  document.addEventListener("mousemove", (e) => {
    if (osReduceMotion.matches) return;
    if (currentCursorMode !== "sparkle" && currentCursorMode !== "rainbow") return;
    const now = performance.now();
    if (now - lastTrailSpawn < 22) return;
    lastTrailSpawn = now;
    spawnParticle(e.clientX, e.clientY, currentCursorMode);
  });

  document.addEventListener("click", (e) => {
    if (osReduceMotion.matches) return;
    if (currentCursorMode !== "star") return;
    for (let i = 0; i < 5; i++) {
      spawnParticle(e.clientX, e.clientY, "burst");
    }
  });

  applyCursorMode(currentCursorMode);

  document.querySelectorAll(".os-startmenu-item[data-cursor]").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyCursorMode(btn.getAttribute("data-cursor"));
    });
  });
}

// ---------- start menu ----------
const osMenuButton = document.getElementById("osMenuButton");
const osStartMenu = document.getElementById("osStartMenu");

if (osMenuButton && osStartMenu) {
  osMenuButton.addEventListener("click", (e) => {
    e.stopPropagation();
    osStartMenu.classList.toggle("is-open");
    osMenuButton.classList.toggle("is-open", osStartMenu.classList.contains("is-open"));
  });

  document.addEventListener("click", (e) => {
    if (
      osStartMenu.classList.contains("is-open") &&
      !osStartMenu.contains(e.target) &&
      e.target !== osMenuButton
    ) {
      osStartMenu.classList.remove("is-open");
      osMenuButton.classList.remove("is-open");
    }
  });

  // nostalgia joke entries: a little wink, nothing more
  const startmenuJokeTitles = {
    solitaire: "SOLITAIRE.EXE",
    minesweeper: "MINESWEEPER.EXE",
  };

  const startmenuJokes = {
    solitaire: [
      "solitaire.exe has stopped responding.\n(as it should, it's 2001)",
      "You win! ...jk, the cards were never real.",
      "52 cards, 0 of them exist.",
      "This game requires Windows 98 or a time machine.",
    ],
    minesweeper: [
      "minesweeper.exe has stopped responding.\n(as it should, it's 2001)",
      "You clicked a mine. There were no mines. You still lost.",
      "Flag placed. Nothing happened. That's the game.",
      "Loading... loading... this is the whole game.",
    ],
  };

  // Programs launched from the start menu
  document.querySelectorAll(".os-startmenu-item[data-program]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const program = btn.getAttribute("data-program");
      osStartMenu.classList.remove("is-open");
      osMenuButton.classList.remove("is-open");

      if ((program === "pong" || program === "thewall") && typeof openOsWindow === "function") {
        openOsWindow(program);
      } else {
        const options = startmenuJokes[program] || [`${program}.exe has stopped responding.\n(as it should, it's 2001)`];
        const message = options[Math.floor(Math.random() * options.length)];
        showOsModal(startmenuJokeTitles[program] || "SYSTEM", message);
      }
    });
  });
}

// ---------- generic in-site modal (replaces browser alert() for menu-bar jokes) ----------
const osModal = document.getElementById("osModal");
const osModalTitle = document.getElementById("osModalTitle");
const osModalBody = document.getElementById("osModalBody");
const osModalClose = document.getElementById("osModalClose");

function showOsModal(title, body) {
  if (!osModal) return;
  osModalTitle.textContent = title;
  osModalBody.textContent = body;
  osModal.classList.add("is-open");
}

function hideOsModal() {
  if (!osModal) return;
  osModal.classList.remove("is-open");
}

if (osModal) {
  osModalClose.addEventListener("click", hideOsModal);
  osModal.addEventListener("click", (e) => {
    if (e.target === osModal) hideOsModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideOsModal();
  });
}

// ---------- top menu bar ----------
const osMenuBar = document.getElementById("osMenuBar");

if (osMenuBar) {
  const menubarItems = Array.from(osMenuBar.querySelectorAll(".os-menubar-item"));

  const closeAllMenubarItems = () => {
    menubarItems.forEach((item) => item.classList.remove("is-open"));
  };

  menubarItems.forEach((item) => {
    const label = item.querySelector(".os-menubar-label");

    label.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasOpen = item.classList.contains("is-open");
      closeAllMenubarItems();
      if (!wasOpen) item.classList.add("is-open");
    });

    item.addEventListener("mouseenter", () => {
      const anyOpen = menubarItems.some((i) => i.classList.contains("is-open"));
      if (anyOpen && !item.classList.contains("is-open")) {
        closeAllMenubarItems();
        item.classList.add("is-open");
      }
    });
  });

  document.addEventListener("click", (e) => {
    if (!osMenuBar.contains(e.target)) closeAllMenubarItems();
  });

  const menubarJokeTitles = {
    about: "ABOUT THIS SITE",
    cut: "EDIT > CUT",
    copy: "EDIT > COPY",
    paste: "EDIT > PASTE",
    help: "HELP",
  };

  const menubarJokes = {
    about: [
      "BAILEY // OS 2.0\n\nMemory: 640K (ought to be enough for anybody)\nBuilt with vanilla JS, spite, and a warm gradient.\n\nNot actually an operating system.",
    ],
    cut: [
      "Nothing selected. Nothing to cut.",
      "Cut? This isn't that kind of website.",
      "Cut into what, exactly?",
      "scissors.exe not found. Please insert scissors.",
    ],
    copy: [
      "Nothing selected. Nothing to copy.",
      "Copied 0 bytes to clipboard. Impressive, honestly.",
      "Ctrl+C on a static site? Bold move.",
      "There's nothing here, but I admire the effort.",
    ],
    paste: [
      "Clipboard is empty. It has always been empty.",
      "Pasting... pasting... still pasting... nope.",
      "Error 404: Clipboard not found.",
      "You can't paste feelings into a textarea.",
    ],
    help: [
      "You're on your own, unfortunately.",
      "Have you tried turning it off and on again?",
      "Documentation? In this economy?",
      "help.exe achieved sentience and left.",
    ],
  };

  osMenuBar.querySelectorAll("[data-joke]").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeAllMenubarItems();
      const key = btn.getAttribute("data-joke");
      const options = menubarJokes[key] || ["..."];
      const message = options[Math.floor(Math.random() * options.length)];
      showOsModal(menubarJokeTitles[key] || "SYSTEM", message);
    });
  });
}

// ---------- fake shutdown sequence (windows caption, early-mac happy-face icon) ----------
const osShutdownBtn = document.getElementById("osShutdownBtn");
const osShutdown = document.getElementById("osShutdown");
const osShutdownContent = document.getElementById("osShutdownContent");
const osBootflash = document.getElementById("osBootflash");
const osEasterEgg = document.getElementById("osEasterEgg");

if (osShutdownBtn && osShutdown && osShutdownContent) {
  let isShuttingDown = false;

  osShutdownBtn.addEventListener("click", () => {
    if (osStartMenu) osStartMenu.classList.remove("is-open");
    if (osMenuButton) osMenuButton.classList.remove("is-open");
    osShutdownContent.classList.remove("is-collapsing");
    osShutdown.classList.add("is-visible");
  });

  const dismissShutdown = () => {
    if (!osShutdown.classList.contains("is-visible") || isShuttingDown) return;
    isShuttingDown = true;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let poweredBackOn = false;
    const powerBackOn = () => {
      if (poweredBackOn) return;
      poweredBackOn = true;
      osShutdown.classList.remove("is-visible");
      osShutdownContent.classList.remove("is-collapsing");
      if (osBootflash && !prefersReducedMotion) {
        osBootflash.classList.add("is-active");
        setTimeout(() => osBootflash.classList.remove("is-active"), 520);
      }
      if (osEasterEgg) {
        const showDelay = prefersReducedMotion ? 100 : 550;
        setTimeout(() => {
          osEasterEgg.classList.add("is-active");
          setTimeout(() => osEasterEgg.classList.remove("is-active"), 3200);
        }, showDelay);
      }
      isShuttingDown = false;
    };

    if (prefersReducedMotion) {
      powerBackOn();
      return;
    }

    // classic CRT power-off: the picture collapses to a line, then a dot
    osShutdownContent.classList.add("is-collapsing");
    osShutdownContent.addEventListener("animationend", powerBackOn, {
      once: true,
    });

    // Fallback in case the animation never fires
    setTimeout(powerBackOn, 550);
  };

  osShutdown.addEventListener("click", dismissShutdown);
  document.addEventListener("keydown", (e) => {
    if (osShutdown.classList.contains("is-visible")) {
      e.preventDefault();
      dismissShutdown();
    }
  });
}

// ---------- thewall.exe: real message board (Upstash Redis via /api/messages) ----------
const wallFeed = document.getElementById("thewallFeed");
const wallForm = document.getElementById("thewallForm");
const wallView = document.getElementById("view-thewall");

if (wallFeed && wallForm && wallView) {
  const wallName = document.getElementById("thewallName");
  const wallMessage = document.getElementById("thewallMessage");
  const wallWebsite = document.getElementById("thewallWebsite");
  let knownIds = new Set();
  let hasLoadedOnce = false;

  function formatTime(ts) {
    const d = new Date(ts);
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  const wallAccents = ["#ff6ec7", "#5eead4", "#ffd166", "#9d8cff", "#7cf29c", "#ff8b5e"];
  function accentForName(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    return wallAccents[hash % wallAccents.length];
  }

  function renderMessages(messages) {
    if (!messages.length) {
      wallFeed.innerHTML = '<div class="os-thewall-empty">no messages yet — be the first to post</div>';
      return;
    }
    // feed is column-reverse, so newest-first array reads bottom-to-top visually
    wallFeed.innerHTML = messages
      .map((m) => {
        const name = m.name || "anonymous";
        return `
        <div class="os-thewall-entry" style="--wall-accent:${accentForName(name)}">
          <span class="os-thewall-entry-meta">${escapeHtml(name)}</span>
          <span class="os-thewall-entry-time">${formatTime(m.ts)}</span>
          <div class="os-thewall-entry-message">${escapeHtml(m.message)}</div>
        </div>`;
      })
      .join("");
  }

  async function fetchMessages() {
    try {
      const res = await fetch("/api/messages");
      if (!res.ok) return;
      const data = await res.json();
      const messages = data.messages || [];
      const ids = messages.map((m) => m.id).join(",");
      const currentIds = new Set(messages.map((m) => m.id));
      const isSame =
        currentIds.size === knownIds.size &&
        [...currentIds].every((id) => knownIds.has(id));

      if (!hasLoadedOnce || !isSame) {
        renderMessages(messages);
        knownIds = currentIds;
        hasLoadedOnce = true;
      }
      void ids;
    } catch (err) {
      if (!hasLoadedOnce) {
        wallFeed.innerHTML = '<div class="os-thewall-empty">couldn\'t reach the board — try again in a bit</div>';
      }
    }
  }

  wallForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = wallMessage.value.trim();
    if (!message) return;

    const submitBtn = wallForm.querySelector(".os-thewall-submit");
    submitBtn.disabled = true;

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: wallName.value.trim(),
          message,
          website: wallWebsite.value,
        }),
      });
      if (res.ok) {
        wallMessage.value = "";
        await fetchMessages();
      }
    } catch (err) {
      // silently fail; user can retry
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Poll only while the thewall window is actually open and visible
  setInterval(() => {
    if (wallView.classList.contains("is-active") && osWindow.classList.contains("is-open")) {
      fetchMessages();
    }
  }, 8000);

  // Fetch immediately the first time thewall is opened, from either the
  // desktop icon (data-window) or the start menu (data-program)
  document
    .querySelectorAll('[data-window="thewall"], [data-program="thewall"]')
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!hasLoadedOnce) fetchMessages();
      });
    });
}
