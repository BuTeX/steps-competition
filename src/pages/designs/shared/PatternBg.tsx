interface PatternBgProps {
  pattern?: '1' | '2';
  className?: string;
  opacity?: number;
}

export function PatternBg({ pattern = '1', className = '', opacity = 0.1 }: PatternBgProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 -z-10 ${className}`}
      style={{
        backgroundImage: `url(/brandbook/pattern-${pattern}.svg)`,
        backgroundSize: '400px',
        backgroundRepeat: 'repeat',
        opacity,
      }}
    />
  );
}
