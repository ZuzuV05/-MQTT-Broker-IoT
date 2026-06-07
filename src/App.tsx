import React, { useState } from 'react';
import { useMqtt } from './useMqtt';
import { useVoiceCommand } from './useVoiceCommand';
import { 
  ThermometerSun, Droplets, Lightbulb, 
  Mic, MicOff, Power, Layers
} from 'lucide-react';

export default function App() {
  const { brokerStatuses, sensorData, publishMessage } = useMqtt();
  
  const [relayState, setRelayState] = useState({
    1: false,
    2: false,
    3: false,
    4: false,
  });
  const [activePattern, setActivePattern] = useState<string | null>(null);
  const [activities, setActivities] = useState<{time: string, text: React.ReactNode}[]>([
    { time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), text: <span>Sistem <span className="font-bold text-emerald-600">online</span></span> }
  ]);

  const addActivity = (text: React.ReactNode) => {
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    setActivities(prev => [{time, text}, ...prev].slice(0, 4));
  };

  const handleCommand = (topic: string, message: string) => {
    publishMessage(topic, message);
    
    // Optimistic UI update
    if (topic === 'iot/lampu/relay/all') {
      const isOn = message === 'ON';
      setRelayState({ 1: isOn, 2: isOn, 3: isOn, 4: isOn });
      setActivePattern(null);
      addActivity(<span><span className="font-bold">Semua Relay</span> {isOn ? 'dihidupkan' : 'dimatikan'}</span>);
    } else if (topic.startsWith('iot/lampu/relay/')) {
      const id = parseInt(topic.split('/').pop() || '0');
      if (id >= 1 && id <= 4) {
        setRelayState((prev) => ({ ...prev, [id]: message === 'ON' }));
        setActivePattern(null);
        addActivity(<span><span className="font-bold">Relay 0{id}</span> {message === 'ON' ? 'diaktifkan' : 'dimatikan'}</span>);
      }
    } else if (topic === 'iot/lampu/pola') {
      if (message === 'STOP') {
        setActivePattern(null);
        addActivity(<span>Pola dihentikan</span>);
      }
      else {
        setActivePattern(message);
        addActivity(<span>Pola <span className="font-bold">{message}</span> aktif</span>);
      }
    }
  };

  const { isListening, transcript, toggleListening, isSupported } = useVoiceCommand({
    onCommand: handleCommand,
    sensorData,
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 flex flex-col gap-6 font-sans text-slate-800">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white/90 p-4 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-sky-500 rounded-lg flex items-center justify-center text-white shadow-sm">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Zuzu IoT</h1>
            <p className="text-xs text-slate-500 font-medium">Sistem kendali lampu & Monitoring Suhu/Kelembapan</p>
          </div>
        </div>
        
        <div className="flex items-center justify-between w-full md:w-auto gap-6">
          {isListening && (
            <div className="flex items-center gap-2 bg-sky-50 px-3 py-1.5 rounded-full border border-sky-100">
              <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></div>
              <span className="text-xs font-semibold text-sky-700 uppercase tracking-wider">Voice Command Aktif</span>
            </div>
          )}
          <div className="text-right flex-1 md:flex-none">
            <p className="text-sm font-bold text-slate-700">{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Column: Broker & Voice */}
        <div className="md:col-span-4 lg:col-span-3 flex flex-col gap-6">
          <section className="bg-white/90 border border-slate-200 rounded-2xl shadow-sm p-5 flex-1">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Status Koneksi Broker</h2>
            <div className="space-y-3">
              {brokerStatuses.map((broker) => {
                const isConnected = broker.status === 'connected';
                return (
                  <div key={broker.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="overflow-hidden mr-2">
                      <p className="text-xs font-bold truncate text-slate-800">{broker.name.split('.')[0] || broker.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{broker.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-[10px] font-bold ${isConnected ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {broker.status === 'connected' ? 'TERHUBUNG' : 'BERHENTI'}
                      </span>
                      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {isSupported && (
            <section className="bg-slate-900 rounded-2xl shadow-sm p-5 flex flex-col relative overflow-hidden flex-1">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Perintah Suara</h2>
              <div className="bg-slate-800 p-3 rounded-lg border-l-4 border-sky-400 flex-1 flex flex-col justify-center">
                <p className="text-sm italic text-slate-300 font-medium whitespace-pre-line text-center">"{transcript || '...'}"</p>
              </div>
              
              <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sky-400">
                  {isListening ? (
                    <>
                      <Mic className="w-4 h-4 animate-pulse shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Mendengarkan...</span>
                    </>
                  ) : (
                    <>
                      <MicOff className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Menunggu masukan</span>
                    </>
                  )}
                </div>
                <button 
                  onClick={toggleListening} 
                  className={`p-2.5 rounded-lg transition-all ${isListening ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/30' : 'bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/30'}`}
                >
                  {isListening ? <Power className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>
            </section>
          )}
        </div>

        {/* Center Column: Controls */}
        <div className="md:col-span-8 lg:col-span-6 flex flex-col gap-6">
          <section className="bg-white/90 border border-slate-200 rounded-2xl shadow-sm p-6 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Kontrol Unit Relay</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleCommand('iot/lampu/relay/all', 'ON')}
                    className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-amber-950 text-xs font-bold rounded-lg transition-colors shadow-sm"
                  >
                    SEMUA ON
                  </button>
                  <button 
                    onClick={() => handleCommand('iot/lampu/relay/all', 'OFF')}
                    className="px-3 py-1.5 border-2 border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-colors shadow-sm"
                  >
                    SEMUA OFF
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((id) => {
                  const isOn = activePattern ? false : relayState[id as keyof typeof relayState];
                  return (
                    <button
                      key={id}
                      onClick={() => handleCommand(`iot/lampu/relay/${id}`, isOn ? 'OFF' : 'ON')}
                      className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                        isOn 
                          ? 'border-sky-200 bg-sky-50 shadow-sm' 
                          : 'border-slate-100 bg-slate-50 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-4 text-left">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                          isOn ? 'bg-white text-sky-500 shadow-inner' : 'bg-white text-slate-300 border border-slate-100 shadow-sm'
                        }`}>
                          <Lightbulb className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Relay 0{id}</p>
                          <p className={`text-[10px] font-bold uppercase tracking-widest ${isOn ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {isOn ? 'Aktif' : 'Mati'}
                          </p>
                        </div>
                      </div>
                      
                      <div className={`w-12 h-6 flex-shrink-0 rounded-full relative transition-colors ${isOn ? 'bg-sky-500' : 'bg-slate-200'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isOn ? 'right-1' : 'left-1'}`}></div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Pola Pencahayaan Dinamis</h3>
              <div className="flex flex-wrap gap-3 sm:gap-4">
                <button
                  onClick={() => handleCommand('iot/lampu/pola', 'SEQUENTIAL')}
                  className={`flex-1 py-3 px-2 sm:py-4 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-widest transition-all ${
                    activePattern === 'SEQUENTIAL' 
                      ? 'bg-sky-500 text-white shadow-lg shadow-sky-200' 
                      : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-sky-500 hover:text-sky-500'
                  }`}
                >
                  Sequential
                </button>
                <button
                  onClick={() => handleCommand('iot/lampu/pola', 'STROBO')}
                  className={`flex-1 py-3 px-2 sm:py-4 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-widest transition-all ${
                    activePattern === 'STROBO' 
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' 
                      : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-amber-500 hover:text-amber-500'
                  }`}
                >
                  Strobo
                </button>
                <button
                  onClick={() => handleCommand('iot/lampu/pola', 'STOP')}
                  className="flex-[0.5] py-3 px-2 sm:py-4 bg-slate-900 text-white rounded-xl font-bold text-xs sm:text-sm uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-1 sm:gap-2"
                >
                  <Power className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Stop</span>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Sensors & Activity */}
        <div className="md:col-span-12 lg:col-span-3 flex flex-col gap-6">
          <section className="bg-white/90 border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col gap-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Monitoring Sensor</h2>
            
            <div className="bg-sky-50 rounded-2xl p-5 border border-sky-100 relative overflow-hidden">
              <p className="text-xs font-bold text-sky-700 tracking-wider">SUHU</p>
              <h3 className="text-4xl font-black text-sky-900 mt-1">
                {sensorData.temperature ? sensorData.temperature.replace(/[^0-9.]/g, '') : '--'}
                <span className="text-2xl font-bold">&deg;C</span>
              </h3>
              <div className="absolute -right-4 -bottom-4 opacity-10 text-sky-900 pointer-events-none">
                <ThermometerSun className="w-20 h-20" />
              </div>
            </div>
            
            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 relative overflow-hidden">
              <p className="text-xs font-bold text-amber-700 tracking-wider">KELEMBAPAN</p>
              <h3 className="text-4xl font-black text-amber-900 mt-1">
                {sensorData.humidity ? sensorData.humidity.replace(/[^0-9.]/g, '') : '--'}
                <span className="text-2xl font-black">%</span>
              </h3>
              <div className="absolute -right-4 -bottom-4 opacity-10 text-amber-900 pointer-events-none">
                <Droplets className="w-20 h-20" />
              </div>
            </div>
          </section>

          <section className="bg-white/90 border border-slate-200 rounded-2xl shadow-sm p-5 flex-1 flex flex-col overflow-hidden">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Aktivitas Terakhir</h2>
            <div className="space-y-4 text-[11px] font-medium leading-relaxed">
               {activities.map((act, i) => (
                 <div key={i} className="flex gap-3">
                   <span className="text-slate-400 whitespace-nowrap">{act.time}</span>
                   <p className="text-slate-700">{act.text}</p>
                 </div>
               ))}
               {activities.length === 0 && (
                  <div className="text-slate-400 italic">Belum ada aktivitas.</div>
               )}
            </div>
          </section>
        </div>

      </main>

      {/* Footer */}
      <footer className="mt-2 flex justify-between items-center px-2">
        <div className="flex gap-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Build v1.0.4-Stable</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden sm:block">•</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden sm:block">Library: MQTT.js</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Semua Sistem Sinkron</p>
        </div>
      </footer>
    </div>
  );
}