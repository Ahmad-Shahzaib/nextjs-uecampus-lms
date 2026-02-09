import type { ComponentPropsWithoutRef } from "react";

interface UECampusLogoLinkProps {
  className?: string;
  containerClassName?: string;
}

export function UECampusLogoLink({
  className = "h-20 w-auto",
  containerClassName = "",
}: UECampusLogoLinkProps) {
  return (
    <a
      href="https://www.uecampus.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Visit UECampus homepage"
      className={`inline-flex items-center ${containerClassName}`.trim()}
    >
      <img src="/logo.png" alt="UECampus logo" className={className} />
      <span className="sr-only">Visit the UECampus website</span>
    </a>
  );
}
