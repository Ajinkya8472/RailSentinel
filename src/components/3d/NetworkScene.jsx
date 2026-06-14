// src/components/3d/NetworkScene.jsx
import React, { useEffect, useRef } from 'react';

export const NetworkScene = ({ scrollProgress }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      // Dynamic velocity feedback: speeds up the cinematic track playback slightly 
      // as the user initiates scroll interactions to mirror active telemetry acceleration.
      videoRef.current.playbackRate = 1.0 + (scrollProgress || 0) * 1.2;
    }
  }, [scrollProgress]);

  return (
    <div className="absolute inset-0 z-0 bg-[#020617] overflow-hidden w-full h-screen select-none pointer-events-none">
      
      {/* High-Fidelity Hardware-Accelerated Video Pipeline Core
        Using muted, autoPlay, loop, and playsInline ensures compliance with all major 
        browser autoplay safety layers (safeguarding your hackathon live pitch from blocking).
      */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover opacity-60 scale-[1.02] filter brightness-[0.70] contrast-[1.15] saturate-[1.1]"
      >
        <source 
          src="/public/assets/Indian_Railways_cinematic_showca…_202606110023.mp4" 
          type="video/mp4" 
        />
        {/* Fallback for ultra-legacy environments */}
        Telemetry Feed Blocked. System Backbone Active.
      </video>

      {/* INDUSTRIAL MATTE & CONTRAST VIGNETTES
        These CSS gradient nodes recreate a premium digital-twin control deck environment.
        They shade the borders of the viewport, eliminating harsh lighting spikes from 
        the source footage and locking in absolute legibility for your overlying UI typography.
      */}
      
      {/* Central Radiance Vignette Shadow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_15%,#020617_92%)]" />
      
      {/* Top and Bottom Horizontal Dynamic Shields */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#020617]/70 via-transparent to-[#020617]" />
      
      {/* Cybernetic Scanline Raster Mesh
        Adds a micro-grid texture line array overlay mimicking mission-critical hardware tracking systems.
      */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_bottom,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:100%_4px]" />
      
    </div>
  );
};