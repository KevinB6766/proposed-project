
// ─── COMPONENT DEFINITIONS ───────────────────────────────────────────────────

class PositionComponent {
  x: number;
  y: number;
  constructor(x: number, y: number) { this.x = x; this.y = y; }
}

class SizeComponent {
  w: number;
  h: number;
  constructor(w: number, h: number) { this.w = w; this.h = h; }
}

class RenderComponent {
  color: string;
  label: string;
  alpha: number;
  constructor(color: string, label: string) {
    this.color = color;
    this.label = label;
    this.alpha = 1;
  }
}

class SelectableComponent {
  selected: boolean;
  constructor() { this.selected = false; }
}

class MovementComponent {
  targetX: number | null;
  targetY: number | null;
  speed: number;
  constructor() {
    this.targetX = null;
    this.targetY = null;
    this.speed = 220; // px/sec
  }
}

class TrailComponent {
  points: Array<{ x: number; y: number; age: number }>;
  constructor() { this.points = []; }
}

// ─── ENTITY MANAGER ──────────────────────────────────────────────────────────

class EntityManager {
  nextId: number;
  entities: Map<number, Map<string, any>>;

  constructor() {
    this.nextId = 0;
    this.entities = new Map(); // id -> { componentType -> component }
  }

  createEntity(): number {
    const id = this.nextId++;
    this.entities.set(id, new Map());
    return id;
  }

  addComponent(entityId: number, component: any): this {
    this.entities.get(entityId)!.set(component.constructor.name, component);
    return this;
  }

  getComponent(entityId: number, ComponentClass: any): any {
    return this.entities.get(entityId)?.get(ComponentClass.name) ?? null;
  }

  getEntitiesWith(...ComponentClasses: any[]): number[] {
    const result: number[] = [];
    for (const [id, comps] of this.entities) {
      if (ComponentClasses.every(C => comps.has(C.name))) result.push(id);
    }
    return result;
  }

  componentCount(): number {
    let n = 0;
    for (const comps of this.entities.values()) n += comps.size;
    return n;
  }
}

// ─── SYSTEMS ─────────────────────────────────────────────────────────────────

// Moves entities toward their target position
class MovementSystem {
  update(em: EntityManager, dt: number): void {
    const entities = em.getEntitiesWith(PositionComponent, MovementComponent, TrailComponent);
    for (const id of entities) {
      const pos = em.getComponent(id, PositionComponent);
      const mov = em.getComponent(id, MovementComponent);
      const trail = em.getComponent(id, TrailComponent);

      if (mov.targetX === null) continue;

      const dx = mov.targetX - pos.x;
      const dy = mov.targetY - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 2) {
        pos.x = mov.targetX;
        pos.y = mov.targetY;
        mov.targetX = null;
        mov.targetY = null;
        continue;
      }

      const step = mov.speed * dt;
      const ratio = Math.min(step / dist, 1);
      pos.x += dx * ratio;
      pos.y += dy * ratio;

      // Record trail
      trail.points.push({ x: pos.x, y: pos.y, age: 0 });
      if (trail.points.length > 30) trail.points.shift();
    }
  }
}

// Ages and prunes trail points
class TrailSystem {
  update(em: EntityManager, dt: number): void {
    const entities = em.getEntitiesWith(TrailComponent, MovementComponent);
    for (const id of entities) {
      const trail = em.getComponent(id, TrailComponent);
      const mov = em.getComponent(id, MovementComponent);
      trail.points = trail.points
        .map((p: any) => ({ ...p, age: p.age + dt }))
        .filter((p: any) => p.age < (mov.targetX !== null ? 0.5 : 0.3));
    }
  }
}

// Renders trails, then entities
class RenderSystem {
  render(em: EntityManager, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    // Clear
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    const entities = em.getEntitiesWith(PositionComponent, SizeComponent, RenderComponent);

    for (const id of entities) {
      const pos = em.getComponent(id, PositionComponent);
      const size = em.getComponent(id, SizeComponent);
      const render = em.getComponent(id, RenderComponent);
      const sel = em.getComponent(id, SelectableComponent);
      const trail = em.getComponent(id, TrailComponent);
      const mov = em.getComponent(id, MovementComponent);

      // Trail
      if (trail && trail.points.length > 1) {
        ctx.save();
        for (let i = 1; i < trail.points.length; i++) {
          const t = 1 - trail.points[i].age / 0.5;
          ctx.strokeStyle = `rgba(0, 255, 159, ${t * 0.4})`;
          ctx.lineWidth = (1 - trail.points[i].age / 0.5) * 3;
          ctx.beginPath();
          ctx.moveTo(trail.points[i-1].x, trail.points[i-1].y);
          ctx.lineTo(trail.points[i].x, trail.points[i].y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Target indicator
      if (mov && mov.targetX !== null) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0,255,159,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(mov.targetX, mov.targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Target crosshair
        const tx = mov.targetX, ty = mov.targetY;
        ctx.strokeStyle = 'rgba(0,255,159,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tx - 8, ty); ctx.lineTo(tx + 8, ty);
        ctx.moveTo(tx, ty - 8); ctx.lineTo(tx, ty + 8);
        ctx.stroke();
        ctx.restore();
      }

      const bx = pos.x - size.w / 2;
      const by = pos.y - size.h / 2;

      // Glow when selected or moving
      const glowing = sel?.selected || (mov?.targetX !== null);
      if (glowing) {
        ctx.save();
        ctx.shadowColor = render.color;
        ctx.shadowBlur = 20;
        ctx.fillStyle = render.color + '22';
        ctx.fillRect(bx - 4, by - 4, size.w + 8, size.h + 8);
        ctx.restore();
      }

      // Box body
      ctx.fillStyle = render.color + (sel?.selected ? '33' : '18');
      ctx.fillRect(bx, by, size.w, size.h);

      // Border
      ctx.strokeStyle = sel?.selected ? render.color : render.color + '88';
      ctx.lineWidth = sel?.selected ? 2 : 1.5;
      ctx.strokeRect(bx, by, size.w, size.h);

      // Corner accents
      const accentLen = 8;
      ctx.strokeStyle = render.color;
      ctx.lineWidth = 2;
      const corners = [
        [bx, by, 1, 1], [bx + size.w, by, -1, 1],
        [bx, by + size.h, 1, -1], [bx + size.w, by + size.h, -1, -1]
      ];
      for (const [cx, cy, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(cx + sx * accentLen, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + sy * accentLen);
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = sel?.selected ? render.color : render.color + 'aa';
      ctx.font = `bold 11px 'Courier New'`;
      ctx.textAlign = 'center';
      ctx.fillText(render.label, pos.x, pos.y + 4);

      // "SELECTED" badge
      if (sel?.selected) {
        ctx.fillStyle = render.color;
        ctx.font = `9px 'Courier New'`;
        ctx.fillText('[ SELECTED ]', pos.x, by - 8);
      }
    }
  }
}

// Handles click input: select box or set movement target
class InputSystem {
  handleClick(em: EntityManager, canvasX: number, canvasY: number): void {
    const selectable = em.getEntitiesWith(PositionComponent, SizeComponent, SelectableComponent);

    // Check if any box was clicked
    let clickedEntity = null;
    for (const id of selectable) {
      const pos = em.getComponent(id, PositionComponent);
      const size = em.getComponent(id, SizeComponent);
      const bx = pos.x - size.w / 2;
      const by = pos.y - size.h / 2;
      if (canvasX >= bx && canvasX <= bx + size.w &&
          canvasY >= by && canvasY <= by + size.h) {
        clickedEntity = id;
        break;
      }
    }

    // Check if a box is currently selected
    let selectedEntity = null;
    for (const id of selectable) {
      const sel = em.getComponent(id, SelectableComponent);
      if (sel.selected) { selectedEntity = id; break; }
    }

    if (clickedEntity !== null) {
      // Toggle selection on clicked box
      for (const id of selectable) {
        em.getComponent(id, SelectableComponent).selected = (id === clickedEntity && selectedEntity !== clickedEntity);
      }
    } else if (selectedEntity !== null) {
      // Move selected box to click position
      const mov = em.getComponent(selectedEntity, MovementComponent);
      if (mov) {
        mov.targetX = canvasX;
        mov.targetY = canvasY;
      }
    }
  }
}

// ─── GAME BOOTSTRAP ──────────────────────────────────────────────────────────

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const em = new EntityManager();
const movementSystem = new MovementSystem();
const trailSystem = new TrailSystem();
const renderSystem = new RenderSystem();
const inputSystem = new InputSystem();

// Create the box entity
const box = em.createEntity();
em.addComponent(box, new PositionComponent(350, 225));
em.addComponent(box, new SizeComponent(80, 80));
em.addComponent(box, new RenderComponent('#00ff9f', 'ENT_0'));
em.addComponent(box, new SelectableComponent());
em.addComponent(box, new MovementComponent());
em.addComponent(box, new TrailComponent());

// Add a second box for fun
const box2 = em.createEntity();
em.addComponent(box2, new PositionComponent(150, 150));
em.addComponent(box2, new SizeComponent(60, 60));
em.addComponent(box2, new RenderComponent('#ff6b6b', 'ENT_1'));
em.addComponent(box2, new SelectableComponent());
em.addComponent(box2, new MovementComponent());
em.addComponent(box2, new TrailComponent());

// Input
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  inputSystem.handleClick(em, x, y);
});

// UI counters
const eCount = document.getElementById('eCount') as HTMLElement;
const cCount = document.getElementById('cCount') as HTMLElement;
eCount.textContent = em.entities.size.toString();
cCount.textContent = em.componentCount().toString();

// Game loop
let lastTime = 0;
function loop(timestamp: number): void {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  movementSystem.update(em, dt);
  trailSystem.update(em, dt);
  renderSystem.render(em, ctx, canvas);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
