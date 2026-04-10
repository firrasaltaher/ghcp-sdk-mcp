export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export class ConversationSession {
  private messages: Message[] = [];

  addMessage(role: 'user' | 'assistant', content: string): void {
    this.messages.push({ role, content, timestamp: new Date() });
  }

  getHistory(): Message[] {
    return [...this.messages];
  }

  clear(): void {
    this.messages = [];
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  getSummary(): string {
    return `${this.messages.length} messages in conversation`;
  }
}
