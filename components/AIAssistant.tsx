
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Sparkles, AlertCircle } from 'lucide-react';
import { askConsultant } from '../services/geminiService';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AIAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! I'm your GA-AppLocker expert assistant. How can I help you secure your Windows environment today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const response = await askConsultant(userMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: response || "I'm sorry, I couldn't generate a response." }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Error: Connection lost. Please verify your API key configuration." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
      <div className="bg-slate-900 p-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">AppLocker Consultant</h3>
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Powered by Gemini 3 Pro</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium">
          <Sparkles size={14} className="text-amber-400" />
          <span>Intelligent Insights</span>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
      >
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}
          >
            <div className={`flex space-x-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <div className={`p-2 rounded-xl h-fit ${msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                : 'bg-slate-50 border border-slate-100 text-slate-800'
              }`}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex space-x-3 max-w-[80%]">
              <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                <Bot size={18} />
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center space-x-2">
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-3 max-w-4xl mx-auto">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            type="text" 
            placeholder="Ask about rule design, LOLBins, or compliance best practices..." 
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm bg-white"
          />
          <button 
            onClick={handleSend}
            disabled={loading}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
        <div className="mt-2 text-center">
          <p className="text-[10px] text-slate-400 font-medium">
            AI can make mistakes. Please verify critical policy decisions with your ISSO.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
