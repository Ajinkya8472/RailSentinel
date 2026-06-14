// src/pages/LandingPage.jsx
import React, { useState, useEffect, memo } from 'react';
import { NetworkScene } from '../components/3d/NetworkScene';
import { LandingOverlay } from '../components/3d/LandingOverlay';
import { Footer } from '../components/3d/Footer';
import LandingNavbar from '../components/LandingNavbar'; // 💡 IMPORT LOGO HEADER HERE

const LandingPage = memo(() => {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = window.scrollY / totalHeight;
        setScrollProgress(progress);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative w-full bg-[#05080A] h-[200vh]">
      
      {/* 🚀 MASTER LOGO NAVIGATION BAR LAYER: Floats fixed at top-0 */}
      <LandingNavbar />

      {/* High-Fidelity Video Background Wrapper */}
      <div className="fixed inset-0 w-full h-screen z-0">
        <NetworkScene scrollProgress={scrollProgress} />
      </div>

      {/* Immersive Front HUD Layer Stack */}
      <div className="relative w-full z-10 pt-16"> {/* Added padding-top to keep content clear of navbar dimensions */}
        <LandingOverlay scrollProgress={scrollProgress} />
      </div>

      {/* Footer — sits below the scroll-driven HUD on solid ground */}
      <div className="relative w-full z-10">
        <Footer />
      </div>
    </div>
  );
});

LandingPage.displayName = 'LandingPage';

export default LandingPage;