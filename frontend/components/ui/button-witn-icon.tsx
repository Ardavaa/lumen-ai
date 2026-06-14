import { Button } from "@/components/ui/button";
import type { ButtonHTMLAttributes } from "react";

const ButtonWithIconDemo = (props: ButtonHTMLAttributes<HTMLButtonElement>) => {
  return (
    <Button {...props} className={`relative text-sm font-medium rounded-full h-12 p-1 ps-6 pe-14 group transition-all duration-500 hover:ps-12 hover:pe-8 w-fit overflow-hidden cursor-pointer bg-[#0A0D14] text-white hover:bg-white hover:text-[#0A0D14] border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)] ${props.className || ""}`}>
      <span className="relative z-10 block transition-all duration-500 ease-out group-hover:translate-x-3">
        Start Simulation
      </span>
      <div className="absolute right-1 w-10 h-10 bg-white text-[#0A0D14] rounded-full flex items-center justify-center transition-all duration-500 group-hover:right-[calc(100%-44px)] group-hover:rotate-45 group-hover:bg-[#0A0D14] group-hover:text-white">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#0A0D14] group-hover:text-white">
          <line x1="7" y1="17" x2="17" y2="7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      </div>
    </Button>
  );
};

export default ButtonWithIconDemo;
