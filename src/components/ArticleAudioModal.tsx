import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  X,
  Minimize2,
  Maximize2,
  ExternalLink,
  Sparkles,
  Radio,
  Sliders,
  Check,
  Loader2,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { sourcesStore, useSourcesStore } from '../store/sourcesStore';
import { decodeHtmlEntities } from '../utils/text';
import { formatRelativeTimeVi } from '../utils/date';
import catLogo from '../assets/images/cat.jpg';

export const ArticleAudioModal: React.FC = () => {
  const { activeAudioArticle: article, isAudioModalOpen: isOpen } = useSourcesStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.5);
  const [isMinimized, setIsMinimized] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Trạng thái tải toàn bộ nội dung bài viết
  const [isLoadingFullContent, setIsLoadingFullContent] = useState(false);
  const [fullArticleParagraphs, setFullArticleParagraphs] = useState<string[]>([]);
  const [contentError, setContentError] = useState<string | null>(null);

  // Audio & Speech Synthesis
  const [useGoogleOnlineVoice, setUseGoogleOnlineVoice] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);

  // Audio HTML5 ref cho giọng nữ Google online ("Chị Google")
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Ref tracking
  const isPlayingRef = useRef(false);
  const currentChunkIndexRef = useRef(0);
  const chunksRef = useRef<string[]>([]);
  const sentenceListRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const activeArticleIdRef = useRef<string | null>(null);

  isPlayingRef.current = isPlaying;
  currentChunkIndexRef.current = currentChunkIndex;

  // 2. Phân tách toàn bộ bài báo thành các câu hoàn chỉnh để đọc
  const chunks = useMemo(() => {
    if (!article) return [];

    const intro = `Bản tin từ ${article.sourceName}.`;
    const cleanTitle = decodeHtmlEntities(article.title).trim();

    const sentenceList: string[] = [intro, cleanTitle];

    if (fullArticleParagraphs.length > 0) {
      // Giữ nguyên các câu tự nhiên hoàn chỉnh theo dấu câu, không cắt vụn
      for (const p of fullArticleParagraphs) {
        const cleanP = decodeHtmlEntities(p).trim();
        if (!cleanP) continue;

        const subSentences = cleanP
          .split(/(?<=[.?!;:\n])\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        sentenceList.push(...subSentences);
      }
    } else {
      // Fallback khi đang tải hoặc không tải được toàn văn
      const cleanDesc = decodeHtmlEntities(article.description).trim();
      if (cleanDesc) {
        const subSentences = cleanDesc
          .split(/(?<=[.?!;:\n])\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        sentenceList.push(...subSentences);
      }
    }

    return sentenceList.filter((s) => s.length > 0);
  }, [article, fullArticleParagraphs]);

  chunksRef.current = chunks;
  const totalChunks = chunks.length;

  // 3. Ước tính thời lượng (khoảng 140 từ/phút)
  const totalWordCount = useMemo(() => {
    return chunks.reduce((acc, c) => acc + c.split(/\s+/).length, 0);
  }, [chunks]);

  const estimatedTotalSec = useMemo(() => {
    const baseSec = Math.max(Math.round((totalWordCount / 140) * 60), 10);
    return Math.round(baseSec / playbackRate);
  }, [totalWordCount, playbackRate]);

  const elapsedSec = useMemo(() => {
    if (totalChunks <= 1) return isPlaying ? Math.round(estimatedTotalSec / 2) : 0;
    return Math.min(
      Math.round((currentChunkIndex / totalChunks) * estimatedTotalSec),
      estimatedTotalSec
    );
  }, [currentChunkIndex, totalChunks, estimatedTotalSec, isPlaying]);

  const progressPercent = useMemo(() => {
    if (totalChunks <= 0 || currentChunkIndex === 0) return 0;
    return Math.min(Math.round(((currentChunkIndex + 0.5) / totalChunks) * 100), 100);
  }, [currentChunkIndex, totalChunks]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // 4. Tìm giọng đọc Tiếng Việt chuẩn của Google / hệ thống
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const findViVoices = () => {
      const all = window.speechSynthesis.getVoices();
      if (!all || all.length === 0) return;
      setVoices(all);

      // Ưu tiên 1: Giọng Google tiếng Việt (female)
      const googleVi = all.find(
        (v) =>
          v.lang.toLowerCase().startsWith('vi') &&
          v.name.toLowerCase().includes('google')
      );

      // Ưu tiên 2: Giọng nữ tiếng Việt (HoaiMy, Linh, Mai, Nữ, Female)
      const femaleVi = all.find(
        (v) =>
          v.lang.toLowerCase().startsWith('vi') &&
          (v.name.toLowerCase().includes('nữ') ||
            v.name.toLowerCase().includes('female') ||
            v.name.toLowerCase().includes('hoaimy') ||
            v.name.toLowerCase().includes('linh') ||
            v.name.toLowerCase().includes('mai'))
      );

      // Ưu tiên 3: Bất kỳ giọng tiếng Việt nào
      const anyVi = all.find((v) => v.lang.toLowerCase().startsWith('vi'));

      setSelectedVoice(googleVi || femaleVi || anyVi || all[0]);
    };

    findViVoices();
    window.speechSynthesis.onvoiceschanged = findViVoices;

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // 5. Hàm dừng toàn bộ âm thanh và hủy phiên phát cũ
  const stopAllAudio = useCallback(() => {
    isPlayingRef.current = false;
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = '';
      } catch {
        // ignore
      }
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }, []);

  // 6. Phát âm từng câu với kiểm tra id bài viết để tránh đọc nhầm bài cũ
  const speakChunk = useCallback(
    (index: number, targetArticleId?: string | null) => {
      const currentArticleId = targetArticleId || activeArticleIdRef.current;
      if (!currentArticleId || (activeArticleIdRef.current && currentArticleId !== activeArticleIdRef.current)) {
        return;
      }

      stopAllAudio();

      const currentChunks = chunksRef.current;
      if (!currentChunks || index < 0 || index >= currentChunks.length) {
        setIsPlaying(false);
        return;
      }

      const text = currentChunks[index];
      setCurrentChunkIndex(index);
      setIsPlaying(true);
      isPlayingRef.current = true;

      // Phương án 1: Giọng nữ Google trực tuyến ("Chị Google" chuẩn 100%)
      if (useGoogleOnlineVoice) {
        const audioUrl = `/api/tts?text=${encodeURIComponent(text)}`;
        const audio = new Audio(audioUrl);
        audio.playbackRate = playbackRate;
        audioRef.current = audio;

        // Preload trước câu kế tiếp để chuyển câu ngay lập tức, không có khoảng lặng
        if (index + 1 < currentChunks.length) {
          const nextAudio = new Audio(`/api/tts?text=${encodeURIComponent(currentChunks[index + 1])}`);
          nextAudio.preload = 'auto';
        }

        audio.onended = () => {
          if (!isPlayingRef.current || activeArticleIdRef.current !== currentArticleId) return;
          if (index + 1 < currentChunks.length) {
            speakChunk(index + 1, currentArticleId);
          } else {
            setIsPlaying(false);
            setCurrentChunkIndex(0);
          }
        };

        audio.onerror = (e) => {
          if (activeArticleIdRef.current !== currentArticleId) return;
          console.warn('Lỗi audio Google TTS online, chuyển sang Web Speech:', e);
          fallbackWebSpeech(text, index, currentArticleId);
        };

        audio.play().catch((err) => {
          if (activeArticleIdRef.current !== currentArticleId) return;
          console.warn('Không thể tự động phát audio, chuyển fallback:', err);
          fallbackWebSpeech(text, index, currentArticleId);
        });

        return;
      }

      // Phương án 2: Web Speech API nội bộ
      fallbackWebSpeech(text, index, currentArticleId);
    },
    [useGoogleOnlineVoice, playbackRate, stopAllAudio]
  );

  const fallbackWebSpeech = (text: string, index: number, targetArticleId?: string | null) => {
    const currentArticleId = targetArticleId || activeArticleIdRef.current;
    if (activeArticleIdRef.current && currentArticleId !== activeArticleIdRef.current) return;

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsPlaying(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang || 'vi-VN';
    } else {
      utterance.lang = 'vi-VN';
    }

    utterance.rate = playbackRate;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      if (!isPlayingRef.current || activeArticleIdRef.current !== currentArticleId) return;
      const currentChunks = chunksRef.current;
      if (index + 1 < currentChunks.length) {
        speakChunk(index + 1, currentArticleId);
      } else {
        setIsPlaying(false);
        setCurrentChunkIndex(0);
      }
    };

    utterance.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      if (activeArticleIdRef.current !== currentArticleId) return;
      console.warn('Lỗi Web Speech:', e);
      setIsPlaying(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  // 7. Quản lý vòng đời tải toàn văn và phát âm: Hủy toàn bộ bài cũ khi chuyển sang bài mới
  useEffect(() => {
    // Luôn dừng ngay mọi âm thanh đang phát của bài cũ
    stopAllAudio();
    setIsPlaying(false);
    setCurrentChunkIndex(0);
    setImageError(false);

    if (!article || !isOpen) {
      activeArticleIdRef.current = null;
      setFullArticleParagraphs([]);
      setIsLoadingFullContent(false);
      setContentError(null);
      return;
    }

    const currentArticleId = article.id;
    activeArticleIdRef.current = currentArticleId;
    // Khi mở bài báo mới, hủy trình đọc cũ và mở popup đầy đủ cho bài mới
    setIsMinimized(false);
    setFullArticleParagraphs([]);
    setIsLoadingFullContent(true);
    setContentError(null);

    const abortController = new AbortController();

    const fetchFullContent = async () => {
      try {
        const res = await fetch(`/api/article-content?url=${encodeURIComponent(article.link)}`, {
          signal: abortController.signal,
        });
        const data = await res.json().catch(() => null);
        if (activeArticleIdRef.current === currentArticleId) {
          let loadedParagraphs: string[] = [];
          if (data && data.success && Array.isArray(data.paragraphs) && data.paragraphs.length > 0) {
            loadedParagraphs = data.paragraphs;
            setContentError(null);
          } else if (data && data.sapo) {
            loadedParagraphs = [data.sapo];
            setContentError(data.message || 'Đọc theo bản tin tóm tắt.');
          } else {
            const fallbackReason =
              data?.message ||
              (data?.upstreamStatus ? `Báo giới hạn truy cập (HTTP ${data.upstreamStatus})` : 'Đọc theo bản tin tóm tắt.');
            setContentError(fallbackReason);
          }
          setFullArticleParagraphs(loadedParagraphs);
          setIsLoadingFullContent(false);

          // Bắt đầu đọc ngay sau khi nội dung bài viết đã sẵn sàng
          setTimeout(() => {
            if (activeArticleIdRef.current === currentArticleId) {
              speakChunk(0, currentArticleId);
            }
          }, 150);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        if (activeArticleIdRef.current === currentArticleId) {
          console.warn('Không thể tải toàn bộ bài viết, chuyển sang đọc tóm tắt:', err);
          setContentError('Đọc theo bản tin tóm tắt.');
          setIsLoadingFullContent(false);
          // Fallback đọc bản tin tóm tắt nếu trang báo chặn tải toàn văn
          setTimeout(() => {
            if (activeArticleIdRef.current === currentArticleId) {
              speakChunk(0, currentArticleId);
            }
          }, 150);
        }
      }
    };

    fetchFullContent();

    return () => {
      abortController.abort();
      stopAllAudio();
    };
  }, [article?.id, article?.link, isOpen]);

  // Tự động cuộn theo câu đang đọc
  useEffect(() => {
    if (!sentenceListRef.current) return;
    const activeEl = sentenceListRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentChunkIndex]);

  // Điều khiển
  const handleTogglePlay = () => {
    if (isPlaying) {
      stopAllAudio();
      setIsPlaying(false);
    } else {
      speakChunk(currentChunkIndex);
    }
  };

  const handleNextSentence = () => {
    if (currentChunkIndex + 1 < totalChunks) {
      speakChunk(currentChunkIndex + 1);
    }
  };

  const handlePrevSentence = () => {
    if (currentChunkIndex > 0) {
      speakChunk(currentChunkIndex - 1);
    } else {
      speakChunk(0);
    }
  };

  const handleRestart = () => {
    speakChunk(0);
  };

  const handleCycleRate = () => {
    const rates = [0.75, 1.0, 1.25, 1.5, 2.0];
    const curIdx = rates.indexOf(playbackRate);
    const nextRate = rates[(curIdx + 1) % rates.length];
    setPlaybackRate(nextRate);

    if (isPlaying) {
      setTimeout(() => speakChunk(currentChunkIndex), 50);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || totalChunks <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetIndex = Math.min(Math.floor(ratio * totalChunks), totalChunks - 1);
    speakChunk(targetIndex);
  };

  const handleClose = () => {
    stopAllAudio();
    setIsPlaying(false);
    sourcesStore.stopAudio();
  };

  // Keyboard shortcut: Space để Play/Pause, Esc để thu nhỏ/đóng
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (!isMinimized) {
          setIsMinimized(true);
        } else {
          handleClose();
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNextSentence();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSentence();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying, isMinimized, currentChunkIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen || !article) return null;

  // =========================================================================
  // GIAO DIỆN THU NHỎ (Ô BÉ Ở GÓC MÀN HÌNH - Floating Corner Mini Player)
  // =========================================================================
  if (isMinimized) {
    return (
      <aside
        aria-label="Trình phát thu nhỏ góc màn hình"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[380px] max-w-sm bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-emerald-500/30 hover:border-emerald-500/50 rounded-2xl shadow-2xl shadow-black/80 text-white animate-in fade-in slide-in-from-bottom-4 duration-300 select-none overflow-hidden transition-all group/mini"
      >
        {/* Thanh tiến trình mini ở mép trên */}
        <div
          onClick={handleProgressClick}
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tiến độ bài đọc"
          className="h-1.5 bg-white/10 w-full overflow-hidden cursor-pointer"
          title={`Tiến độ ${progressPercent}% - Bấm để tua`}
        >
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-sm shadow-emerald-400/50 transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="p-3 sm:p-3.5 flex items-center gap-3">
          {/* Ảnh đại diện nhỏ có hiệu ứng sóng âm khi đang phát */}
          <div
            onClick={() => setIsMinimized(false)}
            className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0 bg-slate-800 shadow-md cursor-pointer group/thumb border border-white/10"
            title="Nhấp để phóng to lại trình đọc báo"
          >
            {!imageError && article.thumbnail ? (
              <img
                src={article.thumbnail}
                alt={article.title}
                onError={() => setImageError(true)}
                className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
              />
            ) : (
              <img src={catLogo} alt="Lều Báo" className="w-full h-full object-cover" />
            )}
            {isPlaying && (
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center gap-0.5">
                <span className="w-1 h-3.5 bg-emerald-400 rounded-full animate-bounce" />
                <span className="w-1 h-6 bg-emerald-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1 h-4 bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms]" />
                <span className="w-1 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:450ms]" />
              </div>
            )}
          </div>

          {/* Tiêu đề và trạng thái: Bấm vào mở rộng về popup */}
          <div
            onClick={() => setIsMinimized(false)}
            className="flex-1 min-w-0 cursor-pointer group/text"
            title="Nhấp để mở lại toàn màn hình popup"
          >
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-0.5">
              <Sparkles className="w-3 h-3 fill-current shrink-0" />
              <span className="truncate">{article.sourceName} · Giọng nữ Google</span>
            </div>
            <h4 className="text-xs sm:text-[13px] font-bold line-clamp-1 text-slate-100 group-hover/text:text-emerald-300 transition-colors">
              {decodeHtmlEntities(article.title)}
            </h4>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 font-mono">
              <span className="text-emerald-400 font-semibold">{formatTime(elapsedSec)}</span>
              <span>/</span>
              <span>{formatTime(estimatedTotalSec)}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300 font-sans">{progressPercent}%</span>
              <span className="hidden sm:inline text-[10px] text-slate-400 italic font-sans ml-1">
                · Bấm để phóng to
              </span>
            </div>
          </div>

          {/* Các nút điều khiển ô bé */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Play / Pause */}
            <button
              onClick={handleTogglePlay}
              className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer"
              title={isPlaying ? 'Tạm dừng (Space)' : 'Tiếp tục đọc (Space)'}
              aria-label={isPlaying ? 'Tạm dừng' : 'Tiếp tục đọc'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            {/* Phóng to lại full popup */}
            <button
              onClick={() => setIsMinimized(false)}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-colors cursor-pointer"
              title="Phóng to toàn màn hình popup"
              aria-label="Phóng to toàn màn hình popup"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Đóng hoàn toàn */}
            <button
              onClick={handleClose}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-colors cursor-pointer"
              title="Đóng trình đọc báo (Esc)"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // =========================================================================
  // GIAO DIỆN POPUP ĐẦY ĐỦ (Full Modal với Ảnh đại diện làm nền)
  // =========================================================================
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 select-none animate-in fade-in duration-300"
    >
      {/* 1. LỚP NỀN: Ảnh đại diện bài báo làm nền toàn cảnh */}
      <div className="absolute inset-0 overflow-hidden bg-black">
        {!imageError && article.thumbnail ? (
          <img
            src={article.thumbnail}
            alt=""
            aria-hidden="true"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover scale-110 blur-2xl opacity-35 brightness-45 contrast-125 transition-all duration-700"
          />
        ) : (
          <img
            src={catLogo}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover scale-110 blur-2xl opacity-20 brightness-30"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-slate-950/90" />
        <div className="absolute inset-0 bg-radial from-transparent via-black/40 to-black/80" />
      </div>

      {/* 2. Backdrop click */}
      <div className="absolute inset-0" onClick={handleClose} aria-hidden="true" />

      {/* 3. KHUNG POP-UP CHÍNH */}
      <div className="relative w-full max-w-xl md:max-w-2xl bg-slate-900/85 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-2xl shadow-black/80 text-white overflow-hidden flex flex-col max-h-[92vh] z-10 animate-in zoom-in-95 duration-200">
        {/* A. Header Bar với nút Thu nhỏ ô góc */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-white/5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <Radio className="w-4 h-4 animate-pulse" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1 shrink-0">
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                  Giọng nữ Google Tiếng Việt
                </span>
                <span className="text-white/30">·</span>
                <span className="text-xs font-semibold text-white/80 truncate">{article.sourceName}</span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                <span>Trình đọc toàn bộ nội dung bài báo</span>
                {isLoadingFullContent && (
                  <span className="inline-flex items-center gap-1 text-emerald-400 animate-pulse font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" /> Đang tải toàn văn...
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Nút Thu nhỏ / Scale thành ô bé ở góc màn hình */}
            <button
              onClick={() => setIsMinimized(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white/10 hover:bg-emerald-500/25 text-slate-200 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/40 transition-all text-xs font-semibold cursor-pointer active:scale-95 shadow-sm"
              title="Scale thành 1 ô bé ở góc màn hình (vừa nghe vừa đọc báo khác)"
              aria-label="Scale thành ô bé góc màn hình"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Thu nhỏ ô góc</span>
            </button>

            {/* Nút Đóng */}
            <button
              onClick={handleClose}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Đóng trình đọc báo (Esc)"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* B. Thân Modal */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6 space-y-5">
          {/* Card Bài Báo */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-center sm:items-start bg-white/5 border border-white/10 rounded-2xl p-3.5 sm:p-4">
            <div className="relative aspect-video sm:aspect-square w-full sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-slate-800 shadow-lg border border-white/15">
              {!imageError && article.thumbnail ? (
                <img
                  src={article.thumbnail}
                  alt={article.title}
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img src={catLogo} alt="Lều Báo" className="w-full h-full object-cover" />
              )}
              {isPlaying && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center gap-1">
                  <span className="w-1.5 h-4 bg-emerald-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-8 bg-emerald-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-6 bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  <span className="w-1.5 h-3 bg-emerald-400 rounded-full animate-bounce [animation-delay:450ms]" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 text-center sm:text-left space-y-1.5">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-slate-400 font-medium">
                <span className="text-emerald-400 font-semibold">{article.categoryName}</span>
                <span>·</span>
                <span>{formatRelativeTimeVi(article.pubDate)}</span>
              </div>
              <h3 id="audio-modal-title" className="text-base sm:text-lg font-bold leading-snug text-white line-clamp-2">
                {decodeHtmlEntities(article.title)}
              </h3>
              <div className="flex items-center justify-center sm:justify-start gap-3 pt-1">
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => sourcesStore.markArticleRead(article.id)}
                  className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
                >
                  <span>Mở bài gốc trên {article.sourceName}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                {fullArticleParagraphs.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-300 bg-white/10 px-2 py-0.5 rounded-full">
                    <FileText className="w-3 h-3 text-emerald-400" />
                    <span>Toàn văn: {fullArticleParagraphs.length} đoạn</span>
                  </span>
                ) : contentError ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full" title={contentError}>
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    <span className="truncate max-w-[200px]">{contentError}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Karaoke / Văn bản toàn bài đang đọc */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                Nội dung toàn bài (Bấm vào câu bất kỳ để nghe đoạn đó):
              </span>
              <span className="text-[11px] tabular-nums font-mono">
                Đoạn {currentChunkIndex + 1}/{totalChunks}
              </span>
            </div>

            <div
              ref={sentenceListRef}
              className="max-h-44 sm:max-h-56 overflow-y-auto p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2 text-xs sm:text-sm leading-relaxed scroll-smooth"
            >
              {isLoadingFullContent ? (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-2.5 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  <p className="text-xs font-bold text-slate-200">
                    Đang mở liên kết bài viết và trích xuất toàn bộ nội dung...
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Hệ thống đang truy cập link gốc để đọc toàn văn đầy đủ 100%, âm thanh TTS sẽ bắt đầu đọc ngay sau đó.
                  </p>
                </div>
              ) : chunks.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">Đang chuẩn bị nội dung đọc...</p>
              ) : (
                chunks.map((sentence, idx) => {
                  const isActive = idx === currentChunkIndex;
                  return (
                    <p
                      key={idx}
                      data-active={isActive ? 'true' : 'false'}
                      onClick={() => speakChunk(idx)}
                      className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                        isActive
                          ? 'bg-emerald-500/25 text-emerald-300 font-semibold border-l-4 border-emerald-400 shadow-inner'
                          : 'text-slate-300/80 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {sentence}
                    </p>
                  );
                })
              )}
            </div>
          </div>

          {/* C. THANH TIẾN TRÌNH (PROCESS BAR) */}
          <div className="space-y-2 pt-1">
            <div
              ref={progressBarRef}
              onClick={handleProgressClick}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Tiến độ bài đọc"
              className="group relative h-2.5 bg-white/15 hover:h-3.5 rounded-full cursor-pointer transition-all overflow-hidden"
              title="Bấm để tua đến đoạn tương ứng"
            >
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-md shadow-emerald-400/50 rounded-full transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums">
              <span>{formatTime(elapsedSec)}</span>
              <span className="text-[11px] font-sans font-semibold text-emerald-400">
                {progressPercent}% hoàn thành ({totalChunks} đoạn)
              </span>
              <span>{formatTime(estimatedTotalSec)}</span>
            </div>
          </div>

          {/* D. CÁC NÚT ĐIỀU KHIỂN CHÍNH */}
          <div className="flex items-center justify-center gap-3 sm:gap-5 pt-1">
            {/* Tốc độ đọc */}
            <button
              onClick={handleCycleRate}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold transition-all cursor-pointer"
              title="Đổi tốc độ đọc (0.75x -> 2.0x)"
            >
              {playbackRate}x
            </button>

            {/* Nút Thu nhỏ ô góc */}
            <button
              onClick={() => setIsMinimized(true)}
              className="hidden xs:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-emerald-500/25 text-slate-200 hover:text-emerald-300 text-xs font-medium transition-all cursor-pointer border border-white/10 hover:border-emerald-500/30 active:scale-95"
              title="Thu nhỏ thành 1 ô bé ở góc màn hình"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Thu nhỏ</span>
            </button>

            {/* Câu trước */}
            <button
              onClick={handlePrevSentence}
              disabled={currentChunkIndex === 0}
              className="p-2.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
              title="Lùi về đoạn trước (Phím mũi tên trái)"
              aria-label="Đoạn trước"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            {/* Nút Play / Pause tròn lớn */}
            <button
              onClick={handleTogglePlay}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-xl shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
              title={isPlaying ? 'Tạm dừng (Space)' : 'Phát tiếp (Space)'}
              aria-label={isPlaying ? 'Tạm dừng' : 'Phát tiếp'}
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 fill-current" />
              ) : (
                <Play className="w-7 h-7 fill-current ml-1" />
              )}
            </button>

            {/* Câu tiếp theo */}
            <button
              onClick={handleNextSentence}
              disabled={currentChunkIndex >= totalChunks - 1}
              className="p-2.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
              title="Chuyển sang đoạn tiếp theo (Phím mũi tên phải)"
              aria-label="Đoạn tiếp theo"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            {/* Phát lại từ đầu */}
            <button
              onClick={handleRestart}
              className="p-2.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title="Đọc lại từ đầu"
              aria-label="Đọc lại"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>

          {/* E. Lựa chọn nguồn giọng đọc */}
          <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                Giọng đọc:
              </span>
              <button
                onClick={() => {
                  const nextVal = !useGoogleOnlineVoice;
                  setUseGoogleOnlineVoice(nextVal);
                  if (isPlaying) {
                    setTimeout(() => speakChunk(currentChunkIndex), 50);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  useGoogleOnlineVoice
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-white/10 text-slate-300 hover:bg-white/15'
                }`}
                title="Bấm để chuyển đổi giữa Giọng Nữ Google chuẩn và Giọng máy trình duyệt"
              >
                {useGoogleOnlineVoice ? 'Giọng Nữ Google (Chị Google) ✓' : 'Giọng thiết bị máy'}
              </button>
            </div>

            {/* Dropdown voice máy nếu không dùng online */}
            {!useGoogleOnlineVoice && voices.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setIsVoicePickerOpen(!isVoicePickerOpen)}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 font-medium truncate max-w-[200px] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="truncate">{selectedVoice?.name || 'Mặc định'}</span>
                </button>

                {isVoicePickerOpen && (
                  <div className="absolute bottom-full right-0 mb-2 w-64 max-h-48 overflow-y-auto bg-slate-900 border border-white/20 rounded-xl shadow-2xl p-1.5 z-30 space-y-1">
                    {voices
                      .filter((v) => v.lang.startsWith('vi') || v.default)
                      .map((v) => {
                        const isSelected = selectedVoice?.name === v.name;
                        return (
                          <button
                            key={v.name}
                            onClick={() => {
                              setSelectedVoice(v);
                              setIsVoicePickerOpen(false);
                              if (isPlaying) {
                                setTimeout(() => speakChunk(currentChunkIndex), 50);
                              }
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                                : 'text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            <span className="truncate">{v.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
