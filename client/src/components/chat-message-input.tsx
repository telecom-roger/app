import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Paperclip, Mic, StopCircle } from "lucide-react";

interface ChatMessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  isRecording?: boolean;
  placeholder?: string;
}

export function ChatMessageInput({
  value,
  onChange,
  onSend,
  onFileUpload,
  onStartRecording,
  onStopRecording,
  disabled = false,
  isLoading = false,
  isRecording = false,
  placeholder = "Digite uma mensagem…",
}: ChatMessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaHeight, setTextareaHeight] = useState("auto");

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
    }
  };

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-40 px-3 sm:px-4 py-3 sm:py-4 border-t border-slate-200 dark:border-slate-700 flex justify-center">
      <div className="flex gap-2 sm:gap-3 items-end w-full max-w-2xl">
          <input
            type="file"
            id="chat-file-upload"
            onChange={onFileUpload}
            className="hidden"
            data-testid="chat-input-file-upload"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => document.getElementById("chat-file-upload")?.click()}
            disabled={disabled || isRecording}
            data-testid="chat-input-file-button"
            className="h-10 w-10 flex-shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <div className="relative flex-1 bg-slate-100 dark:bg-slate-700 rounded-3xl shadow-sm flex items-end px-4 py-2">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              disabled={disabled}
              data-testid="chat-input-textarea"
              className="w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:outline-none text-sm placeholder-slate-500 dark:placeholder-slate-400 dark:text-white max-h-40 py-2"
              style={{
                height: "auto",
                minHeight: "40px",
                maxHeight: "160px",
              }}
            />

            {value.trim() ? (
              <Button
                onClick={onSend}
                disabled={isLoading || disabled}
                size="icon"
                data-testid="chat-input-send-button"
                className="h-8 w-8 flex-shrink-0 ml-2"
                variant="ghost"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                onClick={isRecording ? onStopRecording : onStartRecording}
                disabled={isLoading || disabled}
                data-testid="chat-input-voice-button"
                className="h-8 w-8 flex-shrink-0 ml-2"
              >
                {isRecording ? (
                  <StopCircle className="h-4 w-4 animate-pulse" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
    </div>
  );
}
