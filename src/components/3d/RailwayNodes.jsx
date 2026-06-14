import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { CITIES } from './constants';
import * as THREE from 'three';

// Animate a glowing aura for the critical hub (e.g. NDLS)
function RiskNode({ position, isCritical }) {
  const auraRef = useRef();
  
  useFrame((state) => {
    if (!auraRef.current) return;
    const t = state.clock.getElapsedTime();
    const scale = 1 + Math.sin(t * 3) * 0.3;
    auraRef.current.scale.set(scale, scale, scale);
    auraRef.current.material.opacity = 0.4 + Math.sin(t * 3) * 0.2;
  });

  return (
    <group position={position}>
      {/* Core Node */}
      <mesh>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={isCritical ? "#ef4444" : "#38bdf8"} toneMapped={false} />
      </mesh>
      
      {/* Pulsing Aura */}
      <mesh ref={auraRef}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial 
          color={isCritical ? "#f87171" : "#0ea5e9"} 
          transparent 
          opacity={0.4} 
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false} 
        />
      </mesh>
    </group>
  );
}

export function RailwayNodes() {
  return (
    <group>
      {Object.values(CITIES).map((city) => (
        <group key={city.id} position={city.position}>
          <RiskNode position={[0, 0, 0]} isCritical={city.id === 'delhi' || city.id === 'mumbai'} />
          
          {/* Futuristic Data Label */}
          <Html position={[0.2, 0.2, 0]} center className="pointer-events-none">
            <div className={`font-mono text-[8px] uppercase tracking-widest whitespace-nowrap ${
              (city.id === 'delhi' || city.id === 'mumbai') ? 'text-semantic-error-text' : 'text-brand-navy-300'
            }`}>
              {city.name} {city.isHub && <span className="opacity-50">/ HUB</span>}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
