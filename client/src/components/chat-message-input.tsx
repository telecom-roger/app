import { useState, useRef, useEffect, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Paperclip, Mic, StopCircle } from "lucide-react";

interface ChatMessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  isLoading?: boolean;
  isRecording?: boolean;
  placeholder?: string;
}

export const ChatMessageInput = forwardRef<HTMLTextAreaElement, ChatMessageInputProps>(({
  value,
  onChange,
  onSend,
  onFileUpload,
  onStartRecording,
  onStopRecording,
  onPaste,
  disabled = false,
  isLoading = false,
  isRecording = false,
  placeholder = "Digite uma mensagem…",
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaHeight, setTextareaHeight] = useState("auto");

  // Expor o focus method via ref
  useEffect(() => {
    if (ref) {
      if (typeof ref === 'function') {
        ref(textareaRef.current);
      } else {
        ref.current = textareaRef.current;
      }
    }
  }, [ref]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 128);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [value]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
      // Manter o focus no textarea após enviar
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const handleSendClick = () => {
    onSend();
    // Manter o focus no textarea após enviar
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-slate-900 z-40 px-3 sm:px-4 py-3 sm:py-4 border-t border-slate-200 dark:border-slate-700 flex justify-center">
      <div className="flex gap-3 items-end w-full max-w-2xl">
          <input
            type="file"
            id="chat-file-upload"
            onChange={onFileUpload}
            className="hidden"
            data-testid="chat-input-file-upload"
          />

          <div 
            className="relative flex-1 flex items-center px-3 py-1.5 gap-2" 
            style={{
              backgroundColor: "#f7f7f8",
              border: "1px solid #999999",
              borderRadius: "999px",
              boxShadow: "0 2px 12px rgba(0, 0, 0, 0.08)"
            }}
          >
            <Button
              size="icon"
              variant="ghost"
              onClick={() => document.getElementById("chat-file-upload")?.click()}
              disabled={disabled || isRecording}
              data-testid="chat-input-file-button"
              className="h-8 w-8 flex-shrink-0 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors border border-gray-400 dark:border-gray-600"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyPress={handleKeyPress}
              onPaste={onPaste}
              placeholder={placeholder}
              disabled={disabled}
              autoFocus
              data-testid="chat-input-textarea"
              className="flex-1 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:outline-none text-sm placeholder-slate-500 dark:placeholder-slate-400 dark:text-white max-h-32"
              style={{
                height: "auto",
                minHeight: "32px",
                maxHeight: "128px",
                margin: "0",
                padding: "0",
              }}
            />

            {value.trim() ? (
              <Button
                onClick={handleSendClick}
                disabled={isLoading || disabled}
                size="icon"
                data-testid="chat-input-send-button"
                className="h-9 w-9 flex-shrink-0 ml-2 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors border border-gray-400 dark:border-gray-600"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={isRecording ? onStopRecording : onStartRecording}
                disabled={isLoading || disabled}
                data-testid="chat-input-voice-button"
                className="h-9 w-9 flex-shrink-0 ml-2 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors border border-gray-400 dark:border-gray-600"
              >
                {isRecording ? (
                  <StopCircle className="h-5 w-5 animate-pulse text-red-500" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
            )}
          </div>
        </div>
    </div>
  );
});
