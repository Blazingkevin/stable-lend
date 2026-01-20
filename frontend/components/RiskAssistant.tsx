
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Sparkles, X, MessageCircle, Send, ShieldAlert, Loader2 } from 'lucide-react';

const RiskAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([
    { role: 'ai', content: "Hello! I'm your StableLend DeFi Assistant. I can help you understand lending risks, liquidation thresholds, or how USDCx bridging works on Stacks. How can I help?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsTyping(true);

    try {
      // Fix: Ensure initialization uses process.env.API_KEY directly as per guidelines
      const ai = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');
      const model = ai.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `You are an expert DeFi risk advisor for StableLend, a lending protocol on the Stacks blockchain. You explain complex lending mechanics like health factors, LTV (Loan to Value), and USDCx bridging in simple, professional terms. Keep responses concise and focused on risk management and protocol education. Never give financial advice, only technical explanations of the protocol.\n\nUser question: ${userMessage}`;
      
      const response = await model.generateContent(prompt);
      const aiText = response.response.text() || "I'm having trouble connecting to the network. Please try again later.";
      setMessages(prev => [...prev, { role: 'ai', content: aiText }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'ai', content: "I encountered an error processing your request. Please ensure the protocol environment is stable." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Toggle */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-orange-500/40 z-50 transition-all hover:scale-110 active:scale-95 group"
      >
        <Sparkles className="w-6 h-6 group-hover:animate-pulse" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] glass-card rounded-3xl border border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-orange-500 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-white" />
              <span className="font-bold text-white text-sm">Risk Advisor AI</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900/50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-orange-500 text-white rounded-tr-none' 
                    : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-none'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 text-gray-400 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Analyzing protocol data...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-white/10 bg-gray-900/80">
            <div className="relative">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about liquidation prices..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all pr-12"
              />
              <button 
                onClick={handleSend}
                disabled={isTyping}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-orange-500 hover:text-orange-400 disabled:text-gray-600 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RiskAssistant;
