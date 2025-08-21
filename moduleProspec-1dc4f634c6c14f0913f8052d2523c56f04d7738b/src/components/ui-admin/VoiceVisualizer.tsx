import React, { useEffect, useRef, useState } from 'react';

interface VoiceVisualizerProps {
  audioElement?: HTMLAudioElement;
  isActive?: boolean;
  className?: string;
}

const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ 
  audioElement, 
  isActive = false, 
  className = '' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyzerRef = useRef<AnalyserNode>();
  const audioContextRef = useRef<AudioContext>();
  const sourceRef = useRef<MediaElementAudioSourceNode>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Number of bars to display
  const barCount = 30;
  const barWidth = 2;
  const barSpacing = 1;

  useEffect(() => {
    if (!audioElement || !isActive) {
      cleanup();
      return;
    }

    const setupAudioAnalysis = async () => {
      try {
        // Create audio context and analyzer
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyzer = audioContext.createAnalyser();
        
        // Configure analyzer
        analyzer.fftSize = 256;
        analyzer.smoothingTimeConstant = 0.8;
        
        // Create source from audio element
        const source = audioContext.createMediaElementSource(audioElement);
        source.connect(analyzer);
        analyzer.connect(audioContext.destination);
        
        audioContextRef.current = audioContext;
        analyzerRef.current = analyzer;
        sourceRef.current = source;
        
        setIsAnalyzing(true);
        startVisualization();
        
      } catch (error) {
        console.error('Error setting up audio analysis:', error);
      }
    };

    if (audioElement.srcObject) {
      setupAudioAnalysis();
    }

    return cleanup;
  }, [audioElement, isActive]);

  const cleanup = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    setIsAnalyzing(false);
  };

  const startVisualization = () => {
    if (!analyzerRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyzer = analyzerRef.current;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const animate = () => {
      if (!isAnalyzing) return;

      analyzer.getByteFrequencyData(dataArray);
      
      // Clear canvas
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate bar dimensions
      const totalBarsWidth = barCount * barWidth + (barCount - 1) * barSpacing;
      const startX = (canvas.width - totalBarsWidth) / 2;
      
      // Calculate overall voice activity level
      const averageAmplitude = dataArray.reduce((sum, val) => sum + val, 0) / bufferLength / 255;
      const voiceThreshold = 0.02; // Threshold below which we consider it silence
      
      // Draw frequency wave
      for (let i = 0; i < barCount; i++) {
        const x = startX + i * (barWidth + barSpacing);
        
        if (averageAmplitude < voiceThreshold) {
          // Silence - draw flat line in center
          const centerY = canvas.height / 2;
          const flatLineHeight = 2;
          const y = centerY - flatLineHeight / 2;
          
          ctx.fillStyle = '#D1D5DB';
          ctx.beginPath();
          if (typeof (ctx as any).roundRect === 'function') {
            (ctx as any).roundRect(x, y, barWidth, flatLineHeight, 1);
          } else {
            ctx.rect(x, y, barWidth, flatLineHeight);
          }
          ctx.fill();
        } else {
          // Voice detected - create wave based on frequency data
          const dataIndex = Math.floor((i / barCount) * bufferLength * 0.3); // Focus on speech frequencies
          const localAmplitude = dataArray[dataIndex] / 255;
          
          // Create wave amplitude that increases with voice intensity
          const waveIntensity = Math.max(0, (averageAmplitude - voiceThreshold) * 8); // Amplify above threshold
          const timeOffset = Date.now() * 0.006;
          const waveVariation = Math.sin(timeOffset + i * 0.4) * waveIntensity * canvas.height * 0.4;
          
          // Base height in center, with wave variation
          const centerY = canvas.height / 2;
          const baselineHeight = 3;
          const totalHeight = Math.max(baselineHeight, Math.abs(waveVariation) + baselineHeight);
          
          // Calculate y position (wave can go up or down from center)
          const y = waveVariation > 0 
            ? centerY - totalHeight / 2
            : centerY - totalHeight / 2;
          
          // Color intensity based on amplitude
          const colorIntensity = Math.min(1, localAmplitude * 3);
          const blue = Math.floor(37 + colorIntensity * 100); // From #2563EB to darker
          const green = Math.floor(99 + colorIntensity * 50);
          const red = Math.floor(235 - colorIntensity * 100);
          
          ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
          
          ctx.beginPath();
          if (typeof (ctx as any).roundRect === 'function') {
            (ctx as any).roundRect(x, y, barWidth, totalHeight, 1);
          } else {
            ctx.rect(x, y, barWidth, totalHeight);
          }
          ctx.fill();
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  // Fallback animation when no audio is available
  const startIdleAnimation = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      if (isAnalyzing) return;

      // Clear canvas
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const totalBarsWidth = barCount * barWidth + (barCount - 1) * barSpacing;
      const startX = (canvas.width - totalBarsWidth) / 2;

      for (let i = 0; i < barCount; i++) {
        // Draw flat line in center when idle
        const centerY = canvas.height / 2;
        const flatLineHeight = 2;
        const y = centerY - flatLineHeight / 2;
        const x = startX + i * (barWidth + barSpacing);
        
        ctx.fillStyle = '#D1D5DB';
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(x, y, barWidth, flatLineHeight, 1);
        } else {
          ctx.rect(x, y, barWidth, flatLineHeight);
        }
        ctx.fill();
      }

      if (!isAnalyzing) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animate();
  };

  useEffect(() => {
    if (!isAnalyzing && isActive) {
      startIdleAnimation();
    }
  }, [isAnalyzing, isActive]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        width={140}
        height={40}
        className="rounded-md bg-white border border-gray-200 shadow-sm"
        style={{ 
          width: '140px', 
          height: '40px',
          display: isActive ? 'block' : 'none'
        }}
      />
      {!isActive && (
        <div className="w-[140px] h-[40px] rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center">
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceVisualizer;