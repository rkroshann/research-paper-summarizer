"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, Loader2, User, Bot } from "lucide-react";

export default function PaperChat({ sessionId }: { sessionId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: "user" | "ai", text: string}[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Analyzing the paper...");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setLoadingText("Analyzing the paper...");
      interval = setInterval(() => {
        setLoadingText(prev => prev === "Analyzing the paper..." ? "Writing the answer..." : "Analyzing the paper...");
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const userMessage = text.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMessage }]);
    setIsLoading(true);

    if (sessionId === "mock_session") {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: "ai", text: "This is a simulated response since the backend is currently offline. In a real environment, I would answer based on the document's context." }]);
        setIsLoading(false);
      }, 2000);
      return;
    }

    try {
      const res = await fetch("http://localhost:5001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: userMessage }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const data = await res.json();
      setMessages(prev => [...prev, { role: "ai", text: data.answer }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: "ai", text: "I'm sorry, I encountered an error connecting to the knowledge base." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const SUGGESTED_QUESTIONS = [
    "What is the main contribution?",
    "Explain the methodology simply.",
    "What are the key results?",
  ];

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-4 w-[350px] sm:w-[450px] h-[600px] rounded-2xl border border-white/10 bg-[#0B0B0B]/95 backdrop-blur-xl shadow-2xl shadow-[#5EF2FF]/10 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-white/[0.02] flex items-center gap-3 shrink-0">
              <MessageSquare className="w-5 h-5 text-[#5EF2FF]" />
              <h3 className="text-sm font-medium tracking-wide">Research Assistant</h3>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-70">
                  <Bot className="w-10 h-10 mb-2 text-[#5EF2FF]" />
                  <p className="text-sm">Ask me anything about this paper.</p>
                  <p className="text-xs opacity-50 px-8">I will only answer using the document context and provide exact page citations.</p>
                  
                  <div className="flex flex-col gap-2 mt-4 w-full px-6">
                    {SUGGESTED_QUESTIONS.map((q, i) => (
                      <button 
                        key={i}
                        onClick={() => handleSend(q)}
                        className="text-xs py-2 px-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-left text-[#5EF2FF]/80"
                      >
                        "{q}"
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "user" ? "bg-white/10" : "bg-[#5EF2FF]/10 text-[#5EF2FF]"}`}>
                    {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap break-words ${msg.role === "user" ? "bg-white/10" : "bg-[#101010] border border-white/5"}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#5EF2FF]/10 text-[#5EF2FF] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-[#101010] border border-white/5 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-[#5EF2FF]" />
                    <span className="text-xs text-white/50">{loadingText}</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/10 bg-white/[0.02] shrink-0">
              <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#5EF2FF]/50 transition-colors placeholder:text-white/30"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="w-10 h-10 shrink-0 rounded-full bg-[#5EF2FF] text-black flex items-center justify-center hover:bg-[#5EF2FF]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-[#5EF2FF] text-black shadow-lg shadow-[#5EF2FF]/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-50"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
    </div>
  );
}
