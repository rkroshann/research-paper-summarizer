"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Maximize, ZoomIn, ZoomOut, Search } from "lucide-react";
import GraphPanel from "./GraphPanel";

// Dynamically import to avoid SSR issues with canvas
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface GraphData {
  nodes: { id: string; label: string; group?: string; color?: string }[];
  edges: { source: string; target: string; label: string; type: string; color?: string }[];
}

export default function InteractiveGraph({ data, sessionId }: { data: GraphData | null, sessionId: string }) {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [selectedItem, setSelectedItem] = useState<{ type: "node" | "edge"; data: any } | null>(null);
  const [search, setSearch] = useState("");
  const fgRef = useRef<any>();

  useEffect(() => {
    if (data && data.nodes) {
      // Add colors based on edge types
      const styledEdges = data.edges.map(e => {
        let color = "#5EF2FF";
        let lineDash = undefined;
        if (e.type === "contradiction") color = "#FF5E5E";
        if (e.type === "similarity") { color = "#8A6DFF"; lineDash = [5, 5]; }
        if (e.type === "citation") color = "#A3A3A3";
        return { ...e, color, lineDash };
      });
      
      const styledNodes = data.nodes.map(n => ({
        ...n,
        color: "#ffffff"
      }));

      setGraphData({ nodes: styledNodes, edges: styledEdges });
    }
  }, [data]);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedItem({ type: "node", data: node });
    
    // Zoom to node
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(2, 2000);
    }
  }, []);

  const handleLinkClick = useCallback((link: any) => {
    setSelectedItem({ type: "edge", data: link });
  }, []);

  const handleZoomIn = () => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      fgRef.current.zoom(currentZoom * 1.5, 500);
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      fgRef.current.zoom(currentZoom / 1.5, 500);
    }
  };

  const handleFit = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(500, 50);
    }
  };

  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <div className="w-full h-[600px] bg-[#050505] border border-white/10 rounded-2xl flex items-center justify-center text-white/50">
        No relationships identified or invalid graph data.
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px] bg-[#050505] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      {/* Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="flex items-center bg-white/5 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-md">
          <Search className="w-4 h-4 text-white/50 mr-2" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search papers..." 
            className="bg-transparent text-sm focus:outline-none w-32 focus:w-48 transition-all"
          />
        </div>
        <div className="flex flex-col bg-white/5 border border-white/10 rounded-xl backdrop-blur-md w-fit overflow-hidden">
          <button onClick={handleZoomIn} className="p-2 hover:bg-white/10 transition-colors border-b border-white/10 text-white/70 hover:text-white" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={handleZoomOut} className="p-2 hover:bg-white/10 transition-colors border-b border-white/10 text-white/70 hover:text-white" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
          <button onClick={handleFit} className="p-2 hover:bg-white/10 transition-colors text-white/70 hover:text-white" title="Fit to Screen"><Maximize className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-md text-xs space-y-2">
        <h4 className="font-semibold text-white/80 border-b border-white/10 pb-1 mb-2">Relationships</h4>
        <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-[#5EF2FF]"></div> Generic</div>
        <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-[#FF5E5E]"></div> Contradicts</div>
        <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-[#8A6DFF] border-t border-dashed border-[#8A6DFF] h-0"></div> Similarity</div>
        <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-[#A3A3A3]"></div> Citation</div>
      </div>

      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeLabel="label"
        nodeColor={node => {
          if (search && node.label.toLowerCase().includes(search.toLowerCase())) return "#FFD700";
          return selectedItem?.data?.id === node.id ? "#5EF2FF" : "#ffffff";
        }}
        nodeRelSize={6}
        linkColor={(link: any) => link.color}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.2}
        onNodeClick={handleNodeClick}
        onLinkClick={handleLinkClick}
        linkLineDash={(link: any) => link.lineDash}
        backgroundColor="#050505"
      />

      <GraphPanel selectedItem={selectedItem} onClose={() => setSelectedItem(null)} sessionId={sessionId} />
    </div>
  );
}
