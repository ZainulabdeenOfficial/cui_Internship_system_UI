import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatbotService, ChatbotRequest, ChatbotMessage, ChatbotResponse } from '../../services/chatbot.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'cui-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.html',
  styleUrl: './chatbot.css'
})
export class ChatbotComponent {
  private readonly chatbotService = inject(ChatbotService);
  private readonly router = inject(Router);

  isOpen = signal<boolean>(false);
  isTyping = signal<boolean>(false);
  conversationId = signal<string | undefined>(undefined);
  messages = signal<ChatbotMessage[]>([]);
  userInput = signal<string>('');

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  toggleChat(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen() && this.messages().length === 0) {
      // Add a welcome message if the chat is opened for the first time
      this.messages.set([{ role: 'bot', text: 'Hello! How can I help you today?' }]);
    }
    setTimeout(() => this.scrollToBottom(), 100);
  }

  closeChat(): void {
    this.isOpen.set(false);
  }

  sendMessage(): void {
    const text = this.userInput().trim();
    if (!text || this.isTyping()) return;

    // Add user message
    this.messages.update((msgs) => [...msgs, { role: 'user', text }]);
    this.userInput.set('');
    this.isTyping.set(true);
    this.scrollToBottom();

    const requestPayload: ChatbotRequest = {
      message: text,
      currentRoute: this.router.url,
      ...(this.conversationId() ? { conversationId: this.conversationId() } : {})
    };

    this.chatbotService.sendMessage(requestPayload)
      .pipe(finalize(() => {
        this.isTyping.set(false);
        this.scrollToBottom();
      }))
      .subscribe({
        next: (response: ChatbotResponse) => {
          if (response.conversationId) {
            this.conversationId.set(response.conversationId);
          }
          this.messages.update((msgs) => [...msgs, { role: 'bot', text: response.reply }]);
        },
        error: (err) => {
          console.error('Chatbot error:', err);
          this.messages.update((msgs) => [
            ...msgs,
            { role: 'bot', text: 'Sorry, I am having trouble connecting right now. Please try again later.' }
          ]);
        }
      });
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        if (this.messagesContainer) {
          const el = this.messagesContainer.nativeElement;
          el.scrollTop = el.scrollHeight;
        }
      } catch (err) {}
    }, 50);
  }
}
