import { soundManager } from '../../utils/sound';
import { supabase, isSupabaseConfigured } from '../supabase/client';

export interface NotificationResult {
  supported: boolean;
  permission: NotificationPermission;
}

export interface NotifyExtraOptions {
  queueId?: string;
  email?: string;
}

class NotificationService {
  // Check if browser is iOS (iPhone/iPad/iPod)
  public isIOS(): boolean {
    if (typeof window === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  // Check if PWA is installed (standalone mode)
  public isStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  }

  // Check Web Notification support
  public getNotificationStatus(): NotificationResult {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { supported: false, permission: 'default' };
    }
    return { supported: true, permission: Notification.permission };
  }

  // Request browser notification permission
  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    try {
      const res = await Notification.requestPermission();
      return res === 'granted';
    } catch {
      return false;
    }
  }

  // Trigger high-priority call feedback (Sound + Vibration + Browser Notification + Cloud Edge Function)
  public notifyTicketCalled(ticketNumber: number, queueName: string, extra?: NotifyExtraOptions): void {
    // 1. Play Chime Sound
    soundManager.playChime();

    // 2. Trigger Mobile Vibration
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([300, 100, 300, 100, 400]);
      } catch {
        // ignore
      }
    }

    // 3. System Notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`🎉 [${queueName}] 내 차례입니다!`, {
          body: `대기번호 #${ticketNumber}번 고객님, 지금 바로 입장해 주세요!`,
          icon: '/Jullsir/favicon.svg',
          tag: 'jullsir-called',
          requireInteraction: true
        });
      } catch {
        // ignore
      }
    }

    // 4. Cloud Edge Function (Web Push / Resend Email Notification via Supabase)
    if (isSupabaseConfigured() && supabase && extra?.email) {
      supabase.functions.invoke('notify-ticket', {
        body: {
          queueId: extra.queueId || '',
          queueName,
          ticketNumber,
          email: extra.email,
        },
      }).catch((err) => {
        console.warn('Supabase Edge Function notify-ticket error:', err);
      });
    }
  }
}

export const notificationService = new NotificationService();
