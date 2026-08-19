"use client";

import { useState } from "react";
import { X, Send, Loader2, Link as LinkIcon, FileText } from "lucide-react";

interface GraphPanelProps {
  selectedItem: { type: "node" | "edge"; data: any } | null;
  onClose: () => void;
  sessionId: string;
}

export default function GraphPanel({ selectedItem, onClose, sessionId }: GraphPanelProps) {
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{role: "user"|"ai", text: string}[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Reset chat when selected item changes
  if (!selectedItem) return null;

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: userMessage }]);
    setIsChatLoading(true);

    try {
      const res = await fetch("http://localhost:5001/api/graph-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          session_id: sessionId,
          message: userMessage,
          paper_a: selectedItem.type === "edge" ? selectedItem.data.source.label : selectedItem.data.label,
          paper_b: selectedItem.type === "edge" ? selectedItem.data.target.label : undefined,
        })
      });

      if (!res.ok) throw new Error("Chat request failed");
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: "ai", text: data.answer }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: "ai", text: "Error connecting to GraphRAG." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="absolute top-0 right-0 h-full w-[400px] bg-[#0B0B0B]/95 backdrop-blur-2xl border-l border-white/10 p-6 flex flex-col z-10 shadow-2xl overflow-hidden transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold flex items-center gap-2">
          {selectedItem.type === "edge" ? <LinkIcon className="text-[#5EF2FF]" /> : <FileText className="text-[#8A6DFF]" />}
          {selectedItem.type === "edge" ? "Relationship Analysis" : "Paper Details"}
        </h3>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        {selectedItem.type === "edge" ? (
          <div className="space-y-4">
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <p className="text-xs text-white/50 mb-1">Source Paper</p>
              <p className="text-sm font-medium">{selectedItem.data.source.label}</p>
            </div>
            <div className="flex justify-center text-[#5EF2FF] py-2 font-mono text-sm uppercase tracking-widest">
              ↓ {selectedItem.data.label} ↓
            </div>
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <p className="text-xs text-white/50 mb-1">Target Paper</p>
              <p className="text-sm font-medium">{selectedItem.data.target.label}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="text-xl font-bold text-[#5EF2FF]">{selectedItem.data.label}</h4>
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <p className="text-xs text-white/50 mb-2">Paper Node ID: {selectedItem.data.id}</p>
              <p className="text-sm text-white/80">Select an edge connected to this paper to analyze relationships, or ask a question below.</p>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-white/10 space-y-4">
          <h4 className="text-sm font-semibold">GraphRAG Chat</h4>
          <div className="space-y-3 min-h-[150px]">
            {chatMessages.length === 0 && (
              <p className="text-xs text-white/40 italic">
                {selectedItem.type === "edge" 
                  ? "Example: Why does Paper A contradict Paper B?"
                  : "Example: What is the main finding of this paper?"}
              </p>
            )}
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`p-3 rounded-lg text-sm ${msg.role === "user" ? "bg-white/10 ml-8" : "bg-[#5EF2FF]/10 border border-[#5EF2FF]/20 mr-8 whitespace-pre-wrap break-words"}`}>
                {msg.text}
              </div>
            ))}
            {isChatLoading && (
              <div className="p-3 rounded-lg bg-[#5EF2FF]/5 border border-[#5EF2FF]/10 mr-8 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#5EF2FF]" />
                <span className="text-xs text-white/50">Analyzing references...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-white/10 mt-auto shrink-0">
        <form onSubmit={handleAsk} className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask about this connection..."
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#5EF2FF]/50 transition-colors"
          />
          <button
            type="submit"
            disabled={isChatLoading || !chatInput.trim()}
            className="w-10 h-10 shrink-0 rounded-full bg-[#5EF2FF] text-black flex items-center justify-center hover:bg-[#5EF2FF]/90 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
