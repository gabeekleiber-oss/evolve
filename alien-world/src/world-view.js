import * as THREE from "three";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class WorldView {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#111311");
    this.scene.fog = new THREE.Fog("#111311", 55, 190);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 260);
    this.camera.position.set(0, 1.7, 9);
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.features = new Map();
    this.clock = new THREE.Clock();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight("#b5c5b2", "#2a2520", 2.2));
    const sun = new THREE.DirectionalLight("#f0d7b1", 2.4);
    sun.position.set(-35, 55, -25);
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ color: "#292b24", roughness: 0.98 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.035;
    this.scene.add(ground);
    this.addStars();
    this.bindInput();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.animate();
  }

  addStars() {
    const positions = [];
    for (let i = 0; i < 500; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 125 + Math.random() * 40;
      positions.push(Math.cos(angle) * radius, 10 + Math.random() * 65, Math.sin(angle) * radius);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: "#b9c3aa", size: 0.17, transparent: true, opacity: 0.58, sizeAttenuation: true });
    this.scene.add(new THREE.Points(geometry, material));
  }

  bindInput() {
    this.onKeyDown = (event) => {
      if ("wasd".includes(event.key.toLowerCase())) event.preventDefault();
      this.keys.add(event.key.toLowerCase());
    };
    this.onKeyUp = (event) => this.keys.delete(event.key.toLowerCase());
    this.onMouseMove = (event) => {
      if (document.pointerLockElement !== this.renderer.domElement) return;
      this.yaw -= event.movementX * 0.002;
      this.pitch = clamp(this.pitch - event.movementY * 0.002, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
    };
    this.onCanvasClick = () => {
      if (document.pointerLockElement !== this.renderer.domElement) this.renderer.domElement.requestPointerLock();
    };
    this.onBlur = () => this.keys.clear();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("blur", this.onBlur);
    this.renderer.domElement.addEventListener("click", this.onCanvasClick);
  }

  addFeature(feature) {
    const previous = this.features.get(feature.id);
    if (previous?.userData.revision === (feature.revision || 0)) return;
    if (previous) {
      this.scene.remove(previous);
      this.features.delete(feature.id);
    }
    const group = new THREE.Group();
    group.position.set(feature.x, 0, feature.z);
    group.userData.form = feature.form;
    group.userData.revision = feature.revision || 0;
    group.userData.phase = Math.random() * Math.PI * 2;
    this.buildForm(group, feature);
    this.scene.add(group);
    this.features.set(feature.id, group);
  }

  buildForm(group, feature) {
    const size = feature.size;
    const material = new THREE.MeshStandardMaterial({
      color: feature.color,
      roughness: 0.78,
      metalness: feature.category === "artifact" ? 0.32 : 0.04,
      emissive: feature.color,
      emissiveIntensity: feature.category === "phenomenon" ? 0.3 : 0.035
    });
    const add = (geometry, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      group.add(mesh);
      return mesh;
    };
    switch (feature.form) {
      case "spire":
        add(new THREE.ConeGeometry(size * 0.7, size * 2.7, 7), 0, size * 1.3, 0);
        add(new THREE.SphereGeometry(size * 0.32, 12, 9), 0, size * 2.7, 0);
        break;
      case "orb":
        add(new THREE.SphereGeometry(size * 0.75, 20, 16), 0, size * 0.9, 0);
        break;
      case "arch":
        add(new THREE.TorusGeometry(size * 1.15, size * 0.22, 8, 24, Math.PI), 0, size * 1.3, 0).rotation.z = Math.PI;
        add(new THREE.CylinderGeometry(size * 0.16, size * 0.25, size * 1.25, 7), -size * 1.05, size * 0.62, 0);
        add(new THREE.CylinderGeometry(size * 0.16, size * 0.25, size * 1.25, 7), size * 1.05, size * 0.62, 0);
        break;
      case "pod":
        add(new THREE.SphereGeometry(size * 0.72, 16, 12), 0, size * 0.76, 0, 0.9, 1.25, 0.9);
        add(new THREE.ConeGeometry(size * 0.42, size * 0.7, 7), 0, size * 1.75, 0);
        break;
      case "crawler":
        add(new THREE.SphereGeometry(size * 0.56, 16, 12), 0, size * 0.72, 0, 1.35, 0.75, 1);
        for (let i = 0; i < 6; i += 1) {
          const side = i % 2 ? 1 : -1;
          const offset = (Math.floor(i / 2) - 0.5) * size * 0.62;
          const leg = add(new THREE.CylinderGeometry(size * 0.075, size * 0.11, size * 0.9, 5), side * size * 0.7, size * 0.35, offset);
          leg.rotation.z = side * -0.6;
        }
        break;
      case "reed":
        add(new THREE.CylinderGeometry(size * 0.08, size * 0.25, size * 2.2, 6), 0, size * 1.1, 0);
        add(new THREE.SphereGeometry(size * 0.22, 10, 8), 0, size * 2.25, 0);
        break;
      case "ring":
        add(new THREE.TorusGeometry(size * 0.8, size * 0.2, 8, 24), 0, size * 1.15, 0).rotation.x = Math.PI / 2.7;
        break;
      case "monolith":
        add(new THREE.BoxGeometry(size * 0.75, size * 2.1, size * 0.62), 0, size * 1.05, 0).rotation.y = 0.35;
        break;
      case "shelf":
        add(new THREE.CylinderGeometry(size * 0.82, size * 0.64, size * 0.28, 12), 0, size * 0.65, 0);
        add(new THREE.SphereGeometry(size * 0.42, 12, 9), 0, size * 1.02, 0, 1.2, 0.65, 1);
        break;
      case "landform":
        add(new THREE.DodecahedronGeometry(size * 1.35, 1), 0, size * 0.75, 0, 1.4, 0.65, 1.15);
        break;
      default:
        add(new THREE.SphereGeometry(size * 0.7, 12, 9), 0, size * 0.8, 0);
    }
    if (["organism", "phenomenon"].includes(feature.category)) {
      const glintMaterial = new THREE.MeshBasicMaterial({ color: "#f3ecd6" });
      const glint = new THREE.Mesh(new THREE.SphereGeometry(size * 0.07, 8, 6), glintMaterial);
      glint.position.set(size * 0.16, size * 1.04, size * 0.5);
      group.add(glint);
    }
  }

  updateWorld(world) {
    for (const feature of world.objects) this.addFeature(feature);
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const forward = Number(this.keys.has("w")) - Number(this.keys.has("s"));
    const sideways = Number(this.keys.has("d")) - Number(this.keys.has("a"));
    const length = Math.hypot(forward, sideways) || 1;
    const speed = 8 * delta / length;
    this.camera.position.x += (Math.sin(this.yaw) * forward + Math.cos(this.yaw) * sideways) * speed;
    this.camera.position.z += (-Math.cos(this.yaw) * forward + Math.sin(this.yaw) * sideways) * speed;
    this.camera.position.x = clamp(this.camera.position.x, -75, 75);
    this.camera.position.z = clamp(this.camera.position.z, -75, 75);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    const time = performance.now() * 0.001;
    for (const group of this.features.values()) {
      if (group.userData.form === "orb" || group.userData.form === "phenomenon") {
        group.position.y = Math.sin(time * 0.8 + group.userData.phase) * 0.12;
      }
      if (group.userData.form === "crawler") {
        group.rotation.y = Math.sin(time * 0.35 + group.userData.phase) * 0.11;
      }
    }
    this.renderer.render(this.scene, this.camera);
  };
}
