import { API_BASE_URL } from '../constants/config';

const API_URL = `${API_BASE_URL}/api`;

// All commands the AI can return
export type AICommand =
  | 'OPEN_SCANNER'
  | 'OPEN_GALLERY'
  | 'GO_HOME'
  | 'GO_INFLIGHT'
  | 'GO_SEARCH'
  | 'GO_PROFILE'
  | 'GO_TRANSPORTS'
  | 'GO_BOARDING_PASS'
  | 'GO_LOGIN'
  | 'GO_REGISTER'
  | null;

export interface AIResponse {
  command: AICommand;
  message: string;
}

export const aiService = {
  /**
   * Send a message to the AI and get a structured response.
   * @param message User's message
   * @returns { command, message } — command is an action to execute, message is text to display
   */
  async chat(message: string): Promise<AIResponse> {
    try {
      const response = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `AI request failed: ${response.status}`);
      }

      const data = await response.json();
      return {
        command: data.command || null,
        message: data.message || 'No response',
      };
    } catch (error) {
      console.error('AI Service Error:', error);
      throw error;
    }
  },
};
