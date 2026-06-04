import { useState, useCallback, useEffect, useRef } from 'react';
import { SensorData } from './types';

// Extend window for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface UseVoiceCommandProps {
  onCommand: (topic: string, message: string) => void;
  sensorData: SensorData;
}

export function useVoiceCommand({ onCommand, sensorData }: UseVoiceCommandProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  
  // To get the latest sensorData in processCommand
  const sensorDataRef = useRef(sensorData);
  useEffect(() => {
    sensorDataRef.current = sensorData;
  }, [sensorData]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'id-ID';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          const speechResult = event.results[0][0].transcript.toLowerCase();
          setTranscript(speechResult);
          processCommand(speechResult);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
          if (event.error === 'network') {
            setTranscript('(Kesalahan jaringan API Suara Chrome)');
          } else if (event.error === 'not-allowed') {
            setTranscript('(Akses mikrofon ditolak)');
          } else {
            setTranscript(`(Gagal mendengarkan: ${event.error})`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.error('Failed to initialize SpeechRecognition:', err);
      }
    } else {
      console.warn('SpeechRecognition API not supported in this browser.');
    }
  }, [onCommand]);

  const processCommand = (text: string) => {
    // Info Sensor TTS
    if (text.includes('info sensor') || text.includes('informasi sensor')) {
      readSensorData(sensorDataRef.current);
      return;
    }

    // Relay 1-4 ON
    if (text.includes('hidupkan relay satu')) onCommand('iot/lampu/relay/1', 'ON');
    else if (text.includes('hidupkan relay dua')) onCommand('iot/lampu/relay/2', 'ON');
    else if (text.includes('hidupkan relay tiga')) onCommand('iot/lampu/relay/3', 'ON');
    else if (text.includes('hidupkan relay empat')) onCommand('iot/lampu/relay/4', 'ON');
    
    // Relay 1-4 OFF
    else if (text.includes('matikan relay satu')) onCommand('iot/lampu/relay/1', 'OFF');
    else if (text.includes('matikan relay dua')) onCommand('iot/lampu/relay/2', 'OFF');
    else if (text.includes('matikan relay tiga')) onCommand('iot/lampu/relay/3', 'OFF');
    else if (text.includes('matikan relay empat')) onCommand('iot/lampu/relay/4', 'OFF');
    
    // Semua ON/OFF
    else if (text.includes('hidupkan semua')) onCommand('iot/lampu/relay/all', 'ON');
    else if (text.includes('matikan semua')) onCommand('iot/lampu/relay/all', 'OFF');
    
    // Pola
    else if (text.includes('pola sequential') || text.includes('pola sekuensial')) onCommand('iot/lampu/pola', 'SEQUENTIAL');
    else if (text.includes('pola strobo')) onCommand('iot/lampu/pola', 'STROBO');
    else if (text.includes('hentikan pola') || text.includes('berhenti pola')) onCommand('iot/lampu/pola', 'STOP');
  };

  const readSensorData = (data: SensorData) => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // clear previous speech
        const temp = data.temperature ? data.temperature.replace(/[^0-9.]/g, '') : 'tidak diketahui';
        const hum = data.humidity ? data.humidity.replace(/[^0-9.]/g, '') : 'tidak diketahui';
        const utterance = new SpeechSynthesisUtterance(`Suhu saat ini adalah ${temp} derajat celcius, dan kelembapan ${hum} persen.`);
        utterance.lang = 'id-ID';
        
        const voices = window.speechSynthesis.getVoices();
        const idVoice = voices.find(v => v.lang.includes('id'));
        if (idVoice) utterance.voice = idVoice;
        
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error('SpeechSynthesis error:', err);
    }
  };

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error(e);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    toggleListening,
    isSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  };
}
