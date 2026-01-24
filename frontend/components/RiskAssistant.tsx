
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Sparkles, X, MessageCircle, Send, ShieldAlert, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const RiskAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([
    { role: 'ai', content: "Hello! I'm your StableLend DeFi Assistant. I can help you understand lending risks, liquidation thresholds, or how USDCx bridging works on Stacks. How can I help?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, streamingText]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsTyping(true);

    try {
      // Using the stable v1 API model name
      const ai = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');
      const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      const prompt = `You are a friendly financial educator helping newcomers understand StableLend, a lending platform on Bitcoin's Stacks blockchain.

ABOUT STABLELEND:
- StableLend is a native lending protocol on Stacks (Bitcoin Layer 2)
- Users supply USDCx (a stablecoin worth $1, bridged from Ethereum USDC) to earn interest
- Borrowers put up STX (Stacks cryptocurrency) as collateral to borrow USDCx
- Lenders earn 8% APY × utilization rate (more borrowing = higher APY for lenders)
- Borrowers pay 8% APY on their loans
- It's preparing for sBTC launch - when Bitcoin becomes usable in DeFi

KEY CONCEPTS TO EXPLAIN SIMPLY:
- USDCx: A digital dollar (stablecoin) that you can use on Bitcoin's network
- Collateral: Something valuable you lock up to get a loan (like a pawn shop)
- Health Factor: Your safety score - keep it high to avoid liquidation
- Liquidation: When your collateral gets sold because your loan became too risky
- APY: Annual interest rate - what you earn (lenders) or pay (borrowers)
- Utilization: How much of the money in the pool is being borrowed (affects interest rates)

IMPORTANT RULES:
- Use SIMPLE everyday language like explaining to a friend who's new to crypto
- Avoid jargon - if you must use technical terms, explain them in parentheses
- Use real-world analogies (e.g., "It's like a pawn shop, but automatic and on the blockchain")
- Keep responses SHORT - 2-3 sentences maximum
- Be encouraging and reassuring, not scary or overly technical
- Focus on WHAT and WHY, not complex technical HOW

Examples of good explanations:
- "USDCx is like having digital dollars that work on Bitcoin. Each one is worth $1."
- "Think of collateral like leaving your watch at a pawn shop to get cash. You get it back when you repay."
- "Your interest rate goes up when more people borrow - it's supply and demand!"

User question: ${userMessage}`;
      
      const response = await model.generateContent(prompt);
      const aiText = response.response.text() || "I'm having trouble connecting to the network. Please try again later.";
      
      // Typewriter effect - stream the text character by character
      setStreamingText('');
      let index = 0;
      const streamInterval = setInterval(() => {
        if (index < aiText.length) {
          setStreamingText(aiText.slice(0, index + 1));
          index++;
        } else {
          clearInterval(streamInterval);
          setMessages(prev => [...prev, { role: 'ai', content: aiText }]);
          setStreamingText('');
          setIsTyping(false);
        }
      }, 20); // 20ms per character = smooth typing effect
      
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'ai', content: "I encountered an error processing your request. Please ensure the protocol environment is stable." }]);
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
                  {m.role === 'ai' ? (
                    <ReactMarkdown
                      components={{
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold text-orange-400" {...props} />,
                        em: ({node, ...props}) => <em className="italic text-gray-300" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1" {...props} />,
                        li: ({node, ...props}) => <li className="ml-2" {...props} />,
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {/* Streaming text (typewriter effect) */}
            {streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed bg-white/5 border border-white/10 text-gray-200 rounded-tl-none">
                  <ReactMarkdown
                    components={{
                      p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-bold text-orange-400" {...props} />,
                      em: ({node, ...props}) => <em className="italic text-gray-300" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1" {...props} />,
                      li: ({node, ...props}) => <li className="ml-2" {...props} />,
                    }}
                  >
                    {streamingText}
                  </ReactMarkdown>
                  <span className="inline-block w-1 h-4 bg-orange-500 ml-1 animate-pulse"></span>
                </div>
              </div>
            )}
            {isTyping && !streamingText && (
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
