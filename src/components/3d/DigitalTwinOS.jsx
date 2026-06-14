import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { RailwayNodes } from './RailwayNodes';
import { PulseLines } from './PulseLines';
import { TrainEntities } from './TrainEntities';
import * as THREE from 'three';

function CameraRig() {
  const cameraRef = useRef();

  useFrame((state) => {
    // Subtle cinematic camera drift
    const t = state.clock.getElapsedTime();
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, Math.sin(t / 10) * 1.5, 0.01);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, -10 + Math.cos(t / 10) * 1.5, 0.01);
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={[0, -12, 14]}
      fov={45}
    />
  );
}

export function NetworkScene() {
  return (
    <div className="w-full h-full absolute top-0 left-0 bg-[#020617] overflow-hidden -z-10">
      <Canvas dpr={[1, 2]} gl={{ antialias: false, powerPreference: "high-performance" }}>
        <color attach="background" args={['#020617']} />

        {/* Cinematic ambient and directional lighting */}
        <ambientLight intensity={0.2} />
        <directionalLight position={[10, 10, 10]} intensity={1.5} color="#38bdf8" />
        <pointLight position={[-10, -10, 5]} intensity={2} color="#818cf8" />

        <CameraRig />

        <group rotation={[0, 0, 0]}>
          <RailwayNodes />
          <PulseLines />
          <TrainEntities />
        </group>

        {/* Space backdrop for depth */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 4}
          minDistance={8}
          maxDistance={25}
          autoRotate={false}
        />

        <EffectComposer>
          <Bloom
            luminanceThreshold={0.2}
            mipmapBlur
            intensity={1.5}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
