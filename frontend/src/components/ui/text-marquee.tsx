"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface TextMarqueeProps {
  children: React.ReactNode[];
  speed?: number;
  className?: string;
  prefix?: React.ReactNode;
}

export function TextMarquee({
  children,
  speed = 2,
  className,
  prefix,
}: TextMarqueeProps) {
  const items = React.Children.toArray(children);
  const [index, setIndex] = useState(0);
  const [sliding, setSliding] = useState(false);
  const [itemH, setItemH] = useState(0);
  const [maxW, setMaxW] = useState(0);
  const measureRef = useRef<HTMLDivElement>(null);

  // Measure the height and max width across ALL items after mount
  const measure = useCallback(() => {
    if (!measureRef.current) return;
    const container = measureRef.current;
    const spans = container.querySelectorAll<HTMLElement>("[data-measure-item]");
    let h = 0;
    let w = 0;
    spans.forEach((el) => {
      h = Math.max(h, el.offsetHeight);
      w = Math.max(w, el.offsetWidth);
    });
    setItemH(h || container.offsetHeight);
    setMaxW(w);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useEffect(() => {
    if (!itemH) return;
    const interval = setInterval(() => {
      setSliding(true);
    }, speed * 1000);
    return () => clearInterval(interval);
  }, [itemH, speed]);

  function handleTransitionEnd() {
    setSliding(false);
    setIndex((i) => (i + 1) % items.length);
  }

  const current = items[index];
  const next = items[(index + 1) % items.length];

  return (
    <div className={cn("flex relative", className)}>
      <div className="flex flex-row items-baseline gap-[0.3em]">
        {prefix && <div className="whitespace-nowrap shrink-0">{prefix}</div>}
        <div
          style={{
            height: itemH || "auto",
            width: maxW || "auto",
            minWidth: maxW || "auto",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Hidden measurer — renders ALL items to find max width & height */}
          <div
            ref={measureRef}
            aria-hidden
            style={{
              visibility: "hidden",
              position: "absolute",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              top: 0,
              left: 0,
            }}
          >
            {items.map((item, i) => (
              <div key={i} data-measure-item style={{ display: "inline-block" }}>
                {item}
              </div>
            ))}
          </div>

          {/* Sliding pair */}
          <div
            onTransitionEnd={handleTransitionEnd}
            style={{
              transform: sliding
                ? `translateY(-${itemH}px)`
                : "translateY(0)",
              transition: sliding
                ? "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)"
                : "none",
            }}
          >
            <div
              style={{
                height: itemH || "auto",
                display: "flex",
                alignItems: "center",
                whiteSpace: "nowrap",
              }}
            >
              {current}
            </div>
            <div
              style={{
                height: itemH || "auto",
                display: "flex",
                alignItems: "center",
                whiteSpace: "nowrap",
              }}
            >
              {next}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
