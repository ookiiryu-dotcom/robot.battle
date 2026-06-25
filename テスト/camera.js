import * as THREE from "three";

export class ThirdPersonCamera {
  constructor(camera, config) {
    this.camera = camera;
    this.config = config;
  }

  update(playerPosition, yaw, pitch) {
    const { distance, height, targetHeight, pitchHeightScale, lerp } = this.config.camera;
    const target = playerPosition.clone();
    target.y += targetHeight;

    const desiredPosition = new THREE.Vector3(
      target.x - Math.sin(yaw) * distance,
      target.y + height + pitch * pitchHeightScale,
      target.z - Math.cos(yaw) * distance
    );

    this.camera.position.lerp(desiredPosition, lerp);
    this.camera.lookAt(target);
  }
}
