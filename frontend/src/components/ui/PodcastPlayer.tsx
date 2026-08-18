"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Loader2, Headphones, Download, RotateCcw } from "lucide-react";

type PodcastStatus = "idle" | "generating_script" | "generating_audio" | "ready" | "playing" | "error";

export default function PodcastPlayer({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<PodcastStatus>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  const fetchAudio = async () => {
    if (sessionId === "mock_session") {
      setStatus("generating_script");
      await new Promise(r => setTimeout(r, 1500));
      setStatus("generating_audio");
      await new Promise(r => setTimeout(r, 1500));
      const demoUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
      setAudioUrl(demoUrl);
      setStatus("ready");
      return demoUrl;
    }

    setStatus("generating_script");
    
    // Simulate progression to "generating audio" after a few seconds since it's a single API call
    const progressTimeout = setTimeout(() => {
      setStatus("generating_audio");
    }, 4000);

    try {
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 60000);

      const res = await fetch("http://localhost:5001/api/podcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
        signal: controller.signal
      });
      
      clearTimeout(fetchTimeout);
      clearTimeout(progressTimeout);

      if (!res.ok) throw new Error("Failed to generate podcast.");
      
      const data = await res.json();
      const finalUrl = `http://localhost:5001${data.audio_url}`;
      setAudioUrl(finalUrl);
      setStatus("ready");
      return finalUrl;
    } catch (err) {
      clearTimeout(progressTimeout);
      console.error(err);
      setStatus("error");
      setErrorMsg("Podcast generation failed. Try again.");
      return null;
    }
  };

  const togglePlay = async () => {
    if (status === "error") {
      setStatus("idle");
      setErrorMsg("");
      return; // reset
    }

    if (!audioUrl) {
      const url = await fetchAudio();
      if (url && audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.playbackRate = playbackSpeed;
        audioRef.current.play();
        setStatus("playing");
      }
      return;
    }

    if (audioRef.current) {
      if (status === "playing") {
        audioRef.current.pause();
        setStatus("ready");
      } else {
        audioRef.current.play();
        setStatus("playing");
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const curr = audioRef.current.currentTime;
      const total = audioRef.current.duration;
      setCurrentTime(curr);
      setProgress((curr / total) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setStatus("playing");
    }
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const speed = parseFloat(e.target.value);
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const getStatusText = () => {
    switch (status) {
      case "generating_script": return "Generating Script...";
      case "generating_audio": return "Generating Audio...";
      case "error": return errorMsg;
      default: return "Podcast Mode";
    }
  };

  const isWorking = status === "generating_script" || status === "generating_audio";

  return (
    <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-full px-4 py-2 mt-4 inline-flex w-fit backdrop-blur-sm shadow-xl relative">
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setStatus("ready")}
      />
      
      <button 
        onClick={togglePlay}
        disabled={isWorking}
        className="w-10 h-10 flex-shrink-0 rounded-full bg-[#5EF2FF] text-black flex items-center justify-center hover:bg-[#5EF2FF]/90 transition-all shadow-lg shadow-[#5EF2FF]/20"
      >
        {isWorking ? <Loader2 className="w-5 h-5 animate-spin" /> : status === "playing" ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
      </button>

      <div className="flex flex-col gap-1 w-48 sm:w-64">
        <div className="flex justify-between items-center text-xs text-white/50 font-medium tracking-wide">
          <span className={`flex items-center gap-1.5 ${status === 'error' ? 'text-red-400' : ''}`}>
            <Headphones className="w-3 h-3" /> {getStatusText()}
          </span>
          {(!isWorking && status !== 'error') && (
            <span>{duration > 0 ? `${formatTime(currentTime)} / ${formatTime(duration)}` : "3 Min Audio"}</span>
          )}
        </div>
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            className={`h-full ${status === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-[#5EF2FF] to-[#8A6DFF]'}`}
            style={{ width: `${status === 'error' ? 100 : progress}%` }}
          />
        </div>
      </div>

      {audioUrl && status !== "error" && (
        <div className="flex items-center gap-2 border-l border-white/10 pl-4 h-full">
          <select 
            value={playbackSpeed}
            onChange={handleSpeedChange}
            className="bg-transparent text-xs text-white/70 outline-none cursor-pointer appearance-none px-1"
            title="Playback Speed"
          >
            <option value={0.75} className="bg-black">0.75x</option>
            <option value={1} className="bg-black">1x</option>
            <option value={1.25} className="bg-black">1.25x</option>
            <option value={1.5} className="bg-black">1.5x</option>
            <option value={1.75} className="bg-black">1.75x</option>
            <option value={2} className="bg-black">2x</option>
          </select>
          <button onClick={handleRestart} className="p-2 text-white/50 hover:text-white transition-colors" title="Restart">
            <RotateCcw className="w-4 h-4" />
          </button>
          <a href={audioUrl} download className="p-2 text-white/50 hover:text-white transition-colors" title="Download">
            <Download className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}
