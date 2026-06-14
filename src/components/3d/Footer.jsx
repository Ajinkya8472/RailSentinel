// src/components/3d/Footer.jsx
import React from 'react';

const SignalLamp = ({ color = 'green', pulse = true, size = 7 }) => {
  const colors = { green: '#4F9A5C', amber: '#F2A900', red: '#D14B3D' };
  return (
    <span
      className={`inline-block rounded-full ${pulse ? 'animate-pulse' : ''}`}
      style={{ 
        width: size, 
        height: size, 
        backgroundColor: colors[color], 
        boxShadow: `0 0 ${size * 1.4}px ${colors[color]}80` 
      }}
    />
  );
};

const FooterLink = ({ href = '#', children }) => (
  <a
    href={href}
    className="text-[#9CA89B] hover:text-[#F2A900] transition-colors duration-150 text-[12px] font-medium"
  >
    {children}
  </a>
);

const FooterColumn = ({ title, links }) => (
  <div className="flex flex-col gap-4">
    <h4 className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-[#7E8C81]">{title}</h4>
    <ul className="flex flex-col gap-2.5 m-0 p-0 list-none">
      {links.map((link) => (
        <li key={link}><FooterLink>{link}</FooterLink></li>
      ))}
    </ul>
  </div>
);

export const Footer = () => {
  return (
    <footer className="relative w-full bg-[#05080A] border-t border-[#131B15] text-[#EDE6D3] font-sans selection:bg-[#F2A900]/20 selection:text-[#F2A900]">
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-16 grid grid-cols-1 md:grid-cols-12 gap-12">

        {/* BRAND & CAPABILITY BLOCK */}
        <div className="md:col-span-4 flex flex-col gap-5">
          <div className="flex items-center gap-3 group cursor-pointer">
            {/* 🚀 LOGO IMAGE EMBED WITH MATCHING INTERACTIVE HOVER SCALING */}
            <img 
              src="/Logo.png" 
              alt="RailSentinel Footer System Logo" 
              className="h-9 w-9 rounded-xl object-contain bg-[#0E140F] border border-[#2A362E] p-1 shadow-md shadow-emerald-950/20 transition-all duration-300 group-hover:border-[#F2A900]/50 group-hover:scale-105"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div className="flex flex-col">
              <span className="font-sans text-xs font-black uppercase tracking-[0.25em] text-[#EDE6D3] leading-none">
                RailSentinel
              </span>
              <span className="text-[7.5px] font-mono font-bold text-[#7E8C81] uppercase tracking-widest mt-1">
                INDUSTRIAL TELEMETRY
              </span>
            </div>
          </div>

          <p className="text-[#9CA89B] text-[12px] font-light leading-relaxed max-w-xs">
            Industrial railway intelligence — real-time localised track anomaly tracking, and
            multi-agent dispatch containment triage matrices.
          </p>

          <div className="inline-flex items-center gap-2.5 border border-[#2A362E] bg-[#0E140F] px-3 py-1.5 w-fit rounded-lg shadow-inner">
            <SignalLamp color="green" pulse size={7} />
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#B8AF99] font-bold">
              All Systems Operational // Live Stream Connected
            </span>
          </div>
        </div>

        {/* NAVIGATION LINKS GRID */}
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-10">
          <FooterColumn
            title="Platform"
            links={['Live Telemetry', 'Incident Matrix', 'Network Map', 'Predictive Intelligence']}
          />
          <FooterColumn
            title="Resources"
            links={['System Architecture', 'AI Documentation', 'Technical SOPs', 'API Gateway Docs']}
          />
          <FooterColumn
            title="Security & Compliance"
            links={['Safety Architecture', 'Gov-Rail Standards', 'Data Privacy', 'Operational Audit Logs']}
          />
        </div>
      </div>

      {/* BOTTOM LEGAL STRIP */}
      <div className="border-t border-[#131B15] bg-[#030506]">
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[10px] text-[#7E8C81] uppercase tracking-[0.15em] font-medium">
          <span className="text-center sm:text-left leading-normal">
            &copy; 2026 RailSentinel. All rights reserved. Industrial Railway Intelligence Systems.
          </span>
          <div className="flex items-center gap-5 flex-wrap justify-center list-none p-0 m-0">
            {['Terms of Management', 'Privacy Policy', 'Cybersecurity Shield', 'System Status'].map((link) => (
              <a
                key={link}
                href="#"
                className="hover:text-[#F2A900] transition-colors duration-150"
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};