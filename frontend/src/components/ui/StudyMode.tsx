"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Loader2, RotateCw, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Shuffle, Repeat } from "lucide-react";

interface Flashcard {
  type: string;
  front: string;
  back: string;
  source: string;
}

export default function StudyMode({ sessionId }: { sessionId: string }) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [hardCards, setHardCards] = useState<Set<number>>(new Set());

  const fetchCards = async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      if (sessionId === "mock_session") {
        await new Promise(r => setTimeout(r, 2000));
        setCards([
          { type: "Concept", front: "What is a mock flashcard?", back: "It is a placeholder used for UI testing when the backend is disconnected.", source: "Source: Developer Notes" },
          { type: "Definition", front: "What does API stand for?", back: "Application Programming Interface.", source: "Source: Page 1" }
        ]);
        return;
      }

      const res = await fetch("http://localhost:5001/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId })
      });

      if (!res.ok) throw new Error("Failed to generate flashcards.");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setCards(data.flashcards);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to generate study materials.");
    } finally {
      setIsLoading(false);
    }
  };

  const activeCards = reviewMode ? cards.filter((_, i) => hardCards.has(i)) : cards;
  const currentCard = activeCards[currentIndex];

  const handleNext = () => {
    if (currentIndex < activeCards.length - 1) {
      setIsFlipped(false);
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleRate = (difficulty: "easy" | "medium" | "hard") => {
    const actualIndex = cards.indexOf(currentCard);
    if (difficulty === "hard") {
      setHardCards(prev => new Set(prev).add(actualIndex));
    } else {
      setHardCards(prev => {
        const next = new Set(prev);
        next.delete(actualIndex);
        return next;
      });
    }
    handleNext();
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    setCurrentIndex(0);
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
  };

  if (cards.length === 0 && !isLoading && !errorMsg) {
    return (
      <div className="p-8 border border-white/10 rounded-2xl bg-[#0B0B0B] flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-[#8A6DFF]/10 text-[#8A6DFF] flex items-center justify-center">
          <BookOpen className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-xl font-bold mb-2">Study Mode</h3>
          <p className="text-white/60 max-w-md mx-auto">Generate interactive flashcards from the paper's key concepts, definitions, and equations.</p>
        </div>
        <button 
          onClick={fetchCards}
          className="px-6 py-3 rounded-full bg-[#8A6DFF] text-white font-semibold hover:scale-105 transition-transform"
        >
          Generate Flashcards
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-12 border border-white/10 rounded-2xl bg-[#0B0B0B] flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
        <Loader2 className="w-12 h-12 animate-spin text-[#8A6DFF]" />
        <div className="space-y-2">
          <p className="text-[#8A6DFF] font-medium">Generating flashcards...</p>
          <div className="flex flex-col items-center text-sm text-white/50 space-y-1">
            <span className="flex items-center gap-2">Extracting concepts <span className="text-[#8A6DFF]">✓</span></span>
            <span className="flex items-center gap-2">Generating questions <span className="text-[#8A6DFF] animate-pulse">●</span></span>
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
          onClick={fetchCards}
          className="px-6 py-2 rounded-full border border-red-400/50 text-red-400 hover:bg-red-400/10 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (activeCards.length === 0) {
    return (
      <div className="p-12 border border-white/10 rounded-2xl bg-[#0B0B0B] flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
        <CheckCircle className="w-12 h-12 text-green-400" />
        <p className="text-white/80">You've mastered all the difficult cards!</p>
        <button 
          onClick={() => { setReviewMode(false); setCurrentIndex(0); }}
          className="px-6 py-2 rounded-full border border-white/20 hover:bg-white/10 transition-colors"
        >
          Study All Cards
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-[#8A6DFF]" />
          Study Mode
        </h3>
        {hardCards.size > 0 && (
          <button 
            onClick={() => { setReviewMode(!reviewMode); setCurrentIndex(0); setIsFlipped(false); }}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors ${reviewMode ? 'bg-[#FF5E5E] text-white' : 'border border-[#FF5E5E]/50 text-[#FF5E5E] hover:bg-[#FF5E5E]/10'}`}
          >
            {reviewMode ? "Exit Review Mode" : `Review Hard Cards (${hardCards.size})`}
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-white/50 uppercase tracking-wider font-semibold">
          <span>Card {currentIndex + 1} of {activeCards.length}</span>
          <span>{Math.round(((currentIndex + 1) / activeCards.length) * 100)}%</span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-[#8A6DFF] to-[#5EF2FF]"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / activeCards.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Flashcard 3D Container */}
      <div className="relative w-full aspect-[4/3] sm:aspect-video perspective-1000 group cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
        <motion.div 
          className="w-full h-full relative preserve-3d transition-transform duration-500"
          animate={{ rotateX: isFlipped ? 180 : 0 }}
        >
          {/* Front */}
          <div className="absolute w-full h-full backface-hidden bg-[#101010] border border-white/10 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 sm:p-12 text-center group-hover:border-[#8A6DFF]/50 transition-colors">
            <span className="absolute top-6 left-6 text-xs font-semibold text-[#8A6DFF] uppercase tracking-widest bg-[#8A6DFF]/10 px-3 py-1 rounded-full">
              {currentCard.type}
            </span>
            <h2 className="text-2xl sm:text-4xl font-medium leading-relaxed">{currentCard.front}</h2>
            <div className="absolute bottom-6 flex items-center gap-2 text-white/30 text-sm">
              <RotateCw className="w-4 h-4" /> Click to reveal
            </div>
          </div>

          {/* Back */}
          <div className="absolute w-full h-full backface-hidden bg-[#101010] border border-[#8A6DFF]/30 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 sm:p-12 text-center [transform:rotateX(180deg)]">
            <span className="absolute top-6 left-6 text-xs font-semibold text-white/50 bg-white/5 px-3 py-1 rounded-full">
              Answer
            </span>
            <p className="text-xl sm:text-2xl font-light text-white/90 leading-relaxed whitespace-pre-wrap">{currentCard.back}</p>
            
            <div className="absolute bottom-24 sm:bottom-6 left-0 w-full flex justify-center">
              <span className="text-xs text-white/40 border border-white/10 rounded px-2 py-1">
                {currentCard.source}
              </span>
            </div>

            {/* Rating Controls (Only on back) */}
            <div className="absolute bottom-6 w-full flex justify-center gap-4 px-8" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => handleRate("easy")} className="flex-1 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors font-medium">Easy</button>
              <button onClick={() => handleRate("medium")} className="flex-1 py-2 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors font-medium">Medium</button>
              <button onClick={() => handleRate("hard")} className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors font-medium">Hard</button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Nav Controls */}
      <div className="flex items-center justify-between px-2">
        <button 
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="p-3 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        
        <div className="flex gap-4">
          <button onClick={handleShuffle} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
            <Shuffle className="w-4 h-4" /> Shuffle
          </button>
          <button onClick={() => { setCurrentIndex(0); setIsFlipped(false); }} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
            <Repeat className="w-4 h-4" /> Restart
          </button>
        </div>

        <button 
          onClick={handleNext}
          disabled={currentIndex === activeCards.length - 1}
          className="p-3 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
