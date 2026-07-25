import { BotStatusResponse, Meeting } from '../types';

class ApiClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw new Error(`Server returned non-JSON response (${res.status}): ${text.slice(0, 100)}`);
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP Error ${res.status}`);
    }

    return data as T;
  }

  public async getStatus(): Promise<BotStatusResponse> {
    return this.request<BotStatusResponse>('/api/meetings/status');
  }

  public async joinMeeting(params: {
    meetUrl: string;
    botName?: string;
    autoMuteMic?: boolean;
    autoMuteCam?: boolean;
  }): Promise<{ message: string; meeting: Meeting }> {
    return this.request<{ message: string; meeting: Meeting }>('/api/meetings/join', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  public async stopMeeting(): Promise<{ message: string; meeting: Meeting }> {
    return this.request<{ message: string; meeting: Meeting }>('/api/meetings/stop', {
      method: 'POST',
    });
  }

  public async getMeetings(): Promise<{ meetings: Meeting[] }> {
    return this.request<{ meetings: Meeting[] }>('/api/meetings');
  }

  public async getMeeting(id: string): Promise<{ meeting: Meeting }> {
    return this.request<{ meeting: Meeting }>(`/api/meetings/${id}`);
  }

  public async deleteMeeting(id: string): Promise<{ message: string; id: string }> {
    return this.request<{ message: string; id: string }>(`/api/meetings/${id}`, {
      method: 'DELETE',
    });
  }

  public async simulateMeeting(title?: string, transcript?: any[]): Promise<{ message: string; meeting: Meeting }> {
    return this.request<{ message: string; meeting: Meeting }>('/api/meetings/simulate', {
      method: 'POST',
      body: JSON.stringify({ title, transcript }),
    });
  }

  public async uploadAudioOrTranscript(params: {
    title: string;
    audioBase64?: string;
    mimeType?: string;
    textTranscript?: string;
  }): Promise<{ message: string; meeting: Meeting }> {
    return this.request<{ message: string; meeting: Meeting }>('/api/meetings/upload-audio', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  public async reanalyzeMeeting(id: string): Promise<{ message: string; meeting: Meeting }> {
    return this.request<{ message: string; meeting: Meeting }>(`/api/meetings/${id}/analyze`, {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
