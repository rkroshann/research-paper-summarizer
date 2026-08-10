"use client";

import React, { useEffect, useState } from "react";
import mermaid from "mermaid";

interface MermaidChartProps {
  chart: string;
}

export default function MermaidChart({ chart }: MermaidChartProps) {
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
      fontFamily: "var(--font-sans)",
      themeVariables: {
        primaryColor: "#050505",
        primaryTextColor: "#fff",
        primaryBorderColor: "#5EF2FF",
        lineColor: "#8A6DFF",
        secondaryColor: "#101010",
        tertiaryColor: "#0B0B0B"
      }
    });

    let isMounted = true;

    const renderChart = async () => {
      try {
        // Generate a unique ID for this chart instance
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg: svgCode } = await mermaid.render(id, chart);
        if (isMounted) {
          setSvg(svgCode);
        }
      } catch (e) {
        console.error("Mermaid rendering error", e);
        if (isMounted) {
          setSvg("<div class='text-red-400 p-4'>Failed to render flowchart.</div>");
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart]);

  return (
    <div 
      className="mermaid flex justify-center w-full overflow-x-auto p-4 rounded-xl bg-[#050505]/50 border border-white/5" 
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
