import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ChatbotMessage {
  role: 'user' | 'bot';
  text: string;
}

export interface ChatbotRequest {
  message: string;
  currentRoute: string;
  conversationId?: string;
}

export interface ChatbotSource {
  id: string;
  title: string;
  module: string;
}

export interface ChatbotResponse {
  conversationId: string;
  reply: string;
  confidence: string;
  role: string;
  userId: string;
  sources?: ChatbotSource[];
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private readonly http = inject(HttpClient);
  // URL as provided by the user
  private readonly apiUrl = 'https://cui-internship-git-dev-talhas-projects-59c8907e.vercel.app/api/chat';

  sendMessage(payload: ChatbotRequest): Observable<ChatbotResponse> {
    return this.http.post<ChatbotResponse>(this.apiUrl, payload);
  }
}
