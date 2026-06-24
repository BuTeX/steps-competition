interface BrandLogoProps {
  className?: string;
  alt?: string;
}

export function BrandLogo({ className = 'h-10', alt = 'Гуд Программ' }: BrandLogoProps) {
  return (
    <img
      src="/brandbook/logo.png"
      alt={alt}
      className={`object-contain ${className}`}
    />
  );
}
