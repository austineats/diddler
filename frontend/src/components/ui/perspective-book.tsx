"use client";

import React from "react";
import { cn } from "@/lib/utils";

const sizeMap = {
  sm: { width: "150px", spineTranslation: "122px" },
  default: { width: "196px", spineTranslation: "168px" },
  lg: { width: "300px", spineTranslation: "272px" },
};

interface PerspectiveBookProps {
  size?: "sm" | "default" | "lg";
  className?: string;
  children: React.ReactNode;
  textured?: boolean;
}

export function PerspectiveBook({
  size = "default",
  className = "",
  children,
  textured = false,
}: PerspectiveBookProps) {
  const defaultColorClasses =
    'bg-neutral-100 dark:bg-[#1f1f1f] dark:before:content-[""] dark:before:bg-gradient-to-b dark:before:from-[#ffffff1a] dark:before:to-transparent dark:before:absolute dark:before:inset-0 dark:before:rounded-[inherit] text-primary';

  return (
    <div
      className={`z-10 group [perspective:900px] w-min h-min`}
    >
      <div
        style={{
          width: sizeMap[size].width,
          borderRadius: "6px 4px 4px 6px",
        }}
        className={`transition-transform duration-300 ease-out relative [transform-style:preserve-3d] [transform:rotateY(0deg)] group-hover:[transform:rotateY(-20deg)] group-hover:scale-[1.066] group-hover:-translate-x-1 aspect-[49/60]`}
      >
        {/* Front Side */}
        <div
          className={cn(
            `absolute inset-y-0 overflow-hidden size-full left-0 flex flex-col p-[12%] after:content-[''] after:absolute after:inset-0 after:shadow-[0_1.8px_3.6px_#0000000d,_0_10.8px_21.6px_#00000014,_inset_0_-.9px_#0000001a,_inset_0_1.8px_1.8px_#ffffff1a,_inset_3.6px_0_3.6px_#0000001a] after:pointer-events-none after:rounded-[inherit] after:border-[#00000014] after:border after:border-solid`,
            className || defaultColorClasses,
          )}
          style={{
            transform: "translateZ(25px)",
            borderRadius: "6px 4px 4px 6px",
          }}
        >
          <div
            className="absolute left-0 top-0 h-full opacity-40"
            style={{
              minWidth: "8.2%",
              background:
                "linear-gradient(90deg, hsla(0, 0%, 100%, 0), hsla(0, 0%, 100%, 0) 12%, hsla(0, 0%, 100%, .25) 29.25%, hsla(0, 0%, 100%, 0) 50.5%, hsla(0, 0%, 100%, 0) 75.25%, hsla(0, 0%, 100%, .25) 91%, hsla(0, 0%, 100%, 0)), linear-gradient(90deg, rgba(0, 0, 0, .03), rgba(0, 0, 0, .1) 12%, transparent 30%, rgba(0, 0, 0, .02) 50%, rgba(0, 0, 0, .2) 73.5%, rgba(0, 0, 0, .5) 75.25%, rgba(0, 0, 0, .15) 85.25%, transparent)",
            }}
          >
          </div>
          <div className="pl-1 h-full">
            {children}
          </div>
          {textured && (
            <div
              className="absolute inset-0 mix-blend-hard-light rotate-180 opacity-50 brightness-110 bg-no-repeat bg-cover pointer-events-none"
              style={{
                borderRadius: "6px 4px 4px 6px",
                backgroundImage:
                  "url(data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgADWZEAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAB4AAAAT6AAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQwMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAA...)",
              }}
            />
          )}
        </div>

        {/* Pages — visible between front and back covers */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="absolute inset-y-[2px] size-[calc(100%-2px)] right-0"
            style={{
              transform: `translateZ(${20 - i * 5}px)`,
              borderRadius: "0 4px 4px 0",
              background: i % 2 === 0 ? "#e8e4df" : "#ddd8d2",
              borderRight: "1px solid #ccc8c2",
            }}
          />
        ))}

        {/* Spine */}
        <div
          className={cn(
            "absolute inset-y-0 w-[50px]",
            className
              ? className.replace(/rounded[^ ]*/g, "").replace(/border-\[[^\]]*\]/g, "")
              : "bg-neutral-200 dark:bg-[#1a1a1a]"
          )}
          style={{
            transform: `translateX(-100%) rotateY(-90deg)`,
            transformOrigin: "right center",
            borderRadius: "6px 0 0 6px",
          }}
        />

        {/* Back */}
        <div
          className={cn(
            "absolute inset-y-0 size-full",
            className
              ? className.replace(/rounded[^ ]*/g, "").replace(/border-\[[^\]]*\]/g, "")
              : "bg-neutral-100 dark:bg-[#1f1f1f]"
          )}
          style={{
            transform: "translateZ(-50px)",
            borderRadius: "6px 4px 4px 6px",
          }}
        />
      </div>
    </div>
  );
}
