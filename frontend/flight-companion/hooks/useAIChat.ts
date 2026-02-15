import { useState } from 'react';
import { aiService, AICommand } from '../services/aiApi';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  command?: AICommand;
  timestamp: Date;
}

export function useAIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<AICommand>(null);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    setIsLoading(true);
    setError(null);
    setLastCommand(null);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await aiService.chat(content);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        command: response.command,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Set the command so the UI can react to it
      if (response.command) {
        setLastCommand(response.command);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLastCommand = () => {
    setLastCommand(null);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return {
    messages,
    isLoading,
    error,
    lastCommand,
    sendMessage,
    clearLastCommand,
    clearMessages,
  };
}
