import React, { useEffect, useRef } from 'react';

interface AuthCardProps {
  children: React.ReactNode;
  logo?: boolean;
  title: string;
  subtitle?: string;
}

const AuthCard: React.FC<AuthCardProps> = ({ 
  children, 
  logo = true, 
  title, 
  subtitle 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Create particles
    const particlesArray: Particle[] = [];
    const numberOfParticles = 50;
    
    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;
      
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 3 + 1;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.color = `rgba(255, 193, 169, ${Math.random() * 0.2})`;
      }
      
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        
        if (this.x > canvas.width) this.x = 0;
        else if (this.x < 0) this.x = canvas.width;
        
        if (this.y > canvas.height) this.y = 0;
        else if (this.y < 0) this.y = canvas.height;
      }
      
      draw() {
        if (!ctx) return;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    const init = () => {
      for (let i = 0; i < numberOfParticles; i++) {
        particlesArray.push(new Particle());
      }
    };
    
    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Create radial gradient
      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 2
      );
      gradient.addColorStop(0, 'rgba(30, 12, 12, 1)');
      gradient.addColorStop(1, 'rgba(15, 15, 15, 1)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw();
      }
      
      requestAnimationFrame(animate);
    };
    
    init();
    animate();
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full -z-10"
      />
      
      <div className="w-full max-w-md px-4 py-12 relative z-10">
        <div className="flex flex-col items-center mb-8">
          {logo && (
            <div className="mb-4 transition-transform hover:scale-105 duration-300">
              <img 
                src="/src/assets/gavel-icon.svg" 
                alt="Paralegal AI Assistant Logo" 
                className="h-20 w-20 text-primary"
                onError={(e) => {
                  // Fallback to an emoji if the image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const div = document.createElement('div');
                    div.textContent = '⚖️';
                    div.className = 'text-6xl';
                    parent.appendChild(div);
                  }
                }}
              />
            </div>
          )}
          <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">
            Paralegal AI Assistant
          </h1>
          <p className="text-gray-400 mb-8">Your intelligent legal document assistant</p>
          <h2 className="text-2xl font-medium text-white mb-2 tracking-tight">{title}</h2>
          {subtitle && <p className="text-gray-400 text-center max-w-sm">{subtitle}</p>}
        </div>
        
        <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
          {children}
        </div>
        
        <div className="mt-5 text-center text-xs text-gray-500">
          <span>Secure authentication powered by Paralegal AI</span>
        </div>
      </div>
    </div>
  );
};

export default AuthCard;