"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import ParticleBackground from "@/components/canvas/ParticleBackground";
import { Upload, CheckCircle, BrainCircuit, LayoutDashboard, Presentation as PresentationIcon, BookOpen, Network } from "lucide-react";
import MermaidChart from "@/components/ui/MermaidChart";
import PaperChat from "@/components/ui/PaperChat";
import PodcastPlayer from "@/components/ui/PodcastPlayer";
import PresentationViewer from "@/components/ui/PresentationViewer";
import InteractiveGraph from "@/components/ui/InteractiveGraph";
import StudyMode from "@/components/ui/StudyMode";

const MOCK_FLOWCHART = `graph TD;
  A[Input Research Paper] --> B[Text Extraction Engine];
  B --> C[Noise Filtering & Clean Up];
  C --> D[Semantic Section Splitter];
  D --> E{NLP Context Analyzer};
  E -->|Abstract| F[Identify Objectives];
  E -->|Methodology| G[Analyze Approach];
  E -->|Results| H[Extract Findings];
  F --> I[Final Comprehensive Summary];
  G --> I;
  H --> I;
`;

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [loadingText, setLoadingText] = useState("Reading...");
  const [errorMsg, setErrorMsg] = useState("");
  const [summaryData, setSummaryData] = useState<any>(null);
  const [currentTab, setCurrentTab] = useState<"overview" | "presentation" | "study" | "graph">("overview");

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".hero-line", {
        y: 100,
        opacity: 0,
        duration: 1.2,
        stagger: 0.15,
        ease: "power4.out",
        delay: 0.2,
      });
      gsap.from(".hero-sub", {
        opacity: 0,
        y: 30,
        duration: 1,
        delay: 0.8,
        ease: "power3.out",
      });
      gsap.from(".upload-portal", {
        opacity: 0,
        scale: 0.95,
        duration: 1.2,
        delay: 1,
        ease: "power4.out",
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(Array.from(e.dataTransfer.files));
    }
  };

  const animateLoadingText = () => {
    const states = [
      "Understanding...",
      "Extracting Knowledge...",
      "Analyzing References...",
      "Building Summary..."
    ];
    let i = 0;
    return setInterval(() => {
      if (i < states.length) {
        setLoadingText(states[i]);
        i++;
      }
    }, 1500);
  };

  const handleFileSelect = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    setFile(selectedFiles[0]); // store the first one for single-view fallback
    setUploadState("uploading");
    
    const interval = animateLoadingText();

    if (selectedFiles.length === 1) {
      const formData = new FormData();
      formData.append("file", selectedFiles[0]);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      try {
        const res = await fetch("http://localhost:5001/api/summarize", {
          method: "POST",
          body: formData,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error("API responded with an error");
        const data = await res.json();
        setSummaryData({ ...data.summary, session_id: data.session_id, visuals: data.visuals });
        clearInterval(interval);
        setUploadState("success");
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn("Backend not running or failed. Falling back to rich mock data.", err);
        setSummaryData({
          title: selectedFiles[0].name,
          session_id: "mock_session",
          one_line_summary: "This paper presents a breakthrough methodology that significantly outperforms prior baselines. (NOTE: Backend is offline, showing demo data)",
          objectives: "The primary objective of this research is to solve the pervasive issue of data degradation in deep neural networks when scaling to extremely high dimensional spaces.",
          methodology: "The researchers utilize a hybrid approach combining unsupervised contrastive learning with a novel dynamic routing mechanism.",
          key_findings: "The proposed model achieved a 24% reduction in inference latency and improved the F1 score by 14 points on the benchmark datasets.",
          conclusions: "The authors conclude that orthogonal subspace routing is a viable path forward for scaling large models efficiently.",
          flowchart: MOCK_FLOWCHART,
          visuals: [
            {
              url: "https://via.placeholder.com/600x400/101010/5EF2FF?text=Mock+Extracted+Figure",
              caption: "Figure 1: Example Architecture from Demo",
              context: "This image was extracted by the visual extraction engine."
            }
          ]
        });
        clearInterval(interval);
        setUploadState("success");
      }
    } else {
      // Multiple files
      const formData = new FormData();
      selectedFiles.forEach((f) => formData.append("files", f));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout for multiple files

      try {
        const res = await fetch("http://localhost:5001/api/knowledge-graph", {
          method: "POST",
          body: formData,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error("API responded with an error");
        const data = await res.json();
        setSummaryData({ isMulti: true, graph: data.graph, summaries: data.summaries });
        clearInterval(interval);
        setUploadState("success");
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn("Backend not running or failed. Falling back to rich mock data.", err);
        setSummaryData({ 
          isMulti: true, 
          graph: "graph TD;\n  A[Paper 1: Deep Learning] -->|Improves Upon| B[Paper 2: Neural Nets];\n  C[Paper 3: Transformers] -->|Extends| A;\n", 
          summaries: selectedFiles.map((f, i) => ({
            title: f.name,
            one_line_summary: `Mock executive summary for ${f.name} (Backend is offline).`,
            key_findings: "Simulated key findings showing a 15% increase in efficiency."
          }))
        });
        clearInterval(interval);
        setUploadState("success");
      }
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden text-white" ref={heroRef}>
      <ParticleBackground />

      <AnimatePresence>
        {uploadState === "idle" && (
          <motion.div 
            className="flex flex-col items-center justify-center min-h-screen px-4 py-20 text-center relative z-10"
            exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          >
            <div className="max-w-6xl w-full mx-auto space-y-12">
              <h1 className="text-[clamp(48px,10vw,140px)] font-bold tracking-tighter leading-[0.9] text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
                <div className="overflow-hidden"><div className="hero-line">Understand</div></div>
                <div className="overflow-hidden"><div className="hero-line">Every Research</div></div>
                <div className="overflow-hidden"><div className="hero-line">Paper.</div></div>
              </h1>
              
              <p className="hero-sub text-[clamp(16px,2vw,20px)] max-w-2xl mx-auto text-white/55 leading-relaxed tracking-tight">
                Upload one or multiple research papers and receive deep explanations and visual relationships generated by AI.
              </p>

              <div 
                className="upload-portal mx-auto max-w-3xl w-full mt-12"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <motion.div 
                  className={`
                    relative group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-md p-16
                    transition-all duration-700 ease-out
                  `}
                  animate={{
                    borderColor: isDragging ? "rgba(94, 242, 255, 0.5)" : "rgba(255, 255, 255, 0.1)",
                    boxShadow: isDragging ? "0 0 40px rgba(94, 242, 255, 0.1)" : "0 0 0px rgba(94, 242, 255, 0)",
                    scale: isDragging ? 1.02 : 1
                  }}
                >
                  <div className="absolute inset-0 rounded-3xl border border-dashed border-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                  
                  <div className="relative z-10 flex flex-col items-center gap-6">
                    <motion.div 
                      animate={{ y: isDragging ? -10 : 0, scale: isDragging ? 1.1 : 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <Upload className={`w-12 h-12 ${isDragging ? "text-[#5EF2FF]" : "text-white/40"}`} />
                    </motion.div>
                    <div>
                      <p className="text-xl font-medium tracking-tight">Drag and drop your paper(s) here</p>
                      <p className="text-white/40 mt-2 text-sm">Upload multiple PDFs to generate a knowledge graph</p>
                    </div>
                    
                    <label className="mt-4 px-8 py-4 rounded-full bg-white text-black font-semibold tracking-tight cursor-pointer hover:bg-white/90 transition-colors z-20">
                      Upload Paper(s)
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".pdf"
                        multiple
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleFileSelect(Array.from(e.target.files));
                          }
                        }}
                      />
                    </label>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {uploadState === "uploading" && (
          <motion.div 
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505]/90 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <motion.div 
              key={loadingText}
              initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -20, filter: "blur(10px)", position: "absolute" }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className="text-[clamp(32px,6vw,80px)] font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50 text-center px-4"
            >
              {loadingText}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {uploadState === "success" && summaryData && (
          <motion.div 
            className="relative z-20 min-h-screen p-8 md:p-24"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            <div className="max-w-7xl mx-auto space-y-24">
              {summaryData.isMulti ? (
                <>
                  <div className="space-y-8 max-w-3xl">
                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm tracking-widest text-[#5EF2FF] uppercase">
                      <CheckCircle className="w-4 h-4" /> Multi-Paper Analysis Complete
                    </div>
                    <h2 className="text-5xl font-bold tracking-tighter leading-tight">Knowledge Graph</h2>
                    <p className="text-white/60 text-lg">Relationship mapping across {summaryData.summaries?.length} uploaded papers.</p>
                  </div>

                  <div className="flex justify-center mb-8 border-b border-white/10">
                    <div className="flex gap-8">
                      <button 
                        onClick={() => setCurrentTab("overview")} 
                        className={`pb-4 text-sm font-semibold tracking-wider transition-all ${currentTab === "overview" ? "text-[#5EF2FF] border-b-2 border-[#5EF2FF]" : "text-white/50 hover:text-white"}`}
                      >
                        OVERVIEW
                      </button>
                      <button 
                        onClick={() => setCurrentTab("graph")} 
                        className={`pb-4 text-sm font-semibold tracking-wider transition-all ${currentTab === "graph" ? "text-[#5EF2FF] border-b-2 border-[#5EF2FF]" : "text-white/50 hover:text-white"}`}
                      >
                        KNOWLEDGE GRAPH
                      </button>
                    </div>
                  </div>

                  {currentTab === "overview" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {summaryData.summaries?.map((sum: any, idx: number) => (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.8, delay: idx * 0.15 }}
                          className="p-6 rounded-2xl border border-white/10 bg-[#101010] hover:bg-white/[0.03] transition-colors flex flex-col gap-4"
                        >
                          <h3 className="text-lg font-bold text-[#5EF2FF] truncate" title={sum.title}>{sum.title}</h3>
                          <p className="text-sm text-white/80 leading-relaxed">{sum.one_line_summary}</p>
                          <div className="mt-auto pt-4 border-t border-white/5">
                            <p className="text-xs text-white/50 uppercase tracking-widest mb-2">Key Findings</p>
                            <p className="text-sm text-white/70 line-clamp-3">{sum.key_findings}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {currentTab === "graph" && summaryData.graph && (
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8 }}
                    >
                      <InteractiveGraph data={summaryData.graph} sessionId={summaryData.session_id} />
                    </motion.div>
                  )}
                </>
              ) : (
                <>
                  {/* Header */}
                  <div className="space-y-8 max-w-3xl">
                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm tracking-widest text-[#5EF2FF] uppercase">
                      <CheckCircle className="w-4 h-4" /> AI Analysis Complete
                    </div>
                    <h2 className="text-5xl font-bold tracking-tighter leading-tight">{summaryData.title || file?.name || "Paper Summary"}</h2>
                    
                    {summaryData.session_id && (
                      <PodcastPlayer sessionId={summaryData.session_id} />
                    )}
                    
                    <div className="p-8 rounded-2xl border border-white/10 bg-[#0B0B0B] shadow-2xl shadow-[#5EF2FF]/5 relative overflow-hidden mt-8">
                      <div className="absolute top-0 right-0 p-8 opacity-10">
                        <BrainCircuit className="w-32 h-32" />
                      </div>
                      <h3 className="text-xs tracking-[0.2em] text-[#8A6DFF] uppercase mb-4 relative z-10">Executive Summary</h3>
                      <p className="text-xl leading-relaxed text-white/90 relative z-10 font-light">
                        {summaryData.one_line_summary}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-center mt-12 mb-8 border-b border-white/10 sticky top-0 bg-[#000000]/80 backdrop-blur-xl z-40 py-4">
                    <div className="flex gap-4 sm:gap-8 overflow-x-auto px-4 no-scrollbar">
                      {[
                        { id: "overview", label: "Overview", icon: LayoutDashboard },
                        { id: "presentation", label: "Presentation", icon: PresentationIcon },
                        { id: "study", label: "Study Mode", icon: BookOpen }
                      ].map(tab => (
                        <button 
                          key={tab.id}
                          onClick={() => setCurrentTab(tab.id as any)} 
                          className={`flex items-center gap-2 pb-4 text-sm font-semibold tracking-wider transition-all whitespace-nowrap ${currentTab === tab.id ? "text-[#5EF2FF] border-b-2 border-[#5EF2FF]" : "text-white/50 hover:text-white"}`}
                        >
                          <tab.icon className="w-4 h-4" /> {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {currentTab === "overview" && (
                    <>
                      {/* Grid Content */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {[
                          { id: "objectives", label: "Objectives & Problem Statement" },
                          { id: "methodology", label: "Methodology & Approach" },
                          { id: "key_findings", label: "Key Findings & Results" },
                          { id: "conclusions", label: "Conclusions & Limitations" }
                        ].map((section, idx) => (
                          <motion.div 
                            key={section.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: idx * 0.15 }}
                            className="p-8 rounded-2xl border border-white/10 bg-[#101010] hover:bg-white/[0.03] transition-colors"
                          >
                            <h3 className="text-xs tracking-[0.2em] text-[#5EF2FF]/70 uppercase mb-6">{section.label}</h3>
                            <p className="text-white/80 leading-loose text-md font-light">
                              {summaryData[section.id] || "Not provided in this analysis."}
                            </p>
                          </motion.div>
                        ))}
                      </div>

                      {summaryData.visuals && summaryData.visuals.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.8 }}
                          className="space-y-6 pt-12 border-t border-white/10"
                        >
                          <h3 className="text-xs tracking-[0.2em] text-[#8A6DFF] uppercase text-center mb-8">Extracted Visuals</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {summaryData.visuals.map((visual: any, idx: number) => (
                              <div key={idx} className="bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col items-center">
                                <img src={`http://localhost:5001${visual.url}`} alt={`Extracted visual ${idx}`} className="max-h-64 object-contain rounded-xl mb-4" />
                                <p className="text-xs text-white/50 text-center">{visual.caption}</p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Flowchart Section */}
                      {summaryData.flowchart && (
                        <motion.div
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.8 }}
                          className="space-y-6 pt-12 border-t border-white/10"
                        >
                          <h3 className="text-xs tracking-[0.2em] text-[#8A6DFF] uppercase text-center">Visual Methodology Flowchart</h3>
                          <MermaidChart chart={summaryData.flowchart} />
                        </motion.div>
                      )}
                    </>
                  )}

                  {currentTab === "presentation" && (
                    <PresentationViewer sessionId={summaryData.session_id} visuals={summaryData.visuals || []} />
                  )}

                  {currentTab === "study" && (
                    <StudyMode sessionId={summaryData.session_id} />
                  )}

                  {summaryData.session_id && (
                    <PaperChat sessionId={summaryData.session_id} />
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
