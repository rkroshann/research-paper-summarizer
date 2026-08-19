"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Presentation, Loader2, ChevronLeft, ChevronRight, Printer, AlertTriangle } from "lucide-react";

interface Slide {
  title: string;
  bullets: string[];
  visual_id?: string | null;
}

interface PresentationViewerProps {
  sessionId: string;
  visuals: any[];
}

export default function PresentationViewer({ sessionId, visuals }: PresentationViewerProps) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const fetchPresentation = async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      if (sessionId === "mock_session") {
        await new Promise(r => setTimeout(r, 2000));
        setSlides([
          { title: "Introduction to Advanced Mocking", bullets: ["This is a mock slide.", "Backend is offline.", "Enjoy the demo."], visual_id: null },
          { title: "Methodology", bullets: ["We used fake data.", "It was very effective."], visual_id: visuals[0]?.id }
        ]);
        return;
      }

      const res = await fetch("http://localhost:5001/api/presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId })
      });

      if (!res.ok) throw new Error("Failed to generate presentation.");
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setSlides(data.slides);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Unable to generate the presentation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) setCurrentSlideIndex(prev => prev + 1);
  };

  const handlePrev = () => {
    if (currentSlideIndex > 0) setCurrentSlideIndex(prev => prev - 1);
  };

  const handlePrint = () => {
    window.print();
  };

  if (slides.length === 0 && !isLoading && !errorMsg) {
    return (
      <div className="p-8 border border-white/10 rounded-2xl bg-[#0B0B0B] flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-[#5EF2FF]/10 text-[#5EF2FF] flex items-center justify-center">
          <Presentation className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-xl font-bold mb-2">Presentation Generator</h3>
          <p className="text-white/60 max-w-md mx-auto">Generate a complete 5-7 slide presentation deck from this paper, intelligently enriched with extracted visuals.</p>
        </div>
        <button 
          onClick={fetchPresentation}
          className="px-6 py-3 rounded-full bg-[#5EF2FF] text-black font-semibold hover:scale-105 transition-transform"
        >
          Generate Presentation
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-12 border border-white/10 rounded-2xl bg-[#0B0B0B] flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
        <Loader2 className="w-12 h-12 animate-spin text-[#5EF2FF]" />
        <div className="space-y-2">
          <p className="text-[#5EF2FF] font-medium">Generating presentation...</p>
          <div className="flex flex-col items-center text-sm text-white/50 space-y-1">
            <span className="flex items-center gap-2">Extracting key findings <span className="text-[#5EF2FF]">✓</span></span>
            <span className="flex items-center gap-2">Selecting relevant visuals <span className="text-[#5EF2FF]">✓</span></span>
            <span className="flex items-center gap-2">Structuring slides <span className="text-[#5EF2FF] animate-pulse">●</span></span>
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-8 border border-red-500/20 rounded-2xl bg-[#0B0B0B] flex flex-col items-center justify-center text-center space-y-6">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-white/80">{errorMsg}</p>
        <button 
          onClick={fetchPresentation}
          className="px-6 py-2 rounded-full border border-red-400/50 text-red-400 hover:bg-red-400/10 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const currentSlide = slides[currentSlideIndex];
  const slideVisual = currentSlide.visual_id ? visuals.find(v => v.id === currentSlide.visual_id) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-3">
          <Presentation className="w-6 h-6 text-[#5EF2FF]" />
          Presentation Preview
        </h3>
        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 hover:bg-white/5 text-sm transition-colors print:hidden">
          <Printer className="w-4 h-4" /> Export PDF
        </button>
      </div>

      <div className="relative aspect-video bg-[#050505] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col p-8 sm:p-12 print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Slide Counter */}
        <div className="absolute top-6 right-6 text-xs tracking-widest uppercase text-white/30 print:text-black/50">
          Slide {currentSlideIndex + 1} / {slides.length}
        </div>

        {/* Slide Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlideIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className={`flex-1 flex flex-col ${slideVisual ? 'md:flex-row gap-8' : ''}`}
          >
            <div className={`flex flex-col justify-center ${slideVisual ? 'md:w-1/2' : 'w-full'} space-y-6`}>
              <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#5EF2FF] print:text-blue-800 leading-tight">
                {currentSlide.title}
              </h2>
              <ul className="space-y-4 text-white/80 print:text-black/80 text-lg sm:text-xl font-light">
                {currentSlide.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-[#8A6DFF] print:text-blue-500 mt-1.5">•</span>
                    <span className="leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>

            {slideVisual && (
              <div className="md:w-1/2 flex flex-col items-center justify-center bg-white/5 print:bg-gray-100 rounded-xl p-4 border border-white/10 print:border-gray-300">
                <img src={`http://localhost:5001${slideVisual.url}`} alt="Slide visual" className="max-h-[60%] object-contain rounded-lg" />
                <p className="mt-4 text-xs text-white/50 print:text-black/50 text-center">{slideVisual.caption}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between print:hidden">
        <button 
          onClick={handlePrev}
          disabled={currentSlideIndex === 0}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" /> Previous
        </button>
        
        <div className="flex gap-2">
          {slides.map((_, idx) => (
            <button 
              key={idx}
              onClick={() => setCurrentSlideIndex(idx)}
              className={`w-3 h-3 rounded-full transition-all ${idx === currentSlideIndex ? 'bg-[#5EF2FF] w-6' : 'bg-white/20 hover:bg-white/40'}`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        <button 
          onClick={handleNext}
          disabled={currentSlideIndex === slides.length - 1}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#5EF2FF] text-black hover:bg-[#5EF2FF]/90 disabled:opacity-30 disabled:hover:bg-[#5EF2FF] transition-colors"
        >
          Next <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
