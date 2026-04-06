'use client';

import React from 'react';
import SimpleParallax from 'simple-parallax-js';

interface ParallaxImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  scale?: number;
  delay?: number;
  orientation?: "up" | "right" | "down" | "left" | "up left" | "up right" | "down left" | "down right";
  transition?: string;
  overflow?: boolean;
}

/**
 * A wrapper for SimpleParallax from simple-parallax-js.
 */
export default function ParallaxImage({ 
  scale = 1.2, 
  delay = 0.4, 
  orientation = 'up', 
  transition = 'cubic-bezier(0,0,0,1)',
  overflow = false,
  className = '',
  style,
  ...props 
}: ParallaxImageProps) {
  return (
    <SimpleParallax
      scale={scale}
      delay={delay}
      orientation={orientation}
      transition={transition}
      overflow={overflow}
    >
      <img 
        className={className}
        style={{ 
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          ...style 
        }}
        {...props} 
      />
    </SimpleParallax>
  );
}
