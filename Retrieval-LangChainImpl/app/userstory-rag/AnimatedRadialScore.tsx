import React, { useEffect, useState } from 'react';

interface RadialScoreProps {
  score: number;   // out of 10
  size?: number;   // diameter in px
}

const AnimatedRadialScore: React.FC<RadialScoreProps> = ({ score, size = 140 }) => {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [progress, setProgress] = useState(0); // Animated value from 0 to score

  useEffect(() => {
    let start = 0;
    const end = (score / 10) * 100; // Convert to percentage
    const duration = 800;
    const increment = 1;

    const animate = () => {
      if (start < end) {
        start += increment;
        setProgress(Math.min(start, end));
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [score]);

  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          stroke="#e5e7eb" // Tailwind's gray-200
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          stroke="#6366f1" // Tailwind's indigo-500
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            transition: 'stroke-dashoffset 0.5s ease-out',
            transform: 'rotate(-90deg)',
            transformOrigin: 'center',
          }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-indigo-600">{score.toFixed(1)}%</div>
        <div className="text-xs text-gray-500"></div>
      </div>
    </div>
  );
};

export default AnimatedRadialScore;
