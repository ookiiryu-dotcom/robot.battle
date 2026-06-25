import * as THREE from "three";

export class SkillController {
  constructor(scene, config, world) {
    this.scene = scene;
    this.config = config.skills;
    this.world = world;
    this.projectiles = [];
    this.shields = [];
    this.thrownMines = [];
    this.mines = [];
    this.explosions = [];

    this.projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xfff4a3 });
    this.shieldMaterial = new THREE.MeshBasicMaterial({
      color: 0x7df9ff,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide
    });
    this.mineMaterial = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    this.explosionMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8c42,
      transparent: true,
      opacity: 0.72,
      wireframe: true
    });
  }

  trigger(action, player, yaw) {
    if (action === "shoot") this.shootFrom(player, yaw, "player", 0xfff4a3);
    if (action === "shield") this.placeShield(player, yaw);
    if (action === "ascend") player.activateAscend(this.config.ascendDuration, this.config.ascendSpeed);
    if (action === "mine") this.placeMine(player, yaw, "player");
  }

  getForward(yaw) {
    return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
  }

  shootFrom(actor, yaw, team, color = 0xfff4a3, options = {}) {
    const direction = this.getForward(yaw);
    const material = this.projectileMaterial.clone();
    material.color.setHex(color);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(this.config.projectileRadius, 12, 8), material);
    mesh.position.copy(actor.position);
    mesh.position.y += 1.55;
    mesh.position.addScaledVector(direction, 1.1);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      direction,
      team,
      damage: options.damage ?? this.config.projectileDamage,
      speed: options.speed ?? this.config.projectileSpeed,
      life: options.lifetime ?? this.config.projectileLifetime
    });
  }

  placeShield(player, yaw) {
    const direction = this.getForward(yaw);
    const center = player.position.clone().addScaledVector(direction, this.config.shieldDistance);
    center.y = this.world.getHeightAt(center.x, center.z) + this.config.shieldHeight / 2;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.config.shieldWidth, this.config.shieldHeight, 0.28),
      this.shieldMaterial.clone()
    );
    mesh.position.copy(center);
    mesh.rotation.y = yaw;
    this.scene.add(mesh);

    const collider = {
      x: center.x,
      z: center.z,
      halfX: Math.abs(Math.cos(yaw)) * this.config.shieldWidth / 2 + Math.abs(Math.sin(yaw)) * 0.14,
      halfZ: Math.abs(Math.sin(yaw)) * this.config.shieldWidth / 2 + Math.abs(Math.cos(yaw)) * 0.14,
      blocksTeams: ["enemy"]
    };
    this.world.addTemporaryCollider(collider);

    this.shields.push({
      mesh,
      collider,
      life: this.config.shieldDuration
    });
  }

  placeMine(player, yaw, team) {
    const direction = this.getForward(yaw);
    const position = player.position.clone();
    position.y += 1.25;
    position.addScaledVector(direction, 1.0);

    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.16, 12), this.mineMaterial);
    mesh.position.copy(position);
    mesh.castShadow = true;
    this.scene.add(mesh);

    this.thrownMines.push({
      mesh,
      position,
      velocity: new THREE.Vector3(
        direction.x * this.config.mineThrowSpeed,
        this.config.mineThrowUpPower,
        direction.z * this.config.mineThrowSpeed
      ),
      team,
      spin: 0
    });
  }

  armMine(thrownMine) {
    const position = thrownMine.position.clone();
    position.y = this.world.getHeightAt(position.x, position.z) + 0.16;
    thrownMine.mesh.position.copy(position);
    thrownMine.mesh.rotation.set(0, thrownMine.mesh.rotation.y, 0);

    this.mines.push({
      mesh: thrownMine.mesh,
      position,
      team: thrownMine.team,
      life: this.config.mineFuse,
      armDelay: this.config.mineArmDelay
    });

    const index = this.thrownMines.indexOf(thrownMine);
    if (index >= 0) this.thrownMines.splice(index, 1);
  }

  createExplosion(position) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), this.explosionMaterial.clone());
    mesh.position.copy(position);
    this.scene.add(mesh);

    this.explosions.push({
      mesh,
      life: this.config.explosionDuration,
      maxLife: this.config.explosionDuration
    });
  }

  removeItem(list, item) {
    const index = list.indexOf(item);
    if (index >= 0) list.splice(index, 1);
    if (item.mesh) this.scene.remove(item.mesh);
  }

  clearAll() {
    for (const shield of [...this.shields]) {
      this.world.removeTemporaryCollider(shield.collider);
      this.removeItem(this.shields, shield);
    }
    for (const list of [this.projectiles, this.thrownMines, this.mines, this.explosions]) {
      for (const item of [...list]) {
        this.removeItem(list, item);
      }
    }
  }

  projectileHitsCollider(projectile) {
    return this.world.getColliders().some((collider) => {
      if (collider.blocksTeams && !collider.blocksTeams.includes(projectile.team)) {
        return false;
      }

      const position = projectile.mesh.position;
      return Math.abs(position.x - collider.x) <= collider.halfX && Math.abs(position.z - collider.z) <= collider.halfZ;
    });
  }

  horizontalDistance(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  projectileHitsTarget(projectile, player, enemies) {
    if (projectile.team === "enemy") {
      if (this.horizontalDistance(projectile.mesh.position, player.position) <= player.radius + 0.9) {
        return player;
      }
      return null;
    }

    return enemies.find((enemy) => {
      return enemy.hp > 0 && this.horizontalDistance(projectile.mesh.position, enemy.position) <= enemy.radius + 0.9;
    }) || null;
  }

  mineTriggeredTarget(mine, player, enemies) {
    const targets = mine.team === "player" ? enemies.filter((enemy) => enemy.hp > 0) : [player];
    return targets.find((target) => {
      return this.horizontalDistance(mine.position, target.position) <= this.config.mineTriggerRadius;
    }) || null;
  }

  update(dt, player, enemies, callbacks = {}) {
    for (const projectile of [...this.projectiles]) {
      projectile.life -= dt;
      projectile.mesh.position.addScaledVector(projectile.direction, projectile.speed * dt);
      const target = this.projectileHitsTarget(projectile, player, enemies);

      if (target) {
        if (target.takeDamage(projectile.damage)) {
          if (target === player) callbacks.onPlayerDeath?.();
          else callbacks.onEnemyDeath?.(target);
        }
        this.createExplosion(projectile.mesh.position);
        this.removeItem(this.projectiles, projectile);
      } else if (projectile.life <= 0 || this.projectileHitsCollider(projectile)) {
        this.createExplosion(projectile.mesh.position);
        this.removeItem(this.projectiles, projectile);
      }
    }

    for (const shield of [...this.shields]) {
      shield.life -= dt;
      shield.mesh.material.opacity = Math.max(0, 0.38 * (shield.life / this.config.shieldDuration));
      if (shield.life <= 0) {
        this.world.removeTemporaryCollider(shield.collider);
        this.removeItem(this.shields, shield);
      }
    }

    for (const thrownMine of [...this.thrownMines]) {
      thrownMine.velocity.y += this.config.mineThrowGravity * dt;
      thrownMine.position.addScaledVector(thrownMine.velocity, dt);
      thrownMine.mesh.position.copy(thrownMine.position);
      thrownMine.mesh.rotation.x += dt * 8;
      thrownMine.mesh.rotation.z += dt * 5;

      const groundY = this.world.getHeightAt(thrownMine.position.x, thrownMine.position.z) + 0.16;
      if (thrownMine.position.y <= groundY) {
        this.armMine(thrownMine);
      }
    }

    for (const mine of [...this.mines]) {
      mine.life -= dt;
      mine.armDelay -= dt;
      mine.mesh.rotation.y += dt * 4;
      const armed = mine.armDelay <= 0;
      const target = armed ? this.mineTriggeredTarget(mine, player, enemies) : null;

      if (target) {
        if (target.takeDamage(this.config.projectileDamage * 2)) {
          if (target === player) callbacks.onPlayerDeath?.();
          else callbacks.onEnemyDeath?.(target);
        }
        this.createExplosion(mine.position);
        this.removeItem(this.mines, mine);
      } else if (mine.life <= 0) {
        this.createExplosion(mine.position);
        this.removeItem(this.mines, mine);
      }
    }

    for (const explosion of [...this.explosions]) {
      explosion.life -= dt;
      const progress = 1 - explosion.life / explosion.maxLife;
      explosion.mesh.scale.setScalar(0.4 + progress * this.config.explosionRadius);
      explosion.mesh.material.opacity = Math.max(0, 0.72 * (1 - progress));

      if (explosion.life <= 0) {
        this.removeItem(this.explosions, explosion);
      }
    }
  }
}
