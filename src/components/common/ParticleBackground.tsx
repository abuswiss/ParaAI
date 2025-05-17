import React, { useEffect, useMemo, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { type Container, type ISourceOptions } from "@tsparticles/engine";
import { useTheme } from 'next-themes';
// Import the interaction you installed
import { loadExternalRepulseInteraction } from "@tsparticles/interaction-external-repulse";
// Import a base preset (e.g., slim) 
import { loadSlim } from "@tsparticles/slim";
// Optionally import a preset or slimmer engine if you don't need all features
// import { loadSlim } from "@tsparticles/slim"; 

const ParticleBackground: React.FC = () => {
  const [init, setInit] = useState(false);
  const { theme } = useTheme();

  // Initialize particles engine once
  useEffect(() => {
    // console.log("Initializing particles engine..."); // Removed log
    initParticlesEngine(async (engine) => {
      // console.log("Engine instance created, loading presets/interactions..."); // Removed log
      await loadSlim(engine);
      await loadExternalRepulseInteraction(engine);
      // console.log("Presets/interactions loaded."); // Removed log
    }).then(() => {
      // console.log("Engine initialization complete, setting init state."); // Removed log
      setInit(true);
    }).catch((error) => {
      console.error("Particles engine initialization failed:", error); // Keep error log
    });
  }, []);

  const particlesLoaded = async (container?: Container): Promise<void> => {
    // console.log("Particles container loaded", container); // Optional: Keep if needed
  };

  // Define particle options (Restoring complex options with adjustments)
  const options: ISourceOptions = useMemo(
    () => ({
      background: {
        color: { value: "transparent" },
      },
      fpsLimit: 60,
      interactivity: { // Re-enabled interactivity
        events: {
          onHover: {
            enable: true,
            mode: "repulse", // Ensure repulse is active
          },
          // onClick: { enable: true, mode: "push" }, // Optional
        },
        modes: {
          repulse: {
            distance: 100, 
            duration: 1.5, // Significantly increased duration
            factor: 100, 
            speed: 0.5, // Decreased speed
            maxSpeed: 50,
            easing: 'ease-out-sine',
          },
          // push: { quantity: 4 }, // Optional
        },
      },
      particles: {
        color: {
          value: theme === 'dark' 
            ? ["#6B7280", "#9CA3AF", "#D1D5DB"] // Tailwind gray-500, gray-400, gray-300 for dark
            : ["#9CA3AF", "#D1D5DB", "#E5E7EB"], // Tailwind gray-400, gray-300, gray-200 for light
        },
        // links: { // Optional: Restore links if desired
        //   color: "#aaaaaa",
        //   distance: 150,
        //   enable: true,
        //   opacity: 0.3,
        //   width: 1,
        // },
        move: {
          direction: "none",
          enable: true,
          outModes: {
            default: "bounce", // Change back to bounce if preferred over "out"
          },
          random: true,
          speed: 0.5, // Restore slower speed
          straight: false,
        },
        number: {
          density: {
            enable: true,
             area: 800, // Restore density area if needed
          },
          value: 500, // Reduced particle count back to 500
        },
        opacity: {
          value: {min: 0.1, max: 0.5}, // Restore random opacity
          animation: { // Restore opacity animation
            enable: true,
            speed: 0.5,
            sync: false
          }
        },
        shape: {
          type: "circle",
        },
        size: {
          value: { min: 4, max: 8 }, // Increased particle size range further
        },
      },
      detectRetina: true,
    }),
    [theme],
  );

  if (init) {
    return (
      <Particles
        id="tsparticles"
        particlesLoaded={particlesLoaded}
        options={options}
        className="absolute inset-0 -z-10 blur-sm" // Changed back to blur-sm
      />
    );
  } else {
     // console.log("Particles engine not initialized yet."); // Removed log
     return <></>; 
  }
};

export default ParticleBackground; 