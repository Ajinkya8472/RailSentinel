import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { CITIES, ROUTES } from './constants'; // Double check this path matches your tree
import * as THREE from 'three';

function RouteLine({ startCityId, endCityId, index }) {
  const lineRef = useRef();
  
  // Alternate colors between neon cyan and emerald to match the main theme colors
  const routeColor = index % 2 === 0 ? "#10b981" : "#06b6d4";
  
  const points = useMemo(() => {
    // Graceful fallbacks in case constants aren't fully loaded yet
    if (!CITIES[startCityId] || !CITIES[endCityId]) return [new THREE.Vector3(), new THREE.Vector3()];

    const start = new THREE.Vector3(...CITIES[startCityId].position);
    const end = new THREE.Vector3(...CITIES[endCityId].position);
    
    // Create a quadratic bezier curve for the route to give it an arc/depth
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const distance = start.distanceTo(end);
    
    // Smooth architectural arc depth projection
    midPoint.z += distance * 0.25; 
    
    const curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);
    return curve.getPoints(40); // 40 points is optimal for performance vs smoothness
  }, [startCityId, endCityId]);

  useFrame((state) => {
    if (!lineRef.current || !lineRef.current.material) return;
    
    const t = state.clock.getElapsedTime();
    // Fast cyber-pulse modulation speed to simulate high-velocity data packets
    lineRef.current.material.opacity = 0.4 + Math.sin(t * 4.5 + index) * 0.3;
  });

  return (
    <Line
      ref={lineRef}
      points={points}
      color={routeColor}
      lineWidth={2.2}
      transparent
      opacity={0.6}
      depthWrite={false}
      blending={THREE.AdditiveBlending}
      toneMapped={false}
    />
  );
}

export function PulseLines() {
  // Safe validation check against missing data arrays during initialization layers
  if (!ROUTES || !CITIES) return null;

  return (
    <group>
      {ROUTES.map(([start, end], index) => (
        <RouteLine 
          key={`${start}-${end}-${index}`} 
          startCityId={start} 
          endCityId={end} 
          index={index}
        />
      ))}
    </group>
  );
}