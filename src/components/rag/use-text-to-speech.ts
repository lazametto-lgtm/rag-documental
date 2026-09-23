'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// Hook para Web Speech API SpeechSynthesis (TTS) — browser nativo, sin backend.
// Permite leer en voz alta el texto de las respuestas del asistente.

export function useTextToSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  // Detectar soporte sin setState en effect
  const supported = typeof window !== 'undefined' && !!window.speechSynthesis;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Cargar voces cuando el componente monta
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  // Seleccionar voz preferida (español si hay)
  const getSpanishVoice = useCallback((): SpeechSynthesisVoice | undefined => {
    return voices.find((v) => v.lang.startsWith('es')) ?? voices[0];
  }, [voices]);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      // Detener cualquier reproducción anterior
      window.speechSynthesis.cancel();

      // Limpiar el texto de markdown para mejor pronunciación
      const cleanText = text
        .replace(/[#*_`>]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\n{2,}/g, '\n')
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'es-ES';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      const voice = getSpanishVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [getSpanishVoice],
  );

  const stop = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const toggle = useCallback(
    (text: string) => {
      if (speaking) {
        stop();
      } else {
        speak(text);
      }
    },
    [speaking, speak, stop],
  );

  return { speaking, supported, speak, stop, toggle };
}
