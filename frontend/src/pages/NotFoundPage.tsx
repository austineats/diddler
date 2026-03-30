import { useNavigate } from "react-router-dom";
import { useState } from "react";

const pixelFont = { fontFamily: "'Press Start 2P', monospace" };

export function NotFoundPage() {
  const navigate = useNavigate();
  const [hovering, setHovering] = useState(false);

  return (
    <div
      className="min-h-screen bg-[#0d0d1a] flex flex-col items-center justify-center text-center px-4 sm:px-6 relative overflow-hidden"
      style={pixelFont}
    >
      {/* Pixel stars background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {[
          { top: "8%", left: "12%", size: 4, color: "#fff1e8", delay: "0s" },
          { top: "15%", left: "75%", size: 3, color: "#ffec27", delay: "0.5s" },
          { top: "22%", left: "40%", size: 2, color: "#c2c3c7", delay: "1s" },
          { top: "35%", left: "88%", size: 4, color: "#fff1e8", delay: "0.3s" },
          { top: "50%", left: "5%", size: 3, color: "#29adff", delay: "0.7s" },
          { top: "65%", left: "60%", size: 2, color: "#fff1e8", delay: "1.2s" },
          { top: "78%", left: "25%", size: 4, color: "#ffec27", delay: "0.1s" },
          { top: "85%", left: "90%", size: 3, color: "#c2c3c7", delay: "0.9s" },
          { top: "12%", left: "55%", size: 2, color: "#fff1e8", delay: "0.4s" },
          { top: "42%", left: "30%", size: 3, color: "#29adff", delay: "1.1s" },
          { top: "70%", left: "70%", size: 4, color: "#fff1e8", delay: "0.6s" },
          { top: "90%", left: "45%", size: 2, color: "#ffec27", delay: "0.8s" },
        ].map((star, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              backgroundColor: star.color,
              animation: `pixelBlink 2s step-end ${star.delay} infinite`,
            }}
          />
        ))}
      </div>

      {/* Pixel ghost */}
      <div className="mb-8 relative" aria-hidden="true">
        <div className="flex flex-col items-center">
          {/* Ghost body - pixel art using divs */}
          <div className="grid" style={{ gridTemplateColumns: "repeat(10, 8px)", gap: 0 }}>
            {/* Row 1 - top of head */}
            {[0,0,0,1,1,1,1,0,0,0].map((v, i) => (
              <div key={`r1-${i}`} style={{ width: 8, height: 8, backgroundColor: v ? "#c2c3c7" : "transparent" }} />
            ))}
            {/* Row 2 */}
            {[0,0,1,1,1,1,1,1,0,0].map((v, i) => (
              <div key={`r2-${i}`} style={{ width: 8, height: 8, backgroundColor: v ? "#fff1e8" : "transparent" }} />
            ))}
            {/* Row 3 */}
            {[0,1,1,1,1,1,1,1,1,0].map((v, i) => (
              <div key={`r3-${i}`} style={{ width: 8, height: 8, backgroundColor: v ? "#fff1e8" : "transparent" }} />
            ))}
            {/* Row 4 - eyes */}
            {[0,1,2,2,1,1,2,2,1,0].map((v, i) => (
              <div key={`r4-${i}`} style={{ width: 8, height: 8, backgroundColor: v === 2 ? "#1d2b53" : v === 1 ? "#fff1e8" : "transparent" }} />
            ))}
            {/* Row 5 */}
            {[0,1,1,1,1,1,1,1,1,0].map((v, i) => (
              <div key={`r5-${i}`} style={{ width: 8, height: 8, backgroundColor: v ? "#fff1e8" : "transparent" }} />
            ))}
            {/* Row 6 */}
            {[1,1,1,1,1,1,1,1,1,1].map((v, i) => (
              <div key={`r6-${i}`} style={{ width: 8, height: 8, backgroundColor: v ? "#fff1e8" : "transparent" }} />
            ))}
            {/* Row 7 */}
            {[1,1,1,1,1,1,1,1,1,1].map((v, i) => (
              <div key={`r7-${i}`} style={{ width: 8, height: 8, backgroundColor: v ? "#c2c3c7" : "transparent" }} />
            ))}
            {/* Row 8 - bottom jagged edge */}
            {[1,1,0,1,1,1,1,0,1,1].map((v, i) => (
              <div key={`r8-${i}`} style={{ width: 8, height: 8, backgroundColor: v ? "#c2c3c7" : "transparent" }} />
            ))}
            {/* Row 9 - feet */}
            {[1,0,0,1,0,0,1,0,0,1].map((v, i) => (
              <div key={`r9-${i}`} style={{ width: 8, height: 8, backgroundColor: v ? "#c2c3c7" : "transparent" }} />
            ))}
          </div>
        </div>
      </div>

      {/* 404 */}
      <h1
        className="text-[#ff004d] text-6xl sm:text-8xl mb-4 leading-none tracking-widest"
        style={{
          ...pixelFont,
          textShadow: "4px 4px 0 #1d2b53, 8px 8px 0 rgba(0,0,0,0.3)",
        }}
      >
        404
      </h1>

      {/* GAME OVER */}
      <div
        className="border-4 border-[#ffec27] bg-[#1d2b53] px-6 py-3 mb-4"
        style={{ boxShadow: "4px 4px 0 #0d0d1a" }}
      >
        <h2
          className="text-[#ffec27] text-lg sm:text-2xl tracking-wider"
          style={pixelFont}
        >
          GAME OVER
        </h2>
      </div>

      {/* Subtitle */}
      <p
        className="text-[#c2c3c7] text-[10px] sm:text-xs mb-2 leading-relaxed"
        style={pixelFont}
      >
        PAGE NOT FOUND
      </p>
      <p
        className="text-[#29adff] text-[8px] sm:text-[10px] mb-10 leading-relaxed"
        style={pixelFont}
      >
        You wandered into the void...
      </p>

      {/* Score display */}
      <div className="flex gap-6 mb-10">
        <div
          className="border-4 border-[#29adff] bg-[#1d2b53] px-4 py-2"
          style={{ boxShadow: "4px 4px 0 #0d0d1a" }}
        >
          <p className="text-[#c2c3c7] text-[7px] sm:text-[8px] mb-1" style={pixelFont}>
            SCORE
          </p>
          <p className="text-[#fff1e8] text-sm sm:text-base" style={pixelFont}>
            00000
          </p>
        </div>
        <div
          className="border-4 border-[#29adff] bg-[#1d2b53] px-4 py-2"
          style={{ boxShadow: "4px 4px 0 #0d0d1a" }}
        >
          <p className="text-[#c2c3c7] text-[7px] sm:text-[8px] mb-1" style={pixelFont}>
            LIVES
          </p>
          <p className="text-[#ff004d] text-sm sm:text-base" style={pixelFont}>
            0
          </p>
        </div>
      </div>

      {/* Continue button */}
      <button
        onClick={() => navigate("/")}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className="border-4 border-[#fff1e8] px-8 py-4 text-sm sm:text-base tracking-wider"
        style={{
          ...pixelFont,
          backgroundColor: hovering ? "#ff004d" : "#1d2b53",
          color: "#fff1e8",
          boxShadow: hovering
            ? "4px 4px 0 #8b0029"
            : "4px 4px 0 #0d0d1a",
          cursor: "pointer",
          transition: "none",
        }}
      >
        {hovering ? "> CONTINUE <" : "CONTINUE?"}
      </button>

      {/* Insert coin hint */}
      <p
        className="text-[#c2c3c7] text-[7px] sm:text-[8px] mt-6"
        style={{
          ...pixelFont,
          animation: "pixelBlink 1.5s step-end infinite",
        }}
      >
        INSERT COIN TO CONTINUE
      </p>

      {/* Keyframe animation */}
      <style>{`
        @keyframes pixelBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
