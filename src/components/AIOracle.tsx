import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, X, Minimize2, Maximize2, Crown, Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIOracleProps {
  isOpen: boolean;
  onClose: () => void;
}

const FREE_GREETING = "Good day! I'm the AI Oracle, your guide for the Sovereign Sector. I can help with basic document questions and general guidance. For deep analysis, proactive security briefings, and strategic planning, upgrade to Premium.";

const PREMIUM_GREETING = "Good day! I'm your Advanced AI Oracle — your elite, security-cleared advisor. I have full awareness of your document vault and can provide deep analysis, compliance guidance, risk assessments, and strategic planning. How may I be of service?";

const FREE_MESSAGE_LIMIT = 10;

const AIOracle = ({ isOpen, onClose }: AIOracleProps) => {
  const { isPremium, loading: subLoading } = useSubscription();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Reset greeting when premium status changes
  useEffect(() => {
    if (!subLoading) {
      setMessages([
        { role: "assistant", content: isPremium ? PREMIUM_GREETING : FREE_GREETING },
      ]);
      setMessageCount(0);
    }
  }, [isPremium, subLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const endpoint = isPremium ? "ai-oracle-premium" : "ai-oracle";

  const streamChat = async (userMessages: Message[]) => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: userMessages }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to connect to AI Oracle");
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantContent += content;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant" && prev.length > 1) {
                return prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, content: assistantContent } : m
                );
              }
              return [...prev, { role: "assistant", content: assistantContent }];
            });
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Enforce free-tier message limit
    if (!isPremium && messageCount >= FREE_MESSAGE_LIMIT) {
      toast({
        title: "Message Limit Reached",
        description: "Free users are limited to 10 messages per session. Upgrade to Premium for unlimited access.",
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setMessageCount((c) => c + 1);

    try {
      await streamChat(newMessages);
    } catch (error) {
      console.error("AI Oracle error:", error);
      toast({
        variant: "destructive",
        title: "Oracle Connection Error",
        description: error instanceof Error ? error.message : "Unable to reach the Oracle. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const remainingMessages = FREE_MESSAGE_LIMIT - messageCount;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className={`fixed bottom-6 right-6 z-50 ${
          isMinimized ? "w-auto" : "w-96"
        } rounded-2xl shadow-2xl overflow-hidden ${
          isPremium
            ? "border-2 border-primary/40 bg-card"
            : "cyber-border bg-card"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b ${
            isPremium
              ? "bg-gradient-to-r from-primary/20 via-primary/10 to-accent/10 border-primary/30"
              : "bg-gradient-to-r from-accent/20 to-accent/10 border-accent/30"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isPremium
                  ? "bg-primary/20 border border-primary/40"
                  : "bg-accent/20 border border-accent/40"
              }`}
            >
              {isPremium ? (
                <Sparkles className="text-primary" size={20} />
              ) : (
                <Bot className="text-accent" size={20} />
              )}
            </div>
            {!isMinimized && (
              <div>
                <div className="flex items-center gap-2">
                  <h3
                    className={`font-display font-bold text-sm ${
                      isPremium ? "text-primary" : "text-accent"
                    }`}
                  >
                    {isPremium ? "Advanced Oracle" : "AI Oracle"}
                  </h3>
                  {isPremium && (
                    <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] px-1.5 py-0">
                      <Crown size={8} className="mr-0.5" />
                      PRO
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  {isPremium ? "Premium • Deep Analysis Mode" : "Online • Basic Assistance"}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X size={16} />
            </Button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-xl ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : isPremium
                        ? "bg-primary/5 border border-primary/20 text-foreground"
                        : "bg-muted/50 border border-border text-foreground"
                    }`}
                  >
                    <p className="text-sm font-rajdhani whitespace-pre-wrap">{message.content}</p>
                  </div>
                </motion.div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className={`px-4 py-3 rounded-xl ${isPremium ? "bg-primary/5 border border-primary/20" : "bg-muted/50 border border-border"}`}>
                    <div className="flex gap-1">
                      <span className={`w-2 h-2 rounded-full animate-bounce ${isPremium ? "bg-primary" : "bg-accent"}`} style={{ animationDelay: "0ms" }} />
                      <span className={`w-2 h-2 rounded-full animate-bounce ${isPremium ? "bg-primary" : "bg-accent"}`} style={{ animationDelay: "150ms" }} />
                      <span className={`w-2 h-2 rounded-full animate-bounce ${isPremium ? "bg-primary" : "bg-accent"}`} style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Free tier limit indicator */}
            {!isPremium && (
              <div className="px-4 py-2 bg-muted/30 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                  <Lock size={10} />
                  {remainingMessages > 0
                    ? `${remainingMessages} messages remaining`
                    : "Limit reached"}
                </span>
                <span className="text-xs text-primary font-mono cursor-pointer hover:underline">
                  Upgrade for unlimited
                </span>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-border bg-card/50">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isPremium ? "Ask your Advanced Oracle anything..." : "Ask the Oracle..."}
                  className={`flex-1 bg-background border-border ${isPremium ? "focus:border-primary" : "focus:border-accent"}`}
                  disabled={isLoading || (!isPremium && messageCount >= FREE_MESSAGE_LIMIT)}
                />
                <Button
                  type="submit"
                  size="icon"
                  className={`${isPremium ? "bg-primary hover:bg-primary/80" : "bg-accent hover:bg-accent/80"} text-accent-foreground`}
                  disabled={isLoading || !input.trim() || (!isPremium && messageCount >= FREE_MESSAGE_LIMIT)}
                >
                  <Send size={18} />
                </Button>
              </form>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default AIOracle;
