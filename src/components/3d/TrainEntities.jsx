import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CITIES, ROUTES } from './constants';
import * as THREE from 'three';

function TrainNode({ route, speed, offset }) {
  const meshRef = useRef();
  
  const curve = useMemo(() => {
    const start = new THREE.Vector3(...CITIES[route[0]].position);
    const end = new THREE.Vector3(...CITIES[route[1]].position);
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const distance = start.distanceTo(end);
    midPoint.z += distance * 0.2; 
    return new THREE.QuadraticBezierCurve3(start, midPoint, end);
  }, [route]);

  useFrame((state) => {
    if (!meshRef.current) return;
    
    // Calculate progress 0 to 1
    const t = ((state.clock.getElapsedTime() * speed) + offset) % 1;
    
    // Get position on curve
    const point = curve.getPoint(t);
    meshRef.current.position.copy(point);
    
    // Optional: make train face the direction it's going
    const tangent = curve.getTangent(t);
    const lookAtPoint = point.clone().add(tangent);
    meshRef.current.lookAt(lookAtPoint);
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[0.06, 0.06, 0.15]} />
      <meshBasicMaterial 
        color="#38bdf8" 
        toneMapped={false} 
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

export function TrainEntities() {
  // Generate a list of trains randomly distributed across routes
  const trains = useMemo(() => {
    const arr = [];
    ROUTES.forEach((route, index) => {
      // 2 trains per route
      arr.push({ id: `t_${index}_1`, route, speed: 0.05 + Math.random() * 0.05, offset: Math.random() });
      arr.push({ id: `t_${index}_2`, route, speed: 0.05 + Math.random() * 0.05, offset: Math.random() });
    });
    return arr;
  }, []);

  return (
    <group>
      {trains.map((train) => (
        <TrainNode key={train.id} route={train.route} speed={train.speed} offset={train.offset} />
      ))}
    </group>
  );
}
